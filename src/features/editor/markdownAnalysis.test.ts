import { EditorState } from "@codemirror/state";
import { describe, expect, it } from "vitest";
import { analyzeMarkdown } from "./markdownAnalysis";
import { markdownTables, serializeTable } from "./markdownTools";
import { internalNoteMarkerRanges } from "../../infrastructure/markdown/internalNoteMarkers";

describe("incremental Markdown analysis", () => {
  const table = "| A | B |\n| --- | --- |\n| uno | due |";
  it("reuses unaffected cell data while mapping its offsets and caches cursor-only updates", () => {
    let state = EditorState.create({ doc: `Paragrafo prima.\n\n${table}\n\nParagrafo dopo.` });
    const initial = analyzeMarkdown(state.doc);
    const tr = state.update({ changes: { from: 9, insert: " nuovo" } }); state = tr.state;
    const next = analyzeMarkdown(state.doc, initial, tr.changes);
    expect(next.tables[0]!.table.rows).toBe(initial.tables[0]!.table.rows);
    expect(next.tables[0]!.table.from).toBe(initial.tables[0]!.table.from + 6);
    expect(analyzeMarkdown(state.update({ selection: { anchor: 2 } }).state.doc)).toBe(next);
    expect(next.tables.map(item => item.table)).toEqual(markdownTables(state.doc.toString()));
  });
  it("keeps the full parser as the oracle for newlines, fences, YAML, nested tables and multiple edits", () => {
    const sources = [table, `---\ntags: [uno]\n---\n\n${table}`, `\`\`\`md\n${table}\n\`\`\``, `> ${table.replaceAll("\n", "\n> ")}`, `Testo\n\n${table}\n\n${table}`, `## 01/10/2026 · 12:30:00\n\n<!-- nebula-quick-note:test -->\n\n${table}`];
    for (const source of sources) {
      let state = EditorState.create({ doc: source }); let previous = analyzeMarkdown(state.doc);
      for (const insert of ["testo", "\n", "|", "\n```\n", "---\n", "\n<!-- commento -->\n"]) {
        const tr = state.update({ changes: { from: Math.floor(state.doc.length / 2), insert } }); state = tr.state;
        previous = analyzeMarkdown(state.doc, previous, tr.changes);
        expect(previous.tables.map(item => item.table)).toEqual(markdownTables(state.doc.toString()));
        expect(previous.markers).toEqual(internalNoteMarkerRanges(state.doc.toString()));
      }
    }
  });
  it("updates an inline table and shifts later tables without parsing their cells again", () => {
    const state = EditorState.create({ doc: `${table}\n\n${table}` }), before = analyzeMarkdown(state.doc);
    const first = before.tables[0]!.table;
    const text = serializeTable([["A", "B"], ["nuovo | valore", "due"]], [], { spans: [], widths: [180, 220] });
    const tr = state.update({ changes: { from: first.from, to: first.to, insert: text } });
    const after = analyzeMarkdown(tr.state.doc, before, tr.changes, true);
    expect(after.tables.map(item => item.table)).toEqual(markdownTables(tr.state.doc.toString()));
    expect(after.tables[1]!.table.rows).toBe(before.tables[1]!.table.rows);
  });
});
