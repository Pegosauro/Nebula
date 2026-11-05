import { maskFrontmatter } from "../../domain/noteProperties";
import { Lexer, type Tokens } from "marked";
import { serializeTableLayout, tableMetadataAt, type TableLayout } from "../../infrastructure/markdown/tableLayout";

export interface TextEdit { from: number; to: number; insert: string; anchor: number; head: number }
export type FormatAction = "bold" | "italic" | "strike" | "highlight" | "inlineCode" | "bullet" | "ordered" | "task" | "quote" | "paragraph" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
export function minimalChange(before: string, after: string) {
  let from = 0;
  while (from < before.length && from < after.length && before[from] === after[from]) from++;
  let endBefore = before.length, endAfter = after.length;
  while (endBefore > from && endAfter > from && before[endBefore - 1] === after[endAfter - 1]) { endBefore--; endAfter--; }
  return { from, to: endBefore, insert: after.slice(from, endAfter) };
}

function sourceBlocks(source: string) {
  source = maskFrontmatter(source);
  if (!source.includes("\r")) {
    let position = 0;
    return new Lexer({ gfm: true }).blockTokens(source).map(token => {
      const from = position; position += token.raw.length;
      return { token, from, to: position };
    });
  }
  const offsets: number[] = []; let normalized = "";
  for (let i = 0; i < source.length; i++) {
    offsets.push(i);
    if (source[i] === "\r") { normalized += "\n"; if (source[i + 1] === "\n") i++; }
    else normalized += source[i];
  }
  offsets.push(source.length);
  let offset = 0;
  return new Lexer({ gfm: true }).blockTokens(normalized).map(token => {
    const from = offsets[offset] ?? source.length;
    offset += token.raw.length;
    return { token, from, to: offsets[offset] ?? source.length };
  });
}
export interface MarkdownTable { from: number; to: number; rows: string[][]; align: Array<"left" | "center" | "right" | null>; layout?: TableLayout }
export function markdownTables(source: string): MarkdownTable[] {
  if (!source.includes("|")) return [];
  const tables: MarkdownTable[] = [];
  for (const { token, from, to } of sourceBlocks(source)) {
    if (token.type === "table") {
      const t = token as Tokens.Table;
      const trailing = source.slice(from, to).match(/[\r\n]+$/)?.[0].length ?? 0;
      const rows = [t.header.map(c => c.text), ...t.rows.map(r => r.map(c => c.text))];
      const metadata = tableMetadataAt(source, to - trailing, rows.length, t.header.length);
      tables.push({ from, to: metadata?.to ?? to - trailing, rows, align: t.align, ...(metadata ? { layout: metadata.layout } : {}) });
    }
  }
  return tables;
}
export function serializeTable(rows: string[][], align: MarkdownTable["align"] = [], layout?: TableLayout): string {
  const width = Math.max(1, ...rows.map(row => row.length));
  const clean = (value = "") => value.replace(/\r?\n/g, "<br>").replace(/(?<!\\)\|/g, "\\|");
  const row = (cells: string[]) => `| ${Array.from({ length: width }, (_, i) => clean(cells[i])).join(" | ")} |`;
  return [row(rows[0] ?? ["Colonna"]), `| ${Array.from({ length: width }, (_, i) => align[i] === "center" ? ":---:" : align[i] === "right" ? "---:" : align[i] === "left" ? ":---" : "---").join(" | ")} |`, ...rows.slice(1).map(row)].join("\n") + serializeTableLayout(layout, rows.length, width);
}
// TSV parser preserves quoted multiline cells copied from Excel / Sheets.
export function parseTsv(source: string): string[][] {
  const rows: string[][] = [[]]; let value = "", quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (ch === '"' && (quoted || !value)) {
      if (quoted && source[i + 1] === '"') { value += '"'; i++; } else quoted = !quoted;
    } else if (!quoted && (ch === "\t" || ch === "\n" || ch === "\r")) {
      rows.at(-1)!.push(value); value = "";
      if (ch !== "\t") { if (ch === "\r" && source[i + 1] === "\n") i++; rows.push([]); }
    } else value += ch;
  }
  rows.at(-1)!.push(value);
  if (rows.length > 1 && rows.at(-1)!.length === 1 && !rows.at(-1)![0]) rows.pop();
  return rows;
}
export function findText(doc: string, query: string, caseSensitive = false, wholeWord = false) {
  if (!query) return [];
  const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), caseSensitive ? "gu" : "giu");
  return [...doc.matchAll(regex)].filter(m => !wholeWord || (!/[\p{L}\p{N}_]/u.test(doc[m.index! - 1] ?? "") && !/[\p{L}\p{N}_]/u.test(doc[m.index! + m[0].length] ?? ""))).map(m => ({ from: m.index!, to: m.index! + m[0].length }));
}
export function headingEntries(source: string) {
  const entries: Array<{ from: number; level: number; text: string }> = [];
  for (const { token, from } of sourceBlocks(source)) {
    if (token.type === "heading") entries.push({ from, level: token.depth, text: token.text.replace(/[*_`~]/g, "") });
  }
  return entries;
}
