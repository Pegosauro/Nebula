import { isolateHistory } from "@codemirror/commands";
import { ensureSyntaxTree } from "@codemirror/language";
import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { frontmatterRange } from "../../domain/noteProperties";
import { serializeTextButton, validTextButton, type TextButtonBlock, type TextButtonConfig } from "../../domain/textButtons";
import { documentText } from "./markdownAnalysis";
import { resolveNoteDates } from "./noteDates";

export type TextButtonMenu = { block: TextButtonBlock; anchor: DOMRect };
const flashDuration = 420;
const textButtonFlash = StateEffect.define<{ from: number; to: number } | null>();
const flashLine = Decoration.line({ class: "text-button-inserted" });
const flashing = new WeakMap<EditorView, number>();

export const textButtonMotion = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(previous, transaction) {
    for (const effect of transaction.effects) {
      if (!effect.is(textButtonFlash)) continue;
      if (!effect.value) return Decoration.none;
      const { from, to } = effect.value, doc = transaction.newDoc;
      const first = doc.lineAt(from).number, last = doc.lineAt(to - 1).number;
      return Decoration.set(Array.from({ length: last - first + 1 }, (_, index) => flashLine.range(doc.line(first + index).from)));
    }
    return transaction.docChanged ? Decoration.none : previous;
  },
  provide: field => EditorView.decorations.from(field),
});

function blockGap(view: EditorView, at: number) {
  const doc = view.state.doc;
  const left = doc.sliceString(Math.max(0, at - 2), at);
  const right = doc.sliceString(at, Math.min(doc.length, at + 2));
  return {
    before: at === 0 || left.endsWith("\n\n") ? "" : left.endsWith("\n") ? "\n" : "\n\n",
    after: at === doc.length ? "\n" : right.startsWith("\n\n") ? "" : right.startsWith("\n") ? "\n" : "\n\n",
  };
}

export function configureTextButton(view: EditorView, config: TextButtonConfig | null, block?: TextButtonBlock): boolean {
  if (view.state.readOnly || config !== null && !validTextButton(config)) return false;
  const doc = view.state.doc;
  if (block) {
    if (doc.sliceString(block.from, block.to) !== block.raw) return false;
    view.dispatch({ changes: { from: block.from, to: block.to, insert: config ? serializeTextButton(config) : "" }, annotations: isolateHistory.of("full") });
    return true;
  }
  if (!config) return false;
  const { head } = view.state.selection.main;
  const bodyStart = frontmatterRange(documentText(doc))?.end ?? 0;
  let at = Math.max(head, bodyStart);
  const tree = ensureSyntaxTree(view.state, at, 60);
  if (!tree) return false;
  let current = tree.resolve(at, at === bodyStart ? 1 : -1);
  while (current?.parent && current.parent.name !== "Document") current = current.parent;
  if (current?.name === "FencedCode") {
    const opening = current.firstChild, closing = current.lastChild;
    if (closing?.name !== "CodeMark" || opening?.from === closing.from) return false;
  }
  if (current?.name !== "Document" && current) at = Math.max(current.to, at);
  if (at !== bodyStart || bodyStart === 0 && head === at && current?.name !== "Document") at = doc.lineAt(at).to;
  const { before, after } = blockGap(view, at);
  const insert = before + serializeTextButton(config) + after;
  view.dispatch({ changes: { from: at, insert }, selection: { anchor: at + insert.length }, annotations: isolateHistory.of("full"), scrollIntoView: true });
  return true;
}

export function runTextButton(view: EditorView, block: TextButtonBlock): void {
  if (view.state.readOnly || view.state.sliceDoc(block.from, block.to) !== block.raw) return;
  const { config } = block;
  const text = resolveNoteDates(config.text, new Date()).replace(/\r\n?/gu, "\n").replace(/^\n+|\n+$/gu, "");
  const before = config.position === "before";
  const at = before ? block.from : block.to;
  const gap = blockGap(view, at);
  const insert = gap.before + text + gap.after;
  const from = at + gap.before.length, to = from + text.length;
  const win = view.dom.ownerDocument.defaultView;
  const animate = win && !win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  view.dispatch({
    changes: { from: at, insert },
    selection: { anchor: from },
    annotations: isolateHistory.of("full"),
    effects: animate ? textButtonFlash.of({ from, to }) : undefined,
    scrollIntoView: true,
  });
  view.focus();
  if (!animate || !win) return;
  win.clearTimeout(flashing.get(view));
  flashing.set(view, win.setTimeout(() => {
    flashing.delete(view);
    if (view.dom.isConnected) view.dispatch({ effects: textButtonFlash.of(null) });
  }, flashDuration));
}
