import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { readNoteProperties, updateNoteProperty, type PropertyKey } from "../../domain/noteProperties";

function TextProperty({ label, value, disabled, hint, onCommit }: { label: string; value: string; disabled: boolean; hint?: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value), [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(value); }, [value, focused]);
  return <label className="note-property"><span>{label}</span><input aria-label={label} value={draft} disabled={disabled} onFocus={() => setFocused(true)} onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft !== value) onCommit(draft); setFocused(false); }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />{hint ? <small>{hint}</small> : null}</label>;
}
export function NotePropertiesPanel({ content, readOnly, onChange, onHide }: { content: string; readOnly: boolean; onChange: (content: string) => void; onHide: () => void }) {
  const { values, unsupported, malformed } = readNoteProperties(content);
  const [error, setError] = useState("");
  const change = (key: PropertyKey, value: string) => {
    try { onChange(updateNoteProperty(content, key, value)); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Impossibile aggiornare la proprietà."); }
  };
  const disabled = (key: PropertyKey) => readOnly || malformed || unsupported.includes(key);
  const select = (key: "type" | "status", label: string, options: Array<[string, string]>) => <label className="note-property"><span>{label}</span><select value={values[key]} disabled={disabled(key)} onChange={event => change(key, event.target.value)}><option value="">Nessuno</option>{values[key] && !options.some(([id]) => id === values[key]) ? <option value={values[key]}>{values[key]}</option> : null}{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
  return <section className="note-properties" aria-label="Proprietà della nota" id="note-properties">
    <div className="note-properties-heading"><strong>Proprietà</strong><span>Facoltative · salvate nel file Markdown</span><button type="button" className="icon-button" aria-label="Nascondi proprietà" onClick={onHide}><X size={16} /></button></div>
    <div className="note-properties-fields">
      {select("type", "Tipo", [["nota", "Nota"], ["procedura", "Procedura tecnica"], ["soluzione", "Problema e soluzione"]])}
      <TextProperty label="Categoria" value={values.category} disabled={disabled("category")} onCommit={value => change("category", value)} />
      {select("status", "Stato", [["bozza", "Bozza"], ["pronta", "Pronta"], ["da aggiornare", "Da aggiornare"], ["archiviata", "Archiviata"]])}
      <TextProperty label="Revisione" value={values.revision} disabled={disabled("revision")} onCommit={value => change("revision", value)} />
      <TextProperty label="Tag" value={values.tags} disabled={disabled("tags")} hint="Separati da virgole" onCommit={value => change("tags", value)} />
    </div>
    {malformed || unsupported.length ? <p className="template-hint" role="status">{malformed ? "Il frontmatter non è chiuso." : `Proprietà YAML avanzate: ${unsupported.join(", ")}.`} Modificale in Sorgente.</p> : null}
    {error ? <p className="dialog-error" role="alert">{error}</p> : null}
  </section>;
}
