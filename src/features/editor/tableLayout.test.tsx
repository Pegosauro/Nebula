/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import { undo, redo } from "@codemirror/commands";
import { cellText, cellSpan, changeTableStructure, mergeTableLayout, selectionBounds, formatTableCells, validateTableLayout, type TableLayout } from "../../infrastructure/markdown/tableLayout";
import { renderMarkdownSafe } from "../../infrastructure/markdown/renderMarkdown";
import { headingEntries, markdownTables, serializeTable } from "./markdownTools";
import { TablePanel } from "./TablePanel";
import CodeMirrorEditor from "./CodeMirrorEditor";
import MarkdownPreview from "./MarkdownPreview";
import { clearEditorMemories } from "./editorSessionCache";
import type { EditorApi } from "./editorCommands";

const rows = [["A", "B", "C"], ["Uno", "*Due*", "Tre"], ["Quattro", "Cinque", "Sei"]];
const layout: TableLayout = { widths: [180, 240, 120], spans: [{ row: 1, column: 0, rows: 2, columns: 2 }] };
let root: Root | undefined, host: HTMLDivElement | undefined;
const styles: HTMLStyleElement[] = [];
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 100, 20);
  Element.prototype.scrollIntoView = () => {};
  HTMLElement.prototype.setPointerCapture = () => {};
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute("open"); };
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); host?.remove(); host = undefined; root = undefined; styles.splice(0).forEach(style => style.remove()); clearEditorMemories(); });
async function mount(element: React.ReactNode) { host = document.createElement("div"); document.body.append(host); root = createRoot(host); await act(async () => root!.render(element)); }
const button = (label: string) => [...host!.querySelectorAll<HTMLButtonElement>("button")].find(b => b.textContent === label)!;

