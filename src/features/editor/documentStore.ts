import { create } from "zustand";
import { clearEditorMemories, remapEditorMemories, removeEditorMemories } from "./editorSessionCache";
import { isPathInside } from "../../domain/path";
import { findVaultEntry, type VaultSnapshot } from "../../domain/vault";
import { readableFileSystemError } from "../../infrastructure/filesystem/filesystemErrors";
import { ExternalFileConflictError } from "../../infrastructure/filesystem/vaultFileOperations";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { vaultService } from "../vault/vaultService";

export type DocumentStatus = "loading" | "saved" | "dirty" | "saving" | "error" | "conflict";

export interface DocumentSession {
  path: string;
  loaded: boolean;
  content: string;
  savedContent: string;
  size: number;
  lastModified: number;
  status: DocumentStatus;
  error?: string;
  savedAt?: number;
  externalReloadedAt?: number;
  operationLocked?: boolean;
}

interface DocumentState {
  sessions: Record<string, DocumentSession>;
  open: (path: string) => Promise<void>;
  updateContent: (path: string, content: string) => void;
  save: (path: string) => Promise<void>;
  forceSave: (path: string) => Promise<void>;
  reloadFromDisk: (path: string) => Promise<void>;
  checkExternalChanges: () => Promise<void>;
  flushPaths: (basePath: string) => Promise<boolean>;
  remapPaths: (oldPath: string, newPath: string, snapshot?: VaultSnapshot) => void;
  removePaths: (path: string) => void;
  reset: () => void;
}

const AUTOSAVE_DELAY_MS = 900;
const autosaveTimers = new Map<string, ReturnType<typeof setTimeout>>();
const loadPromises = new Map<string, Promise<void>>();
const loadTokens = new Map<string, object>();
const savePromises = new Map<string, Promise<void>>();

function clearAutosave(path: string): void {
  const timer = autosaveTimers.get(path);
  if (timer) clearTimeout(timer);
  autosaveTimers.delete(path);
}

function clearAllAutosaves(): void {
  for (const timer of autosaveTimers.values()) clearTimeout(timer);
  autosaveTimers.clear();
}

function scheduleAutosave(path: string): void {
  clearAutosave(path);
  autosaveTimers.set(path, setTimeout(() => {
    autosaveTimers.delete(path);
    void useDocumentStore.getState().save(path);
  }, AUTOSAVE_DELAY_MS));
}

function updateSession(path: string, updater: (session: DocumentSession) => DocumentSession): void {
  useDocumentStore.setState((state) => {
    const current = state.sessions[path];
    if (!current) return state;
    return { sessions: { ...state.sessions, [path]: updater(current) } };
  });
}

