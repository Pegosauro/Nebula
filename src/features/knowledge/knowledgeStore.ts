import { navigationKnowledge } from "../configurator/navigationKnowledge";
import { create } from "zustand";
import type {
  KnowledgeIndexData,
  KnowledgeLinkReference,
  KnowledgeSourceDocument,
} from "../../domain/knowledge";
import { extensionOf } from "../../domain/path";
import { resolveKnowledgeTarget } from "../../domain/resolveKnowledge";
import type { VaultEntry, VaultSnapshot } from "../../domain/vault";
import { readableFileSystemError } from "../../infrastructure/filesystem/filesystemErrors";
import type { ExpectedFileMetadata } from "../../infrastructure/filesystem/vaultFileOperations";
import { SearchIndexCacheRepository } from "../../infrastructure/storage/searchIndexCacheRepository";
import { vaultService } from "../vault/vaultService";
import { indexWorkerClient } from "./indexWorkerClient";

export type KnowledgeStatus = "idle" | "indexing" | "ready" | "error";

interface KnowledgeState extends KnowledgeIndexData {
  status: KnowledgeStatus;
  progress: number;
  total: number;
  revision: number;
  error?: string;
  rebuild: (snapshot: VaultSnapshot) => Promise<void>;
  indexSavedDocument: (path: string, content: string, metadata?: ExpectedFileMetadata) => Promise<void>;
  addDocument: (path: string) => Promise<void>;
  removePaths: (basePath: string) => Promise<void>;
  remapPaths: (oldPath: string, newPath: string) => Promise<void>;
  reset: () => void;
  resolveLink: (sourcePath: string, target: string) => KnowledgeLinkReference;
}

const emptyData: KnowledgeIndexData = {
  documents: {},
  suggestions: [],
  documentCount: 0,
  linkCount: 0,
  unresolvedCount: 0,
  ambiguousCount: 0,
};

const client = indexWorkerClient;
const cacheRepository = new SearchIndexCacheRepository();
let generation = 0;
const pendingSavedDocuments = new Map<string, KnowledgeSourceDocument>();

function collectMarkdownEntries(entries: VaultEntry[], output: VaultEntry[] = []): VaultEntry[] {
  for (const entry of entries) {
    if (entry.type === "file" && entry.extension === ".md") output.push(entry);
    if (entry.children) collectMarkdownEntries(entry.children, output);
  }
  return output;
}

async function readDocuments(entries: VaultEntry[], onProgress: (value: number) => void): Promise<KnowledgeSourceDocument[]> {
  const documents = new Array<KnowledgeSourceDocument>(entries.length);
  const changed: KnowledgeSourceDocument[] = [];
  const vaultId = vaultService.currentVaultId();
  const cached = vaultId ? await cacheRepository.getVault(vaultId).catch(() => new Map()) : new Map();
  let cursor = 0;
  let completed = 0;
  let lastProgress = 0;
  const worker = async () => {
    while (cursor < entries.length) {
      const index = cursor++;
      const entry = entries[index];
      if (!entry) continue;
      const cachedDocument = cached.get(entry.path);
      if (cachedDocument && cachedDocument.size === entry.size && cachedDocument.lastModified === entry.modifiedAt) {
        documents[index] = cachedDocument;
      } else {
        const snapshot = await vaultService.readText(entry.path);
        const document = { path: entry.path, content: snapshot.content, size: snapshot.size, lastModified: snapshot.lastModified };
        documents[index] = document;
        changed.push(document);
      }
      completed += 1;
      const now = performance.now();
      if (completed === entries.length || now - lastProgress >= 100) { onProgress(completed); lastProgress = now; }
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, entries.length) }, worker));
  if (vaultId) {
    await cacheRepository.synchronize(vaultId, changed, new Set(entries.map((entry) => entry.path))).catch(() => undefined);
  }
  return documents;
}

