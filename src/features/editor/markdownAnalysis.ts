import type { ChangeSet, Text } from "@codemirror/state";
import { frontmatterRange, type Frontmatter } from "../../domain/noteProperties";
import { internalNoteMarkerRanges } from "../../infrastructure/markdown/internalNoteMarkers";
import { markdownTables, type MarkdownTable } from "./markdownTools";

interface TableBlock { table: MarkdownTable; raw: string }
export interface MarkdownAnalysis {
  source: string;
  metadata?: Frontmatter;
  tables: TableBlock[];
  markers: Array<{ from: number; to: number }>;
}
const textCache = new WeakMap<Text, string>();
const analysisCache = new WeakMap<Text, MarkdownAnalysis>();

/** Share the string needed for persistence; caret and viewport updates never
 * flatten or parse the document again. Weak keys release closed editor states. */
export function documentText(doc: Text): string {
  let text = textCache.get(doc);
  if (text === undefined) { text = doc.toString(); textCache.set(doc, text); }
  return text;
}

export function analyzeMarkdown(doc: Text, previous?: MarkdownAnalysis, changes?: ChangeSet, tableInput = false): MarkdownAnalysis {
  const cached = analysisCache.get(doc);
  if (cached) return cached;
  const source = documentText(doc);
  const replacements = new Map<number, TableBlock>();
  let reusable = !!previous && !!changes;
  changes?.iterChanges((from, to, fromB, _toB, insert) => {
    if (!previous || !reusable) return;
    const block = previous.tables.find(item => item.table.from === from && item.table.to === to);
    if (tableInput && block) {
      const raw = insert.toString(), parsed = markdownTables(raw)[0];
      if (parsed?.from === 0 && parsed.to === raw.length) {
        replacements.set(from, { table: { ...parsed, from: fromB, to: fromB + raw.length }, raw });
        return;
      }
    }
    // Plain typing inside an existing text line cannot create/remove a block.
    // Newlines, delimiters, indentation and all structural edits use the full
    // block lexer, preserving Markdown, fences, YAML and undo semantics.
    const start = previous.source.lastIndexOf("\n", from - 1) + 1;
    const end = previous.source.indexOf("\n", to);
    const line = previous.source.slice(start, end < 0 ? undefined : end);
    const added = insert.toString();
    const nextLine = line.slice(0, from - start) + added + line.slice(to - start);
    if (from <= start + 3 || /[\r\n|`~<>]/.test(line + added) || !nextLine.trim() || /^\s*(?:#{1,6}|[-+*]|\d+[.)])\s/.test(line)
      || from < (previous.metadata?.end ?? 0)
      || previous.tables.some(item => from <= item.table.to && to >= item.table.from)
      || previous.markers.some(item => from <= item.to && to >= item.from)) reusable = false;
  });
  let result: MarkdownAnalysis;
  if (reusable && previous && changes) {
    result = {
      source, metadata: previous.metadata,
      tables: previous.tables.map(block => replacements.get(block.table.from) ?? {
        raw: block.raw,
        table: { ...block.table, from: changes.mapPos(block.table.from, 1), to: changes.mapPos(block.table.to, -1) },
      }),
      markers: previous.markers.map(marker => ({ from: changes.mapPos(marker.from, 1), to: changes.mapPos(marker.to, -1) })),
    };
  } else {
    result = {
      source, metadata: frontmatterRange(source),
      tables: markdownTables(source).map(table => ({ table, raw: source.slice(table.from, table.to) })),
      markers: internalNoteMarkerRanges(source),
    };
  }
  analysisCache.set(doc, result);
  return result;
}
