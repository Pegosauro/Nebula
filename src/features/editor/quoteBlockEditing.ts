import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";
import { calloutTag, quoteKind, type QuoteBlockKind } from "../../infrastructure/markdown/quoteBlocks";
import type { TextEdit } from "./markdownTools";

const quotePrefix = /^[ \t]*>[ \t]?/;
export type QuotedBlock = { from: number; to: number; kind: QuoteBlockKind };

export function quoteBlockAt(state: EditorState, from: number, to: number): QuotedBlock | undefined {
  let block: QuotedBlock | undefined;
  const side = from === to && from === state.doc.lineAt(from).to ? -1 : 1;
  for (let node = syntaxTree(state).resolveInner(from, side); node; node = node.parent!) {
    if (node.name !== "Blockquote" || node.to < to) continue;
    const first = state.sliceDoc(node.from, state.doc.lineAt(node.from).to);
    const tag = calloutTag.exec(first.replace(quotePrefix, ""))?.[1]?.toUpperCase();
    const kind = quoteKind(tag);
    block = kind ? { from: node.from, to: node.to, kind } : undefined;
  }
  return block;
}

export function convertQuotedBlock(state: EditorState, block: QuotedBlock, target: QuoteBlockKind | "plain"): TextEdit | undefined {
  if (block.kind === target) return;
  const raw = state.sliceDoc(block.from, block.to);
  const firstLine = state.doc.lineAt(block.from);
  const container = state.sliceDoc(firstLine.from, block.from).replace(/[^\t ]/g, " ");
  const lines = raw.split("\n");
  const prefix = quotePrefix.exec(lines[0]!)?.[0] ?? "> ";
  const tag = calloutTag.exec(lines[0]!.slice(prefix.length))?.[0];
  const header = target === "tip" ? "[!TIP]" : "[!WARNING]";

  let insert: string;
  if (tag && target !== "plain" && target !== "quote") {
    insert = raw.slice(0, prefix.length) + header + raw.slice(prefix.length + tag.length);
  } else if (target === "tip" || target === "warning") {
    insert = `> ${header}\n${container}${raw}`;
  } else {
    if (tag) {
      const rest = lines[0]!.slice(prefix.length + tag.length).replace(/^[ \t]/, "");
      if (!rest.trim() && lines.length > 1 && quotePrefix.test(lines[1]!)) {
        lines.shift();
        lines[0] = lines[0]!.trimStart();
      } else lines[0] = prefix + rest;
    }
    if (target === "plain") {
      insert = lines.map(line => line.replace(quotePrefix, match => match.slice(0, match.indexOf(">")))).join("\n");
    } else insert = lines.join("\n");
  }
  const anchor = block.from + insert.length;
  return { from: block.from, to: block.to, insert, anchor, head: anchor };
}

export function wrapQuotedLines(state: EditorState, from: number, to: number, kind: QuoteBlockKind): TextEdit {
  const first = state.doc.lineAt(from);
  const last = state.doc.lineAt(to > from && to === state.doc.lineAt(to).from ? to - 1 : to);
  const prefix = kind === "quote" ? "" : kind === "tip" ? "> [!TIP]\n" : "> [!WARNING]\n";
  const body = state.sliceDoc(first.from, last.to).split("\n").map(line => `> ${line}`).join("\n");
  const before = first.number > 1 && /^\s*>/.test(state.doc.line(first.number - 1).text) ? "\n" : "";
  const after = last.number < state.doc.lines && state.doc.line(last.number + 1).text.trim() ? "\n" : "";
  const insert = before + prefix + body + after;
  const anchor = first.from + before.length + prefix.length + body.length;
  return { from: first.from, to: last.to, insert, anchor, head: anchor };
}

export function exitQuotedBlock(state: EditorState): TextEdit | undefined {
  if (state.readOnly || state.selection.ranges.length !== 1) return;
  const { empty, head } = state.selection.main;
  const line = state.doc.lineAt(head);
  if (!empty || head !== line.to || !/^[ \t]*>[ \t]*$/.test(line.text)) return;
  const block = quoteBlockAt(state, head, head);
  if (!block || state.doc.lineAt(block.to).number !== line.number) return;
  const first = state.doc.lineAt(block.from);
  const emptyBlock = first.number === line.number || (
    first.number + 1 === line.number && /^>\s*\[!(TIP|WARNING)\][ \t]*$/i.test(state.sliceDoc(block.from, first.to))
  );
  if (emptyBlock) return convertQuotedBlock(state, block, "plain");
  // Keep a blank boundary so typing here does not start a lazy quote continuation.
  const anchor = line.from + 1;
  return { from: line.from, to: line.to, insert: "\n", anchor, head: anchor };
}