async function performSave(path: string, force: boolean): Promise<void> {
  clearAutosave(path);
  const before = useDocumentStore.getState().sessions[path];
  if (!before || (!force && before.status === "conflict") || !before.loaded || before.status === "loading" || (!force && before.content === before.savedContent)) return;
  const contentToSave = before.content;
  updateSession(path, (session) => ({ ...session, status: "saving", error: undefined }));

  try {
    const metadata = await vaultService.writeText(
      path,
      contentToSave,
      force ? undefined : { size: before.size, lastModified: before.lastModified },
    );
    updateSession(path, (current) => {
      const changedDuringSave = current.content !== contentToSave;
      return {
        ...current,
        savedContent: contentToSave,
        size: metadata.size,
        lastModified: metadata.lastModified,
        status: changedDuringSave ? "dirty" : "saved",
        error: undefined,
        savedAt: Date.now(),
      };
    });
    const current = useDocumentStore.getState().sessions[path];
    if (current?.status === "dirty") scheduleAutosave(path);
    void useKnowledgeStore.getState().indexSavedDocument(path, contentToSave, metadata);
  } catch (error) {
    const conflict = error instanceof ExternalFileConflictError;
    updateSession(path, (current) => ({
      ...current,
      status: conflict ? "conflict" : "error",
      error: readableFileSystemError(error),
    }));
  }
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  sessions: {},
  open: async (path) => {
    const existingSession = get().sessions[path];
    if (existingSession?.loaded) return;
    const inFlight = loadPromises.get(path);
    if (inFlight) return inFlight;

    set((state) => ({
      sessions: {
        ...state.sessions,
        [path]: state.sessions[path] ?? {
          path,
          loaded: false,
          content: "",
          savedContent: "",
          size: 0,
          lastModified: 0,
          status: "loading",
        },
      },
    }));

    const token = {}; loadTokens.set(path, token);
    const load = (async () => {
      try {
        const snapshot = await vaultService.readText(path);
        if (loadTokens.get(path) !== token) return;
        set((state) => ({
          sessions: {
            ...state.sessions,
            [path]: {
              path,
              loaded: true,
              content: snapshot.content,
              savedContent: snapshot.content,
              size: snapshot.size,
              lastModified: snapshot.lastModified,
              status: "saved",
            },
          },
        }));
      } catch (error) {
        if (loadTokens.get(path) === token) updateSession(path, (session) => ({ ...session, status: "error", error: readableFileSystemError(error) }));
      } finally {
        if (loadTokens.get(path) === token) { loadPromises.delete(path); loadTokens.delete(path); }
      }
    })();
    loadPromises.set(path, load);
    return load;
  },
  updateContent: (path, content) => {
    set((state) => {
      const session = state.sessions[path];
      if (!session || session.operationLocked || !session.loaded || session.status === "loading" || session.content === content) return state;
      const dirty = content !== session.savedContent;
      return {
        sessions: {
          ...state.sessions,
          [path]: { ...session, content, status: session.status === "conflict" ? "conflict" : dirty ? "dirty" : "saved", error: session.status === "conflict" ? session.error : undefined },
        },
      };
    });
    const session = get().sessions[path];
    if (session?.status === "dirty") scheduleAutosave(path);
    else clearAutosave(path);
  },
  save: async (path) => {
    if (get().sessions[path]?.operationLocked) return;
    const existing = savePromises.get(path);
    if (existing) return existing;
    const save = performSave(path, false).finally(() => savePromises.delete(path));
    savePromises.set(path, save);
    return save;
  },
  forceSave: async (path) => {
    if (get().sessions[path]?.operationLocked) return;
    const existing = savePromises.get(path);
    if (existing) await existing;
    const save = performSave(path, true).finally(() => savePromises.delete(path));
    savePromises.set(path, save);
    return save;
  },
  reloadFromDisk: async (path) => {
    if (get().sessions[path]?.operationLocked) return;
    clearAutosave(path);
    try {
      const snapshot = await vaultService.readText(path);
      set((state) => ({
        sessions: {
          ...state.sessions,
          [path]: {
            path,
            loaded: true,
            content: snapshot.content,
            savedContent: snapshot.content,
            size: snapshot.size,
            lastModified: snapshot.lastModified,
            status: "saved",
            externalReloadedAt: Date.now(),
          },
        },
      }));
      void useKnowledgeStore.getState().indexSavedDocument(path, snapshot.content, snapshot);
    } catch (error) {
      updateSession(path, (session) => ({ ...session, status: "error", error: readableFileSystemError(error) }));
    }
  },
  checkExternalChanges: async () => {
    const sessions = Object.values(get().sessions).filter((session) => session.status !== "loading" && !session.operationLocked);
    await Promise.allSettled(sessions.map(async (session) => {
      try {
        const metadata = await vaultService.statText(session.path);
        if (metadata.size === session.size && metadata.lastModified === session.lastModified) return;
        const current = get().sessions[session.path];
        if (!current || current.operationLocked) return;
        if (current.content !== current.savedContent || current.status === "dirty" || current.status === "saving") {
          clearAutosave(session.path);
          updateSession(session.path, (item) => ({
            ...item,
            status: "conflict",
            error: "Il file è cambiato sul disco mentre erano presenti modifiche in Nebula.",
          }));
        } else {
          await get().reloadFromDisk(session.path);
        }
      } catch (error) {
        updateSession(session.path, (item) => ({ ...item, status: "error", error: readableFileSystemError(error) }));
      }
    }));
  },
  flushPaths: async (basePath) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const paths = Object.values(get().sessions)
        .filter((session) => isPathInside(session.path, basePath) && session.content !== session.savedContent)
        .map((session) => session.path);
      if (!paths.length) return true;
      await Promise.all(paths.map((path) => get().save(path)));
    }
    return !Object.values(get().sessions).some((session) =>
      isPathInside(session.path, basePath) && session.content !== session.savedContent,
    );
  },
  remapPaths: (oldPath, newPath, snapshot) => {
    remapEditorMemories(oldPath, newPath);
    const next: Record<string, DocumentSession> = {};
    for (const session of Object.values(get().sessions)) {
      if (!isPathInside(session.path, oldPath)) {
        next[session.path] = session;
        continue;
      }
      clearAutosave(session.path);
      const path = `${newPath}${session.path.slice(oldPath.length)}`;
      const entry = snapshot ? findVaultEntry(snapshot.root, path) : undefined;
      next[path] = { ...session, path, size: entry?.size ?? session.size, lastModified: entry?.modifiedAt ?? session.lastModified };
      if (session.content !== session.savedContent) scheduleAutosave(path);
    }
    set({ sessions: next });
  },
  removePaths: (path) => {
    for (const pending of loadTokens.keys()) if (isPathInside(pending, path)) { loadTokens.delete(pending); loadPromises.delete(pending); }
    removeEditorMemories(path);
    const next: Record<string, DocumentSession> = {};
    for (const session of Object.values(get().sessions)) {
      if (isPathInside(session.path, path)) clearAutosave(session.path);
      else next[session.path] = session;
    }
    set({ sessions: next });
  },
  reset: () => {
    clearEditorMemories();
    clearAllAutosaves();
    loadPromises.clear();
    loadTokens.clear();
    savePromises.clear();
    set({ sessions: {} });
  },
}));

