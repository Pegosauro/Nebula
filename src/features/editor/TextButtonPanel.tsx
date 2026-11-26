import { CalendarDays, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { textButtonLimits, validTextButton, type TextButtonConfig } from "../../domain/textButtons";
import { EditorDialog } from "./EditorDialog";
import { noteDateFormats } from "./noteDates";
import type { TextButtonMenu } from "./textButtonEditing";

const formatLabels = {
  date: "GG/MM/AAAA",
  "long-date": "Data estesa",
  "date-time": "Data e ora",
  time: "Solo ora",
} satisfies Record<keyof typeof noteDateFormats, string>;

export function TextButtonPanel({ existing, onSave, onClose }: {
  existing?: TextButtonMenu;
  onSave: (config: TextButtonConfig | null) => boolean;
  onClose: () => void;
}) {
  const initial = existing?.block.config;
  const [position, setPosition] = useState<TextButtonConfig["position"]>(initial?.position ?? "after");
  const [canSave, setCanSave] = useState(validTextButton(initial));
  const [format, setFormat] = useState<keyof typeof noteDateFormats>("date");
  const [error, setError] = useState("");
  const name = useRef<HTMLInputElement>(null);
  const textarea = useRef<HTMLTextAreaElement>(null);

  function readDraft(): TextButtonConfig {
    return { label: name.current?.value ?? "", position, text: textarea.current?.value ?? "" };
  }

  function checkDraft() {
    const valid = validTextButton(readDraft());
    if (valid !== canSave) setCanSave(valid);
    if (error) setError("");
  }

  function save(value: TextButtonConfig | null) {
    if (onSave(value)) onClose();
    else setError(existing ? "Il pulsante è cambiato. Chiudi il menu e riaprilo." : "Sposta il cursore in un paragrafo della nota e riprova.");
  }

  function insertDate() {
    const element = textarea.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    const { token } = noteDateFormats[format];
    if (element.value.length - (end - start) + token.length > textButtonLimits.text) return;
    element.focus({ preventScroll: true });
    element.setRangeText(token, start, end, "end");
    checkDraft();
  }

  return <EditorDialog title={existing ? "Configura pulsante" : "Pulsante di testo"} anchor={existing?.anchor}
    onClose={onClose} className="text-button-dialog">
    <form onSubmit={event => { event.preventDefault(); const value = readDraft(); if (validTextButton(value)) save(value); }}>
      <div className="text-button-fields">
        <label className="editor-field">Nome
          <input ref={name} autoFocus defaultValue={initial?.label ?? ""} maxLength={textButtonLimits.label} required onChange={checkDraft} />
        </label>
        <div className="editor-field">
          <span>Posizione del testo</span>
          <div className="editor-panel-tabs" role="group" aria-label="Posizione del testo">
            {(["before", "after"] as const).map(option => <button type="button" key={option}
              aria-pressed={position === option} onClick={() => setPosition(option)}>
              {option === "before" ? "Prima" : "Dopo"}
            </button>)}
          </div>
        </div>
        <label className="editor-field">Testo da inserire
          <textarea ref={textarea} rows={4} defaultValue={initial?.text ?? ""} maxLength={textButtonLimits.text} required onChange={checkDraft} />
        </label>
        <div className="text-button-date">
          <button type="button" className="button button-secondary" onClick={insertDate}><CalendarDays size={15} />Inserisci data attuale</button>
          <select aria-label="Formato data" value={format} onChange={event => setFormat(event.target.value as typeof format)}>
            {Object.entries(formatLabels).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </div>
        {error && <p role="alert" className="editor-panel-error">{error}</p>}
      </div>
      <footer>
        {existing && <button type="button" className="button button-secondary" aria-label="Rimuovi pulsante" title="Rimuovi pulsante" onClick={() => save(null)}><Trash2 size={16} /></button>}
        <button type="submit" className="button button-primary" disabled={!canSave}>{existing ? "Salva" : "Inserisci pulsante"}</button>
      </footer>
    </form>
  </EditorDialog>;
}
