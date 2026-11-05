import { useConfiguratorStore } from "../configurator/configuratorStore";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton";
import { useDocumentStore } from "../editor/documentStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";

export function CloseNotesDialog({ count, onClose }: { count: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);

  const confirm = async () => {
    if (busy) return;
    setBusy(true); setError(undefined);
    try {
      const notes = useWorkspaceStore.getState().tabs.filter(tab => tab.kind === "document");
      const saved = await Promise.all(notes.map(tab => tab.path ? useDocumentStore.getState().flushPaths(tab.path) : true));
      if (saved.some(result => !result) || !await useConfiguratorStore.getState().flush()) {
        setError("Non è stato possibile salvare tutte le modifiche. Le note restano aperte: risolvi gli errori o i conflitti e riprova.");
        return;
      }
      useWorkspaceStore.getState().resetDocuments();
      onClose();
    } catch {
      setError("Non è stato possibile salvare tutte le modifiche. Le note restano aperte. Riprova.");
    } finally { setBusy(false); }
  };

  return <dialog ref={ref} className="vault-dialog close-notes-dialog" aria-labelledby="close-notes-title" aria-describedby="close-notes-description" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form method="dialog" onSubmit={event => { event.preventDefault(); void confirm(); }}>
      <header className="vault-dialog-header">
        <span className="vault-dialog-icon is-danger"><X size={19} /></span>
        <div><h2 id="close-notes-title">Chiudere tutte le note?</h2></div>
        <IconButton label="Annulla chiusura" disabled={busy} onClick={onClose}><X size={17} /></IconButton>
      </header>
      <div className="vault-dialog-body">
        <p id="close-notes-description">Verranno chiuse tutte le {count} note aperte. Le modifiche saranno salvate prima della chiusura.</p>
        {error && <p className="dialog-error" role="alert">{error}</p>}
      </div>
      <footer className="vault-dialog-footer">
        <button type="button" className="button" autoFocus disabled={busy} onClick={onClose}>Annulla</button>
        <button type="submit" className="button button-danger" disabled={busy}>{busy ? "Salvataggio…" : "Chiudi tutte"}</button>
      </footer>
    </form>
  </dialog>;
}
