import { Bold, Italic, Strikethrough, Highlighter, Code2, List, ListOrdered, ListTodo, Link2, Plus, Search, CircleHelp, Undo2, Redo2, Maximize2, Minimize2, Table2 } from "lucide-react";
import type { EditorApi, EditorPanel, EditorUiState } from "./editorCommands";
import type { FormatAction } from "./markdownTools";
const formats: Array<{ action: FormatAction; label: string; icon: typeof Bold; shortcut?: string }> = [
  { action: "bold", label: "Grassetto", icon: Bold, shortcut: "Ctrl/⌘ B" },
  { action: "italic", label: "Corsivo", icon: Italic, shortcut: "Ctrl/⌘ I" },
  { action: "strike", label: "Barrato", icon: Strikethrough, shortcut: "Ctrl/⌘ Shift X" },
  { action: "highlight", label: "Evidenziatore", icon: Highlighter, shortcut: "Ctrl/⌘ Shift H" },
  { action: "inlineCode", label: "Codice in linea", icon: Code2 },
  { action: "bullet", label: "Elenco puntato", icon: List },
  { action: "ordered", label: "Elenco numerato", icon: ListOrdered },
  { action: "task", label: "Checklist", icon: ListTodo },
];
interface Props { api: EditorApi | null; state?: EditorUiState; onPanel: (panel: EditorPanel) => void; focus: boolean; onFocus: () => void; floating?: boolean }
export function EditorToolbar({ api, state, onPanel, focus, onFocus, floating = false }: Props) {
  return <div className={floating ? "selection-format-bar" : "editor-toolbar"} role="toolbar" aria-label={floating ? "Formatta selezione" : "Formattazione nota"} onMouseDown={event => { if ((event.target as HTMLElement).closest("button")) event.preventDefault(); }}>
    {!floating && <div className="editor-tools-group">
      <button type="button" title="Annulla (Ctrl/⌘ Z)" aria-label="Annulla" disabled={!state?.canUndo} onClick={() => api?.undo()}><Undo2 size={17} /></button>
      <button type="button" title="Ripristina (Ctrl/⌘ Shift Z)" aria-label="Ripristina" disabled={!state?.canRedo} onClick={() => api?.redo()}><Redo2 size={17} /></button>
    </div>}
    {!floating && <select aria-label="Stile del paragrafo" value={state?.active.find(a => /^h\d$/.test(a)) ?? "paragraph"} onChange={e => api?.format(e.target.value as FormatAction)}>
      <option value="paragraph">Testo</option>{[1,2,3,4,5,6].map(n => <option key={n} value={`h${n}`}>Titolo {n}</option>)}
    </select>}
    <div className="editor-tools-group">{formats.slice(0, floating ? 4 : 5).map(({ action, label, icon: Icon, shortcut }) => <button type="button" key={action} aria-label={label} title={`${label}${shortcut ? ` (${shortcut})` : ""}`} aria-pressed={state?.active.includes(action) ?? false} onClick={() => api?.format(action)}><Icon size={17} /></button>)}</div>
    {!floating && <div className="editor-tools-group">{formats.slice(5).map(({ action, label, icon: Icon }) => <button type="button" key={action} aria-label={label} title={label} aria-pressed={state?.active.includes(action) ?? false} onClick={() => api?.format(action)}><Icon size={17} /></button>)}</div>}
    <button type="button" title="Collegamento (Ctrl/⌘ K)" aria-label="Inserisci collegamento" onClick={() => onPanel("link")}><Link2 size={17} /></button>
    {!floating && <>
      <button type="button" title="Inserisci o modifica tabella" aria-label="Tabella" onClick={() => onPanel("table")}><Table2 size={17} /></button>
      <button type="button" className="insert-trigger" onClick={() => onPanel("insert")} title="Inserisci elemento (Ctrl/⌘ Shift P)"><Plus size={17} /><span>Inserisci</span></button>
      <div className="editor-tools-group editor-tools-tail">
        <button type="button" aria-label="Trova e sostituisci" title="Trova e sostituisci (Ctrl/⌘ F)" onClick={() => onPanel("search")}><Search size={17} /></button>
        <button type="button" aria-label={focus ? "Esci da Concentrazione" : "Concentrazione"} title={focus ? "Esci da Concentrazione (Esc)" : "Concentrazione"} onClick={onFocus}>{focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
        <button type="button" aria-label="Guida editor" title="Guida editor (F1)" onClick={() => onPanel("help")}><CircleHelp size={17} /></button>
      </div>
    </>}
  </div>;
}
