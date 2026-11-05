import type { EditorPanel } from "./editorCommands";
import type { FormatAction } from "./markdownTools";
export interface InsertCommand { id: string; label: string; group: string; keywords: string; format?: FormatAction; panel?: EditorPanel; text?: string; syntax: string; shortcut?: string }
export const insertCommands: InsertCommand[] = [
  ...[1,2,3,4,5,6].map(n => ({ id: `h${n}`, label: `Titolo ${n}`, group: "Testo", keywords: "intestazione heading", format: `h${n}` as FormatAction, syntax: `${"#".repeat(n)} Titolo`, shortcut: `Ctrl/⌘ Alt ${n}` })),
  { id: "paragraph", label: "Paragrafo", group: "Testo", keywords: "normale testo", format: "paragraph", syntax: "Testo normale" },
  { id: "bold", label: "Grassetto", group: "Formato", keywords: "bold", format: "bold", syntax: "**grassetto**", shortcut: "Ctrl/⌘ B" },
  { id: "italic", label: "Corsivo", group: "Formato", keywords: "italic", format: "italic", syntax: "*corsivo*", shortcut: "Ctrl/⌘ I" },
  { id: "strike", label: "Barrato", group: "Formato", keywords: "eliminato", format: "strike", syntax: "~~barrato~~", shortcut: "Ctrl/⌘ Shift X" },
  { id: "highlight", label: "Evidenziatore", group: "Formato", keywords: "evidenzia colore", format: "highlight", syntax: "==evidenziato==", shortcut: "Ctrl/⌘ Shift H" },
  { id: "inlineCode", label: "Codice in linea", group: "Formato", keywords: "monospace", format: "inlineCode", syntax: "`codice`", shortcut: "Ctrl/⌘ Shift C" },
  { id: "bullet", label: "Elenco puntato", group: "Elenchi", keywords: "lista punti", format: "bullet", syntax: "- Elemento" },
  { id: "ordered", label: "Elenco numerato", group: "Elenchi", keywords: "lista numeri", format: "ordered", syntax: "1. Elemento" },
  { id: "task", label: "Checklist", group: "Elenchi", keywords: "attività casella spunta task", format: "task", syntax: "- [ ] Da fare\n- [x] Completato" },
  { id: "link", label: "Collegamento", group: "Collegamenti e media", keywords: "link nota pagina url", panel: "link", syntax: "[[Nota]] oppure [Sito](https://…)", shortcut: "Ctrl/⌘ K" },
  { id: "image", label: "Immagine", group: "Collegamenti e media", keywords: "foto immagine allegato", panel: "image", syntax: "![Descrizione](attachments/foto.png)" },
  { id: "table", label: "Tabella", group: "Blocchi", keywords: "griglia celle excel", panel: "table", syntax: "| Nome | Valore |\n| --- | --- |\n| Dato | 1 |" },
  { id: "quote", label: "Citazione", group: "Blocchi", keywords: "quote", format: "quote", syntax: "> Citazione" },
  { id: "code", label: "Blocco di codice", group: "Blocchi", keywords: "javascript python codice", text: "```text\nInserisci il codice\n```", syntax: "```linguaggio\ncodice\n```" },
  { id: "note", label: "Riquadro informativo", group: "Blocchi", keywords: "callout nota", text: "> [!NOTE]\n> Informazione utile", syntax: "> [!NOTE]\n> Informazione utile" },
  { id: "tip", label: "Suggerimento", group: "Blocchi", keywords: "callout tip consiglio", text: "> [!TIP]\n> Un suggerimento", syntax: "> [!TIP]\n> Un suggerimento" },
  { id: "warning", label: "Avviso", group: "Blocchi", keywords: "callout warning attenzione", text: "> [!WARNING]\n> Presta attenzione a questo punto", syntax: "> [!WARNING]\n> Avviso" },
  { id: "divider", label: "Separatore", group: "Blocchi", keywords: "linea orizzontale", text: "---", syntax: "---" },
];
