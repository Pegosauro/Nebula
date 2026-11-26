import { dragPreview, scrollAtDragEdge, trackPointerDrag, type DragPoint } from "../../components/ui/pointerDrag";
import { findClusterBreak } from "@codemirror/state";
import type { PaletteColor } from "../../domain/colorPalette";
import { showTableColorMenu } from "./tableColorMenu";
import { navigationKnowledge } from "../configurator/navigationKnowledge";
import { renderMarkdownSafe } from "../../infrastructure/markdown/renderMarkdown";
import { canInsertTableAxis, cellFontStyles, cellSpan, cellText, changeTableStructure, columnWidth, containsCell, DEFAULT_COLUMN_WIDTH, formatTableCells, MAX_COLUMN_WIDTH, mergeTableLayout, MIN_COLUMN_WIDTH, reorderTableAxis, selectionBounds, tableAxisRange, type AxisRange, type TableAxis, type CellColor, type CellFontStyle, type CellFormat, type TableCell, type TableLayout } from "../../infrastructure/markdown/tableLayout";
import { parseTsv, serializeTable, serializeTsv, type MarkdownTable } from "./markdownTools";

type Axis = TableAxis;
type SelectionKind = "cells" | Axis | "all";
interface Options {
  change: (previous: MarkdownTable, text: string, isolate: "before" | "full" | undefined) => void;
  history: (redo: boolean) => void;
  decorate: (host: HTMLElement) => void;
  measure: () => void;
  dispose: () => void;
}
const headerIcon = "M3 4h18v16H3zM3 10h18M12 10v10";
const hiddenHeaderIcon = "M3 10h18v10H3zM12 10v10M3 4h3M10 4h4M18 4h3";
const alignmentIcons: Record<string, string> = {
  left: "M4 5h16M4 10h10M4 15h16M4 20h10", center: "M4 5h16M7 10h10M4 15h16M7 20h10", right: "M4 5h16M10 10h10M4 15h16M10 20h10",
  top: "M4 4h16M8 8h8M8 12h8M8 16h8", middle: "M4 12h3M17 12h3M9 7h6M9 12h6M9 17h6", bottom: "M4 20h16M8 8h8M8 12h8M8 16h8",
};
const fontTools: Record<CellFontStyle, readonly [string, string]> = {
  bold: ["Grassetto", "M6 4h8a4 4 0 0 1 0 8H6m0-8v16h9a4 4 0 0 0 0-8H6"],
  italic: ["Corsivo", "M19 4H10m4 0-4 16m4 0H5"],
  underline: ["Sottolineato", "M6 4v7a6 6 0 0 0 12 0V4M4 21h16"],
  strike: ["Barrato", "M17 5H9a3.5 3.5 0 0 0-1.5 6.7m9 1.3a3.5 3.5 0 0 1-1.5 6.7H6M3 12h18"],
};
const colorTools = [
  ["textColor", "Colore del testo", "M6 16 12 4l6 12m-9-4h6M4 21h16"],
  ["backgroundColor", "Colore dello sfondo", "m8 3 10 10-6 6a2 2 0 0 1-3 0l-5-5a2 2 0 0 1 0-3l6-6m-6 8h14m2 3v4"],
] as const;
function icon(path: string) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "16"); svg.setAttribute("height", "16"); svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "1.7"); svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("aria-hidden", "true");
  const line = document.createElementNS(svg.namespaceURI, "path"); line.setAttribute("d", path); svg.append(line); return svg;
}

/** The focused textarea stays mounted while CodeMirror records changes. Pointer
 * selection only paints this widget; it never rewrites the note or its history. */
