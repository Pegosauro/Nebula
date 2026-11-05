import { create } from "zustand";
import type { KnowledgeLinkReference } from "../../domain/knowledge";
import { dirname, ensureMarkdownExtension, joinVaultPath, normalizeRelativePath } from "../../domain/path";
import { findVaultEntry } from "../../domain/vault";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useKnowledgeStore } from "./knowledgeStore";

interface PendingKnowledgeNavigation {
  sourcePath: string;
  target: string;
  reference: KnowledgeLinkReference;
}

interface KnowledgeNavigationState {
  pending?: PendingKnowledgeNavigation;
  busy: boolean;
  error?: string;
  activate: (sourcePath: string, target: string) => void;
  choose: (path: string) => void;
  create: () => Promise<void>;
  cancel: () => void;
}

function openDocument(path: string): boolean {
  const snapshot = useVaultStore.getState().snapshot;
  if (!snapshot) return false;
  const entry = findVaultEntry(snapshot.root, path);
  if (!entry || entry.type !== "file") return false;
  useWorkspaceStore.getState().openEntry(entry);
  return true;
}

export const useKnowledgeNavigationStore = create<KnowledgeNavigationState>((set, get) => ({
  busy: false,
  activate: (sourcePath, target) => {
    const reference = useKnowledgeStore.getState().resolveLink(sourcePath, target);
    if (reference.resolvedPath && openDocument(reference.resolvedPath)) {
      set({ pending: undefined, error: undefined });
      return;
    }
    set({ pending: { sourcePath, target, reference }, error: undefined });
  },
  choose: (path) => {
    if (openDocument(path)) set({ pending: undefined, error: undefined });
    else set({ error: "La nota selezionata non è più disponibile nel Vault." });
  },
  create: async () => {
    const pending = get().pending;
    if (!pending || pending.reference.status !== "unresolved") return;
    set({ busy: true, error: undefined });
    try {
      const target = normalizeRelativePath(pending.target.replace(/\.md$/iu, ""));
      const targetParent = dirname(target);
      let currentParent = "";
      if (targetParent) {
        for (const segment of targetParent.split("/")) {
          const nextPath = joinVaultPath(currentParent, segment);
          const snapshot = useVaultStore.getState().snapshot;
          const existing = snapshot ? findVaultEntry(snapshot.root, nextPath) : undefined;
          if (existing && existing.type !== "directory") throw new Error(`“${nextPath}” esiste già e non è una cartella.`);
          if (!existing) await useVaultStore.getState().createFolder(currentParent, segment);
          currentParent = nextPath;
        }
      }
      const name = ensureMarkdownExtension(target.split("/").at(-1) || target);
      await useVaultStore.getState().createNote(currentParent, name);
      set({ pending: undefined, busy: false, error: undefined });
    } catch (error) {
      set({ busy: false, error: error instanceof Error ? error.message : "Impossibile creare la nota." });
    }
  },
  cancel: () => set({ pending: undefined, busy: false, error: undefined }),
}));
