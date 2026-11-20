import { GitBranch, FilePlus2, FolderOpen, FolderPlus, LoaderCircle, LogOut, RefreshCw, Replace, X } from "lucide-react";
import { useRef, useState } from "react";
import type { VaultEntry } from "../../domain/vault";
import { basename, dirname } from "../../domain/path";
import { IconButton } from "../../components/ui/IconButton";
import { PanelHeader } from "../../components/ui/PanelHeader";
import { useVaultStore } from "../vault/vaultStore";
import { FileTree, type FileTreeAction } from "./FileTree";
import { VaultOperationDialog, type VaultOperationRequest } from "./VaultOperationDialog";
import { useWorkspaceStore } from "../workspace/workspaceStore";

export function ExplorerPanel() {
  const status = useVaultStore((state) => state.status);
  const backupBusy = useVaultStore(state => state.backupBusy);
  const activeVaultId = useVaultStore(state => state.activeVaultId);
  const snapshot = useVaultStore((state) => state.snapshot);
  const savedVaultName = useVaultStore((state) => state.savedVaultName);
  const error = useVaultStore((state) => state.error);
  const chooseVault = useVaultStore((state) => state.chooseVault);
  const reconnect = useVaultStore((state) => state.reconnect);
  const refresh = useVaultStore((state) => state.refresh);
  const disconnect = useVaultStore((state) => state.disconnect);
  const clearError = useVaultStore((state) => state.clearError);
  const selectedEntry = useWorkspaceStore((state) => state.selectedEntry);
  const [request, setRequest] = useState<VaultOperationRequest>();
  const [notice, setNotice] = useState<string>();
  const [duplicating, setDuplicating] = useState(false);
  const operationPending = useRef(false);
  const [moving, setMoving] = useState(false);
  const action = async (next: FileTreeAction) => {
    if (operationPending.current) return;
    setNotice(undefined); clearError();
    if (next.type !== "duplicate") { setRequest(next); return; }
    operationPending.current = true; setDuplicating(true); setNotice("Duplicazione della nota…");
    try {
      await useVaultStore.getState().duplicateNote(next.entry);
      setNotice("Nota duplicata nella stessa cartella.");
    } catch { setNotice(undefined); /* The store exposes the error above the tree. */ }
    finally { operationPending.current = false; setDuplicating(false); }
  };

  const move = async (entry: VaultEntry, destination: string) => {
    if (operationPending.current) throw new Error("Attendi la fine dell’operazione in corso.");
    operationPending.current = true;
    setMoving(true);
    clearError();
    setNotice("Spostamento in corso…");
    try {
      const path = await useVaultStore.getState().moveEntry(entry, destination);
      setNotice(destination ? `Spostato in ${basename(destination)}.` : "Spostato nella radice del Vault.");
      return path;
    } catch (error) {
      setNotice(undefined);
      throw error;
    } finally {
      operationPending.current = false;
      setMoving(false);
    }
  };
  const loading = backupBusy || moving || status === "opening" || status === "restoring" || status === "scanning";
  const creationParent = selectedEntry?.type === "directory"
    ? selectedEntry.path
    : selectedEntry?.path ? dirname(selectedEntry.path) : "";

  return (
    <section className="side-panel explorer-panel" aria-label="Explorer">
      <PanelHeader
        title={snapshot?.name ?? savedVaultName ?? "Explorer"}
        actions={
          snapshot ? (
            <>
              <IconButton label="Nuovo" disabled={loading} onClick={() => setRequest({ type: "create-note", parentPath: creationParent })}>
                <FilePlus2 size={16} />
              </IconButton>
              <IconButton label="Nuovo configuratore" disabled={loading} onClick={() => { useWorkspaceStore.getState().activateTab("workspace-home"); useWorkspaceStore.getState().setActivity("configurators"); }}><GitBranch size={16}/></IconButton>
              <IconButton label="Nuova cartella" disabled={loading} onClick={() => setRequest({ type: "create-folder", parentPath: creationParent })}>
                <FolderPlus size={16} />
              </IconButton>
              <IconButton label="Aggiorna struttura" disabled={loading} onClick={() => void refresh()}>
                <RefreshCw size={16} />
              </IconButton>
              <IconButton label="Cambia Vault" disabled={loading} onClick={() => void chooseVault()}>
                <Replace size={16} />
              </IconButton>
              <IconButton label="Disconnetti Vault" disabled={loading} onClick={() => void disconnect()}>
                <LogOut size={16} />
              </IconButton>
            </>
          ) : null
        }
      />

      {snapshot && (notice || error) ? (
        <div className={`explorer-feedback ${error ? "is-error" : ""}`} role={error ? "alert" : "status"}>
          <span>{error || notice}</span>
          <button type="button" aria-label="Chiudi messaggio" onClick={() => { setNotice(undefined); clearError(); }}><X size={14} /></button>
        </div>
      ) : null}

      {snapshot ? (
        snapshot.root.length ? (
          <div className="explorer-scroll">
            <FileTree vaultId={activeVaultId} entries={snapshot.root} vaultRevision={snapshot.scannedAt} duplicating={duplicating} onMove={loading || duplicating || request ? undefined : move} onAction={next => { if (!backupBusy) void action(next); }} />
          </div>
        ) : (
          <div className="panel-empty compact-empty">
            <FolderOpen size={28} />
            <strong>Il Vault è vuoto</strong>
            <span>Le nuove note verranno mostrate qui.</span>
          </div>
        )
      ) : (
        <div className="panel-empty compact-empty">
          {loading ? <LoaderCircle className="spin" size={30} /> : <FolderOpen size={30} />}
          <strong>{loading ? "Accesso al Vault…" : "Nessun Vault collegato"}</strong>
          <span>{error || "Apri una cartella locale per iniziare."}</span>
          {status === "needs-permission" ? (
            <button className="button button-secondary" type="button" onClick={() => void reconnect()}>
              Riconnetti Vault
            </button>
          ) : null}
        </div>
      )}

      {request && snapshot ? (
        <VaultOperationDialog
          request={request}
          snapshot={snapshot}
          onClose={() => setRequest(undefined)}
          onCompleted={(message) => { setNotice(message); clearError(); }}
        />
      ) : null}
    </section>
  );
}
