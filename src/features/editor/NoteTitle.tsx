import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Pencil } from "lucide-react";
import { ensureMarkdownExtension, withoutMarkdownExtension } from "../../domain/path";
import { findVaultEntry } from "../../domain/vault";
import { useVaultStore } from "../vault/vaultStore";

/** Title keystrokes stay local until the name is confirmed. */
export function NoteTitle({ path, title, disabled }: { path: string; title: string; disabled?: boolean }) {
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(title);
  const [saving, setSaving] = useState(false), [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null), button = useRef<HTMLButtonElement>(null);
  const pending = useRef(false), cancelled = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (editing) { input.current?.focus(); input.current?.select(); } }, [editing]);
  const finish = (restoreFocus = false) => { setEditing(false); if (restoreFocus) requestAnimationFrame(() => button.current?.focus()); };
  const submit = async (restoreFocus = false) => {
    if (pending.current || cancelled.current || disabled) return;
    try {
      const name = withoutMarkdownExtension(ensureMarkdownExtension(draft));
      if (name === title) { finish(restoreFocus); return; }
      const store = useVaultStore.getState();
      const entry = findVaultEntry(store.snapshot?.root ?? [], path);
      if (!entry) throw new Error("La nota non è più disponibile. Aggiorna l’albero e riprova.");
      pending.current = true; setSaving(true); setError("");
      await store.renameEntry(entry, name);
      if (mounted.current) finish(restoreFocus);
    } catch (caught) {
      if (mounted.current) { setError(caught instanceof Error ? caught.message : "Impossibile rinominare la nota."); requestAnimationFrame(() => input.current?.focus()); }
    } finally { pending.current = false; if (mounted.current) setSaving(false); }
  };
  return <div className="note-title-control">
    {editing ? <form className="note-title-form" onSubmit={event => { event.preventDefault(); void submit(true); }}>
      <input ref={input} aria-label="Titolo della nota" aria-invalid={!!error} aria-describedby={error ? "note-title-error" : undefined} value={draft} disabled={saving || disabled} autoComplete="off" spellCheck={false}
        onChange={event => { setDraft(event.target.value); setError(""); }} onBlur={() => { void submit(); }}
        onKeyDown={event => {
          if (event.nativeEvent.isComposing) { if (event.key === "Enter") event.preventDefault(); return; }
          if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); cancelled.current = true; if (!pending.current) finish(true); }
          if (event.key.toLowerCase() === "s" && (event.ctrlKey || event.metaKey)) { event.preventDefault(); event.stopPropagation(); void submit(true); }
        }} />
      {saving && <LoaderCircle className="spin" size={15} aria-label="Rinomina in corso" />}
    </form> : <h1><button ref={button} type="button" className="note-title-trigger" aria-label="Modifica titolo della nota" title={disabled ? "Sblocca la nota per modificarne il titolo" : "Modifica titolo · Invio per salvare · Esc per annullare"} disabled={disabled}
      onClick={() => { cancelled.current = false; setDraft(title); setError(""); setEditing(true); }}><span>{title}</span><Pencil size={13} aria-hidden="true" /></button></h1>}
    {error && <span id="note-title-error" className="note-title-error" role="alert">{error}</span>}
  </div>;
}
