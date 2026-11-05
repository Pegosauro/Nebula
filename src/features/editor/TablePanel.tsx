import { useEffect, useRef, useState } from "react";
import { Plus, Trash2, AlignLeft, AlignCenter, AlignRight, Merge, Split, MousePointer2 } from "lucide-react";
import { EditorDialog } from "./EditorDialog";
import { parseTsv, serializeTable, type MarkdownTable } from "./markdownTools";
import { cellSpan, cellText, changeTableStructure, columnWidth, containsCell, DEFAULT_COLUMN_WIDTH, MAX_COLUMN_WIDTH, mergeTableLayout, MIN_COLUMN_WIDTH, selectionBounds, type TableCell, type TableLayout } from "../../infrastructure/markdown/tableLayout";

interface TableDraft { rows: string[][]; align: MarkdownTable["align"]; layout: TableLayout }
function initialDraft(table?: MarkdownTable): TableDraft {
  const rows = table?.rows ?? [["Colonna 1", "Colonna 2"], ["", ""], ["", ""]];
  const columns = Math.max(1, ...rows.map(row => row.length));
  return { rows: rows.map(row => Array.from({ length: columns }, (_, c) => row[c] ?? "")), align: table?.align ?? [null, null], layout: table?.layout ?? { spans: [] } };
}