export class InlineTable {
  private first: TableCell = { row: 0, column: 0 };
  private active: TableCell = { row: 0, column: 0 };
  private kind: SelectionKind = "cells";
  private axisAnchor = 0;
  private selected = false;
  private editing?: { input: HTMLTextAreaElement; originalRows: string[][]; cell: TableCell; firstChange: boolean };
  private events = new AbortController();
  private toolbar = document.createElement("div");
  private body = document.createElement("div");
  private status = document.createElement("span");
  private headerButton: HTMLButtonElement;
  private colorMenu?: { key: CellColor; close: () => void };
  private activeColors: Partial<Record<CellColor, PaletteColor>> = {};
  private buttons = new Map<string, HTMLButtonElement>();
  private tableElement!: HTMLTableElement;
  private frame!: HTMLDivElement;
  private controls!: HTMLDivElement;
  private scroll?: HTMLElement;
  private cells: HTMLTableCellElement[] = [];
  private rowHandles: HTMLButtonElement[] = [];
  private columnHandles: HTMLButtonElement[] = [];
  private observer?: ResizeObserver;
  private geometryFrame = 0;
  private drag?: { kind: "cells" | Axis; pointerId: number };
  private preview?: Axis;
  private cancelReorder?: () => void;
  private resizing?: { column: number; x: number; width: number; widths: number[] };
  constructor(readonly host: HTMLElement, private table: MarkdownTable, private raw: string, private options: Options) {
    host.classList.add("inline-table"); host.contentEditable = "false";
    this.toolbar.className = "inline-table-toolbar";
    this.toolbar.setAttribute("role", "toolbar"); this.toolbar.setAttribute("aria-label", "Strumenti tabella");
    this.status.className = "inline-table-status"; this.status.setAttribute("role", "status");
    this.toolbar.append(this.status);
    this.headerButton = this.tool("header", "Nascondi intestazione", icon(headerIcon), () => this.toggleHeader());
    const copy = this.tool("copy", "Copia celle", icon("M8 8h12v12H8zM16 8V4H4v12h4"), () => void this.copyCells());
    copy.title = "Copia celle per Excel (Ctrl/⌘ C)";
    copy.setAttribute("aria-keyshortcuts", "Control+C Meta+C");
    const fontGroup = this.toolGroup("Formattazione del testo delle celle");
    for (const style of cellFontStyles) {
      const [label, path] = fontTools[style];
      this.tool(style, label, icon(path), () => {
        const pressed = this.buttons.get(style)!.getAttribute("aria-pressed") === "true";
        this.applyFormat({ [style]: !pressed });
      }, fontGroup);
    }
    const colorGroup = this.toolGroup("Colori delle celle");
    for (const [key, label, path] of colorTools) {
      const button = this.tool(key, label, icon(path), () => queueMicrotask(() => this.toggleColorMenu(key)), colorGroup);
      button.classList.add("inline-table-color-tool");
      button.setAttribute("aria-haspopup", "dialog");
      button.setAttribute("aria-expanded", "false");
    }
    for (const [axis, label, values] of [
      ["horizontal", "Allineamento orizzontale", [["left", "Allinea a sinistra"], ["center", "Allinea al centro"], ["right", "Allinea a destra"]]],
      ["vertical", "Allineamento verticale", [["top", "Allinea in alto"], ["middle", "Allinea a metà altezza"], ["bottom", "Allinea in basso"]]],
    ] as const) {
      const group = this.toolGroup(label);
      for (const [value, name] of values) this.tool(`${axis}-${value}`, name, icon(alignmentIcons[value]!), () => this.applyFormat({ [axis]: value }), group);
    }
    this.tool("merge", "Unisci celle", "Unisci", () => {
      const bounds = this.bounds, layout = mergeTableLayout(this.layout, bounds); if (!layout) return;
      this.active = this.first = { row: bounds.top, column: bounds.left }; this.kind = "cells";
      this.write({ ...this.table, layout });
    });
    this.tool("split", "Dividi celle", "Dividi", () => this.write({ ...this.table, layout: { ...this.layout, spans: this.layout.spans.filter(s => !this.intersects(s)) } }));
    for (const axis of ["row", "column"] as const) {
      const button = this.tool(`delete-${axis}`, "", "", () => this.remove(axis)); button.classList.add("inline-table-delete");
      for (const event of ["pointerenter", "focus"] as const) button.addEventListener(event, () => { this.preview = axis; this.paint(); });
      for (const event of ["pointerleave", "blur"] as const) button.addEventListener(event, () => { this.preview = undefined; this.paint(); });
    }
    this.body.className = "inline-table-body"; host.replaceChildren(this.toolbar, this.body);
    const signal = this.events.signal;
    document.addEventListener("pointerdown", event => { if (!host.contains(event.target as Node)) { this.finishEdit(); this.selected = false; this.drag = undefined; this.paint(); } }, { signal });
    document.addEventListener("pointermove", e => this.dragSelection(e), { signal });
    document.addEventListener("pointerup", () => { this.drag = undefined; }, { signal });
    document.addEventListener("pointercancel", () => { this.drag = undefined; }, { signal });
    window.addEventListener("blur", () => { this.drag = undefined; }, { signal });
    host.addEventListener("focusout", event => {
      if (event.relatedTarget instanceof Node && host.contains(event.relatedTarget)) return;
      queueMicrotask(() => { if (!host.contains(document.activeElement) && !this.drag) { this.selected = false; this.paint(); } });
    }, { signal });
    host.addEventListener("keydown", e => this.keydown(e), { signal });
    host.addEventListener("copy", e => {
      if (!this.selected || this.editing || !e.clipboardData || (e.target as Element).closest("input,textarea,select")) return;
      e.clipboardData.setData("text/plain", this.selectionTsv());
      e.preventDefault(); e.stopPropagation();
      this.status.textContent = "Celle copiate";
    }, { signal });
    host.addEventListener("paste", e => { if (this.editing || (e.target as HTMLElement).closest("input,select,button")) return; const text = e.clipboardData?.getData("text/plain") ?? ""; if (!text) return; e.preventDefault(); e.stopPropagation(); this.selected = true; if (text.includes("\t")) this.paste(text); else this.startEdit(text); }, { signal });
    this.clampSelection();
    this.render();
  }
  get layout(): TableLayout { return this.table.layout ?? { spans: [] }; }
  private get firstVisibleRow() { return this.layout.headerHidden ? 1 : 0; }
  get columns() { return this.table.rows[0]!.length; }
  get bounds() { return selectionBounds(this.layout, this.first, this.active); }
  private intersects(s: { row: number; column: number; rows: number; columns: number }) { const b = this.bounds; return s.row <= b.bottom && s.row + s.rows > b.top && s.column <= b.right && s.column + s.columns > b.left; }
  sync(table: MarkdownTable, raw: string) {
    const changed = raw !== this.raw; this.table = table; this.raw = raw;
    if (changed) { this.cancelReorder?.(); this.colorMenu?.close(); this.editing = undefined; this.resizing = undefined; this.drag = undefined; this.clampSelection(); this.render(); }
  }
  destroy() { this.cancelReorder?.(); this.colorMenu?.close(); this.events.abort(); this.observer?.disconnect(); cancelAnimationFrame(this.geometryFrame); this.options.dispose(); }
  private toolGroup(label: string) {
    const group = document.createElement("div");
    group.className = "inline-table-tool-group";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", label);
    this.toolbar.append(group);
    return group;
  }
  private applyFormat(format: Omit<CellFormat, keyof TableCell>) {
    this.write({ ...this.table, layout: formatTableCells(this.layout, this.bounds, format) });
  }
  private toggleColorMenu(key: CellColor) {
    const current = this.colorMenu?.key;
    this.colorMenu?.close();
    if (current === key || !this.host.isConnected || !this.selected) return;
    const close = showTableColorMenu(this.host, this.buttons.get(key)!, this.activeColors[key], color => {
      this.applyFormat({ [key]: color });
      this.focusCell();
    }, () => { this.colorMenu = undefined; });
    this.colorMenu = { key, close };
  }
  private tool(id: string, label: string, content: string | SVGSVGElement, action: () => void, parent = this.toolbar) {
    const button = document.createElement("button"); button.type = "button"; button.append(content); button.title = label; button.setAttribute("aria-label", label);
    button.addEventListener("pointerdown", e => e.preventDefault());
    button.addEventListener("click", () => { this.finishEdit(); this.selected = true; action(); this.preview = undefined; this.paint(); if (!this.editing) this.focusCell(); });
    this.buttons.set(id, button); parent.append(button); return button;
  }
  private clampSelection() {
    const clamp = (cell: TableCell) => ({ row: Math.max(this.firstVisibleRow, Math.min(this.table.rows.length - 1, cell.row)), column: Math.max(0, Math.min(this.columns - 1, cell.column)) });
    this.first = clamp(this.first); this.active = clamp(this.active);
    if (this.kind === "row") this.axisAnchor = Math.max(this.firstVisibleRow, this.axisAnchor);
  }
  private toggleHeader() {
    const headerHidden = !this.layout.headerHidden;
    const rows = headerHidden && this.table.rows.length === 1
      ? [...this.table.rows, Array<string>(this.columns).fill("")]
      : this.table.rows;
    this.write({ ...this.table, rows, layout: { ...this.layout, headerHidden } });
  }
  private cellElement(cell = this.active) { const s = cellSpan(this.layout, cell.row, cell.column); return this.body.querySelector<HTMLTableCellElement>(`[data-row="${s.row}"][data-column="${s.column}"]`); }
  private focusCell() { this.cellElement()?.focus({ preventScroll: true }); }
  private select(cell: TableCell, extend = false) {
    this.finishEdit(); const span = cellSpan(this.layout, cell.row, cell.column);
    this.active = { row: span.row, column: span.column }; if (!extend) this.first = this.active;
    this.kind = "cells"; this.selected = true; this.paint(); this.focusCell();
  }
  private selectAxis(axis: Axis, index: number, extend = false) {
    this.finishEdit(); if (!extend || this.kind !== axis) this.axisAnchor = index;
    this.kind = axis;
    this.first = axis === "row" ? { row: this.axisAnchor, column: 0 } : { row: this.firstVisibleRow, column: this.axisAnchor };
    this.active = axis === "row" ? { row: index, column: this.columns - 1 } : { row: this.table.rows.length - 1, column: index };
    this.selected = true; this.paint(); this.focusCell();
  }
  private selectAll() { this.finishEdit(); this.kind = "all"; this.first = { row: this.firstVisibleRow, column: 0 }; this.active = { row: this.table.rows.length - 1, column: this.columns - 1 }; this.selected = true; this.paint(); this.focusCell(); }
  private dragSelection(e: PointerEvent) {
    if (!this.drag || this.drag.pointerId !== e.pointerId) return;
    const target = e.target instanceof Element ? e.target : undefined;
    const cell = target?.closest<HTMLElement>("[data-row][data-column]"), handle = target?.closest<HTMLElement>("[data-select-row],[data-select-column]");
    if (!this.body.contains(cell ?? handle ?? null)) return;
    const row = Number(cell?.dataset.row ?? handle?.dataset.selectRow), column = Number(cell?.dataset.column ?? handle?.dataset.selectColumn);
    if (this.drag.kind === "row" && Number.isFinite(row) && row !== this.active.row) this.selectAxis("row", row, true);
    else if (this.drag.kind === "column" && Number.isFinite(column) && column !== this.active.column) this.selectAxis("column", column, true);
    else if (this.drag.kind === "cells" && cell && (row !== this.active.row || column !== this.active.column)) this.select({ row, column }, true);
  }
  private paint() {
    const activated = this.selected && !this.host.classList.contains("is-active");
    this.host.classList.toggle("is-active", this.selected); this.host.classList.toggle("is-editing", !!this.editing);
    if (activated) this.scheduleGeometry();
    if (!this.selected) this.colorMenu?.close();
    const bounds = this.bounds, rowCount = bounds.bottom - bounds.top + 1, columnCount = bounds.right - bounds.left + 1, count = rowCount * columnCount;
    this.status.textContent = this.selected ? this.kind === "row" ? `${rowCount} ${rowCount === 1 ? "riga" : "righe"}` : this.kind === "column" ? `${columnCount} ${columnCount === 1 ? "colonna" : "colonne"}` : count > 1 ? `${count} celle` : `R${this.active.row + 1 - this.firstVisibleRow} · C${this.active.column + 1}` : "Seleziona una cella e scrivi";
    const formats = new Map((this.layout.cells ?? []).map(cell => [`${cell.row}:${cell.column}`, cell]));
    const horizontal = new Set<string>(), vertical = new Set<string>(), activeElement = this.cellElement();
    const fonts = new Map<CellFontStyle, number>();
    const colors = { textColor: new Set<PaletteColor | undefined>(), backgroundColor: new Set<PaletteColor | undefined>() };
    let selectedCells = 0;
    for (const cell of this.cells) {
      const r = Number(cell.dataset.row), c = Number(cell.dataset.column), active = cell === activeElement, selected = this.selected && containsCell(bounds, r, c);
      cell.classList.toggle("is-selected", selected); cell.classList.toggle("is-active", this.selected && active);
      cell.classList.toggle("is-delete-preview", this.selected && !!this.preview && (this.preview === "row" ? r >= bounds.top && r <= bounds.bottom : c >= bounds.left && c <= bounds.right));
      cell.setAttribute("aria-selected", String(selected)); cell.tabIndex = active ? 0 : -1;
      if (selected) {
        selectedCells++;
        const format = formats.get(`${r}:${c}`);
        horizontal.add(format?.horizontal ?? this.table.align[c] ?? "left");
        vertical.add(format?.vertical ?? "top");
        for (const style of cellFontStyles) {
          if (format?.[style] ?? (style === "bold" && r === 0)) fonts.set(style, (fonts.get(style) ?? 0) + 1);
        }
        for (const [key] of colorTools) colors[key].add(format?.[key]);
      }
    }
    for (const style of cellFontStyles) {
      const styled = fonts.get(style) ?? 0;
      this.buttons.get(style)!.setAttribute("aria-pressed", styled === 0 ? "false" : styled === selectedCells ? "true" : "mixed");
    }
    for (const [key] of colorTools) {
      const color = colors[key].size === 1 ? colors[key].values().next().value : undefined;
      this.activeColors[key] = color;
      this.buttons.get(key)!.style.setProperty("--cell-swatch", color ?? "transparent");
    }
    this.rowHandles.forEach((handle, index) => {
      const row = index + this.firstVisibleRow;
      handle.setAttribute("aria-pressed", String(this.selected && bounds.left === 0 && bounds.right === this.columns - 1 && row >= bounds.top && row <= bounds.bottom));
    });
    this.columnHandles.forEach((handle, column) => handle.setAttribute("aria-pressed", String(this.selected && bounds.top === this.firstVisibleRow && bounds.bottom === this.table.rows.length - 1 && column >= bounds.left && column <= bounds.right)));
    this.buttons.get("all")?.setAttribute("aria-pressed", String(this.selected && count === (this.table.rows.length - this.firstVisibleRow) * this.columns));
    for (const [axis, values] of [["horizontal", horizontal], ["vertical", vertical]] as const) for (const value of axis === "horizontal" ? ["left", "center", "right"] : ["top", "middle", "bottom"]) this.buttons.get(`${axis}-${value}`)!.setAttribute("aria-pressed", String(values.size === 1 && values.has(value)));
    const span = cellSpan(this.layout, this.active.row, this.active.column);
    this.buttons.get("merge")!.disabled = !mergeTableLayout(this.layout, bounds) || span.rows * span.columns === count;
    this.buttons.get("split")!.disabled = !this.layout.spans.some(s => this.intersects(s));
    for (const axis of ["row", "column"] as const) {
      const n = axis === "row" ? rowCount : columnCount, noun = axis === "row" ? n === 1 ? "riga" : "righe" : n === 1 ? "colonna" : "colonne";
      const button = this.buttons.get(`delete-${axis}`)!; button.hidden = this.kind === (axis === "row" ? "column" : "row"); button.textContent = `− ${n} ${noun}`; button.title = `Elimina ${n} ${noun}`; button.setAttribute("aria-label", button.title);
    }
  }
  private render() {
    const scrollLeft = this.scroll?.scrollLeft ?? 0;
    this.observer?.disconnect();
    // The editor preserves whitespace, so a trailing HTML newline would add a line beneath the grid.
    this.body.innerHTML = renderMarkdownSafe(this.raw, navigationKnowledge()).trim();
    this.tableElement = this.body.querySelector("table")!;
    const headerLabel = this.layout.headerHidden ? "Mostra intestazione" : "Nascondi intestazione";
    this.headerButton.title = headerLabel;
    this.headerButton.setAttribute("aria-label", headerLabel);
    this.headerButton.replaceChildren(icon(this.layout.headerHidden ? hiddenHeaderIcon : headerIcon));
    this.tableElement.setAttribute("aria-label", "Tabella della nota"); this.tableElement.setAttribute("role", "grid"); this.tableElement.setAttribute("aria-multiselectable", "true");
    this.cells = [];
    Array.from(this.tableElement.rows).forEach((row, r) => {
      if (r < this.firstVisibleRow) return;
      let column = 0;
      for (const cell of Array.from(row.cells)) {
        while (cellSpan(this.layout, r, column).row !== r || cellSpan(this.layout, r, column).column !== column) column++;
        const c = column; column += cell.colSpan; cell.dataset.row = String(r); cell.dataset.column = String(c); this.cells.push(cell);
        cell.setAttribute("aria-description", "Scrivi per sostituire · Invio o doppio clic per modificare · Shift+clic per estendere");
        cell.addEventListener("pointerdown", e => {
          if (e.button !== 0 || this.editing?.input.contains(e.target as Node) || (e.target as Element).closest("a,button,input")) return;
          const touchEdit = e.pointerType === "touch" && this.selected && this.first.row === r && this.first.column === c && this.active.row === r && this.active.column === c;
          e.preventDefault(); this.select({ row: r, column: c }, e.shiftKey);
          if (touchEdit) this.startEdit(); else this.drag = { kind: "cells", pointerId: e.pointerId };
        });
        cell.addEventListener("dblclick", e => { if ((e.target as Element).closest("a,button,input,textarea")) return; e.preventDefault(); this.select({ row: r, column: c }); this.startEdit(); });
        cell.addEventListener("focus", () => { if (!this.selected) { this.active = this.first = { row: r, column: c }; this.kind = "cells"; this.selected = true; this.paint(); } });
      }
    });
    let scroll = this.tableElement.parentElement!;
    if (scroll === this.body) { scroll = document.createElement("div"); scroll.className = "nebula-table-scroll"; this.tableElement.replaceWith(scroll); scroll.append(this.tableElement); }
    this.frame = document.createElement("div"); this.frame.className = "inline-table-frame"; this.tableElement.replaceWith(this.frame); this.frame.append(this.tableElement);
    const overlay = document.createElement("div");
    overlay.className = "inline-table-overlay";
    const controls = document.createElement("div");
    controls.className = "inline-table-controls";
    this.body.append(overlay);
    overlay.append(controls);
    this.controls = controls;
    this.scroll = scroll;
    this.sizeFrame(this.layout.widths);
    scroll.scrollLeft = scrollLeft;
    const positionControls = () => { controls.style.transform = `translateX(${-scroll.scrollLeft}px)`; };
    scroll.addEventListener("scroll", positionControls, { passive: true });
    overlay.addEventListener("focusin", event => {
      if (!(event.target instanceof HTMLElement)) return;
      const target = event.target.getBoundingClientRect();
      const viewport = overlay.getBoundingClientRect();
      if (target.left < viewport.left) scroll.scrollLeft += target.left - viewport.left;
      else if (target.right > viewport.right) scroll.scrollLeft += target.right - viewport.right;
      positionControls();
    });
    positionControls();

    this.tool("all", "Seleziona tutta la tabella", icon("M5 5h5v5H5zM14 5h5v5h-5zM5 14h5v5H5zM14 14h5v5h-5z"), () => this.selectAll(), controls).classList.add("inline-table-corner");
    const ruler = document.createElement("div"); ruler.className = "inline-table-ruler"; controls.append(ruler);
    this.columnHandles = [];
    const widths = this.layout.widths ?? Array.from({ length: this.columns }, () => DEFAULT_COLUMN_WIDTH);
    widths.forEach((width, c) => {
      const track = document.createElement("div"); track.style.flex = this.layout.widths ? `0 0 ${width}px` : "1";
      const select = this.axisHandle("column", c); track.append(select); this.columnHandles.push(select);
      const handle = document.createElement("span"); handle.className = "inline-table-resizer"; handle.tabIndex = 0; handle.setAttribute("role", "separator"); handle.setAttribute("aria-orientation", "vertical"); handle.setAttribute("aria-label", `Ridimensiona colonna ${c + 1}`); handle.title = "Trascina per ridimensionare · Doppio clic per adattare al contenuto"; handle.setAttribute("aria-valuenow", String(width)); handle.setAttribute("aria-valuemin", String(MIN_COLUMN_WIDTH)); handle.setAttribute("aria-valuemax", String(MAX_COLUMN_WIDTH));
      handle.addEventListener("pointerdown", e => {
        if (e.button !== 0) return; e.preventDefault(); this.finishEdit(); this.selected = true; this.active = this.first = { row: this.active.row, column: c }; this.kind = "cells"; this.paint();
        const actual = this.actualWidths(); this.resizing = { column: c, x: e.clientX, width: actual[c]!, widths: actual }; const current = this.body.querySelector<HTMLElement>(`[aria-label="Ridimensiona colonna ${c + 1}"]`); current?.setPointerCapture?.(e.pointerId); this.focusCell();
      });
      handle.addEventListener("pointermove", e => { const drag = this.resizing; if (!drag) return; drag.widths[c] = columnWidth(drag.width + e.clientX - drag.x); this.previewWidths(drag.widths); handle.setAttribute("aria-valuenow", String(drag.widths[c])); });
      const finish = () => { const drag = this.resizing; if (!drag) return; this.resizing = undefined; if (drag.widths[drag.column] !== drag.width) this.write({ ...this.table, layout: { ...this.layout, widths: drag.widths } }); };
      handle.addEventListener("pointerup", finish); handle.addEventListener("lostpointercapture", finish);
      handle.addEventListener("pointercancel", () => { this.resizing = undefined; this.render(); });
      handle.addEventListener("dblclick", e => { e.preventDefault(); this.autoWidth(c); });
      handle.addEventListener("keydown", e => {
        if (!["ArrowLeft", "ArrowRight", "Enter"].includes(e.key)) return; e.preventDefault(); e.stopPropagation();
        if (e.key === "Enter") this.autoWidth(c); else this.setWidth(c, this.actualWidths()[c]! + (e.key === "ArrowRight" ? 10 : -10));
        this.body.querySelector<HTMLElement>(`[aria-label="Ridimensiona colonna ${c + 1}"]`)?.focus();
      });
      track.append(handle); ruler.append(track);
    });
    const gutter = document.createElement("div"); gutter.className = "inline-table-row-gutter"; controls.append(gutter);
    this.rowHandles = this.table.rows.slice(this.firstVisibleRow).map((_, index) => { const handle = this.axisHandle("row", index + this.firstVisibleRow); gutter.append(handle); return handle; });
    this.tool("add-column", "Aggiungi colonna a destra", "+", () => this.append("column"), controls).classList.add("inline-table-add", "inline-table-add-column");
    this.tool("add-row", "Aggiungi riga sotto", "+", () => this.append("row"), controls).classList.add("inline-table-add", "inline-table-add-row");
    this.options.decorate(this.body); this.paint(); this.scheduleGeometry(); this.options.measure();
    if (typeof ResizeObserver !== "undefined") { this.observer = new ResizeObserver(() => this.scheduleGeometry()); this.observer.observe(this.tableElement); this.observer.observe(scroll); }
  }
  private axisHandle(axis: Axis, index: number) {
    const handle = document.createElement("button"); handle.type = "button"; handle.className = `inline-table-${axis}-handle`;
    handle.dataset[axis === "row" ? "selectRow" : "selectColumn"] = String(index); handle.textContent = axis === "row" ? "⋮" : "⋯";
    handle.title = `Seleziona ${axis === "row" ? "riga" : "colonna"} ${index + 1 - (axis === "row" ? this.firstVisibleRow : 0)}`; handle.setAttribute("aria-label", handle.title);
    handle.title += " · Trascina per spostare · Shift+trascina per estendere la selezione";
    handle.setAttribute("aria-keyshortcuts", axis === "row" ? "Alt+ArrowUp Alt+ArrowDown" : "Alt+ArrowLeft Alt+ArrowRight");
    handle.addEventListener("pointerdown", e => {
      if (e.button !== 0 || e.isPrimary === false) return;
      e.preventDefault();
      this.selectAxis(axis, index, e.shiftKey);
      if (e.shiftKey) this.drag = { kind: axis, pointerId: e.pointerId };
      else this.startAxisReorder(axis, index, handle, e);
    });
    handle.addEventListener("click", e => { if (e.detail === 0) this.selectAxis(axis, index, e.shiftKey); });
    handle.addEventListener("keydown", e => {
      const previous = axis === "row" ? e.key === "ArrowUp" : e.key === "ArrowLeft";
      const next = axis === "row" ? e.key === "ArrowDown" : e.key === "ArrowRight";
      if (!previous && !next) return;
      if (e.altKey && !e.shiftKey) {
        e.preventDefault(); e.stopPropagation();
        const source = tableAxisRange(this.layout, axis, index);
        const neighbor = previous ? source.first - 1 : source.last + 1;
        const target = tableAxisRange(this.layout, axis, neighbor);
        this.moveAxis(axis, source, previous ? target.first : target.last + 1, true);
      } else if (e.shiftKey) {
        e.preventDefault(); e.stopPropagation();
        const min = axis === "row" ? this.firstVisibleRow : 0;
        this.selectAxis(axis, Math.max(min, Math.min(this.axisCount(axis) - 1, this.active[axis] + (previous ? -1 : 1))), true);
      }
    });
    return handle;
  }
  private axisCount(axis: Axis) { return axis === "row" ? this.table.rows.length : this.columns; }
  private moveAxis(axis: Axis, source: AxisRange, slot: number, keepHandleFocus = false) {
    const result = reorderTableAxis(this.layout, axis, this.axisCount(axis), source, slot);
    if (!result) return;
    const { first, last } = result.range;
    const rows = axis === "row"
      ? result.order.map(index => this.table.rows[index]!)
      : this.table.rows.map(row => result.order.map(index => row[index]!));
    const align = axis === "column" ? result.order.map(index => this.table.align[index] ?? null) : this.table.align;
    this.first = axis === "row" ? { row: first, column: 0 } : { row: this.firstVisibleRow, column: first };
    this.active = axis === "row" ? { row: last, column: this.columns - 1 } : { row: rows.length - 1, column: last };
    this.axisAnchor = first;
    this.kind = axis;
    this.write({ ...this.table, rows, align, layout: result.layout });
    this.paint();
    const bounds = this.bounds;
    for (const cell of this.cells) if (containsCell(bounds, Number(cell.dataset.row), Number(cell.dataset.column))) {
      cell.classList.add("is-axis-landed");
      cell.addEventListener("animationend", () => cell.classList.remove("is-axis-landed"), { once: true });
    }
    if (keepHandleFocus) this.axisHandles(axis)[first - (axis === "row" ? this.firstVisibleRow : 0)]?.focus();
    else this.focusCell();
  }
  private axisHandles(axis: Axis) { return axis === "row" ? this.rowHandles : this.columnHandles; }
  private axisDrop(axis: Axis, point: DragPoint) {
    const viewport = this.scroll!.getBoundingClientRect();
    const rect = this.tableElement.getBoundingClientRect();
    const row = axis === "row";
    const origin = row ? this.firstVisibleRow : 0;
    const ruler = this.controls.querySelector<HTMLElement>(".inline-table-ruler")!.getBoundingClientRect();
    if (point.x < viewport.left || point.x > viewport.right || point.y < ruler.top || point.y > rect.bottom + 12) return;
    if (row && point.y < rect.top - 12) return;
    const count = this.axisCount(axis) - origin;
    const boxAt = (index: number) => row
      ? this.tableElement.rows[origin + index]!.getBoundingClientRect()
      : this.columnHandles[index]!.parentElement!.getBoundingClientRect();
    let index = 0, end = count;
    while (index < end) {
      const mid = Math.floor((index + end) / 2), box = boxAt(mid);
      if ((row ? point.y < (box.top + box.bottom) / 2 : point.x < (box.left + box.right) / 2)) end = mid;
      else index = mid + 1;
    }
    const box = boxAt(Math.min(index, count - 1));
    const edge = row ? (index === count ? box.bottom : box.top) : (index === count ? box.right : box.left);
    const left = Math.max(viewport.left, rect.left), right = Math.min(viewport.right, rect.right);
    if (!row && (edge < left || edge > right)) return;
    return { slot: origin + index, left: row ? left : edge, top: row ? edge : rect.top, length: row ? right - left : rect.height };
  }
  private startAxisReorder(axis: Axis, index: number, handle: HTMLElement, event: PointerEvent) {
    this.cancelReorder?.();
    const source = tableAxisRange(this.layout, axis, index);
    let point: DragPoint, frame = 0;
    let marker: HTMLElement | undefined, preview: ReturnType<typeof dragPreview> | undefined;
    const draw = () => {
      frame = 0;
      if (!marker || !preview) return;
      preview.move(point);
      const scroll = this.scroll;
      const scroller = this.host.closest<HTMLElement>(".cm-scroller");
      const scrolledX = axis === "column" && !!scroll && scrollAtDragEdge(scroll, point, "x");
      const scrolledY = axis === "row" && !!scroller && scrollAtDragEdge(scroller, point, "y");
      const drop = this.axisDrop(axis, point);
      marker.hidden = !drop || !canInsertTableAxis(this.layout, axis, this.axisCount(axis), source, drop.slot);
      if (drop && !marker.hidden) {
        const host = this.host.getBoundingClientRect();
        marker.style.left = `${drop.left - host.left}px`;
        marker.style.top = `${drop.top - host.top}px`;
        marker.style[axis === "row" ? "width" : "height"] = `${drop.length}px`;
      }
      if (scrolledX || scrolledY) frame = requestAnimationFrame(draw);
    };
    this.cancelReorder = trackPointerDrag(handle, event, {
      start: at => {
        point = at;
        const size = source.last - source.first + 1;
        const number = index + 1 - (axis === "row" ? this.firstVisibleRow : 0);
        const label = size > 1 ? `${size} ${axis === "row" ? "righe" : "colonne"}` : `${axis === "row" ? "Riga" : "Colonna"} ${number}`;
        preview = dragPreview(handle, label, at);
        marker = this.host.ownerDocument.createElement("div");
        marker.className = `inline-table-axis-marker is-${axis}`;
        marker.hidden = true;
        this.host.append(marker);
        this.host.classList.add("is-axis-dragging");
        for (const cell of this.cells) {
          const value = Number(cell.dataset[axis]);
          cell.classList.toggle("is-axis-source", value >= source.first && value <= source.last);
        }
      },
      move: at => { point = at; if (!frame) frame = requestAnimationFrame(draw); },
      end: at => {
        this.cancelReorder = undefined;
        cancelAnimationFrame(frame);
        preview?.remove(); marker?.remove();
        if (!preview) return;
        this.host.classList.remove("is-axis-dragging");
        for (const cell of this.cells) cell.classList.remove("is-axis-source");
        const drop = at && this.axisDrop(axis, at);
        if (drop) this.moveAxis(axis, source, drop.slot);
      },
    });
  }
  private sizeFrame(widths?: number[]) {
    const minimum = `calc(${widths ? widths.reduce((a, b) => a + b, 0) : this.columns * 90}px + 2 * var(--table-gutter))`;
    for (const element of [this.frame, this.controls]) {
      element.style.minWidth = minimum;
      element.style.width = widths ? minimum : "100%";
    }
  }
  private scheduleGeometry() {
    cancelAnimationFrame(this.geometryFrame);
    this.geometryFrame = requestAnimationFrame(() => {
      const frame = this.frame.getBoundingClientRect();
      const scroll = this.scroll!;
      const scrollbarHeight = scroll.offsetHeight - scroll.clientHeight;
      this.body.style.setProperty("--table-scrollbar-height", `${scrollbarHeight}px`);
      const rects = Array.from(this.tableElement.rows).slice(this.firstVisibleRow).map(row => row.getBoundingClientRect());
      const scroller = this.host.closest(".cm-scroller")?.getBoundingClientRect();
      if (scroller) {
        const toolbarHeight = this.toolbar.offsetHeight;
        const rulerHeight = this.controls.querySelector(".inline-table-ruler")!.getBoundingClientRect().height;
        const above = frame.top - scroller.top;
        const below = scroller.bottom - frame.bottom;
        this.toolbar.classList.toggle("is-below", above < toolbarHeight + rulerHeight + 4 && below > above);
      }
      this.controls.style.height = `${frame.height}px`;
      rects.forEach((rect, row) => {
        const handle = this.rowHandles[row]!;
        handle.style.top = `${rect.top - frame.top}px`;
        handle.style.height = `${rect.height}px`;
      });
    });
  }
  private actualWidths() { return Array.from(this.body.querySelectorAll<HTMLElement>(".inline-table-ruler > div"), (track, column) => columnWidth(track.getBoundingClientRect().width || this.layout.widths?.[column] || DEFAULT_COLUMN_WIDTH)); }
  private previewWidths(widths: number[]) {
    this.tableElement.style.tableLayout = "fixed"; this.tableElement.style.width = `${widths.reduce((a, b) => a + b, 0)}px`; this.tableElement.classList.add("has-column-widths"); this.sizeFrame(widths);
    let group = this.tableElement.querySelector("colgroup"); if (!group) { group = document.createElement("colgroup"); widths.forEach(() => group!.append(document.createElement("col"))); this.tableElement.prepend(group); }
    Array.from(group.children).forEach((col, c) => (col as HTMLElement).style.width = `${widths[c]}px`);
    Array.from(this.body.querySelectorAll<HTMLElement>(".inline-table-ruler > div")).forEach((track, c) => track.style.flex = `0 0 ${widths[c]}px`); this.options.measure();
  }
  private autoWidth(column: number) {
    this.finishEdit();
    const probe = document.createElement("span"); probe.style.cssText = "position:fixed;left:-10000px;visibility:hidden;white-space:pre;width:max-content"; this.host.append(probe);
    let width = MIN_COLUMN_WIDTH;
    for (const cell of this.cells) {
      const c = Number(cell.dataset.column); if (column < c || column >= c + cell.colSpan) continue;
      probe.style.font = getComputedStyle(cell).font; probe.textContent = cell.innerText || cell.textContent;
      width = Math.max(width, (probe.getBoundingClientRect().width + 28) / cell.colSpan);
    }
    probe.remove(); this.setWidth(column, width);
  }
  private write(next: MarkdownTable, render = true) {
    const previous = this.table, text = serializeTable(next.rows, next.align, next.layout); if (text === this.raw) return;
    // The editor synchronizes canonical parsed cells during change(). Avoid
    // lexing this same table twice on each keystroke.
    this.raw = text; this.table = { ...next, from: previous.from, to: previous.from + text.length };
    const isolate = render ? "full" : this.editing?.firstChange ? "before" : undefined;
    if (this.editing) this.editing.firstChange = false;
    this.options.change(previous, text, isolate); this.clampSelection(); if (render) this.render();
  }
  private setWidth(column: number, value: number) { const widths = this.actualWidths(); widths[column] = columnWidth(value); this.write({ ...this.table, layout: { ...this.layout, widths } }); }
  private startEdit(replacement?: string) {
    if (this.editing) return;
    const span = cellSpan(this.layout, this.active.row, this.active.column); this.active = this.first = { row: span.row, column: span.column }; this.kind = "cells"; this.selected = true;
    const cell = this.cellElement(); if (!cell) return;
    const original = cellText(this.table.rows, span), input = document.createElement("textarea"); input.className = "inline-table-input"; input.rows = 1;
    input.setAttribute("aria-label", `${this.active.row === 0 ? "Intestazione" : `Riga ${this.active.row + 1 - this.firstVisibleRow}`} colonna ${this.active.column + 1}`);
    input.value = replacement ?? original.replace(/<br\s*\/?\s*>/gi, "\n"); input.style.textAlign = cell.style.textAlign || this.table.align[this.active.column] || "left";
    this.editing = { input, originalRows: this.table.rows.map(row => [...row]), cell: { ...this.active }, firstChange: true }; cell.replaceChildren(input);
    const size = () => { input.style.height = "auto"; input.style.height = `${input.scrollHeight}px`; this.options.measure(); };
    const update = () => { if (!this.editing) return; const { row: r, column: c } = this.editing.cell, span = cellSpan(this.layout, r, c); this.write({ ...this.table, rows: this.table.rows.map((row, y) => row.map((value, x) => y === r && x === c ? input.value : y >= span.row && y < span.row + span.rows && x >= span.column && x < span.column + span.columns ? "" : value)) }, false); size(); };
    input.addEventListener("input", update); input.addEventListener("blur", () => this.finishEdit());
    input.addEventListener("paste", e => { const text = e.clipboardData?.getData("text/plain") ?? ""; if (!text.includes("\t")) return; e.preventDefault(); this.paste(text); });
    this.paint(); input.focus(); size(); if (replacement === undefined) input.select(); else { input.setSelectionRange(input.value.length, input.value.length); update(); }
  }
  private finishEdit(cancel = false) {
    const editing = this.editing; if (!editing) return; this.editing = undefined;
    if (cancel) this.write({ ...this.table, rows: editing.originalRows });
    this.render();
  }
  private append(axis: Axis) {
    const index = axis === "row" ? this.table.rows.length : this.columns;
    const rows = axis === "row" ? [...this.table.rows, Array.from({ length: this.columns }, () => "")] : this.table.rows.map(row => [...row, ""]);
    const align = axis === "column" ? [...Array.from({ length: this.columns }, (_, c) => this.table.align[c] ?? null), null] : this.table.align;
    this.active = this.first = axis === "row" ? { row: index, column: 0 } : { row: Math.min(this.active.row, this.table.rows.length - 1), column: index };
    this.kind = "cells"; this.write({ ...this.table, rows, align, layout: changeTableStructure(this.layout, axis, index, false) }); this.startEdit(); this.cellElement()?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  private remove(axis: Axis) {
    const b = this.bounds, start = axis === "row" ? b.top : b.left, end = axis === "row" ? b.bottom : b.right;
    if (end - start + 1 === (axis === "row" ? this.table.rows.length : this.columns)) { this.options.change(this.table, "", "full"); return; }
    const rows = axis === "row" ? this.table.rows.filter((_, r) => r < start || r > end) : this.table.rows.map(row => row.filter((_, c) => c < start || c > end));
    if (axis === "row" && this.layout.headerHidden && rows.length === 1) rows.push(Array<string>(this.columns).fill(""));
    const align = axis === "column" ? this.table.align.filter((_, c) => c < start || c > end) : this.table.align;
    let layout = this.layout; for (let index = end; index >= start; index--) layout = changeTableStructure(layout, axis, index, true);
    this.active = this.first = { row: Math.min(b.top, rows.length - 1), column: Math.min(b.left, rows[0]!.length - 1) }; this.kind = "cells";
    this.write({ ...this.table, rows, align, layout });
  }
  private clear() { const bounds = this.bounds; this.write({ ...this.table, rows: this.table.rows.map((row, r) => row.map((value, c) => containsCell(bounds, r, c) ? "" : value)) }); this.focusCell(); }
  private selectionTsv() {
    const bounds = this.bounds;
    const rows = Array.from({ length: bounds.bottom - bounds.top + 1 }, () => Array<string>(bounds.right - bounds.left + 1).fill(""));
    for (const cell of this.cells) {
      const row = Number(cell.dataset.row), column = Number(cell.dataset.column);
      if (!containsCell(bounds, row, column)) continue;
      const rendered = cell.cloneNode(true) as HTMLTableCellElement;
      rendered.querySelectorAll("br").forEach(line => line.replaceWith("\n"));
      rendered.querySelectorAll("img").forEach(image => image.replaceWith(image.alt));
      // A merged cell occupies its original rectangle, with text at the anchor.
      rows[row - bounds.top]![column - bounds.left] = rendered.textContent ?? "";
    }
    return serializeTsv(rows);
  }
  private async copyCells() {
    try {
      await navigator.clipboard.writeText(this.selectionTsv());
      if (this.selected) this.status.textContent = "Celle copiate";
    } catch {
      if (this.selected) this.status.textContent = "Copia non riuscita";
    }
  }
  private paste(text: string) {
    this.editing = undefined; const pasted = parseTsv(text), r = this.active.row, c = this.active.column;
    const columns = Math.max(this.columns, c + Math.max(...pasted.map(row => row.length))), bottom = r + pasted.length, right = c + Math.max(...pasted.map(row => row.length));
    this.write({ ...this.table, rows: Array.from({ length: Math.max(this.table.rows.length, bottom) }, (_, y) => Array.from({ length: columns }, (_, x) => pasted[y - r]?.[x - c] ?? this.table.rows[y]?.[x] ?? "")), layout: { ...this.layout, spans: this.layout.spans.filter(s => !(s.row < bottom && s.row + s.rows > r && s.column < right && s.column + s.columns > c)), ...(this.layout.widths ? { widths: Array.from({ length: columns }, (_, x) => this.layout.widths?.[x] ?? DEFAULT_COLUMN_WIDTH) } : {}) } });
    this.first = { row: r, column: c }; this.active = { row: bottom - 1, column: right - 1 }; this.kind = "cells"; this.paint(); this.focusCell();
  }
  private keydown(e: KeyboardEvent) {
    if (e.isComposing) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") return;
    if (this.editing) {
      e.stopPropagation();
      if (e.key === "Escape") { e.preventDefault(); this.finishEdit(true); this.focusCell(); }
      else if (e.key === "Enter" && !e.shiftKey || e.key === "Tab") { e.preventDefault(); const tab = e.key === "Tab"; this.finishEdit(); if (tab) this.moveTab(e.shiftKey); else this.focusCell(); }
      return;
    }
    if ((e.ctrlKey || e.metaKey) && ["z", "y"].includes(e.key.toLowerCase())) { e.preventDefault(); e.stopPropagation(); this.options.history(e.shiftKey || e.key.toLowerCase() === "y"); return; }
    if ((e.target as Element).closest("button,input,textarea,select,[role=separator]")) return;
    if (this.selected && (e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "c" && typeof navigator.clipboard?.writeText === "function") {
      e.preventDefault(); e.stopPropagation(); void this.copyCells(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") { e.preventDefault(); e.stopPropagation(); this.selectAll(); return; }
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); this.selected = false; this.drag = undefined; this.cellElement()?.blur(); this.paint(); return; }
    if (e.key === "Tab") { e.preventDefault(); e.stopPropagation(); this.moveTab(e.shiftKey); return; }
    const delta: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (delta[e.key]) {
      e.preventDefault(); e.stopPropagation(); const [y, x] = delta[e.key]!, span = cellSpan(this.layout, this.active.row, this.active.column);
      if (e.shiftKey && (this.kind === "row" && y || this.kind === "column" && x)) this.selectAxis(this.kind as Axis, Math.max(this.kind === "row" ? this.firstVisibleRow : 0, Math.min((this.kind === "row" ? this.table.rows.length : this.columns) - 1, this.active[this.kind as Axis] + (y || x))), true);
      else this.select({ row: Math.max(this.firstVisibleRow, Math.min(this.table.rows.length - 1, span.row + (y > 0 ? span.rows : y))), column: Math.max(0, Math.min(this.columns - 1, span.column + (x > 0 ? span.columns : x))) }, e.shiftKey);
      return;
    }
    if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); e.stopPropagation(); this.startEdit(); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); e.stopPropagation(); this.clear(); }
    else if (this.selected && !e.metaKey && ((!e.ctrlKey && !e.altKey) || e.getModifierState("AltGraph"))) {
      if (e.key === "Dead" || e.key === "Process") { this.startEdit(); return; }
      if (e.key && findClusterBreak(e.key, 0) === e.key.length) {
        e.preventDefault(); e.stopPropagation(); this.startEdit(e.key); return;
      }
    }
  }
  private moveTab(back: boolean) {
    const at = this.cells.indexOf(this.cellElement()!), next = this.cells[at + (back ? -1 : 1)];
    if (next) this.select({ row: Number(next.dataset.row), column: Number(next.dataset.column) });
    else if (!back) this.append("row");
    else this.buttons.get("all")!.focus();
  }
}