describe("table layouts persisted in Markdown", () => {
  it.each(["\n", "\r\n"])("round trips merges, widths, alignment and offsets without touching other blocks (%j)", newline => {
    const text = serializeTable(rows, ["center", null, "right"], layout).replaceAll("\n", newline);
    const source = `# Prima${newline}${newline}${text}${newline}${newline}## Dopo${newline}`;
    const table = markdownTables(source)[0]!;
    expect(source.slice(table.from, table.to)).toBe(text);
    expect(table).toMatchObject({ rows, layout, align: ["center", null, "right"] });
    expect(source.slice(headingEntries(source)[1]!.from)).toMatch(/^## Dopo/);
    expect(serializeTable(table.rows, table.align, table.layout)).toBe(text.replaceAll("\r\n", "\n"));
  });
  it("keeps plain tables plain and ignores table examples in code", () => {
    const plain = serializeTable(rows); expect(plain).not.toContain("nebula-table");
    expect(markdownTables(`\`\`\`md\n${serializeTable(rows, [], layout)}\n\`\`\``)).toEqual([]);
    expect(renderMarkdownSafe(`\`\`\`md\n${serializeTable(rows, [], layout)}\n\`\`\``)).toContain("nebula-table");
  });
  it("rejects malformed, overlapping, out-of-grid and cross-header metadata", () => {
    for (const value of [
      { ...layout, widths: [180, 0, 120] }, { ...layout, widths: [180, "240", 120] },
      { spans: [{ row: 0, column: 0, rows: 2, columns: 1 }] },
      { spans: [{ row: 1, column: 0, rows: 3, columns: 2 }] },
      { spans: [layout.spans[0], { row: 2, column: 1, rows: 1, columns: 2 }] },
      { version: 99, ...layout },
    ]) expect(validateTableLayout(value, 3, 3)).toBeUndefined();
    const invalid = serializeTable(rows) + '\n<!-- nebula-table:{"spans":[{"row":1,"column":0,"rows":99,"columns":2}]} -->';
    expect(markdownTables(invalid)[0]!.layout).toBeUndefined();
    expect(renderMarkdownSafe(invalid)).toContain("Cinque");
  });
  it("joins a rectangle without losing original values and transforms merges on structural edits", () => {
    const merged = mergeTableLayout({ spans: [] }, { top: 1, bottom: 2, left: 0, right: 1 })!;
    expect(cellText(rows, cellSpan(merged, 2, 1))).toBe("Uno<br>*Due*<br>Quattro<br>Cinque");
    expect(rows[2]![1]).toBe("Cinque");
    expect(mergeTableLayout(merged, { top: 1, bottom: 1, left: 1, right: 2 })).toBeUndefined();
    expect(mergeTableLayout(merged, { top: 0, bottom: 1, left: 0, right: 1 })).toBeUndefined();
    expect(changeTableStructure(layout, "row", 2, false).spans[0]!.rows).toBe(3);
    expect(changeTableStructure(layout, "column", 1, false)).toMatchObject({ widths: [180, 160, 240, 120], spans: [{ columns: 3 }] });
    expect(changeTableStructure(changeTableStructure(layout, "column", 1, false), "column", 1, true)).toEqual(layout);
    expect(changeTableStructure({ spans: [{ row: 1, column: 0, rows: 2, columns: 1 }] }, "row", 1, true).spans).toEqual([]);
  });
  it("expands selection across every intersected merge and preserves cell formats through structural edits", () => {
    const spans = [{ row: 1, column: 1, rows: 2, columns: 1 }, { row: 2, column: 2, rows: 1, columns: 2 }];
    expect(selectionBounds({ spans }, { row: 1, column: 0 }, { row: 1, column: 2 })).toEqual({ top: 1, bottom: 2, left: 0, right: 3 });
    const formatted = formatTableCells(layout, { top: 1, bottom: 2, left: 0, right: 1 }, { horizontal: "right", vertical: "middle" });
    expect(markdownTables(serializeTable(rows, [], formatted))[0]!.layout).toEqual(formatted);
    expect(changeTableStructure(changeTableStructure(formatted, "column", 1, false), "column", 1, true)).toEqual(formatted);
    expect(changeTableStructure(formatted, "row", 1, true).cells).toEqual([{ row: 1, column: 0, horizontal: "right", vertical: "middle" }, { row: 1, column: 1, horizontal: "right", vertical: "middle" }]);
    for (const cells of [[{ row: 9, column: 0, horizontal: "left" }], [{ row: 1, column: 0, vertical: "url(javascript:x)" }], [{ row: 1, column: 0, horizontal: "center" }, { row: 1, column: 0, horizontal: "right" }]]) expect(validateTableLayout({ spans: [], cells }, 3, 3)).toBeUndefined();
  });
  it("renders safe merged content and exact widths without affecting raw HTML tables", () => {
    const html = renderMarkdownSafe('<table data-nebula-table="0"><tr><td>HTML</td></tr></table>\n\n' + serializeTable(rows, [], layout) + '\n\n' + serializeTable([["X", "Y"], ['<img src="x" onerror="alert(1)">', "Z"]], [], { spans: [{ row: 1, column: 0, rows: 1, columns: 2 }] }));
    const element = document.createElement("div"); element.innerHTML = html;
    const tables = element.querySelectorAll("table"); expect(tables).toHaveLength(3);
    expect(tables[0]!.style.width).toBe("");
    expect(tables[1]!.style.width).toBe("540px");
    expect([...tables[1]!.querySelectorAll("col")].map(col => col.style.width)).toEqual(["180px", "240px", "120px"]);
    const cell = tables[1]!.querySelector("tbody td")!;
    expect(cell.getAttribute("rowspan")).toBe("2"); expect(cell.getAttribute("colspan")).toBe("2"); expect(cell.querySelector("em")!.textContent).toBe("Due");
    expect(tables[1]!.querySelectorAll("tbody td")).toHaveLength(3);
    expect(html).not.toContain("onerror"); expect(html).not.toContain("nebula-table:");
  });
});

describe("table editor interactions", () => {
  async function live(source = "Prima\n\n" + serializeTable(rows) + "\n\nDopo\n\n" + serializeTable([["X", "Y"], ["A", "B"]])) {
    const api = createRef<EditorApi>(); let content = source;
    await mount(<CodeMirrorEditor path="Inline.md" value={source} visible source={false} apiRef={api} onChange={text => { content = text; }} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} onUiChange={() => {}} onPanel={() => {}} onImages={() => {}} />);
    return { api, content: () => content, view: EditorView.findFromDOM(host!.querySelector<HTMLElement>(".cm-editor")!)! };
  }
  const inlineCell = (row: number, column: number, table = 0) => host!.querySelectorAll('.inline-table')[table]!.querySelector<HTMLElement>(`[data-row="${row}"][data-column="${column}"]`)!;
  const inlineButton = (label: string) => host!.querySelector<HTMLButtonElement>(`.inline-table [aria-label="${label}"]`)!;
  async function pick(row: number, column: number, shiftKey = false) { await act(async () => inlineCell(row, column).dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, shiftKey, button: 0 }))); }
  async function key(element: HTMLElement, key: string, extra = {}) { await act(async () => element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, ...extra }))); }
  async function edit(value: string) { const input = host!.querySelector<HTMLTextAreaElement>(".inline-table-input")!; await act(async () => { input.value = value; input.dispatchEvent(new Event("input", { bubbles: true })); }); return input; }
  it("edits in place without replacing the focused textarea, saves immediately and keeps other blocks intact", async () => {
    const { content, api } = await live();
    await pick(1, 0); await key(inlineCell(1, 0), "Enter");
    const input = await edit("Nuovo | valore\nseconda riga");
    expect(host!.querySelector(".inline-table-input")).toBe(input); expect(document.activeElement).toBe(input);
    expect(markdownTables(content())[0]!.rows[1]![0]).toBe("Nuovo | valore<br>seconda riga");
    await key(input, "Tab"); expect(document.activeElement).toBe(inlineCell(1, 1));
    expect(host!.querySelector("dialog")).toBeNull();
    expect(content().startsWith("Prima\n\n")).toBe(true); expect(content()).toContain("\n\nDopo\n\n");
    expect(markdownTables(content())[1]!.rows).toEqual([["X", "Y"], ["A", "B"]]);
    await act(async () => api.current!.undo()); expect(markdownTables(content())[0]!.rows).toEqual(rows);
    await act(async () => api.current!.redo()); expect(markdownTables(content())[0]!.rows[1]![0]).toContain("Nuovo");
  });
  it("joins and splits inline without losing values, and Escape restores a merged edit", async () => {
    const { content } = await live();
    await pick(1, 0); await pick(2, 1, true);
    await act(async () => inlineButton("Unisci celle").click());
    expect(host!.querySelector('.inline-table td[rowspan="2"][colspan="2"]')).toBeTruthy();
    expect(markdownTables(content())[0]!.rows).toEqual(rows);
    await key(inlineCell(1, 0), "Enter"); await edit("Sostituito"); await key(host!.querySelector("textarea")!, "Escape");
    expect(markdownTables(content())[0]!.rows).toEqual(rows);
    await act(async () => inlineButton("Dividi celle").click()); expect(inlineCell(2, 1).textContent).toBe("Cinque");
  });
  it("changes structure, alignment and width directly, then edits a second table after offsets move", async () => {
    const { content, api } = await live(); await pick(1, 0);
    await act(async () => inlineButton("Aggiungi riga sotto").click());
    await act(async () => inlineButton("Aggiungi colonna a destra").click());
    let table = markdownTables(content())[0]!; expect(table.rows).toHaveLength(4); expect(table.rows[0]).toHaveLength(4);
    await pick(1, 1);
    await act(async () => inlineButton("Allinea al centro").click());
    await key(host!.querySelector('[aria-label="Ridimensiona colonna 2"]')!, "ArrowRight");
    table = markdownTables(content())[0]!; expect(table.layout?.cells).toEqual([{ row: 1, column: 1, horizontal: "center" }]); expect(table.layout?.widths?.[1]).toBe(170);
    await act(async () => api.current!.replace(0, 0, "Una premessa\n\n"));
    await act(async () => inlineCell(1, 0, 1).dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    const input = await edit("Seconda"); await key(input, "Enter");
    expect(markdownTables(content())[1]!.rows[1]![0]).toBe("Seconda"); expect(markdownTables(content())[0]!.rows).toHaveLength(4);
  });
  it("pastes spreadsheet cells inline and removes all editing controls when locked", async () => {
    const { content } = await live(); await pick(1, 0);
    const paste = new Event("paste", { bubbles: true, cancelable: true }); Object.defineProperty(paste, "clipboardData", { value: { getData: () => "Uno\tDue\nTre\tQuattro" } });
    await act(async () => inlineCell(1, 0).dispatchEvent(paste));
    expect(markdownTables(content())[0]!.rows.slice(1, 3).map(row => row.slice(0, 2))).toEqual([["Uno", "Due"], ["Tre", "Quattro"]]);
    await act(async () => root!.render(<MarkdownPreview sourcePath="Inline.md" content={content()} readOnly />));
    expect(host!.querySelector(".inline-table-toolbar")).toBeNull(); expect(host!.querySelector("textarea")).toBeNull();
    expect(host!.querySelector("table")!.textContent).toContain("Quattro");
  });
  it("selects rectangular cells by dragging, preserves text selection when editing, and clears only selected contents", async () => {
    const { content, api } = await live(); const before = content();
    await pick(1, 0);
    await act(async () => inlineCell(2, 1).dispatchEvent(new MouseEvent("pointermove", { bubbles: true, buttons: 1 })));
    await act(async () => document.dispatchEvent(new MouseEvent("pointerup", { bubbles: true })));
    expect(host!.querySelectorAll(".inline-table td.is-selected")).toHaveLength(4);
    expect(content()).toBe(before);
    await key(inlineCell(2, 1), "Delete");
    expect(markdownTables(content())[0]!.rows).toEqual([["A", "B", "C"], ["", "", "Tre"], ["", "", "Sei"]]);
    expect(host!.querySelector("textarea")).toBeNull();
    await act(async () => api.current!.undo()); expect(content()).toBe(before);
    await pick(1, 0); await key(inlineCell(1, 0), "Enter");
    const input = await edit("Seleziona questo testo");
    const event = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0 });
    await act(async () => input.dispatchEvent(event));
    expect(event.defaultPrevented).toBe(false); expect(host!.querySelector("textarea")).toBe(input);
    await key(input, "Enter", { isComposing: true }); expect(host!.querySelector("textarea")).toBe(input);
  });
  it("selects and deletes multiple whole rows or columns, previews the affected area and undoes in one step", async () => {
    const { content, api } = await live(); const before = content();
    await act(async () => inlineButton("Seleziona riga 2").dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 })));
    await act(async () => inlineButton("Seleziona riga 3").dispatchEvent(new MouseEvent("pointermove", { bubbles: true, buttons: 1 })));
    await act(async () => document.dispatchEvent(new MouseEvent("pointerup")));
    expect(host!.querySelectorAll(".inline-table td.is-selected")).toHaveLength(6);
    await act(async () => inlineButton("Elimina 2 righe").dispatchEvent(new MouseEvent("pointerenter")));
    expect(host!.querySelectorAll(".is-delete-preview")).toHaveLength(6);
    await act(async () => inlineButton("Elimina 2 righe").click());
    expect(markdownTables(content())[0]!.rows).toEqual([rows[0]]);
    await act(async () => api.current!.undo()); expect(content()).toBe(before);
    await act(async () => inlineButton("Seleziona colonna 1").click());
    await act(async () => inlineButton("Seleziona colonna 2").dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })));
    expect(host!.querySelectorAll(".inline-table :is(th,td).is-selected")).toHaveLength(6);
    await act(async () => inlineButton("Elimina 2 colonne").click());
    expect(markdownTables(content())[0]!.rows).toEqual([["C"], ["Tre"], ["Sei"]]);
    await act(async () => api.current!.undo()); expect(content()).toBe(before);
    await act(async () => inlineButton("Seleziona tutta la tabella").click());
    await act(async () => inlineButton("Elimina 3 colonne").click());
    expect(markdownTables(content())).toHaveLength(1); expect(content()).toContain("Dopo");
    await act(async () => api.current!.undo()); expect(content()).toBe(before);
  });
  it("applies all nine alignment positions to the selection only and shows mixed values honestly", async () => {
    const { content } = await live(); await pick(1, 0); await pick(2, 1, true);
    for (const [horizontal, label] of [["left", "Allinea a sinistra"], ["center", "Allinea al centro"], ["right", "Allinea a destra"]]) {
      await act(async () => inlineButton(label!).click());
      for (const [vertical, label] of [["top", "Allinea in alto"], ["middle", "Allinea a metà altezza"], ["bottom", "Allinea in basso"]]) {
        await act(async () => inlineButton(label!).click());
        const table = markdownTables(content())[0]!;
        expect(table.layout!.cells).toHaveLength(4);
        expect(table.layout!.cells!.every(cell => cell.horizontal === horizontal && cell.vertical === vertical)).toBe(true);
        expect(inlineCell(1, 0).style.textAlign).toBe(horizontal); expect(inlineCell(2, 1).style.verticalAlign).toBe(vertical);
        expect(inlineCell(1, 2).style.textAlign).toBe(""); expect(inlineCell(0, 0).style.verticalAlign).toBe("");
      }
    }
    await pick(1, 0); await pick(1, 2, true);
    expect(host!.querySelectorAll('[aria-label="Allineamento orizzontale"] [aria-pressed="true"]')).toHaveLength(0);
    await act(async () => root!.render(<MarkdownPreview sourcePath="Inline.md" content={content()} readOnly />));
    const cells = host!.querySelectorAll<HTMLTableCellElement>("table tbody tr:first-child td");
    expect(cells[0]!.style.textAlign).toBe("right"); expect(cells[1]!.style.verticalAlign).toBe("bottom"); expect(cells[2]!.style.textAlign).toBe("");
  });
  it("appends at the edges, focuses new input, extends with the keyboard and removes obsolete tools", async () => {
    const { content } = await live(); await pick(1, 0);
    for (const label of ["Modifica tabella", "Selezione multipla", "Modifica cella", "Allineamento colonna", "Larghezza colonna in pixel"]) expect(inlineButton(label)).toBeNull();
    await act(async () => inlineButton("Aggiungi riga sotto").click());
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Riga 4 colonna 1");
    const input = await edit("In fondo"); await key(input, "Enter");
    expect(markdownTables(content())[0]!.rows[3]![0]).toBe("In fondo");
    await act(async () => inlineButton("Aggiungi colonna a destra").click());
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Riga 4 colonna 4");
    await key(host!.querySelector("textarea")!, "Escape");
    await act(async () => inlineButton("Seleziona riga 2").click());
    await key(document.activeElement as HTMLElement, "ArrowDown", { shiftKey: true });
    expect(host!.querySelectorAll(".inline-table td.is-selected")).toHaveLength(8);
    await key(document.activeElement as HTMLElement, "a", { ctrlKey: true });
    expect(host!.querySelectorAll(".inline-table :is(td,th).is-selected")).toHaveLength(16);
  });
  it("keeps the editor mounted during repeated input, supports touch editing and commits a resize as one undo step", async () => {
    const { content, api } = await live();
    for (let tap = 0; tap < 2; tap++) {
      const event = new MouseEvent("pointerdown", { bubbles: true, button: 0 }); Object.defineProperty(event, "pointerType", { value: "touch" });
      await act(async () => inlineCell(1, 0).dispatchEvent(event));
      await act(async () => document.dispatchEvent(new MouseEvent("pointerup")));
    }
    const input = host!.querySelector<HTMLTextAreaElement>(".inline-table-input")!; expect(input).not.toBeNull();
    for (let n = 1; n <= 20; n++) { await edit("Scrittura continua ".repeat(n)); expect(host!.querySelector("textarea")).toBe(input); }
    const separator = inlineButton("Ridimensiona colonna 2");
    await act(async () => separator.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0, clientX: 100 })));
    for (const [type, x] of [["pointermove", 160], ["pointerup", 160]] as const) await act(async () => inlineButton("Ridimensiona colonna 2").dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0, clientX: x })));
    expect(markdownTables(content())[0]!.layout!.widths).toEqual([160, 220, 160]);
    await act(async () => api.current!.undo());
    expect(markdownTables(content())[0]!.layout?.widths).toBeUndefined();
    expect(markdownTables(content())[0]!.rows[1]![0]).toContain("Scrittura continua");
  });
  it("promotes the next row when deleting the header without losing merged contents or cell formats", async () => {
    const styled = formatTableCells(layout, { top: 1, bottom: 2, left: 0, right: 1 }, { vertical: "bottom" });
    const { content, api } = await live(serializeTable(rows, [], styled));
    await act(async () => inlineButton("Seleziona riga 1").click());
    await act(async () => inlineButton("Elimina 1 riga").click());
    const table = markdownTables(content())[0]!;
    expect(table.rows).toEqual(rows.slice(1)); expect(table.layout?.spans).toEqual([]);
    expect(table.layout?.cells?.[0]).toMatchObject({ row: 0, column: 0, vertical: "bottom" });
    await act(async () => api.current!.undo()); expect(markdownTables(content())[0]!.layout).toEqual(styled);
  });
  it("selects, joins, resizes, saves and reopens a table; splitting restores original cells", async () => {
    const save = vi.fn(); await mount(<TablePanel table={markdownTables(serializeTable(rows))[0]} onSave={save} onClose={() => {}} />);
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Seleziona riga 1 colonna 1"]')!.click());
    await act(async () => host!.querySelector('[aria-label="Seleziona riga 2 colonna 2"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })));
    expect(button("Unisci celle").disabled).toBe(false);
    await act(async () => button("Unisci celle").click());
    expect(host!.querySelector('td[rowspan="2"][colspan="2"] input')!.getAttribute("value")).toBe("Uno<br>*Due*<br>Quattro<br>Cinque");
    const separator = host!.querySelector('[aria-label="Ridimensiona colonna 1"]')!;
    await act(async () => separator.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })));
    await act(async () => button("Applica modifiche").click());
    const parsed = markdownTables(save.mock.calls[0]![0])[0]!;
    expect(parsed.rows).toEqual(rows); expect(parsed.layout).toEqual({ ...layout, widths: [170, 160, 160] });
    await act(async () => root!.render(<TablePanel key="reopened" table={parsed} onSave={save} onClose={() => {}} />));
    expect(host!.querySelectorAll('td[rowspan="2"][colspan="2"]')).toHaveLength(1);
    await act(async () => button("Dividi celle").click());
    expect(host!.querySelector<HTMLInputElement>('[aria-label="Riga 2 colonna 2"]')!.value).toBe("Cinque");
  });
  it("supports range mode, pointer resize and editing a merged value without stale hidden text", async () => {
    const save = vi.fn(); await mount(<TablePanel table={markdownTables(serializeTable(rows))[0]} onSave={save} onClose={() => {}} />);
    await act(async () => button("Selezione multipla").click());
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Seleziona riga 1 colonna 2"]')!.click());
    await act(async () => button("Unisci celle").click());
    const separator = host!.querySelector('[aria-label="Ridimensiona colonna 2"]')!;
    for (const [type, x] of [["pointerdown", 100], ["pointermove", 190], ["pointerup", 190]] as const) {
      const event = new MouseEvent(type, { clientX: x, button: 0, bubbles: true }); Object.defineProperty(event, "pointerId", { value: 1 });
      await act(async () => separator.dispatchEvent(event));
    }
    expect(separator.getAttribute("aria-valuenow")).toBe("250");
    const input = host!.querySelector<HTMLInputElement>('[aria-label="Riga 1 colonna 1"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Nuovo testo"); input.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => button("Applica modifiche").click());
    const parsed = markdownTables(save.mock.calls[0]![0])[0]!;
    expect(parsed.rows[1]!.slice(0, 2)).toEqual(["Nuovo testo", ""]); expect(parsed.layout!.widths).toEqual([160, 250, 160]);
  });
  it("keeps header/body merge disabled and closes without writing when cancelled", async () => {
    const save = vi.fn(), close = vi.fn(); await mount(<TablePanel onSave={save} onClose={close} />);
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Seleziona intestazione colonna 1"]')!.click());
    await act(async () => host!.querySelector('[aria-label="Seleziona riga 1 colonna 2"]')!.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })));
    expect(button("Unisci celle").disabled).toBe(true);
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Chiudi"]')!.click());
    expect(close).toHaveBeenCalled(); expect(save).not.toHaveBeenCalled();
  });
  it("hides layout metadata in Scrivi, shares reading rendering and applies changes with undo/redo", async () => {
    const api = createRef<EditorApi>(); const before = "# Dati\n\n" + serializeTable(rows) + "\n\nFine"; let content = before;
    await mount(<CodeMirrorEditor path="Tabella.md" value={before} visible source={false} apiRef={api} onChange={text => { content = text; }} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} onUiChange={() => {}} onPanel={() => {}} onImages={() => {}} />);
    const table = markdownTables(before)[0]!;
    await act(async () => api.current!.replace(table.from, table.to, serializeTable(rows, [], layout)));
    expect(host!.textContent).not.toContain("nebula-table:"); expect(host!.querySelector('td[colspan="2"][rowspan="2"]')).not.toBeNull();
    const view = EditorView.findFromDOM(host!.querySelector<HTMLElement>(".cm-editor")!)!;
    await act(async () => { undo(view); }); expect(content).toBe(before);
    await act(async () => { redo(view); }); expect(markdownTables(content)[0]!.layout).toEqual(layout);
    await act(async () => root!.render(<MarkdownPreview content={content} sourcePath="Tabella.md" readOnly />));
    expect(host!.querySelector('td[colspan="2"][rowspan="2"]')).not.toBeNull(); expect(host!.querySelector("table")!.style.width).toBe("540px"); expect(host!.textContent).not.toContain("nebula-table:");
  });
  it.each(["light", "dark"])("keeps writing content from growing beyond its centered page width (%s)", async theme => {
    for (const file of ["../../styles/features.css", "../../styles/editor.css"]) { const style = document.createElement("style"); style.textContent = readFileSync(new URL(file, import.meta.url), "utf8"); document.head.append(style); styles.push(style); }
    document.documentElement.dataset.theme = theme;
    await mount(<section className="editor-v2"><CodeMirrorEditor path="Centro.md" value="# Centrata" visible source={false} apiRef={createRef<EditorApi>()} onChange={() => {}} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} onUiChange={() => {}} onPanel={() => {}} onImages={() => {}} /></section>);
    const style = getComputedStyle(host!.querySelector(".cm-content")!);
    expect(style.flexGrow).toBe("0"); expect(style.flexShrink).toBe("0"); expect(style.marginInline).toBe("auto");
  });
});
