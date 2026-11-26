import { flushTaskSession, reloadTaskSession, updateLinkedTaskPaths } from "../tasks/taskSession";
import { useConfiguratorStore } from "../configurator/configuratorStore";
import { useTreeStore } from "../trees/treeStore";
import { create } from "zustand";
import { dirname, isPathInside } from "../../domain/path";
import { findVaultEntry, type RecentVault, type VaultEntry, type VaultScanProgress, type VaultSnapshot } from "../../domain/vault";
import { readableFileSystemError } from "../../infrastructure/filesystem/filesystemErrors";
import { useDocumentStore } from "../editor/documentStore";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useSearchStore } from "../search/searchStore";
import { vaultService } from "./vaultService";
import type { VaultBackupStatus } from "./vaultBackupManager";
import type { VaultBackupChoice, VaultBackupReview } from "../../infrastructure/filesystem/vaultBackup";

export type VaultStatus =
  | "idle"
  | "restoring"
  | "needs-permission"
  | "opening"
  | "scanning"
  | "ready"
  | "unsupported"
  | "error";

interface VaultState {
  initialized: boolean;
  status: VaultStatus;
  snapshot?: VaultSnapshot;
  activeVaultId?: string;
  savedVaultName?: string;
  recentVaults: RecentVault[];
  progress?: VaultScanProgress;
  error?: string;
  backup?: VaultBackupStatus;
  backupBusy: boolean;
  backupError?: string;
  backupReview?: VaultBackupReview;
  configureBackup: () => Promise<void>;
  disableBackup: () => Promise<void>;
  syncBackup: () => Promise<void>;
  openBackup: () => Promise<void>;
  reviewBackup: () => Promise<void>;
  dismissBackupReview: () => void;
  applyBackup: (choices: ReadonlyMap<string, VaultBackupChoice>) => Promise<void>;
  initialize: () => Promise<void>;
  chooseVault: () => Promise<void>;
  openTestVault: () => Promise<void>;
  reconnect: () => Promise<void>;
  openRecent: (id: string) => Promise<void>;
  refresh: () => Promise<void>;
  disconnect: () => Promise<void>;
  createNote: (parentPath: string, name: string, openDocument?: boolean, content?: string) => Promise<string>;
  duplicateNote: (entry: VaultEntry) => Promise<string>;
  saveTemplate: (name: string, content: string, sourcePath: string) => Promise<string>;
  createFolder: (parentPath: string, name: string) => Promise<string>;
  renameEntry: (entry: VaultEntry, name: string) => Promise<string>;
  moveEntry: (entry: VaultEntry, targetDirectoryPath: string) => Promise<string>;
  deleteEntry: (entry: VaultEntry) => Promise<void>;
  setFolderOpeningNote: (path: string, enabled: boolean) => Promise<void>;
  clearError: () => void;
}

const service = vaultService;
const readableError = readableFileSystemError;

