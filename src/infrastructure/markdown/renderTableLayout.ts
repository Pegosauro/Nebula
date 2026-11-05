import { type TableLayout } from "./tableLayout";

/** Operates only on already sanitized table content and validated layout. */
export function applyTableLayout(table: HTMLTableElement, layout: TableLayout) {
  const cells = Array.from(table.rows, row => Array.from(row.cells));
  for (const format of layout.cells ?? []) {
    const cell = cells[format.row]?.[format.column]; if (!cell) continue;
    if (format.horizontal) cell.style.textAlign = format.horizontal;
    if (format.vertical) cell.style.verticalAlign = format.vertical;
  }
  for (const span of layout.spans) {
    const anchor = cells[span.row]?.[span.column]; if (!anchor) continue;
    const content: string[] = [];
    for (let r = span.row; r < span.row + span.rows; r++) for (let c = span.column; c < span.column + span.columns; c++) {
      const cell = cells[r]?.[c];
      if (cell?.innerHTML.trim()) content.push(cell.innerHTML);
      if (cell && cell !== anchor) cell.remove();
    }
    anchor.innerHTML = content.join("<br>"); anchor.rowSpan = span.rows; anchor.colSpan = span.columns;
  }
  if (layout.widths) {
    const group = document.createElement("colgroup");
    for (const width of layout.widths) { const col = document.createElement("col"); col.style.width = `${width}px`; group.append(col); }
    table.prepend(group); table.style.tableLayout = "fixed"; table.style.width = `${layout.widths.reduce((sum, width) => sum + width, 0)}px`;
    table.classList.add("has-column-widths");
  }
  const scroll = document.createElement("div"); scroll.className = "nebula-table-scroll";
  table.replaceWith(scroll); scroll.append(table);
}
