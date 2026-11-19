import { syntaxTree } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";
import { redo, undo, redoDepth, undoDepth, isolateHistory } from "@codemirror/commands";
import { EditorSelection } from "@codemirror/state";
import type { FormatAction, TextEdit } from "./markdownTools";
import { convertQuotedBlock, quoteBlockAt, wrapQuotedLines } from "./quoteBlockEditing";
import { formatEdit } from "./markdownFormatting";
import { findHighlights } from "../../domain/markdownHighlight";

export type EditorPanel = "insert" | "link" | "image" | "table" | "help" | "search";
export interface EditorUiState { from: number; to: number; line: number; column: number; selected: string; canUndo: boolean; canRedo: boolean; active: string[]; x: number; y: number }
export interface EditorApi {
  format(action: FormatAction, toggle?: boolean): void;
  insert(text: string, block?: boolean): void;
  replace(from: number, to: number, text: string): void;
  replaceAll(changes: Array<{ from: number; to: number; insert: string }>): void;
  select(from: number, to?: number, focus?: boolean): void;
  undo(): void;
  redo(): void;
  focus(): void;
  getSelection(): { from: number; to: number; text: string };
}
export function applyTextEdit(view: EditorView, edit: TextEdit) {
  if (view.state.readOnly) return;
  view.dispatch({ changes: { from: edit.from, to: edit.to, insert: edit.insert }, selection: EditorSelection.range(edit.anchor, edit.head), userEvent: "input", annotations: isolateHistory.of("full"), scrollIntoView: true });
  view.focus();
}
export function createEditorApi(view: EditorView): EditorApi {
  return {
    format: (action, toggle) => {
      if (view.state.readOnly) return;
      const { from, to } = view.state.selection.main;
      if (action === "codeBlock") {
        for (let node = syntaxTree(view.state).resolveInner(from, 1); node; node = node.parent!) {
          if ((node.name === "FencedCode" || node.name === "CodeBlock") && from > node.from && to <= node.to) {
            view.focus();
            return;
          }
        }
        const selected = view.state.sliceDoc(from, to);
        const longest = [...selected.matchAll(/`+/g)].reduce((length, run) => Math.max(length, run[0].length + 1), 3);
        const fence = "`".repeat(longest);
        const left = view.state.sliceDoc(Math.max(0, from - 2), from);
        const right = view.state.sliceDoc(to, Math.min(view.state.doc.length, to + 2));
        const prefix = from === 0 || left === "\n\n" ? "" : left.endsWith("\n") ? "\n" : "\n\n";
        const suffix = to === view.state.doc.length ? "\n" : right === "\n\n" ? "" : right.startsWith("\n") ? "\n" : "\n\n";
        const insert = `${prefix}${fence}\n${selected}\n${fence}${suffix}`;
        const anchor = from + prefix.length + fence.length + 1;
        applyTextEdit(view, { from, to, insert, anchor, head: anchor + selected.length });
        return;
      }
      if (action === "quote" || action === "tip" || action === "warning") {
        const block = quoteBlockAt(view.state, from, to);
        const target = action === "quote" && block?.kind === "quote" && toggle !== false ? "plain" : action;
        const edit = block
          ? convertQuotedBlock(view.state, block, target)
          : wrapQuotedLines(view.state, from, to, action);
        if (edit) applyTextEdit(view, edit);
        else view.focus();
        return;
      }
      const names: Partial<Record<FormatAction, string>> = { bold: "StrongEmphasis", italic: "Emphasis", strike: "Strikethrough", inlineCode: "InlineCode" };
      if (from === to && names[action]) {
        for (let node = syntaxTree(view.state).resolveInner(from, -1); node; node = node.parent!) {
          if (node.name !== names[action]) continue;
          const edit = formatEdit(view.state.doc.toString(), node.from, node.to, action);
          const markerLength = Math.floor((node.to - node.from - edit.insert.length) / 2);
          const position = Math.max(edit.from, Math.min(edit.from + edit.insert.length, from - markerLength));
          applyTextEdit(view, { ...edit, anchor: position, head: position }); return;
        }
      }
      const edit = formatEdit(view.state.doc.toString(), from, to, action, toggle);
      if (toggle === false && view.state.sliceDoc(edit.from, edit.to) === edit.insert) { view.focus(); return; }
      applyTextEdit(view, edit);
    },
    insert: (text, block = false) => {
      if (view.state.readOnly) return;
      const { from, to } = view.state.selection.main;
      const before = block && from > 0 && view.state.sliceDoc(Math.max(0, from - 2), from) !== "\n\n" ? (view.state.sliceDoc(from - 1, from) === "\n" ? "\n" : "\n\n") : "";
      const after = block ? "\n\n" : "";
      const insert = before + text + after;
      view.dispatch({ changes: { from, to, insert }, selection: { anchor: from + insert.length }, userEvent: "input", annotations: isolateHistory.of("full"), scrollIntoView: true }); view.focus();
    },
    replace: (from, to, insert) => { if (view.state.readOnly) return; view.dispatch({ changes: { from, to, insert }, userEvent: "input", annotations: isolateHistory.of("full") }); },
    replaceAll: changes => { if (!view.state.readOnly && changes.length) view.dispatch({ changes, userEvent: "input", annotations: isolateHistory.of("full") }); },
    select: (from, to = from, focus = true) => {
      view.dispatch({ selection: { anchor: Math.min(from, view.state.doc.length), head: Math.min(to, view.state.doc.length) }, scrollIntoView: true });
      if (focus) view.focus();
    },
    undo: () => { if (view.state.readOnly) return; undo(view); view.focus(); }, redo: () => { if (view.state.readOnly) return; redo(view); view.focus(); }, focus: () => view.focus(),
    getSelection: () => { const { from, to } = view.state.selection.main; return { from, to, text: view.state.sliceDoc(from, to) }; },
  };
}
export function editorUiState(view: EditorView): EditorUiState {
  const { from, to, head } = view.state.selection.main;
  const line = view.state.doc.lineAt(head), selected = view.state.sliceDoc(from, to);
  const active: string[] = [];
  const styles: Record<string, string> = { StrongEmphasis: "bold", Strikethrough: "strike", InlineCode: "inlineCode" };
  for (let node = syntaxTree(view.state).resolveInner(head, -1); node; node = node.parent!) {
    if (styles[node.name]) active.push(styles[node.name]!);
    if (node.name === "Emphasis" && from >= node.from && to <= node.to && (from !== to || (from > node.from && from < node.to))) active.push("italic");
  }
  const pairs = { bold: "**", strike: "~~", inlineCode: "`" };
  for (const [name, marker] of Object.entries(pairs)) {
    if ((selected.length >= 2 * marker.length && selected.startsWith(marker) && selected.endsWith(marker)) || (from >= marker.length && view.state.sliceDoc(from - marker.length, from) === marker && view.state.sliceDoc(to, to + marker.length) === marker)) active.push(name);
  }
  for (const highlight of findHighlights(line.text, line.from)) {
    if ((from >= highlight.textFrom && to <= highlight.textTo) || (from === highlight.from && to === highlight.to)) {
      active.push("highlight"); break;
    }
  }
  const heading = /^(#{1,6})\s/.exec(line.text); if (heading) active.push(`h${heading[1]!.length}`);
  if (/^\s*[-*+] \[[ xX]\]/.test(line.text)) active.push("task");
  else if (/^\s*[-*+] /.test(line.text)) active.push("bullet");
  if (/^\s*\d+[.)] /.test(line.text)) active.push("ordered");
  const quote = quoteBlockAt(view.state, from, to);
  if (quote) active.push(quote.kind);
  return { from, to, selected, line: line.number, column: head - line.from + 1, canUndo: undoDepth(view.state) > 0, canRedo: redoDepth(view.state) > 0, active, x: 0, y: 0 };
}
