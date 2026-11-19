import { Bold, Italic, Underline, Strikethrough, Highlighter, Code2, List, ListOrdered, ListTodo, Quote, Lightbulb, TriangleAlert, Minus, Image, Link2, Plus, Search, CircleHelp, Undo2, Redo2, Maximize2, Minimize2, Table2 } from "lucide-react";
import type { EditorApi, EditorPanel, EditorUiState } from "./editorCommands";
import type { FormatAction } from "./markdownTools";
import { useSettingsStore } from "../settings/settingsStore";
import { insertCommands, type InsertCommand } from "./insertCommands";
import { headingBars, headingDigits } from "./headingIcon";
import { ToolbarMenu } from "./ToolbarMenu";
import { CalendarTool } from "./CalendarTool";

const formats: Array<{ action: FormatAction; label: string; icon: typeof Bold; shortcut?: string }> = [
  { action: "bold", label: "Grassetto", icon: Bold, shortcut: "Ctrl/⌘ B" },
  { action: "italic", label: "Corsivo", icon: Italic, shortcut: "Ctrl/⌘ I" },
  { action: "underline", label: "Sottolineato", icon: Underline, shortcut: "Ctrl/⌘ U" },
  { action: "strike", label: "Barrato", icon: Strikethrough, shortcut: "Ctrl/⌘ Shift X" },
  { action: "highlight", label: "Evidenziatore", icon: Highlighter, shortcut: "Ctrl/⌘ Shift H" },
  { action: "inlineCode", label: "Codice in linea", icon: Code2 },
];
const headings = [1, 2, 3, 4] as const;
const blockTools = [
  ["bullet", List], ["ordered", ListOrdered], ["task", ListTodo],
  ["quote", Quote], ["tip", Lightbulb], ["warning", TriangleAlert], ["code", Code2],
] as const;
const blocks = blockTools.map(([id, Icon]) => ({ command: insertCommands.find(command => command.id === id)!, Icon }));
const table = insertCommands.find(command => command.id === "table")!;
const divider = insertCommands.find(command => command.id === "divider")!;

function HeadingIcon({ level }: { level: number }) {
  return <svg width="19" height="19" viewBox="0 0 24 24" aria-hidden="true">
    <path d={headingBars} fill="none" stroke="currentColor" strokeWidth="2.65" strokeLinecap="round" />
    <path d={headingDigits[level - 1]} fill="currentColor" />
  </svg>;
}

interface Props {
  api: EditorApi | null;
  state?: EditorUiState;
  onPanel: (panel: EditorPanel) => void;
  onCommand: (command: InsertCommand) => void;
  focus: boolean;
  onFocus: () => void;
  floating?: boolean;
}
export function EditorToolbar({ api, state, onPanel, onCommand, focus, onFocus, floating = false }: Props) {
  const heading = useSettingsStore(state => state.editorHeadingLevel);
  const setHeading = useSettingsStore(state => state.setEditorHeadingLevel);
  const applyHeading = (level: number) => api?.format(`h${level}` as FormatAction, false);
  return <div className={floating ? "selection-format-bar" : "editor-toolbar"} role="toolbar" aria-label={floating ? "Formatta selezione" : "Formattazione nota"} onMouseDown={event => { if ((event.target as HTMLElement).closest("button")) event.preventDefault(); }}>
    {!floating && <div className="editor-tools-group">
      <button type="button" title="Annulla (Ctrl/⌘ Z)" aria-label="Annulla" disabled={!state?.canUndo} onClick={() => api?.undo()}><Undo2 size={17} /></button>
      <button type="button" title="Ripristina (Ctrl/⌘ Shift Z)" aria-label="Ripristina" disabled={!state?.canRedo} onClick={() => api?.redo()}><Redo2 size={17} /></button>
    </div>}
    {!floating && <ToolbarMenu label="Scegli il livello del titolo" icon={<HeadingIcon level={heading} />} selected={String(heading)}
      primary={{ label: `Applica titolo H${heading}`, run: () => applyHeading(heading) }}
      items={headings.map(level => ({
        id: String(level), label: `Titolo H${level}`, icon: <HeadingIcon level={level} />,
        run: () => { setHeading(level); applyHeading(level); },
      }))} />}
    <div className="editor-tools-group">{formats.filter(({ action }) => !floating || action !== "inlineCode").map(({ action, label, icon: Icon, shortcut }) => <button type="button" key={action} aria-label={label} title={`${label}${shortcut ? ` (${shortcut})` : ""}`} aria-pressed={state?.active.includes(action) ?? false} onClick={() => api?.format(action)}><Icon size={17} /></button>)}</div>
    {!floating && <div className="editor-tools-group">
      <ToolbarMenu label="Elenchi, citazioni e avvisi" icon={<List size={19} aria-hidden="true" />}
        items={blocks.map(({ command, Icon }) => ({
          id: command.id, label: command.label, icon: <Icon size={18} aria-hidden="true" />, run: () => onCommand(command),
        }))} />
    </div>}
    <button type="button" title="Collegamento (Ctrl/⌘ K)" aria-label="Inserisci collegamento" onClick={() => onPanel("link")}><Link2 size={17} /></button>
    {!floating && <>
      <button type="button" title="Inserisci tabella" aria-label="Tabella" onClick={() => onCommand(table)}><Table2 size={17} /></button>
      <button type="button" className="editor-toolbar-direct" title="Inserisci separatore" aria-label="Separatore" onClick={() => onCommand(divider)}><Minus size={19} aria-hidden="true" /></button>
      <button type="button" className="editor-toolbar-direct" title="Inserisci immagine" aria-label="Immagine" onClick={() => onPanel("image")}><Image size={18} aria-hidden="true" /></button>
      <CalendarTool api={api} />
      <button type="button" className="insert-trigger" onClick={() => onPanel("insert")} title="Inserisci elemento (Ctrl/⌘ Shift P)"><Plus size={17} /><span>Inserisci</span></button>
      <div className="editor-tools-group editor-tools-tail">
        <button type="button" aria-label="Trova e sostituisci" title="Trova e sostituisci (Ctrl/⌘ F)" onClick={() => onPanel("search")}><Search size={17} /></button>
        <button type="button" aria-label={focus ? "Esci da Concentrazione" : "Concentrazione"} title={focus ? "Esci da Concentrazione (Esc)" : "Concentrazione"} onClick={onFocus}>{focus ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
        <button type="button" aria-label="Guida editor" title="Guida editor (F1)" onClick={() => onPanel("help")}><CircleHelp size={17} /></button>
      </div>
    </>}
  </div>;
}