function asReference(target: string, candidates: string[]): KnowledgeLinkReference {
  return {
    raw: `[[${target}]]`,
    target,
    display: target.split("/").at(-1) || target,
    start: 0,
    end: target.length + 4,
    candidates,
    status: candidates.length === 1 ? "resolved" : candidates.length > 1 ? "ambiguous" : "unresolved",
    resolvedPath: candidates.length === 1 ? candidates[0] : undefined,
  };
}

export const useKnowledgeStore = create<KnowledgeState>((set, get) => ({
  ...emptyData,
  status: "idle",
  progress: 0,
  total: 0,
  revision: 0,
  rebuild: async (snapshot) => {
    const currentGeneration = ++generation;
    pendingSavedDocuments.clear();
    const entries = collectMarkdownEntries(snapshot.root);
    set({ status: "indexing", progress: 0, total: entries.length, error: undefined });
    try {
      const documents = await readDocuments(entries, (progress) => {
        if (generation === currentGeneration) set({ progress });
      });
      if (generation !== currentGeneration) return;
      let data = await client.rebuild(documents);
      while (generation === currentGeneration && pendingSavedDocuments.size) {
        const updates = [...pendingSavedDocuments.entries()];
        pendingSavedDocuments.clear();
        for (const document of updates.map(([, value]) => value)) data = await client.update(document);
      }
      if (generation !== currentGeneration) return;
      set((state) => ({ ...data, status: "ready", progress: entries.length, total: entries.length, revision: state.revision + 1 }));
    } catch (error) {
      if (generation !== currentGeneration) return;
      set({ status: "error", error: readableFileSystemError(error) || "Impossibile indicizzare i collegamenti." });
    }
  },
  indexSavedDocument: async (path, content, metadata) => {
    if (extensionOf(path) !== ".md") return;
    const document = { path, content, size: metadata?.size, lastModified: metadata?.lastModified };
    const vaultId = vaultService.currentVaultId();
    if (vaultId && metadata) void cacheRepository.put(vaultId, document).catch(() => undefined);
    if (get().status === "indexing") {
      pendingSavedDocuments.set(path, document);
      return;
    }
    try {
      const data = await client.update(document);
      set((state) => ({ ...data, status: "ready", error: undefined, revision: state.revision + 1 }));
    } catch (error) {
      set({ status: "error", error: readableFileSystemError(error) || "Impossibile aggiornare i collegamenti." });
    }
  },
  addDocument: async (path) => {
    if (extensionOf(path) !== ".md") return;
    const snapshot = await vaultService.readText(path);
    await get().indexSavedDocument(path, snapshot.content, snapshot);
  },
  removePaths: async (basePath) => {
    try {
      const data = await client.remove(basePath);
      const vaultId = vaultService.currentVaultId();
      if (vaultId) void cacheRepository.remove(vaultId, basePath).catch(() => undefined);
      set((state) => ({ ...data, status: "ready", error: undefined, revision: state.revision + 1 }));
    } catch (error) {
      set({ status: "error", error: readableFileSystemError(error) });
    }
  },
  remapPaths: async (oldPath, newPath) => {
    try {
      const data = await client.remap(oldPath, newPath);
      const vaultId = vaultService.currentVaultId();
      if (vaultId) void cacheRepository.remap(vaultId, oldPath, newPath).catch(() => undefined);
      set((state) => ({ ...data, status: "ready", error: undefined, revision: state.revision + 1 }));
    } catch (error) {
      set({ status: "error", error: readableFileSystemError(error) });
    }
  },
  reset: () => {
    generation += 1;
    pendingSavedDocuments.clear();
    void client.reset();
    set((state) => ({ ...emptyData, status: "idle", progress: 0, total: 0, revision: state.revision + 1, error: undefined }));
  },
  resolveLink: (sourcePath, target) => {
    const direct = get().documents[sourcePath]?.outgoing.find((link) => link.target === target);
    const candidates = resolveKnowledgeTarget(target, navigationKnowledge().documents);
    return direct ? { ...direct, ...asReference(target,candidates) } : asReference(target, candidates);
  },
}));
