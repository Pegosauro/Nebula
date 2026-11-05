import { useConfiguratorStore } from "../configurator/configuratorStore";
import { create } from "zustand";
import { findVaultEntry, type RecentVault, type VaultEntry, type VaultScanProgress, type VaultSnapshot } from "../../domain/vault";
import { readableFileSystemError } from "../../infrastructure/filesystem/filesystemErrors";
import { useDocumentStore } from "../editor/documentStore";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useSearchStore } from "../search/searchStore";
import { vaultService } from "./vaultService";

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
  clearError: () => void;
}

const service = vaultService;
const readableError = readableFileSystemError;

export const useVaultStore = create<VaultState>((set, get) => {
  const setProgress = (progress: VaultScanProgress) => set({ status: "scanning", progress, error: undefined });

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
    set({ status: "ready", snapshot, activeVaultId: service.currentVaultId(), savedVaultName: snapshot.name, progress: undefined, error: undefined });
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
    initialize: async () => {
      if (get().initialized) return;
      set({ initialized: true, status: "restoring", error: undefined });

      if (!service.isSupported() && !navigator.storage?.getDirectory) {
        set({ status: "unsupported" });
        return;
      }

      try {
        const recentVaults = await service.recentVaults();
        const probe = await service.probeSaved();
        if (!probe.exists) {
          set({ status: service.isSupported() ? "idle" : "unsupported", recentVaults });
          return;
        }
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
        set({ status: "error", error: readableError(error) });
      }
    },
    openTestVault: async () => {
      if (["opening", "scanning", "restoring"].includes(get().status)) return;
      const previous = get();
      set({ status: "opening", error: undefined });
      try {
        for (const path of Object.keys(useDocumentStore.getState().sessions)) {
          if (!await useDocumentStore.getState().flushPaths(path)) throw new Error("Salva o risolvi i conflitti delle note prima di aprire il Vault di prova.");
        }
        if (!await useConfiguratorStore.getState().flush()) throw new Error("Salva o risolvi i conflitti dei configuratori prima di aprire il Vault di prova.");
        const snapshot = await service.openTestVault(setProgress);
        useConfiguratorStore.getState().reset(); useDocumentStore.getState().reset();
        useKnowledgeStore.getState().reset(); useSearchStore.getState().reset(); useWorkspaceStore.getState().resetDocuments();
        useWorkspaceStore.getState().setActivity("files");
        set({ status: "ready", snapshot, activeVaultId: service.currentVaultId(), savedVaultName: snapshot.name, recentVaults: await service.recentVaults(), progress: undefined });
        void useKnowledgeStore.getState().rebuild(snapshot);
      } catch (error) { set({ status: previous.snapshot ? "ready" : "error", snapshot: previous.snapshot, error: readableError(error), progress: undefined }); }
    },
    chooseVault: async () => {
      if (!await useConfiguratorStore.getState().flush()) { set({error:"Salva o risolvi i conflitti dei configuratori prima di cambiare Vault."}); return; }
      const previous = get();
      set({ status: "opening", error: undefined, progress: undefined });
      try {
        const snapshot = await service.openFromPicker(setProgress);
        useConfiguratorStore.getState().reset();
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
      if (!await useConfiguratorStore.getState().flush()) { set({error:"Salva o risolvi i conflitti dei configuratori prima di cambiare Vault."}); return; }
      useConfiguratorStore.getState().reset();
      set({ status: "opening", error: undefined, progress: undefined });
      try {
        const probe = await service.selectRecent(id);
        if (probe.permission !== "granted") {
          set({
            status: "needs-permission",
            savedVaultName: probe.name,
            error: probe.permission === "denied" ? "L'accesso a questo Vault è stato revocato." : undefined,
          });
          return;
        }
        useWorkspaceStore.getState().resetDocuments();
        useDocumentStore.getState().reset();
        await loadSaved();
        useWorkspaceStore.getState().setActivity("files");
      } catch (error) {
        set({ status: "error", error: readableError(error) });
      }
    },
    refresh: async () => {
      if (!get().snapshot) return;
      try {
        const snapshot = await service.resumeSaved(setProgress);
        set({ status: "ready", snapshot, activeVaultId: service.currentVaultId(), progress: undefined, error: undefined });
        void useKnowledgeStore.getState().rebuild(snapshot);
      } catch (error) {
        set({ status: "error", error: readableError(error), progress: undefined });
      }
    },
    disconnect: async () => {
      if (!await useConfiguratorStore.getState().flush()) { set({error:"Salva o risolvi i conflitti dei configuratori prima di disconnettere il Vault."}); return; }
      useConfiguratorStore.getState().reset();
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
        const flushed = await useDocumentStore.getState().flushPaths(entry.path);
        if (!flushed) throw new Error("Salva o risolvi le modifiche aperte prima di rinominare l'elemento.");
        const result = await service.rename(entry, name);
        completeMutation(result.snapshot);
        useConfiguratorStore.getState().remove(entry.path);
        useDocumentStore.getState().remapPaths(entry.path, result.path, result.snapshot);
        syncKnowledgeAfterMutation(result.snapshot, () => useKnowledgeStore.getState().remapPaths(entry.path, result.path));
        useWorkspaceStore.getState().remapEntryPaths(entry.path, result.path, result.snapshot);
        return result.path;
      } catch (error) {
        return failMutation(error);
      }
    },
    moveEntry: async (entry, targetDirectoryPath) => {
      try {
        if (!await useConfiguratorStore.getState().flush(entry.path)) throw new Error("Risolvi il salvataggio del configuratore prima di rinominare o spostare l'elemento.");
        const flushed = await useDocumentStore.getState().flushPaths(entry.path);
        if (!flushed) throw new Error("Salva o risolvi le modifiche aperte prima di spostare l'elemento.");
        const result = await service.move(entry, targetDirectoryPath);
        completeMutation(result.snapshot);
        useConfiguratorStore.getState().remove(entry.path);
        useDocumentStore.getState().remapPaths(entry.path, result.path, result.snapshot);
        syncKnowledgeAfterMutation(result.snapshot, () => useKnowledgeStore.getState().remapPaths(entry.path, result.path));
        useWorkspaceStore.getState().remapEntryPaths(entry.path, result.path, result.snapshot);
        return result.path;
      } catch (error) {
        return failMutation(error);
      }
    },
    deleteEntry: async (entry) => {
      try {
        if (!await useConfiguratorStore.getState().flush(entry.path)) throw new Error("Risolvi il salvataggio del configuratore prima di eliminare l'elemento.");
        const snapshot = await service.delete(entry);
        useConfiguratorStore.getState().remove(entry.path);
        completeMutation(snapshot);
        useDocumentStore.getState().removePaths(entry.path);
        syncKnowledgeAfterMutation(snapshot, () => useKnowledgeStore.getState().removePaths(entry.path));
        useWorkspaceStore.getState().removeEntryPaths(entry.path);
      } catch (error) {
        failMutation(error);
      }
    },
    clearError: () => set({ error: undefined }),
  };
});
