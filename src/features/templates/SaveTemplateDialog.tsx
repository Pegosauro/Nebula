import { useEffect, useRef, useState } from "react";
import { Files, X } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton";
import { useVaultStore } from "../vault/vaultStore";

interface Props { title: string; content: string; sourcePath: string; hasUnsavedChanges: boolean; onClose: () => void; onSaved: (message: string) => void }
export function SaveTemplateDialog({ title, content, sourcePath, hasUnsavedChanges, onClose, onSaved }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(`${title} modello`);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const element = dialog.current; element?.showModal();
    return () => { if (element?.open) element.close(); };
  }, []);
  return <dialog ref={dialog} className="vault-dialog" aria-labelledby="save-template-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <form onSubmit={event => {
      event.preventDefault(); if (busy) return;
      setBusy(true); setError(undefined);
      void useVaultStore.getState().saveTemplate(name, content, sourcePath).then(path => {
        onSaved(`Modello salvato in ${path}. Disponibile dal pulsante Nuovo.`); onClose();
      }).catch(caught => setError(caught instanceof Error ? caught.message : "Impossibile salvare il modello.")).finally(() => setBusy(false));
    }}>
      <header className="vault-dialog-header"><span className="vault-dialog-icon"><Files size={19} /></span><div><h2 id="save-template-title">Salva come modello</h2><span>{title}</span></div><IconButton label="Chiudi" disabled={busy} onClick={onClose}><X size={17} /></IconButton></header>
      <div className="vault-dialog-body">
        <p className="template-hint">Crea una copia riutilizzabile nella cartella Modelli. La nota originale resta invariata.</p>
        {hasUnsavedChanges ? <p className="template-hint">La copia include anche le modifiche attualmente presenti nell’editor.</p> : null}
        <label className="field-label">Nome del modello<input autoFocus value={name} disabled={busy} onChange={event => setName(event.target.value)} /><span>Il titolo principale sarà adattato alle nuove note. Puoi usare {"{{titolo}}"} e {"{{data}}"} nel modello.</span></label>
        {error ? <p className="dialog-error" role="alert">{error}</p> : null}
      </div>
      <footer className="vault-dialog-footer"><button className="button button-secondary" type="button" disabled={busy} onClick={onClose}>Annulla</button><button className="button button-primary" type="submit" disabled={busy || !name.trim()}>{busy ? "Salvataggio…" : "Salva modello"}</button></footer>
    </form>
  </dialog>;
}
