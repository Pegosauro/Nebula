import { markdownLanguage } from "@codemirror/lang-markdown";
import type { FormatAction, TextEdit } from "./markdownTools";

const wrappers: Partial<Record<FormatAction, string>> = { bold: "**", italic: "*", strike: "~~", highlight: "==", inlineCode: "`" };

export function formatEdit(doc: string, from: number, to: number, action: FormatAction): TextEdit {
  if (action === "italic") return italicEdit(doc, from, to);
  let marker = wrappers[action];
  const selected = doc.slice(from, to);
  if (marker) {
    if (action === "inlineCode" && selected.includes("`")) {
      marker = "`".repeat(Math.max(...[...selected.matchAll(/`+/g)].map(m => m[0].length)) + 1);
    }
    if (selected.startsWith(marker) && selected.endsWith(marker) && selected.length >= marker.length * 2) {
      const insert = selected.slice(marker.length, -marker.length);
      return { from, to, insert, anchor: from, head: from + insert.length };
    }
    if (doc.slice(from - marker.length, from) === marker && doc.slice(to, to + marker.length) === marker) {
      return { from: from - marker.length, to: to + marker.length, insert: selected, anchor: from - marker.length, head: to - marker.length };
    }
    const text = selected || "testo";
    return { from, to, insert: `${marker}${text}${marker}`, anchor: from + marker.length, head: from + marker.length + text.length };
  }
  const start = doc.lastIndexOf("\n", from - 1) + 1;
  const endSearch = doc.indexOf("\n", to > from && doc[to - 1] === "\n" ? to - 1 : to);
  const end = endSearch < 0 ? doc.length : endSearch;
  const lines = doc.slice(start, end).split("\n");
  const prefix = action.startsWith("h") ? `${"#".repeat(Number(action[1]))} ` : action === "bullet" ? "- " : action === "ordered" ? "1. " : action === "task" ? "- [ ] " : action === "quote" ? "> " : "";
  const pattern = action === "ordered" ? /^\d+[.)]\s+/ : action === "task" ? /^[-*+] \[[ xX]\]\s+/ : action === "bullet" ? /^[-*+]\s+(?!\[[ xX]\])/ : action === "quote" ? /^>\s?/ : /^(#{1,6})\s+/;
  const toggleOff = action !== "paragraph" && lines.every(line => pattern.test(line.trimStart()) && (action[0] !== "h" || line.trimStart().startsWith(prefix)));
  const insert = lines.map((line, index) => {
    const indent = line.match(/^\s*/)?.[0] ?? "";
    const body = line.slice(indent.length).replace(/^(?:#{1,6}\s+|[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|>\s?)/, "");
    return indent + (toggleOff || action === "paragraph" ? "" : action === "ordered" ? `${index + 1}. ` : prefix) + body;
  }).join("\n");
  return { from: start, to: end, insert, anchor: start, head: start + insert.length };
}

function italicEdit(doc: string, from: number, to: number): TextEdit {
  if (from !== to) {
    const selected = doc.slice(from, to);
    const text = selected.trim();
    // Emphasis delimiters next to whitespace are literal Markdown characters.
    if (!text) return { from, to, insert: selected, anchor: from, head: to };
    from += selected.length - selected.trimStart().length;
    to = from + text.length;
  }
  const tree = markdownLanguage.parser.parse(doc);
  for (let node = tree.resolveInner(from, 1); node; node = node.parent!) {
    if (node.name !== "Emphasis") continue;
    const marks = node.getChildren("EmphasisMark");
    const open = marks[0], close = marks.at(-1);
    if (!open || !close) continue;
    let contentFrom = open.to, contentTo = close.from;
    // A visible selection can exclude the nested bold delimiters in ***text***.
    const bold = node.getChild("StrongEmphasis");
    if (bold?.from === contentFrom && bold.to === contentTo) {
      const boldMarks = bold.getChildren("EmphasisMark");
      contentFrom = boldMarks[0]?.to ?? contentFrom;
      contentTo = boldMarks.at(-1)?.from ?? contentTo;
    }
    if (from < node.from || from > contentFrom || to < contentTo || to > node.to) continue;
    const insert = doc.slice(open.to, close.from);
    const map = (position: number) => node.from + Math.max(0, Math.min(insert.length, position - open.to));
    return { from: node.from, to: node.to, insert, anchor: map(from), head: map(to) };
  }
  const text = doc.slice(from, to) || "testo";
  return { from, to, insert: `*${text}*`, anchor: from + 1, head: from + 1 + text.length };
}

