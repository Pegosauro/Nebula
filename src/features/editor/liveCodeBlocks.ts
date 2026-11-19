import { syntaxTree } from "@codemirror/language";
import { StateEffect, StateField, type EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { codeLanguage, codeTokens, excelBreaks, fenceOpening, fencedPayload, indentVba, type CodeMode } from "../../domain/codeBlock";
import { applyTextEdit } from "./editorCommands";
import { codeBlockControls } from "./codeBlockControls";

const toggleFormula = StateEffect.define<number>();
export const formulaLayouts = StateField.define<ReadonlySet<number>>({
  create: () => new Set(),
  update(value, transaction) {
    if (!value.size && !transaction.effects.some(effect => effect.is(toggleFormula))) return value;
    if (!transaction.docChanged && !transaction.effects.some(effect => effect.is(toggleFormula))) return value;
    const updated = new Set<number>();
    for (const from of value) {
      const mapped = transaction.changes.mapPos(from, 1);
      const oldLine = transaction.startState.doc.lineAt(from);
      const newLine = transaction.newDoc.lineAt(mapped);
      if (oldLine.text === newLine.text) updated.add(mapped);
    }
    for (const effect of transaction.effects) if (effect.is(toggleFormula)) {
      if (updated.has(effect.value)) updated.delete(effect.value);
      else updated.add(effect.value);
    }
    return updated;
  },
});

class CodeToolbar extends WidgetType {
  constructor(
    readonly from: number, readonly info: string, readonly source: string, readonly bodyFrom: number,
    readonly bodyTo: number, readonly modeFrom: number, readonly modeTo: number, readonly expanded: boolean,
    readonly readOnly: boolean, readonly safeToFormat: boolean, readonly canExpand: boolean,
  ) { super(); }

  eq(other: CodeToolbar) {
    return this.from === other.from && this.info === other.info && this.source === other.source &&
      this.bodyFrom === other.bodyFrom && this.bodyTo === other.bodyTo && this.modeFrom === other.modeFrom &&
      this.modeTo === other.modeTo && this.expanded === other.expanded && this.readOnly === other.readOnly &&
      this.safeToFormat === other.safeToFormat && this.canExpand === other.canExpand;
  }

  toDOM(view: EditorView) {
    const { from, info, source, bodyFrom, bodyTo, modeFrom, modeTo, expanded } = this;
    const change = (mode: CodeMode) => {
      const head = view.state.selection.main.head;
      const insert = mode;
      const anchor = head < modeFrom ? head : head < modeTo ? modeFrom + insert.length : head + insert.length - (modeTo - modeFrom);
      applyTextEdit(view, { from: modeFrom, to: modeTo, insert, anchor, head: anchor });
    };
    const format = () => {
      const insert = indentVba(source);
      if (insert === source) return;
      const cursor = view.state.selection.main.head;
      let anchor = cursor;
      if (cursor >= bodyFrom && cursor <= bodyTo) {
        const line = view.state.doc.lineAt(cursor);
        const top = view.state.doc.lineAt(bodyFrom);
        const lines = insert.split("\n");
        const index = line.number - top.number;
        const leading = (value: string) => value.length - value.trimStart().length;
        const column = cursor - line.from + leading(lines[index]!) - leading(line.text);
        anchor = bodyFrom + lines.slice(0, index).reduce((offset, text) => offset + text.length + 1, 0) + Math.max(0, column);
      } else if (cursor > bodyTo) anchor += insert.length - (bodyTo - bodyFrom);
      applyTextEdit(view, { from: bodyFrom, to: bodyTo, insert, anchor, head: anchor });
    };
    const bar = codeBlockControls(view.dom.ownerDocument, {
      info, source, expanded,
      setMode: !this.readOnly && modeFrom >= 0 ? change : undefined,
      format: !this.readOnly && this.safeToFormat && codeLanguage(info, source) === "vba" ? format : undefined,
      toggle: this.canExpand ? () => {
        view.dispatch({ effects: toggleFormula.of(from) });
        view.dom.querySelector<HTMLButtonElement>(`[data-live-code="${from}"] .nebula-code-layout`)?.focus({ preventScroll: true });
      } : undefined,
    });
    bar.dataset.liveCode = String(from);
    return bar;
  }
}

class FormulaBreak extends WidgetType {
  constructor(readonly indent: number) { super(); }
  eq(other: FormulaBreak) { return this.indent === other.indent; }
  get lineBreaks() { return 1; }
  toDOM(view: EditorView) {
    const owner = view.dom.ownerDocument;
    const span = owner.createElement("span");
    span.className = "nebula-code-break";
    span.setAttribute("aria-hidden", "true");
    span.append(owner.createElement("br"), owner.createTextNode(" ".repeat(this.indent * 4)));
    return span;
  }
}

type MarkdownNode = ReturnType<ReturnType<typeof syntaxTree>["resolveInner"]>;

export function insideCodeBlock(state: EditorState, position: number) {
  for (let node: MarkdownNode | null = syntaxTree(state).resolveInner(position, -1); node; node = node.parent) {
    if ((node.name === "FencedCode" || node.name === "CodeBlock") && position > node.from) return true;
  }
  return false;
}

export function decorateCodeBlock(
  view: EditorView,
  node: MarkdownNode,
  decorations: Range<Decoration>[],
  active: (from: number, to: number) => boolean,
  hide: (from: number, to: number) => void,
) {
  const { state } = view, { doc } = state;
  const first = doc.lineAt(node.from), last = doc.lineAt(node.to);
  const marks = node.getChildren("CodeMark");
  const fenced = node.name === "FencedCode" && marks.length > 0;
  const opening = marks[0], closing = marks[1];
  const info = node.getChild("CodeInfo");
  const name = info ? doc.sliceString(info.from, info.to) : "";
  const texts = node.getChildren("CodeText");
  const bodyFrom = fenced ? Math.min(node.to, first.to + 1) : node.from;
  const bodyTo = closing ? Math.max(bodyFrom, doc.lineAt(closing.from).from - 1) : node.to;
  const topLevelFence = fenced && fenceOpening.test(first.text);
  const source = topLevelFence
    ? fencedPayload(doc.sliceString(first.from, node.to)) ?? ""
    : texts.map(text => doc.sliceString(text.from, text.to)).join("").replace(/\n$/, "");
  const simpleOffsets = topLevelFence && opening?.from === first.from;
  const language = codeLanguage(name, source);
  const breaks = language === "excel" ? excelBreaks(source) : [];
  const canExpand = breaks.length > 0 && (simpleOffsets || texts.length === 1);
  const expanded = canExpand && state.field(formulaLayouts).has(node.from);
  const mode = opening ? /^[ \t]*\S*/.exec(doc.sliceString(opening.to, first.to))?.[0] : undefined;
  const modeFrom = opening?.to ?? -1;
  const modeTo = modeFrom + (mode?.length ?? 0);
  const header = new CodeToolbar(node.from, name, source, bodyFrom, bodyTo, modeFrom, modeTo, expanded, state.readOnly, simpleOffsets && bodyFrom <= bodyTo, canExpand);
  decorations.push(Decoration.widget({ widget: header, side: -1 }).range(first.from));
  for (let number = first.number; number <= last.number; number++) {
    const line = doc.line(number);
    const isHeader = fenced && number === first.number;
    const hideOpening = isHeader && !active(line.from, line.to);
    const hideClosing = closing && number === last.number && !active(line.from, line.to);
    const className = ["live-code-line", number === first.number && "live-block-start", number === last.number && "live-block-end",
      isHeader && "live-code-opening", hideOpening && "live-code-opening-hidden", hideClosing && "live-code-closing-hidden"].filter(Boolean).join(" ");
    decorations.push(Decoration.line({ class: className }).range(line.from));
    if (hideOpening) hide(topLevelFence ? line.from : opening!.from, line.to);
    if (hideClosing) hide(topLevelFence ? line.from : closing.from, line.to);
  }
  for (const text of texts) {
    for (const token of codeTokens(doc.sliceString(text.from, text.to), language)) {
      decorations.push(Decoration.mark({ class: `nebula-code-${token.style}` }).range(text.from + token.from, text.from + token.to));
    }
  }
  if (expanded) for (const { at, indent } of breaks) {
    const from = (simpleOffsets ? bodyFrom : texts[0]!.from) + at;
    decorations.push(Decoration.widget({ widget: new FormulaBreak(indent), side: -1 }).range(from));
  }
}
