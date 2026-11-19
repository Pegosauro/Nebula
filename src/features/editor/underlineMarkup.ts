import { markdownLanguage } from "@codemirror/lang-markdown";
import type { TextEdit } from "./markdownTools";

type MarkdownTree = ReturnType<typeof markdownLanguage.parser.parse>;
type MarkdownNode = ReturnType<MarkdownTree["resolveInner"]>;
type ReadText = (from: number, to: number) => string;
type Underline = { from: number; to: number; contentFrom: number; contentTo: number };
const opening = "<u>", closing = "</u>";

export function isInlineTextBlock(name: string) {
  return name === "Paragraph" || /^(?:ATX|Setext)Heading[1-6]$/.test(name);
}

export function underlineSpans(tree: MarkdownTree, read: ReadText, from: number, to: number): Underline[] {
  if (!/<u>/i.test(read(from, to))) return [];
  const spans: Underline[] = [];
  const starts: Array<{ from: number; to: number }> = [];
  tree.iterate({ from, to, enter(node) {
    if (node.name !== "HTMLTag") return;
    const tag = read(node.from, node.to).toLowerCase();
    if (tag === opening) starts.push({ from: node.from, to: node.to });
    if (tag === closing) {
      const start = starts.pop();
      if (start && start.to < node.from) spans.push({ from: start.from, to: node.to, contentFrom: start.to, contentTo: node.from });
    }
  } });
  return spans;
}

export function hasUnderline(tree: MarkdownTree, read: ReadText, from: number, to: number) {
  for (let node: MarkdownNode | null = tree.resolveInner(from, 1); node; node = node.parent) {
    if (isInlineTextBlock(node.name)) {
      return underlineSpans(tree, read, node.from, node.to).some(span => from >= span.from && to <= span.to);
    }
  }
  return false;
}

export function underlineEdit(doc: string, from: number, to: number): TextEdit {
  const tree = markdownLanguage.parser.parse(doc);
  const read: ReadText = (start, end) => doc.slice(start, end);
  const unchanged = { from, to, insert: read(from, to), anchor: from, head: to };
  if (from === to) {
    for (let node: MarkdownNode | null = tree.resolveInner(from, -1); node; node = node.parent) {
      if (node.name === "FencedCode" || node.name === "CodeBlock") return unchanged;
      if (!isInlineTextBlock(node.name)) continue;
      const span = underlineSpans(tree, read, node.from, node.to).find(item => from >= item.contentFrom && from <= item.contentTo);
      if (span) {
        const anchor = from - opening.length;
        return { from: span.from, to: span.to, insert: read(span.contentFrom, span.contentTo), anchor, head: anchor };
      }
      break;
    }
    const anchor = from + opening.length;
    return { from, to, insert: opening + "testo" + closing, anchor, head: anchor + 5 };
  }

  const sections: Array<{ from: number; to: number; existing?: Underline }> = [];
  tree.iterate({ from, to, enter(node) {
    if (!isInlineTextBlock(node.name)) return;
    const marks = node.node.getChildren("HeaderMark");
    const first = node.name.startsWith("ATX") ? marks[0]?.to ?? node.from : node.from;
    const last = node.name.startsWith("Setext") || marks.length > 1 ? marks.at(-1)?.from ?? node.to : node.to;
    let start = Math.max(first, from), end = Math.min(last, to);
    const selected = read(start, end);
    const trimmed = selected.trim();
    if (trimmed) {
      start += selected.length - selected.trimStart().length;
      end = start + trimmed.length;
      const existing = underlineSpans(tree, read, node.from, node.to).find(span => start >= span.from && end <= span.to);
      sections.push({ from: start, to: end, existing });
    }
    return false;
  } });
  if (!sections.length) return unchanged;

  const remove = sections.every(section => section.existing);
  const changes = sections.flatMap(section => {
    const span = section.existing;
    if (remove && span) return [{ from: span.from, to: span.to, text: read(span.contentFrom, span.contentTo), open: "", close: "" }];
    if (span) return [];
    return [{ ...section, text: read(section.from, section.to), open: opening, close: closing }];
  });
  const start = Math.min(from, changes[0]!.from), end = Math.max(to, changes.at(-1)!.to);
  let insert = "", cursor = start, anchor = start, head = start;
  changes.forEach((change, index) => {
    insert += read(cursor, change.from) + change.open;
    if (!index) anchor = start + insert.length;
    insert += change.text;
    head = start + insert.length;
    insert += change.close;
    cursor = change.to;
  });
  insert += read(cursor, end);
  return { from: start, to: end, insert, anchor, head };
}