export const useVaultStore = create<VaultState>((set, get) => {
  const setProgress = (progress: VaultScanProgress) => set({ status: "scanning", progress, error: undefined });

  const flushDocuments = async () => {
    const documents = useDocumentStore.getState();
    for (const path of Object.keys(documents.sessions)) {
      if (!await documents.flushPaths(path)) throw new Error("Salva o risolvi i conflitti delle note prima di cambiare cartella.");
    }
    if (!await useConfiguratorStore.getState().flush() || !await useTreeStore.getState().flush() || !await flushTaskSession(get().activeVaultId)) {
      throw new Error("Salva o risolvi i conflitti di configuratori, strutture e task prima di cambiare cartella.");
    }
  };

  const backupAction = async (action: () => Promise<void>) => {
    if (get().backupBusy) return;
    set({ backupBusy: true, backupError: undefined });
    try { await action(); }
    catch (error) { set({ backupError: readableError(error) || undefined }); }
    finally { set({ backupBusy: false }); }
  };

  const replaceActiveSnapshot = (snapshot: VaultSnapshot, savedVaultName?: string) => {
    useConfiguratorStore.getState().reset();
    useTreeStore.getState().reset();
    useDocumentStore.getState().reset();
    useKnowledgeStore.getState().reset();
    useSearchStore.getState().reset();
    useWorkspaceStore.getState().resetDocuments();
    if (useWorkspaceStore.getState().activity !== "settings") useWorkspaceStore.getState().setActivity("files");
    const activeVaultId = service.currentVaultId();
    set({ status: "ready", snapshot, activeVaultId, savedVaultName, progress: undefined, error: undefined });
    reloadTaskSession(activeVaultId);
    void useKnowledgeStore.getState().rebuild(snapshot);
  };

  const loadSaved = async (): Promise<void> => {
    const snapshot = await service.resumeSaved(setProgress);
    set({
      status: "ready",
      snapshot,
      activeVaultId: service.currentVaultId(),
      savedVaultName: snapshot.name,
      recentVaults: await service.recentVaults(),
      progress: undefined,
      error: undefined,
    });
    useKnowledgeStore.getState().reset();
    useSearchStore.getState().reset();
    void useKnowledgeStore.getState().rebuild(snapshot);
  };

  const completeMutation = (snapshot: VaultSnapshot) => {
    set({ status: "ready", snapshot, activeVaultId: service.currentVaultId(), savedVaultName: get().backup?.usingBackup ? get().savedVaultName : snapshot.name, progress: undefined, error: undefined });
  };

  const syncKnowledgeAfterMutation = (
    snapshot: VaultSnapshot,
    mutation: () => Promise<void>,
  ): void => {
    if (useKnowledgeStore.getState().status === "indexing") {
      void useKnowledgeStore.getState().rebuild(snapshot);
    } else {
      void mutation();
    }
  };

  const failMutation = (error: unknown): never => {
    const message = readableError(error);
    set({ status: get().snapshot ? "ready" : "error", error: message, progress: undefined });
    throw new Error(message);
  };

  return {
    initialized: false,
    status: "idle",
    recentVaults: [],
    backupBusy: false,
    configureBackup: () => backupAction(() => service.configureBackup()),
    disableBackup: () => backupAction(() => service.disableBackup()),
    syncBackup: () => backupAction(async () => {
      if (get().backup?.pending) await service.authorizeBackup();
      else await service.syncBackup();
    }),
    openBackup: () => backupAction(async () => {
      const current = get();
      if (current.status === "ready" || current.status === "opening" || current.status === "scanning") return;
      // Permission is requested from the click, before asynchronous saves or directory reads.
      if (current.snapshot) {
        await service.authorizeBackup();
        await flushDocuments();
      }
      const snapshot = await service.openBackup();
      replaceActiveSnapshot(snapshot, current.savedVaultName);
    }),
    reviewBackup: () => backupAction(async () => {
      await service.authorizePrimary();
      await flushDocuments();
      set({ backupReview: await service.reviewBackup() });
    }),
    dismissBackupReview: () => { if (!get().backupBusy) set({ backupReview: undefined, backupError: undefined }); },
    applyBackup: (choices) => backupAction(async () => {
      const review = get().backupReview;
      if (!review) return;
      await flushDocuments();
      const snapshot = await service.applyBackup(review, choices);
      replaceActiveSnapshot(snapshot, snapshot.name);
      set({ backupReview: undefined });
    }),
    initialize: async () => {
      if (get().initialized) return;
      set({ initialized: true, status: "restoring", error: undefined });

      if (!service.isSupported() && !navigator.storage?.getDirectory) {
        set({ status: "unsupported" });
        return;
      }

      try {
        const recentVaults = await service.recentVaults();
        set({ recentVaults });
        const probe = await service.probeSaved();
        if (!probe.exists) {
          set({ status: service.isSupported() ? "idle" : "unsupported", recentVaults });
          return;
        }
        set({ savedVaultName: probe.name });
        if (probe.permission === "granted") {
          await loadSaved();
          return;
        }
        set({
          status: "needs-permission",
          savedVaultName: probe.name,
          recentVaults,
          error: probe.permission === "denied" ? "L'accesso al Vault è stato revocato." : undefined,
        });
      } catch (error) {
        set({ status: get().backup ? "needs-permission" : "error", error: readableError(error), progress: undefined });
      }
    },
    openTestVault: async () => {
      if (get().backupBusy || ["opening", "scanning", "restoring"].includes(get().status)) return;
      const previous = get();
      set({ status: "opening", error: undefined });
      try {
        for (const path of Object.keys(useDocumentStore.getState().sessions)) {
          if (!await useDocumentStore.getState().flushPaths(path)) throw new Error("Salva o risolvi i conflitti delle note prima di aprire il Vault di prova.");
        }
        if (!await useConfiguratorStore.getState().flush()) throw new Error("Salva o risolvi i conflitti dei configuratori prima di aprire il Vault di prova.");
        if (!await useTreeStore.getState().flush()) throw new Error("Salva o risolvi i conflitti delle strutture prima di aprire il Vault di prova.");
        const snapshot = await service.openTestVault(setProgress);
        useConfiguratorStore.getState().reset(); useTreeStore.getState().reset(); useDocumentStore.getState().reset();
        useKnowledgeStore.getState().reset(); useSearchStore.getState().reset(); useWorkspaceStore.getState().resetDocuments();
        useWorkspaceStore.getState().setActivity("files");
        set({ status: "ready", snapshot, activeVaultId: service.currentVaultId(), savedVaultName: snapshot.name, recentVaults: await service.recentVaults(), progress: undefined });
        void useKnowledgeStore.getState().rebuild(snapshot);
      } catch (error) { set({ status: previous.snapshot ? "ready" : "error", snapshot: previous.snapshot, error: readableError(error), progress: undefined }); }
    },
    chooseVault: async () => {
      if (get().backupBusy) return;
      if (get().backup?.usingBackup) {
        try { await flushDocuments(); } catch (error) { set({ error: readableError(error) }); return; }
      }
      if (!await useConfiguratorStore.getState().flush()) { set({error:"Salva o risolvi i conflitti dei configuratori prima di cambiare Vault."}); return; }
      if (!await useTreeStore.getState().flush()) { set({error:"Salva o risolvi i conflitti delle strutture prima di cambiare Vault."}); return; }
      const previous = get();
      set({ status: "opening", error: undefined, progress: undefined });
      try {
        const snapshot = await service.openFromPicker(setProgress);
        useConfiguratorStore.getState().reset();
        useTreeStore.getState().reset();
        useDocumentStore.getState().reset();
        useKnowledgeStore.getState().reset();
        useSearchStore.getState().reset();
        useWorkspaceStore.getState().resetDocuments();
        set({
          status: "ready",
          snapshot,
          activeVaultId: service.currentVaultId(),
          savedVaultName: snapshot.name,
          recentVaults: await service.recentVaults(),
          progress: undefined,
        });
        void useKnowledgeStore.getState().rebuild(snapshot);
      } catch (error) {
        const message = readableError(error);
        if (!message) {
          set({
            status: previous.snapshot ? "ready" : "idle",
            snapshot: previous.snapshot,
            savedVaultName: previous.savedVaultName,
          });
          return;
        }
        set({ status: "error", error: message, snapshot: previous.snapshot });
      }
    },
    reconnect: async () => {
      if (get().backupBusy) return;
      if (get().backup?.usingBackup) return get().reviewBackup();
      set({ status: "opening", error: undefined });
      try {
        const snapshot = await service.reconnectSaved(setProgress);
        set({
          status: "ready",
          snapshot,
          activeVaultId: service.currentVaultId(),
          savedVaultName: snapshot.name,
          recentVaults: await service.recentVaults(),
          progress: undefined,
        });
        useKnowledgeStore.getState().reset();
        void useKnowledgeStore.getState().rebuild(snapshot);
      } catch (error) {
        set({ status: "needs-permission", error: readableError(error) });
      }
    },
    openRecent: async (id) => {
      if (get().backupBusy) return;
      if (get().backup?.usingBackup) {
        try { await flushDocuments(); } catch (error) { set({ error: readableError(error) }); return; }
      }
      if (!await useConfiguratorStore.getState().flush()) { set({error:"Salva o risolvi i conflitti dei configuratori prima di cambiare Vault."}); return; }
      if (!await useTreeStore.getState().flush()) { set({error:"Salva o risolvi i conflitti delle strutture prima di cambiare Vault."}); return; }
      useConfiguratorStore.getState().reset();
      useTreeStore.getState().reset();
      set({ status: "opening", error: undefined, progress: undefined });
      try {
        const probe = await service.selectRecent(id);
        set({ savedVaultName: probe.name, snapshot: undefined, activeVaultId: undefined });
        useWorkspaceStore.getState().resetDocuments();
        useDocumentStore.getState().reset();
        if (probe.permission !== "granted") {
          set({
            status: "needs-permission",
            savedVaultName: probe.name,
            error: probe.permission === "denied" ? "L'accesso a questo Vault è stato revocato." : undefined,
          });
          return;
        }
        await loadSaved();
        useWorkspaceStore.getState().setActivity("files");
      } catch (error) {
        set({ status: get().backup ? "needs-permission" : "error", error: readableError(error), progress: undefined });
      }
    },
    refresh: async () => {
      if (!get().snapshot || get().backupBusy) return;
      try {
        const snapshot = await service.refreshActive(setProgress);
        set({ status: "ready", snapshot, activeVaultId: service.currentVaultId(), progress: undefined, error: undefined });
        service.scheduleBackup();
        void useKnowledgeStore.getState().rebuild(snapshot);
      } catch (error) {
        set({ status: get().backup ? "needs-permission" : "error", error: readableError(error), progress: undefined });
      }
    },
    disconnect: async () => {
      if (get().backupBusy) return;
      if (get().backup?.usingBackup) {
        try { await flushDocuments(); } catch (error) { set({ error: readableError(error) }); return; }
      }
      if (!await useConfiguratorStore.getState().flush()) { set({error:"Salva o risolvi i conflitti dei configuratori prima di disconnettere il Vault."}); return; }
      if (!await useTreeStore.getState().flush()) { set({error:"Salva o risolvi i conflitti delle strutture prima di disconnettere il Vault."}); return; }
      useConfiguratorStore.getState().reset();
      useTreeStore.getState().reset();
      await service.disconnect();
      useDocumentStore.getState().reset();
      useKnowledgeStore.getState().reset();
      useSearchStore.getState().reset();
      useWorkspaceStore.getState().resetDocuments();
      set({
        status: "idle",
        snapshot: undefined,
        activeVaultId: undefined,
        savedVaultName: undefined,
        recentVaults: await service.recentVaults(),
        progress: undefined,
        error: undefined,
      });
    },
    createNote: async (parentPath, name, openDocument = true, content) => {
      try {
        const result = await service.createNote(parentPath, name, content);
        completeMutation(result.snapshot);
        const entry = findVaultEntry(result.snapshot.root, result.path);
        if (entry && openDocument) useWorkspaceStore.getState().openEntry(entry, false, true);
        syncKnowledgeAfterMutation(result.snapshot, () => useKnowledgeStore.getState().addDocument(result.path));
        return result.path;
      } catch (error) {
        return failMutation(error);
      }
    },
    duplicateNote: async (entry) => {
      try {
        const session = useDocumentStore.getState().sessions[entry.path];
        if (session?.operationLocked) throw new Error("Attendi il completamento dell’operazione sulla nota e riprova.");
        const result = await service.duplicateNote(entry, session?.loaded ? session.content : undefined);
        completeMutation(result.snapshot);
        const copy = findVaultEntry(result.snapshot.root, result.path);
        if (copy) useWorkspaceStore.getState().openEntry(copy, false, true);
        syncKnowledgeAfterMutation(result.snapshot, () => useKnowledgeStore.getState().addDocument(result.path));
        return result.path;
      } catch (error) { return failMutation(error); }
    },
    saveTemplate: async (name, content, sourcePath) => {
      try {
        const result = await service.saveTemplate(name, content, sourcePath);
        completeMutation(result.snapshot);
        syncKnowledgeAfterMutation(result.snapshot, () => useKnowledgeStore.getState().addDocument(result.path));
        return result.path;
      } catch (error) {
        return failMutation(error);
      }
    },
    createFolder: async (parentPath, name) => {
      try {
        const result = await service.createFolder(parentPath, name);
        completeMutation(result.snapshot);
        const entry = findVaultEntry(result.snapshot.root, result.path);
        if (entry) useWorkspaceStore.getState().selectEntry(entry);
        return result.path;
      } catch (error) {
        return failMutation(error);
      }
    },
    renameEntry: async (entry, name) => {
      try {
        if (!await useConfiguratorStore.getState().flush(entry.path)) throw new Error("Risolvi il salvataggio del configuratore prima di rinominare o spostare l'elemento.");
        if (!await useTreeStore.getState().flush(entry.path)) throw new Error("Risolvi il salvataggio della struttura prima di rinominare o spostare l'elemento.");
        const flushed = await useDocumentStore.getState().flushPaths(entry.path);
        if (!flushed) throw new Error("Salva o risolvi le modifiche aperte prima di rinominare l'elemento.");
        const result = await service.rename(entry, name);
        completeMutation(result.snapshot);
        useConfiguratorStore.getState().remove(entry.path);
        useTreeStore.getState().remove(entry.path);
        useDocumentStore.getState().remapPaths(entry.path, result.path, result.snapshot);
        syncKnowledgeAfterMutation(result.snapshot, () => useKnowledgeStore.getState().remapPaths(entry.path, result.path));
        useWorkspaceStore.getState().remapEntryPaths(entry.path, result.path, result.snapshot);
        const vaultId = service.currentVaultId();
        if (vaultId && (entry.type === "directory" || entry.extension === ".md")) void updateLinkedTaskPaths(vaultId, entry.path, result.path);
        return result.path;
      } catch (error) {
        return failMutation(error);
      }
    },
    moveEntry: async (entry, targetDirectoryPath) => {
      try {
        if (!await useConfiguratorStore.getState().flush(entry.path)) throw new Error("Risolvi il salvataggio del configuratore prima di rinominare o spostare l'elemento.");
        if (!await useTreeStore.getState().flush(entry.path)) throw new Error("Risolvi il salvataggio della struttura prima di rinominare o spostare l'elemento.");
        const flushed = await useDocumentStore.getState().flushPaths(entry.path);
        if (!flushed) throw new Error("Salva o risolvi le modifiche aperte prima di spostare l'elemento.");
        const result = await service.move(entry, targetDirectoryPath);
        completeMutation(result.snapshot);
        useConfiguratorStore.getState().remove(entry.path);
        useTreeStore.getState().remove(entry.path);
        useDocumentStore.getState().remapPaths(entry.path, result.path, result.snapshot);
        syncKnowledgeAfterMutation(result.snapshot, () => useKnowledgeStore.getState().remapPaths(entry.path, result.path));
        useWorkspaceStore.getState().remapEntryPaths(entry.path, result.path, result.snapshot);
        const vaultId = service.currentVaultId();
        if (vaultId && (entry.type === "directory" || entry.extension === ".md")) void updateLinkedTaskPaths(vaultId, entry.path, result.path);
        return result.path;
      } catch (error) {
        return failMutation(error);
      }
    },
    deleteEntry: async (entry) => {
      try {
        if (!await useConfiguratorStore.getState().flush(entry.path)) throw new Error("Risolvi il salvataggio del configuratore prima di eliminare l'elemento.");
        if (!await useTreeStore.getState().flush(entry.path)) throw new Error("Risolvi il salvataggio della struttura prima di eliminare l'elemento.");
        const snapshot = await service.delete(entry);
        useConfiguratorStore.getState().remove(entry.path);
        useTreeStore.getState().remove(entry.path);
        completeMutation(snapshot);
        useDocumentStore.getState().removePaths(entry.path);
        syncKnowledgeAfterMutation(snapshot, () => useKnowledgeStore.getState().removePaths(entry.path));
        useWorkspaceStore.getState().removeEntryPaths(entry.path);
      } catch (error) {
        failMutation(error);
      }
    },
    setFolderOpeningNote: async (path, enabled) => {
      const vaultId = get().activeVaultId;
      if (!vaultId || get().backupBusy || get().status !== "ready") throw new Error("Il Vault non è disponibile per la modifica.");
      const parent = dirname(path);
      const openingNoteName = await service.setFolderOpeningNote(path, enabled);
      set(state => {
        if (!state.snapshot || state.activeVaultId !== vaultId) return state;
        const update = (entries: VaultEntry[]): VaultEntry[] => entries.map(entry => {
          if (entry.path === parent && entry.children?.some(child => child.path === path)) {
            return { ...entry, openingNoteName };
          }
          if (entry.children && isPathInside(parent, entry.path)) return { ...entry, children: update(entry.children) };
          return entry;
        });
        return { snapshot: { ...state.snapshot, root: update(state.snapshot.root) } };
      });
    },
    clearError: () => set({ error: undefined }),
  };
});

service.observeBackup(backup => useVaultStore.setState({ backup }));
