import { findVaultEntry } from "../../domain/vault";
import { useVaultStore } from "../vault/vaultStore";
import { useEffect, useMemo, useRef, useState } from "react";
import { NotebookPen, X } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton";
import { QUICK_NOTES_PATH, openQuickNotes, saveQuickNote } from "./quickNotes";

export function QuickNoteDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const snapshot = useVaultStore(state => state.snapshot);
  const hasSheet = useMemo(() => !!snapshot && !!findVaultEntry(snapshot.root, QUICK_NOTES_PATH), [snapshot]);
  const capture = useRef<{ text: string; date: Date; id: string } | undefined>(undefined);
  const dialog = useRef<HTMLDialogElement>(null), pending = useRef(false);
  const input = useRef<HTMLTextAreaElement>(null);
  const draft = useRef("");
  const [hasText, setHasText] = useState(false);
  const [busy, setBusy] = useState(false), [discard, setDiscard] = useState(false), [error, setError] = useState("");
  const close = () => { if (pending.current) return; if (/\S/u.test(draft.current)) setDiscard(true); else onClose(); };
  useEffect(() => { const element = dialog.current; element?.showModal(); input.current?.focus(); return () => { if (element?.open) element.close(); }; }, []);
  return <dialog ref={dialog} className="vault-dialog quick-note-dialog" aria-labelledby="quick-note-title" onCancel={event => { event.preventDefault(); close(); }}>
    <form onSubmit={event => {
      event.preventDefault(); const text = draft.current; if (pending.current || !text.trim()) return;
      pending.current = true; setBusy(true); setDiscard(false); setError("");
      if (capture.current?.text !== text) capture.current = { text, date: new Date(), id: crypto.randomUUID() };
      void saveQuickNote(text, capture.current.date, capture.current.id).then(onSaved).catch(caught => setError(caught instanceof Error ? caught.message : "Impossibile salvare l’appunto.")).finally(() => { pending.current = false; setBusy(false); });
    }}>
      <header className="vault-dialog-header"><span className="vault-dialog-icon"><NotebookPen size={19} /></span><div><h2 id="quick-note-title">Nota veloce</h2><span>Un appunto alla volta, nello stesso foglio</span></div><IconButton label="Chiudi nota veloce" disabled={busy} onClick={close}><X size={17} /></IconButton></header>
      <div className="vault-dialog-body">
        <textarea ref={input} autoFocus className="quick-note-input" aria-label="Testo dell’appunto" defaultValue="" disabled={busy} onChange={event => {
          // The browser owns the live value, selection, undo and IME composition.
          // React only updates controls when empty/nonempty or discard state changes.
          draft.current = event.target.value;
          const nextHasText = /\S/u.test(draft.current);
          if (nextHasText !== hasText) setHasText(nextHasText);
          if (discard) setDiscard(false);
        }} />
        <p className="template-hint">Si aggiunge in fondo ad Appunti veloci.md con data e ora locali.</p>
        {error ? <p className="dialog-error" role="alert">{error}</p> : null}
        {discard ? <div className="quick-note-discard" role="alert"><span>Scartare questo appunto non salvato?</span><button type="button" className="button button-secondary" onClick={() => setDiscard(false)}>Continua a scrivere</button><button type="button" className="button button-danger" onClick={onClose}>Scarta appunto</button></div> : null}
      </div>
      <footer className="vault-dialog-footer">{hasSheet && <button type="button" className="button button-secondary" disabled={busy || hasText} onClick={() => { onClose(); openQuickNotes(); }}>Apri foglio</button>}<button type="button" className="button button-secondary" disabled={busy} onClick={close}>Annulla</button><button type="submit" className="button button-primary" disabled={busy || !hasText}>{busy ? "Salvataggio…" : "Aggiungi appunto"}</button></footer>
    </form>
  </dialog>;
}
