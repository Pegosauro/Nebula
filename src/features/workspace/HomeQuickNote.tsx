import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Check, NotebookPen } from "lucide-react";
import { saveQuickNote } from "../notes/quickNotes";

interface Draft { text: string; capture?: { text: string; id: string; date: Date }; operation?: Promise<void> }
const drafts = new Map<string, Draft>();

export function HomeQuickNote({ vaultId }: { vaultId: string }) {
  const input = useRef<HTMLTextAreaElement>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const mounted = useRef(true);
  const [initial] = useState(() => ({ text: drafts.get(vaultId)?.text ?? "", pending: drafts.get(vaultId)?.operation }));
  const [hasText, setHasText] = useState(() => Boolean(initial.text.trim()));
  const [busy, setBusy] = useState(() => Boolean(initial.pending));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const watchSave = useCallback(async (operation: Promise<void>, trigger?: Element | null) => {
    const field = input.current;
    setBusy(true);
    setError("");
    setSaved(false);
    clearTimeout(timeout.current);
    try {
      await operation;
      if (!mounted.current || !field) return;
      field.value = "";
      setHasText(false);
      setSaved(true);
      if (trigger && (document.activeElement === trigger || document.activeElement === document.body)) field.focus({ preventScroll: true });
      clearTimeout(timeout.current);
      timeout.current = setTimeout(() => setSaved(false), 2300);
    } catch (caught) {
      if (mounted.current) setError(caught instanceof Error && caught.message ? caught.message : "Impossibile salvare l’appunto.");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (initial.pending) void watchSave(initial.pending);
    return () => { mounted.current = false; clearTimeout(timeout.current); };
  }, [initial.pending, watchSave]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = input.current?.value;
    const previous = drafts.get(vaultId);
    if (!text?.trim() || previous?.operation) return;
    const capture = previous?.capture?.text === text ? previous.capture : { text, id: crypto.randomUUID(), date: new Date() };
    const draft: Draft = { text, capture };
    const operation = saveQuickNote(text, capture.date, capture.id).then(() => {
      if (drafts.get(vaultId) === draft) drafts.delete(vaultId);
    }).finally(() => { draft.operation = undefined; });
    draft.operation = operation;
    drafts.set(vaultId, draft);
    void watchSave(operation, event.currentTarget.contains(document.activeElement) ? document.activeElement : undefined);
  }

  return <section className="home-card home-note" aria-labelledby="home-note-title">
    <h2 id="home-note-title" className="home-card-title"><NotebookPen size={20} aria-hidden="true" />Appunto veloce</h2>
    <form onSubmit={submit} className="home-note-form" aria-busy={busy}>
      <textarea ref={input} aria-label="Scrivi un appunto" placeholder="Scrivi un appunto…" readOnly={busy} defaultValue={initial.text}
        onChange={event => {
          const text = event.currentTarget.value;
          if (text) drafts.set(vaultId, { text }); else drafts.delete(vaultId);
          const next = Boolean(text.trim());
          if (next !== hasText) setHasText(next);
          if (error) setError("");
          if (saved) { setSaved(false); clearTimeout(timeout.current); }
        }}
        onKeyDown={event => {
          if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey) || event.nativeEvent.isComposing) return;
          event.preventDefault();
          if (!event.repeat) event.currentTarget.form?.requestSubmit();
        }} />
      {error && <p className="home-error" role="alert">{error}</p>}
      <div className="home-note-footer">
        <kbd>Ctrl / ⌘ + Invio</kbd>
        <div className="home-note-action">
          {saved && <span className="home-note-saved" role="status"><Check size={17} aria-hidden="true" />Appunto salvato</span>}
          <button type="submit" className="home-text-action" disabled={busy || !hasText} hidden={saved}>{busy ? "Salvataggio…" : "Salva appunto"}</button>
        </div>
      </div>
    </form>
  </section>;
}
