import { useEffect, useRef, useState } from "react";
import { Plus, Search, ImagePlus, FilePlus2, Link2 } from "lucide-react";
import { insertCommands, type InsertCommand } from "./insertCommands";
import type { KnowledgeSuggestion } from "../../domain/knowledge";
import { withoutMarkdownExtension } from "../../domain/path";
import { IMAGE_ACCEPT } from "../../infrastructure/filesystem/vaultImages";

import { EditorDialog } from "./EditorDialog";
export { EditorDialog } from "./EditorDialog";

export function InsertPanel({ help, onCommand, onClose }: { help?: boolean; onCommand: (command: InsertCommand) => void; onClose: () => void }) {
  const [query, setQuery] = useState(""); const [selected, setSelected] = useState(0);
  const items = insertCommands.filter(c => `${c.label} ${c.group} ${c.keywords}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  useEffect(() => { buttons.current[selected]?.scrollIntoView({ block: "nearest" }); }, [selected]);
  return <EditorDialog title={help ? "Guida dell’editor" : "Inserisci elemento"} onClose={onClose} wide={help}>
    <div className="editor-dialog-search"><Search size={18} /><input autoFocus placeholder={help ? "Cerca una funzione o una formattazione…" : "Cerca: tabella, immagine, checklist…"} aria-label="Cerca funzione" value={query} onChange={e => { setQuery(e.target.value); setSelected(0); }} onKeyDown={e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); setSelected(i => Math.max(0, Math.min(items.length - 1, i + (e.key === "ArrowDown" ? 1 : -1)))); }
      if (e.key === "Enter" && items[selected]) { e.preventDefault(); onCommand(items[selected]); }
    }} /></div>
    {help && <p className="editor-panel-hint">Scrivi è anche l’anteprima: i simboli compaiono solo sull’elemento vicino al cursore e restano nascosti quando selezioni testo. Sorgente mostra tutto il Markdown. In Scrivi apri un collegamento con un clic; Alt+clic ti permette di modificarlo. Puoi usare anche Ctrl/⌘ Invio. Aspetto della pagina regola testo e larghezza anche in lettura. Usa / a inizio riga per inserire; Ctrl/⌘ Z annulla. Trascina o incolla immagini per salvarle nel Vault.</p>}
    <div className="insert-command-list">{items.map((command, index) => <button type="button" key={command.id} ref={el => { buttons.current[index] = el; }} className={selected === index ? "is-highlighted" : ""} onClick={() => onCommand(command)}>
      <span><strong>{command.label}</strong><small>{command.group}{command.shortcut ? ` · ${command.shortcut}` : ""}</small></span>
      {help ? <code>{command.syntax}</code> : <Plus size={15} />}
    </button>)}{!items.length && <p className="editor-panel-hint">Nessun risultato. Prova “lista”, “titolo” o “link”.</p>}</div>
    <footer><span>{help ? "Seleziona una funzione per usarla nella nota." : "↑ ↓ per scegliere · Invio per inserire · Esc per chiudere"}</span></footer>
  </EditorDialog>;
}
function linkLabel(value: string) { return value.replace(/([\[\]\\])/g, "\\$1").replace(/\r?\n/g, " "); }
export function LinkPanel({ suggestions, selectedText, onInsert, onCreate, onClose }: { suggestions: KnowledgeSuggestion[]; selectedText: string; onInsert: (markdown: string) => void; onCreate: (name: string) => Promise<string>; onClose: () => void }) {
  const [kind, setKind] = useState<"note" | "url">("note"), [query, setQuery] = useState(""), [label, setLabel] = useState(selectedText), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const results = suggestions.filter(s => `${s.label} ${s.path} ${s.aliases.join(" ")}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const insertNote = (path: string) => onInsert(`[[${withoutMarkdownExtension(path)}${label.trim() ? `|${label.trim().replace(/[\[\]|\r\n]/g, " ")}` : ""}]]`);
  return <EditorDialog title="Inserisci collegamento" onClose={onClose}>
    <div className="editor-panel-tabs"><button type="button" aria-pressed={kind === "note"} onClick={() => { setKind("note"); setQuery(""); }}>Nota del Vault</button><button type="button" aria-pressed={kind === "url"} onClick={() => { setKind("url"); setQuery(""); }}>Sito o email</button></div>
    <label className="editor-field">Testo del collegamento<input value={label} placeholder="Facoltativo" onChange={e => setLabel(e.target.value)} /></label>
    <label className="editor-field">{kind === "note" ? "Cerca una nota" : "Indirizzo"}<input autoFocus value={query} placeholder={kind === "note" ? "Nome, percorso o alias…" : "https://… oppure mailto:…"} onChange={e => { setQuery(e.target.value); setError(""); }} /></label>
    {kind === "note" ? <div className="note-picker-results">{results.slice(0, 100).map(s => <button type="button" key={s.path} onClick={() => insertNote(s.path)}><Link2 size={17} /><span><strong>{s.label}</strong><small>{withoutMarkdownExtension(s.path)}</small></span></button>)}{!results.length && <p>Nessuna nota trovata.</p>}
      {query.trim() && !suggestions.some(s => s.label.toLowerCase() === query.trim().toLowerCase()) && <button type="button" disabled={busy} onClick={async () => { setBusy(true); try { insertNote(await onCreate(query.trim())); } catch(e) { setError(e instanceof Error ? e.message : "Creazione non riuscita."); } finally { setBusy(false); } }}><FilePlus2 size={17} />{busy ? "Creazione…" : `Crea “${query.trim()}” e collega`}</button>}
    </div> : <footer><button className="button button-primary" type="button" disabled={!query.trim()} onClick={() => {
      const url = query.trim();
      try { const parsed = new URL(url); if (!["http:", "https:", "mailto:"].includes(parsed.protocol)) throw new Error(); onInsert(`[${linkLabel(label.trim() || url)}](${url.replace(/[\s()<>]/g, c => `%${c.charCodeAt(0).toString(16)}`)})`); }
      catch { setError("Inserisci un indirizzo completo https:// oppure mailto:."); }
    }}>Inserisci collegamento</button></footer>}
    {error && <p role="alert" className="editor-panel-error">{error}</p>}
  </EditorDialog>;
}
export function ImagePanel({ onFiles, onReference, onClose }: { onFiles: (files: File[]) => void; onReference: (reference: string, alt: string) => void; onClose: () => void }) {
  const [reference, setReference] = useState(""), [alt, setAlt] = useState(""), [error, setError] = useState("");
  return <EditorDialog title="Inserisci immagine" onClose={onClose}>
    <label className="image-file-picker"><ImagePlus size={28} /><strong>Scegli immagini dal dispositivo</strong><span>PNG, JPG, GIF, WebP, AVIF o BMP · fino a 20 MB ciascuna</span><input type="file" accept={IMAGE_ACCEPT} multiple aria-label="Scegli immagini" onChange={e => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); }} /></label>
    <p className="editor-panel-hint">Le immagini selezionate vengono copiate nella cartella attachments del Vault. Puoi anche trascinarle o incollarle nella nota.</p>
    <label className="editor-field">Oppure percorso nel Vault / URL<input value={reference} placeholder="attachments/foto.png oppure https://…" onChange={e => setReference(e.target.value)} /></label>
    <label className="editor-field">Descrizione dell’immagine<input value={alt} onChange={e => setAlt(e.target.value)} placeholder="Descrivi il contenuto" /></label>
    {error && <p role="alert" className="editor-panel-error">{error}</p>}
    <footer><button type="button" className="button button-primary" disabled={!reference.trim()} onClick={() => { const ref = reference.trim(); if (/^(?!https?:)[a-z][a-z\d+.-]*:|^\/\//i.test(ref)) { setError("Usa un percorso nel Vault oppure un URL http/https."); return; } onReference(ref, alt); }}>Inserisci riferimento</button></footer>
  </EditorDialog>;
}
export { TablePanel } from "./TablePanel";
