import { useEffect, useId, useMemo, useState } from "react";
import { Link2, X } from "lucide-react";
import { basename, dirname, withoutMarkdownExtension } from "../../domain/path";
import { findVaultEntry, folderOpeningNote } from "../../domain/vault";
import { readableFileSystemError } from "../../infrastructure/filesystem/filesystemErrors";
import { useVaultStore } from "../vault/vaultStore";
import { readNoteProperties, updateNoteProperty, type PropertyKey } from "../../domain/noteProperties";

function TextProperty({ label, value, disabled, hint, onCommit }: { label: string; value: string; disabled: boolean; hint?: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useState(value), [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused) setDraft(value); }, [value, focused]);
  return <label className="note-property"><span>{label}</span><input aria-label={label} value={draft} disabled={disabled} onFocus={() => setFocused(true)} onChange={event => setDraft(event.target.value)} onBlur={() => { if (draft !== value) onCommit(draft); setFocused(false); }} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />{hint ? <small>{hint}</small> : null}</label>;
}
function FolderOpeningNoteProperty({ path, readOnly }: { path: string; readOnly: boolean }) {
  const entries = useVaultStore(state => state.snapshot?.root);
  const disabled = useVaultStore(state => state.status !== "ready" || state.backupBusy);
  const change = useVaultStore(state => state.setFolderOpeningNote);
  const parent = dirname(path);
  const folder = useMemo(() => entries && parent ? findVaultEntry(entries, parent) : undefined, [entries, parent]);
  const note = folderOpeningNote(folder);
  const isOpeningNote = note?.path === path;
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  if (!parent || !folder?.children?.some(entry => entry.path === path)) return null;
  const folderName = basename(parent);
  const hint = isOpeningNote ? `Nota di apertura di «${folderName}»`
    : note ? `«${folderName}» apre «${withoutMarkdownExtension(note.name)}». Attiva per sostituirla.`
    : `Cartella padre · ${folderName}`;

  async function setOpeningNote(enabled: boolean) {
    setPending(true);
    setError("");
    try { await change(path, enabled); }
    catch (error) { setError(readableFileSystemError(error) || "Impossibile aggiornare la nota di apertura."); }
    finally { setPending(false); }
  }

  return <>
    <label className={`note-folder-opening${isOpeningNote ? " is-active" : ""}`}>
      <span className="note-folder-opening-icon" aria-hidden="true"><Link2 size={17} /></span>
      <span className="note-folder-opening-copy">
        <strong id={`${id}-label`}>Apri questa nota dalla cartella padre</strong>
        <small id={`${id}-hint`}>{hint}</small>
      </span>
      <input type="checkbox" role="switch" aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`}
        checked={isOpeningNote} disabled={disabled || readOnly || pending} onChange={event => void setOpeningNote(event.target.checked)} />
    </label>
    {error && <p className="dialog-error" role="alert">{error}</p>}
  </>;
}

export function NotePropertiesPanel({ path, content, readOnly, onChange, onHide }: { path: string; content: string; readOnly: boolean; onChange: (content: string) => void; onHide: () => void }) {
  const { values, unsupported, malformed } = readNoteProperties(content);
  const [error, setError] = useState("");
  const change = (key: PropertyKey, value: string) => {
    try { onChange(updateNoteProperty(content, key, value)); setError(""); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Impossibile aggiornare la proprietà."); }
  };
  const disabled = (key: PropertyKey) => readOnly || malformed || unsupported.includes(key);
  const select = (key: "type" | "status", label: string, options: Array<[string, string]>) => <label className="note-property"><span>{label}</span><select value={values[key]} disabled={disabled(key)} onChange={event => change(key, event.target.value)}><option value="">Nessuno</option>{values[key] && !options.some(([id]) => id === values[key]) ? <option value={values[key]}>{values[key]}</option> : null}{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
  return <section className="note-properties" aria-label="Proprietà della nota" id="note-properties">
    <div className="note-properties-heading"><strong>Proprietà</strong><span>Impostazioni facoltative</span><button type="button" className="icon-button" aria-label="Nascondi proprietà" onClick={onHide}><X size={16} /></button></div>
    <div className="note-properties-fields">
      {select("type", "Tipo", [["nota", "Nota"], ["procedura", "Procedura tecnica"], ["soluzione", "Problema e soluzione"]])}
      <TextProperty label="Categoria" value={values.category} disabled={disabled("category")} onCommit={value => change("category", value)} />
      {select("status", "Stato", [["bozza", "Bozza"], ["pronta", "Pronta"], ["da aggiornare", "Da aggiornare"], ["archiviata", "Archiviata"]])}
      <TextProperty label="Revisione" value={values.revision} disabled={disabled("revision")} onCommit={value => change("revision", value)} />
      <TextProperty label="Tag" value={values.tags} disabled={disabled("tags")} hint="Separati da virgole" onCommit={value => change("tags", value)} />
    </div>
    <FolderOpeningNoteProperty path={path} readOnly={readOnly} />
    {malformed || unsupported.length ? <p className="template-hint" role="status">{malformed ? "Il frontmatter non è chiuso." : `Proprietà YAML avanzate: ${unsupported.join(", ")}.`} Modificale in Sorgente.</p> : null}
    {error ? <p className="dialog-error" role="alert">{error}</p> : null}
  </section>;
}
