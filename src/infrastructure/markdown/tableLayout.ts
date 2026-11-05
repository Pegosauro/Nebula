export interface TableCell { row: number; column: number }
export interface CellSpan extends TableCell { rows: number; columns: number }
export type HorizontalAlignment = "left" | "center" | "right";
export type VerticalAlignment = "top" | "middle" | "bottom";
export interface CellFormat extends TableCell { horizontal?: HorizontalAlignment; vertical?: VerticalAlignment }
export interface TableLayout { spans: CellSpan[]; widths?: number[]; cells?: CellFormat[] }
export interface CellBounds { top: number; bottom: number; left: number; right: number }
export const MIN_COLUMN_WIDTH = 80, MAX_COLUMN_WIDTH = 1200, DEFAULT_COLUMN_WIDTH = 160;
export const columnWidth = (value: number) => Math.round(Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, value)));

/** All layout values are validated against the real Markdown grid. Invalid or
 * overlapping metadata is ignored, never used to hide a cell's contents. */
export function validateTableLayout(value: unknown, rowCount: number, columnCount: number): TableLayout | undefined {
  if (!value || typeof value !== "object") return;
  const input = value as { version?: unknown; widths?: unknown; spans?: unknown; cells?: unknown };
  if (input.version !== undefined && input.version !== 1) return;
  if (!Array.isArray(input.spans) || input.spans.length > rowCount * columnCount) return;
  let widths: number[] | undefined;
  if (input.widths !== undefined) {
    if (!Array.isArray(input.widths) || input.widths.length !== columnCount || !input.widths.every(w => Number.isInteger(w) && w >= MIN_COLUMN_WIDTH && w <= MAX_COLUMN_WIDTH)) return;
    widths = [...input.widths];
  }
  const spans: CellSpan[] = [], occupied = new Set<string>();
  for (const item of input.spans) {
    if (!item || typeof item !== "object") return;
    const span = item as CellSpan;
    if (![span.row, span.column, span.rows, span.columns].every(Number.isInteger) || span.row < 0 || span.column < 0 || span.rows < 1 || span.columns < 1 || span.rows * span.columns < 2 || span.row + span.rows > rowCount || span.column + span.columns > columnCount || (span.row === 0 && span.rows !== 1)) return;
    for (let r = span.row; r < span.row + span.rows; r++) for (let c = span.column; c < span.column + span.columns; c++) {
      const key = `${r}:${c}`; if (occupied.has(key)) return; occupied.add(key);
    }
    spans.push({ row: span.row, column: span.column, rows: span.rows, columns: span.columns });
  }
  const cells: CellFormat[] = [], formatted = new Set<string>();
  if (input.cells !== undefined) {
    if (!Array.isArray(input.cells) || input.cells.length > rowCount * columnCount) return;
    for (const value of input.cells) {
      if (!value || typeof value !== "object") return;
      const cell = value as CellFormat, key = `${cell.row}:${cell.column}`;
      if (!Number.isInteger(cell.row) || !Number.isInteger(cell.column) || cell.row < 0 || cell.row >= rowCount || cell.column < 0 || cell.column >= columnCount || formatted.has(key)) return;
      if (cell.horizontal !== undefined && !["left", "center", "right"].includes(cell.horizontal) || cell.vertical !== undefined && !["top", "middle", "bottom"].includes(cell.vertical)) return;
      if (cell.horizontal === undefined && cell.vertical === undefined) return;
      cells.push({ row: cell.row, column: cell.column, ...(cell.horizontal ? { horizontal: cell.horizontal } : {}), ...(cell.vertical ? { vertical: cell.vertical } : {}) });
      formatted.add(key);
    }
  }
  return { spans, ...(widths ? { widths } : {}), ...(cells.length ? { cells } : {}) };
}
export function tableMetadataAt(source: string, end: number, rows: number, columns: number) {
  const match = /^\r?\n<!-- nebula-table:(\{[^\r\n]*\}) -->/.exec(source.slice(end));
  if (!match) return;
  try {
    const layout = validateTableLayout(JSON.parse(match[1]!), rows, columns);
    if (layout) return { layout, to: end + match[0].length };
  } catch { /* Preserve unrecognized comments as ordinary source. */ }
}
export function serializeTableLayout(layout: TableLayout | undefined, rows: number, columns: number) {
  const valid = validateTableLayout(layout, rows, columns);
  return valid && (valid.spans.length || valid.widths || valid.cells?.length) ? `\n<!-- nebula-table:${JSON.stringify({ version: 1, ...valid })} -->` : "";
}
export function cellSpan(layout: TableLayout | undefined, row: number, column: number): CellSpan {
  return layout?.spans.find(s => row >= s.row && row < s.row + s.rows && column >= s.column && column < s.column + s.columns) ?? { row, column, rows: 1, columns: 1 };
}
export function cellText(rows: string[][], span: CellSpan) {
  const text: string[] = [];
  for (let r = span.row; r < span.row + span.rows; r++) for (let c = span.column; c < span.column + span.columns; c++) {
    const value = rows[r]?.[c]; if (value) text.push(value);
  }
  return text.join("<br>");
}
export function selectionBounds(layout: TableLayout, first: TableCell, last: TableCell): CellBounds {
  const a = cellSpan(layout, first.row, first.column), b = cellSpan(layout, last.row, last.column);
  const bounds = { top: Math.min(a.row, b.row), bottom: Math.max(a.row + a.rows - 1, b.row + b.rows - 1), left: Math.min(a.column, b.column), right: Math.max(a.column + a.columns - 1, b.column + b.columns - 1) };
  // A merge anywhere along the rectangle can expand it into another merge.
  // Reach a fixed point so no selected cell is only partially covered.
  let expanded: boolean;
  do {
    expanded = false;
    for (const s of layout.spans) {
      if (s.row > bounds.bottom || s.row + s.rows <= bounds.top || s.column > bounds.right || s.column + s.columns <= bounds.left) continue;
      const next = { top: Math.min(bounds.top, s.row), bottom: Math.max(bounds.bottom, s.row + s.rows - 1), left: Math.min(bounds.left, s.column), right: Math.max(bounds.right, s.column + s.columns - 1) };
      if (Object.keys(next).some(key => next[key as keyof CellBounds] !== bounds[key as keyof CellBounds])) { Object.assign(bounds, next); expanded = true; }
    }
  } while (expanded);
  return bounds;
}
export function formatTableCells(layout: TableLayout, bounds: CellBounds, format: Pick<CellFormat, "horizontal" | "vertical">): TableLayout {
  const cells = new Map((layout.cells ?? []).map(cell => [`${cell.row}:${cell.column}`, cell]));
  for (let row = bounds.top; row <= bounds.bottom; row++) for (let column = bounds.left; column <= bounds.right; column++) {
    const key = `${row}:${column}`; cells.set(key, { row, column, ...cells.get(key), ...format });
  }
  return { ...layout, cells: [...cells.values()].sort((a, b) => a.row - b.row || a.column - b.column) };
}
export function containsCell(bounds: CellBounds, row: number, column: number) {
  return row >= bounds.top && row <= bounds.bottom && column >= bounds.left && column <= bounds.right;
}
export function mergeTableLayout(layout: TableLayout, bounds: CellBounds): TableLayout | undefined {
  const { top, bottom, left, right } = bounds;
  if ((top === bottom && left === right) || (top === 0 && bottom > 0)) return;
  for (const s of layout.spans) {
    const intersects = s.row <= bottom && s.row + s.rows > top && s.column <= right && s.column + s.columns > left;
    if (intersects && !(containsCell(bounds, s.row, s.column) && containsCell(bounds, s.row + s.rows - 1, s.column + s.columns - 1))) return;
  }
  return { ...layout, spans: [...layout.spans.filter(s => !containsCell(bounds, s.row, s.column)), { row: top, column: left, rows: bottom - top + 1, columns: right - left + 1 }] };
}
/** Insert/delete keeps unaffected merges and expands/shrinks crossing merges. */
export function changeTableStructure(layout: TableLayout, axis: "row" | "column", index: number, remove: boolean): TableLayout {
  const extent = axis === "row" ? "rows" : "columns";
  const spans = layout.spans.flatMap(original => {
    const span = { ...original }, start = span[axis], end = start + span[extent];
    if (remove) { if (index < start) span[axis]--; else if (index < end) span[extent]--; }
    else { if (index <= start) span[axis]++; else if (index < end) span[extent]++; }
    return span.rows > 0 && span.columns > 0 && span.rows * span.columns > 1 && !(span.row === 0 && span.rows > 1) ? [span] : [];
  });
  const widths = layout.widths ? [...layout.widths] : undefined;
  if (widths && axis === "column") widths.splice(index, remove ? 1 : 0, ...(remove ? [] : [DEFAULT_COLUMN_WIDTH]));
  const cells = layout.cells?.flatMap(cell => remove && cell[axis] === index ? [] : [{ ...cell, [axis]: cell[axis] + (cell[axis] >= index ? remove ? -1 : 1 : 0) }]);
  return { spans, ...(widths ? { widths } : {}), ...(cells?.length ? { cells } : {}) };
}