export function TablePanel({ table, onSave, onClose }: { table?: MarkdownTable; onSave: (text: string) => void; onClose: () => void }) {
  const [data, setData] = useState(() => initialDraft(table));
  const firstCell = { row: Math.min(1, data.rows.length - 1), column: 0 };
  const [selection, setSelection] = useState(() => ({ first: firstCell, last: firstCell }));
  const [rangeMode, setRangeMode] = useState(false);
  const resize = useRef<{ column: number; x: number; width: number } | undefined>(undefined);
  const grid = useRef<HTMLTableElement>(null);
  const active = selection.last, columns = data.rows[0]!.length;
  const widths = data.layout.widths ?? Array.from({ length: columns }, () => DEFAULT_COLUMN_WIDTH);
  const bounds = selectionBounds(data.layout, selection.first, selection.last);
  const merged = mergeTableLayout(data.layout, bounds);
  const selectedSpans = data.layout.spans.filter(s => s.row <= bounds.bottom && s.row + s.rows > bounds.top && s.column <= bounds.right && s.column + s.columns > bounds.left);
  const selectedCount = (bounds.bottom - bounds.top + 1) * (bounds.right - bounds.left + 1);
  const [widthDraft, setWidthDraft] = useState(String(widths[active.column]));
  useEffect(() => setWidthDraft(String(widths[active.column])), [active.column, widths[active.column]]);

  const select = (cell: TableCell, extend = false) => setSelection(old => ({ first: extend || rangeMode ? old.first : cell, last: cell }));
  const setWidth = (column: number, value: number) => {
    if (!Number.isFinite(value)) return;
    setData(old => ({ ...old, layout: { ...old.layout, widths: Array.from({ length: old.rows[0]!.length }, (_, c) => c === column ? columnWidth(value) : old.layout.widths?.[c] ?? DEFAULT_COLUMN_WIDTH) } }));
  };
  const confirmWidth = () => {
    const numeric = Number(widthDraft);
    const value = widthDraft.trim() && Number.isFinite(numeric) ? columnWidth(numeric) : widths[active.column]!;
    setWidth(active.column, value); setWidthDraft(String(value));
  };
  const update = (r: number, c: number, value: string) => setData(old => {
    const span = cellSpan(old.layout, r, c);
    // Editing the unified value puts it in the anchor. No hidden stale values
    // remain to reappear after splitting; joining alone preserves originals.
    return { ...old, rows: old.rows.map((row, y) => row.map((text, x) => y === r && x === c ? value : y >= span.row && y < span.row + span.rows && x >= span.column && x < span.column + span.columns ? "" : text)) };
  });
  const structure = (axis: "row" | "column", remove: boolean) => {
    const span = cellSpan(data.layout, active.row, active.column);
    const index = remove ? active[axis] : span[axis] + span[axis === "row" ? "rows" : "columns"];
    setData(old => {
      const rows = axis === "row" ? remove ? old.rows.filter((_, r) => r !== index) : [...old.rows.slice(0, index), Array.from({ length: columns }, () => ""), ...old.rows.slice(index)] : old.rows.map(row => remove ? row.filter((_, c) => c !== index) : [...row.slice(0, index), "", ...row.slice(index)]);
      const align = axis === "column" ? remove ? old.align.filter((_, c) => c !== index) : [...old.align.slice(0, index), null, ...old.align.slice(index)] : old.align;
      return { rows, align, layout: changeTableStructure(old.layout, axis, index, remove) };
    });
    const cell = { row: Math.min(active.row, data.rows.length - (axis === "row" && remove ? 2 : 1)), column: Math.min(active.column, columns - (axis === "column" && remove ? 2 : 1)) };
    setSelection({ first: cell, last: cell }); setRangeMode(false);
  };
  return <EditorDialog title={table ? "Modifica tabella" : "Inserisci tabella"} onClose={onClose} wide>
    <p className="editor-panel-hint">Seleziona le celle con i piccoli pulsanti nell’angolo. Shift+clic estende l’intervallo; “Selezione multipla” funziona anche senza tastiera. Trascina i separatori sopra le colonne per regolare la larghezza.</p>
    <div className="table-tools" role="toolbar" aria-label="Struttura tabella">
      <button type="button" onClick={() => structure("row", false)}><Plus size={15} />Riga sotto</button>
      <button type="button" onClick={() => structure("column", false)}><Plus size={15} />Colonna a destra</button>
      <button type="button" disabled={active.row === 0 || data.rows.length <= 2} onClick={() => structure("row", true)}><Trash2 size={15} />Rimuovi riga</button>
      <button type="button" disabled={columns <= 1} onClick={() => structure("column", true)}><Trash2 size={15} />Rimuovi colonna</button>
      <button type="button" aria-pressed={rangeMode} onClick={() => setRangeMode(value => !value)}><MousePointer2 size={15} />Selezione multipla</button>
      <button type="button" disabled={!merged || (selectedSpans.length === 1 && selectedSpans[0]!.rows * selectedSpans[0]!.columns === selectedCount)} onClick={() => {
        if (!merged) return;
        setData(old => ({ ...old, layout: merged })); const cell = { row: bounds.top, column: bounds.left }; setSelection({ first: cell, last: cell }); setRangeMode(false);
      }}><Merge size={15} />Unisci celle</button>
      <button type="button" disabled={!selectedSpans.length} onClick={() => setData(old => ({ ...old, layout: { ...old.layout, spans: old.layout.spans.filter(s => !selectedSpans.includes(s)) } }))}><Split size={15} />Dividi celle</button>
      {(["left", "center", "right"] as const).map((align, i) => { const Icon = [AlignLeft, AlignCenter, AlignRight][i]!; return <button type="button" key={align} aria-label={["Allinea a sinistra", "Allinea al centro", "Allinea a destra"][i]} aria-pressed={data.align[active.column] === align} onClick={() => setData(old => ({ ...old, align: Array.from({ length: columns }, (_, c) => c === active.column ? align : old.align[c] ?? null) }))}><Icon size={16} /></button>; })}
    </div>
    <div className="table-width-tools">
      <label>Larghezza colonna {active.column + 1} <input type="number" aria-label="Larghezza colonna in pixel" min={MIN_COLUMN_WIDTH} max={MAX_COLUMN_WIDTH} step={10} value={widthDraft} onChange={e => setWidthDraft(e.target.value)} onBlur={confirmWidth} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }} /> px</label>
      <button type="button" disabled={!data.layout.widths} onClick={() => setData(old => ({ ...old, layout: { ...old.layout, widths: undefined } }))}>Larghezze automatiche</button>
      <span role="status">{selectedCount} {selectedCount === 1 ? "cella selezionata" : "celle selezionate"}{bounds.top === 0 && bounds.bottom > 0 ? " · Seleziona intestazioni e corpo separatamente" : ""}</span>
    </div>
    <div className="table-editor-scroll">
      <div className="table-column-ruler" style={{ width: widths.reduce((sum, value) => sum + value, 0) }}>{widths.map((width, c) => <div key={c} style={{ width }}><span>Colonna {c + 1}</span><span role="separator" tabIndex={0} aria-orientation="vertical" aria-label={`Ridimensiona colonna ${c + 1}`} aria-valuemin={MIN_COLUMN_WIDTH} aria-valuemax={MAX_COLUMN_WIDTH} aria-valuenow={width} className="table-column-resizer" onPointerDown={e => {
        if (e.button !== 0) return; e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); resize.current = { column: c, x: e.clientX, width }; select({ row: active.row, column: c });
      }} onPointerMove={e => { const drag = resize.current; if (drag?.column === c) setWidth(c, drag.width + e.clientX - drag.x); }} onPointerUp={() => { resize.current = undefined; }} onPointerCancel={() => { resize.current = undefined; }} onLostPointerCapture={() => { resize.current = undefined; }} onKeyDown={e => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); setWidth(c, width + (e.key === "ArrowRight" ? 10 : -10)); }
      }} /></div>)}</div>
      <table ref={grid} className="table-editor-grid" style={{ width: widths.reduce((sum, value) => sum + value, 0), tableLayout: "fixed" }}><colgroup>{widths.map((width, c) => <col key={c} style={{ width }} />)}</colgroup><tbody>{data.rows.map((row, r) => <tr key={r}>{row.map((_, c) => {
        const span = cellSpan(data.layout, r, c); if (span.row !== r || span.column !== c) return null;
        const label = `${r === 0 ? "Intestazione" : `Riga ${r}`} colonna ${c + 1}`;
        return <td key={c} rowSpan={span.rows} colSpan={span.columns} className={`${r === 0 ? "is-header" : ""} ${containsCell(bounds, r, c) ? "is-selected" : ""} ${active.row === r && active.column === c ? "is-active" : ""}`}>
          <button type="button" className="table-cell-select" aria-label={`Seleziona ${label.toLowerCase()}`} aria-pressed={containsCell(bounds, r, c)} title="Seleziona cella · Shift+clic per un intervallo" onClick={e => select({ row: r, column: c }, e.shiftKey)} onKeyDown={e => {
            const delta: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
            if (e.shiftKey && delta[e.key]) { e.preventDefault(); const [y, x] = delta[e.key]!; select({ row: Math.max(0, Math.min(data.rows.length - 1, active.row + y)), column: Math.max(0, Math.min(columns - 1, active.column + x)) }, true); }
          }}><MousePointer2 size={12} /></button>
          <input aria-label={label} value={cellText(data.rows, span)} onPointerDown={e => { if (e.shiftKey || rangeMode) { e.preventDefault(); select({ row: r, column: c }, true); } }} onFocus={() => select({ row: r, column: c })} onChange={e => update(r, c, e.target.value)} onPaste={e => {
            const text = e.clipboardData.getData("text/plain"); if (!/[\t\n]/.test(text)) return; e.preventDefault();
            const pasted = parseTsv(text), newColumns = Math.max(columns, c + Math.max(...pasted.map(x => x.length)));
            setData(old => ({ ...old, rows: Array.from({ length: Math.max(old.rows.length, r + pasted.length) }, (_, y) => Array.from({ length: newColumns }, (_, x) => y >= r && x >= c && pasted[y - r]?.[x - c] !== undefined ? pasted[y - r]![x - c]! : old.rows[y]?.[x] ?? "")), layout: { ...old.layout, spans: old.layout.spans.filter(s => !(s.row < r + pasted.length && s.row + s.rows > r && s.column < newColumns && s.column + s.columns > c)), ...(old.layout.widths ? { widths: Array.from({ length: newColumns }, (_, x) => old.layout.widths?.[x] ?? DEFAULT_COLUMN_WIDTH) } : {}) } }));
          }} onKeyDown={e => {
            if (e.key !== "Tab") return;
            const inputs = Array.from(grid.current?.querySelectorAll<HTMLInputElement>("td > input") ?? []), index = inputs.indexOf(e.currentTarget), next = inputs[index + (e.shiftKey ? -1 : 1)];
            if (next) { e.preventDefault(); next.focus(); }
            else if (!e.shiftKey) {
              e.preventDefault(); setData(old => ({ ...old, rows: [...old.rows, Array.from({ length: columns }, () => "")] })); requestAnimationFrame(() => grid.current?.querySelector<HTMLInputElement>("tr:last-child input")?.focus());
            }
          }} />
        </td>;
      })}</tr>)}</tbody></table>
    </div>
    <footer><span>{data.rows.length - 1} righe · {columns} colonne</span><button type="button" className="button button-primary" onClick={() => onSave(serializeTable(data.rows, data.align, data.layout))}>{table ? "Applica modifiche" : "Inserisci tabella"}</button></footer>
  </EditorDialog>;
}
