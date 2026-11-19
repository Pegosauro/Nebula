import { syntaxTree } from "@codemirror/language";
import { StateEffect, StateField, type EditorState, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType } from "@codemirror/view";
import { codeLanguage, codeTokens, excelBreaks, fenceOpening, fencedPayload, formatExcelDisplay, indentVba, type CodeMode } from "../../domain/codeBlock";
import { applyTextEdit } from "./editorCommands";
import { canCompactCode, codeBlockControls, drawCode, setCodeCompact } from "./codeBlockControls";

interface CompactCode {
  from: number;
  to: number;
  info: string;
  source: string;
  expanded: boolean;
}

const showCompactCode = StateEffect.define<CompactCode>();
const expandCode = StateEffect.define<number>();

export const compactCodeBlocks = StateField.define<readonly CompactCode[]>({
  create: () => [],
  update(blocks, transaction) {
    const effects = transaction.effects.filter(effect => effect.is(showCompactCode) || effect.is(expandCode));
    if (!effects.length && (!blocks.length || (!transaction.docChanged && !transaction.selection))) return blocks;
    const next: CompactCode[] = [];
    const inside = (pos: number, block: CompactCode) => pos > block.from && pos < block.to;
    for (const block of blocks) {
      if (transaction.changes.touchesRange(block.from, block.to)) continue;
      const from = transaction.changes.mapPos(block.from, 1), to = transaction.changes.mapPos(block.to, -1);
      const mapped = from === block.from && to === block.to ? block : { ...block, from, to };
      if (!transaction.selection?.ranges.some(range => inside(range.from, mapped) || inside(range.to, mapped))) next.push(mapped);
    }
    for (const effect of effects) {
      if (effect.is(showCompactCode)) next.push(effect.value);
      if (effect.is(expandCode)) return next.filter(block => block.from !== effect.value);
    }
    return next.length === blocks.length && next.every((block, index) => block === blocks[index]) ? blocks : next;
  },
  provide: field => EditorView.decorations.compute([field], state => Decoration.set(state.field(field).map(block =>
    Decoration.replace({ block: true, widget: new CompactCodeWidget(block) }).range(block.from, block.to)), true)),
});

export function expandCodeBeforeDeleting(view: EditorView, forward: boolean) {
  if (view.state.readOnly || view.composing) return false;
  const block = view.state.field(compactCodeBlocks).find(({ from, to }) => view.state.selection.ranges.some(range =>
    range.empty && (forward ? range.head === from || range.head === from - 1 : range.head === to || range.head === to + 1)));
  if (!block) return false;
  view.dispatch({ effects: expandCode.of(block.from) });
  return true;
}

function focusCodeControl(view: EditorView, from: number, control: string) {
  const button = view.dom.querySelector<HTMLButtonElement>(`[data-live-code="${from}"] ${control}`);
  if (button) button.focus({ preventScroll: true });
  else view.focus();
}

class CompactCodeWidget extends WidgetType {
  constructor(readonly block: CompactCode) { super(); }

  eq(other: CompactCodeWidget) {
    return this.block === other.block;
  }

  toDOM(view: EditorView) {
    const { from, info, source, expanded } = this.block;
    const owner = view.dom.ownerDocument;
    const wrap = owner.createElement("div");
    wrap.className = "nebula-code-block live-code-compact-block";
    const bar = codeBlockControls(owner, { info, source, compact: { active: true, toggle: () => {
      view.dispatch({ effects: expandCode.of(from) });
      focusCodeControl(view, from, ".nebula-code-compact");
    } } });
    bar.dataset.liveCode = String(from);
    const pre = owner.createElement("pre"), code = owner.createElement("code");
    drawCode(code, expanded ? formatExcelDisplay(source) : source, codeLanguage(info, source));
    setCodeCompact(pre, true);
    pre.append(code);
    wrap.append(bar, pre);
    return wrap;
  }
}

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
    readonly from: number, readonly block: CompactCode, readonly bodyFrom: number,
    readonly bodyTo: number, readonly modeFrom: number, readonly modeTo: number,
    readonly readOnly: boolean, readonly safeToFormat: boolean, readonly canExpand: boolean, readonly canCompact: boolean,
  ) { super(); }

  eq(other: CodeToolbar) {
    return this.from === other.from && this.block.from === other.block.from && this.block.to === other.block.to &&
      this.block.info === other.block.info && this.block.source === other.block.source && this.block.expanded === other.block.expanded &&
      this.bodyFrom === other.bodyFrom && this.bodyTo === other.bodyTo && this.modeFrom === other.modeFrom &&
      this.modeTo === other.modeTo && this.readOnly === other.readOnly && this.safeToFormat === other.safeToFormat &&
      this.canExpand === other.canExpand && this.canCompact === other.canCompact;
  }

  toDOM(view: EditorView) {
    const { from, block, bodyFrom, bodyTo, modeFrom, modeTo } = this;
    const { info, source, expanded } = block;
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
        focusCodeControl(view, block.from, ".nebula-code-layout");
      } : undefined,
      compact: this.canCompact ? { active: false, toggle: () => {
        const selection = view.state.selection;
        const inside = selection.ranges.some(range => range.to > block.from && range.from < block.to);
        view.dispatch({ effects: showCompactCode.of(block), selection: inside ? { anchor: block.from } : undefined });
        focusCodeControl(view, block.from, ".nebula-code-compact");
      } } : undefined,
    });
    bar.dataset.liveCode = String(block.from);
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
  if (state.field(compactCodeBlocks).some(block => block.from === first.from)) return;
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
  const block = { from: first.from, to: last.to, info: name, source, expanded };
  const canCompact = canCompactCode(source) || (expanded && breaks.length >= 10);
  const header = new CodeToolbar(node.from, block, bodyFrom, bodyTo, modeFrom, modeTo, state.readOnly, simpleOffsets && bodyFrom <= bodyTo, canExpand, canCompact);
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