const appendPromises = new Map<string, Promise<void>>();
/** Append only after saving an existing buffer, and refresh from disk under a
 * short editor lock. A failed append never changes the buffer or loses the draft. */
export function appendDocumentText(path: string, suffix: string, captureMarker?: string): Promise<void> {
  if (appendPromises.has(path)) return Promise.reject(new Error("Un appunto è già in corso di salvataggio."));
  const vaultId = vaultService.currentVaultId();
  const operation = Promise.resolve().then(async () => {
    const store = useDocumentStore.getState();
    await store.open(path);
    const initial = useDocumentStore.getState().sessions[path];
    if (!initial?.loaded) throw new Error(initial?.error ?? "Impossibile aprire il foglio degli appunti.");
    updateSession(path, session => ({ ...session, operationLocked: true }));
    clearAutosave(path);
    try {
      await savePromises.get(path);
      const before = useDocumentStore.getState().sessions[path];
      if (before?.status === "conflict") throw new Error("Risolvi il conflitto in Appunti veloci prima di aggiungere un altro appunto. Il testo qui resta disponibile.");
      await performSave(path, false);
      const current = useDocumentStore.getState().sessions[path];
      if (!current || current.content !== current.savedContent || current.status === "conflict") throw new Error(current?.error ?? "Impossibile salvare le modifiche già presenti nel foglio.");
      const disk = await vaultService.readText(path);
      if (vaultService.currentVaultId() !== vaultId || !useDocumentStore.getState().sessions[path]?.operationLocked) throw new Error("Il Vault è cambiato. Riprova nel Vault originale.");
      if (captureMarker && disk.content.includes(captureMarker)) {
        updateSession(path, session => ({ ...session, content: disk.content, savedContent: disk.content, size: disk.size, lastModified: disk.lastModified, status: "saved", error: undefined }));
        void useKnowledgeStore.getState().indexSavedDocument(path, disk.content, disk);
        return;
      }
      const newline = disk.content.includes("\r\n") ? "\r\n" : "\n";
      const content = disk.content + (disk.content.endsWith(newline + newline) ? "" : disk.content.endsWith(newline) ? newline : newline + newline) + suffix.replace(/\r?\n/g, newline);
      const metadata = await vaultService.writeText(path, content, { size: disk.size, lastModified: disk.lastModified });
      if (vaultService.currentVaultId() === vaultId) {
        updateSession(path, session => ({ ...session, content, savedContent: content, ...metadata, status: "saved", error: undefined, savedAt: Date.now() }));
        void useKnowledgeStore.getState().indexSavedDocument(path, content, metadata);
      }
    } finally { updateSession(path, session => ({ ...session, operationLocked: false })); }
  }).finally(() => appendPromises.delete(path));
  appendPromises.set(path, operation);
  return operation;
}
