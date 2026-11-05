import { useEffect, useId, useMemo, useRef, useState, type ClipboardEvent, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { ArrowLeft, ClipboardPaste, Lock, Plus, Redo2, Undo2 } from "lucide-react";
import type { Component, Configurator } from "./model";
import { uid } from "./model";
import { dimensionPresets, measureConversion } from "./componentMeasure";
import {
  applyBulk, applyCellBlock, applySummary, columnTargetChoices, draftIsClean, draftsFromConfigurator, draftToEdit, editsFromTable,
  gridColumns, isLegacyComponent, looksLikeHeader, mapColumns, mappingIssues, MAX_MEASURES, measureSlotCount, mergePaste, padMeasures,
  parseSpreadsheet, planBulk, readCell, reconcileDrafts, resolveParameter, targetKey, targetLabel, writeCell,
  type BulkPlan, type DraftRow, type MappedColumn, type PlannedRow, type RowKind,
} from "./bulkImport";

export function legacyConfirmText(count: number, pending = false): string {
  return `Convertire ${count} ${count === 1 ? "misura legacy" : "misure legacy"} in dimensioni?\n\nOgni misura singola diventa la dimensione «Lunghezza», con lo stesso parametro, correzione e unità. Codice, regole e proprietà restano invariati.${pending ? "\n\nLe modifiche non ancora applicate della griglia restano nella bozza." : ""}`;
}
const fieldLabel = (key: string) => key === "code" ? "Codice" : key === "name" ? "Descrizione" : key === "family" ? "Famiglia" : key === "group" ? "Gruppo" : key === "unit" ? "Unità" : key === "note" ? "Scheda tecnica" : `M${Number(key.slice(1).split(".")[0]) + 1} ${{ name: "nome", parameter: "parametro", offset: "correzione", unit: "unità" }[key.split(".")[1]!] ?? key}`;
const kindLabel: Record<RowKind, string> = { new: "Nuovo", updated: "Aggiornato", unchanged: "Invariato", error: "Errore", skipped: "Saltata", blocked: "Bloccato", replaced: "Sostituita" };

export function BulkComponentEntry({ data, notes, legacyCount, onApply, onConvert, onOpen, onClose }: { data: Configurator; notes: string[]; legacyCount: number; onApply: (next: Configurator, summary: string) => void; onConvert: () => void; onOpen: (id: string) => void; onClose: () => void }) {
  const gridRef = useRef<HTMLDivElement>(null);
  const baseRef = useRef(data);
  const [past, setPast] = useState<DraftRow[][]>([]);
  const [future, setFuture] = useState<DraftRow[][]>([]);
  const [slots, setSlots] = useState(() => measureSlotCount(data));
  const [drafts, setDrafts] = useState(() => draftsFromConfigurator(data, measureSlotCount(data)));
  const [filter, setFilter] = useState("");
  const [active, setActive] = useState<{ index: number; column: number } | null>(null);
  const [range, setRange] = useState<{ index: number; column: number } | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [bannerNotes, setBannerNotes] = useState<string[]>([]);
  const [side, setSide] = useState<PlannedRow[]>([]);
  const [preview, setPreview] = useState(false);
  const [paste, setPaste] = useState<{ step: "input" | "map"; text: string; header: boolean; columns: MappedColumn[] } | null>(null);
  const columns = gridColumns(slots);
  const numeric = data.parameters.some(parameter => parameter.type === "number");
  useEffect(() => {
    if (data === baseRef.current) return;
    const previous = baseRef.current;
    baseRef.current = data;
    setDrafts(current => reconcileDrafts(previous, data, current, slots));
    setSide([]); setBannerNotes([]);
  }, [data, slots]);
  const dirty = drafts.some(row => !row.originId || !draftIsClean(data, row));
  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;
  const update = (next: DraftRow[] | ((current: DraftRow[]) => DraftRow[]), keepNotes = false) => {
    const current = draftsRef.current;
    const resolved = typeof next === "function" ? next(current) : next;
    if (resolved === current) return;
    setPast(items => [...items, current].slice(-50));
    setFuture([]);
    setDrafts(resolved);
    if (!keepNotes) { setSide([]); setBannerNotes([]); }
  };
  const undo = () => { const previous = past.at(-1); if (!previous) return; setPast(items => items.slice(0, -1)); setFuture(items => [...items, drafts]); setDrafts(previous); };
  const redo = () => { const next = future.at(-1); if (!next) return; setFuture(items => items.slice(0, -1)); setPast(items => [...items, drafts]); setDrafts(next); };
  const query = filter.trim().toLowerCase();
  const visible = drafts.map((row, index) => ({ row, index })).filter(({ row }) => !query || `${row.code}\n${row.name}`.toLowerCase().includes(query));
  const plan = useMemo(() => planBulk(data, drafts.map((row, index) => draftToEdit(row, index + 1)), { duplicatePolicy: "error", matchByCode: false, warnings: bannerNotes }), [data, drafts, bannerNotes]);
  const byNumber = new Map(plan.rows.map(row => [row.rowNumber, row]));
  const close = () => { if (!dirty || confirm("Scartare le modifiche non applicate?")) onClose(); };
  const locked = (row: DraftRow) => isLegacyComponent(data.components.find(component => component.id === row.originId));
  const selectedIndexes = () => {
    if (!active) return [];
    const rows = visible.map(item => item.index);
    const start = rows.indexOf(active.index);
    const end = rows.indexOf((range ?? active).index);
    if (start < 0 || end < 0) return [active.index];
    const [from, to] = start < end ? [start, end] : [end, start];
    return rows.slice(from, to + 1);
  };
  const commitCell = (index: number, column: number, value: string) => {
    const key = columns[column]?.key;
    if (!key) return;
    if (index < 0) {
      if (!value.trim() && key !== "unit") return;
      const created = writeCell({ key: uid(), code: "", name: "", family: "", group: "", unit: "pz", note: "", measures: Array.from({ length: slots }, () => ({ name: "", parameter: "", offset: "", unit: "" })) }, key, value);
      update(current => [...current, created]);
      setActive({ index: drafts.length, column });
      return;
    }
    const row = drafts[index];
    if (!row || locked(row)) return;
    if (row.originId && value === "" && readCell(row, key) !== "") { setStatus("Cella vuota: il valore esistente resta invariato."); return; }
    update(current => current.map((item, itemIndex) => itemIndex === index ? writeCell(item, key, value) : item));
  };
  const move = (rowDelta: number, columnDelta: number, extend = false) => {
    const rows = [...visible.map(item => item.index), -1];
    const current = active ?? { index: rows[0] ?? -1, column: 0 };
    let column = current.column + columnDelta;
    let position = Math.max(0, rows.indexOf(current.index));
    if (column < 0) { column = columns.length - 1; position--; }
    if (column >= columns.length) { column = 0; position++; }
    position = Math.max(0, Math.min(rows.length - 1, position + rowDelta));
    const next = { index: rows[position] ?? -1, column };
    setActive(next); if (!extend) setRange(null); else setRange(range ?? current);
    setEditing(null);
  };
  const fillDown = () => {
    if (!active) return;
    const key = columns[active.column]!.key;
    const indexes = selectedIndexes();
    const targets = indexes.length > 1 ? indexes : visible.map(item => item.index).filter(index => index >= active.index);
    const source = drafts[targets.find(index => drafts[index] && !locked(drafts[index]!)) ?? -1];
    if (!source) return;
    const value = readCell(source, key);
    update(current => current.map((row, index) => targets.includes(index) && !locked(row) ? writeCell(row, key, value) : row));
  };
  const onPasteText = (text: string) => {
    const parsed = parseSpreadsheet(text);
    if (!parsed.rows.length) return;
    const block = parsed.rows.some(row => row.length > 1) || text.includes("\n") || text.includes("\t");
    if (block && looksLikeHeader(parsed.rows[0] ?? [])) { setPaste({ step: "map", text, header: true, columns: mapColumns(parsed.rows, true).columns }); return; }
    if (!block) { if (active) commitCell(active.index, active.column, text.replace(/\r?\n$/, "")); return; }
    const rows = visible.map(item => item.index);
    const start = Math.max(0, rows.indexOf(active?.index ?? rows[0] ?? 0));
    const pasted = applyCellBlock(drafts, slots, rows.slice(start), active?.column ?? 0, parsed.rows, locked, () => ({ key: uid(), code: "", name: "", family: "", group: "", unit: "pz", note: "", measures: Array.from({ length: slots }, () => ({ name: "", parameter: "", offset: "", unit: "" })) }));
    update(pasted.drafts.map(row => padMeasures(row, slots)));
    if (pasted.ignoredColumns) setStatus(`${pasted.ignoredColumns} ${pasted.ignoredColumns === 1 ? "colonna ignorata" : "colonne ignorate"}.`);
  };
  const keyDown = (event: ReactKeyboardEvent) => {
    if ((event.target as HTMLElement).closest("input,textarea,select")) return;
    const key = event.key;
    if ((event.ctrlKey || event.metaKey) && event.shiftKey && key.toLowerCase() === "v") { event.preventDefault(); setPaste({ step: "input", text: "", header: true, columns: [] }); return; }
    if ((event.ctrlKey || event.metaKey) && key === "Enter") { event.preventDefault(); setPreview(true); return; }
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "z") { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
    if ((event.ctrlKey || event.metaKey) && key.toLowerCase() === "d") { event.preventDefault(); fillDown(); return; }
    if (key === "F8") { event.preventDefault(); const errors = plan.rows.filter(row => row.kind === "error").map(row => row.rowNumber - 1); const position = errors.find(index => active ? index > active.index : true) ?? errors[0]; if (position !== undefined) setActive({ index: position, column: 0 }); return; }
    if (!active) return;
    if (key === "Tab") { event.preventDefault(); move(0, event.shiftKey ? -1 : 1); return; }
    if (key === "Enter" || key === "F2") { event.preventDefault(); setEditing(readCell(drafts[active.index] ?? ghost(), columns[active.column]!.key)); return; }
    if (key === "Escape") { setActive(null); setRange(null); return; }
    if (key === "ArrowUp" || key === "ArrowDown" || key === "ArrowLeft" || key === "ArrowRight") { event.preventDefault(); move(key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0, key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : 0, event.shiftKey); return; }
    if ((key === "Backspace" || key === "Delete") && active.index >= 0) { event.preventDefault(); commitCell(active.index, active.column, ""); return; }
    if (key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); setEditing(key); }
  };
  const copy = (event: ClipboardEvent) => {
    if ((event.target as HTMLElement).closest("input,textarea") && editing !== null) return;
    if (!active) return;
    const indexes = selectedIndexes().filter(index => index >= 0 && drafts[index]);
    const [from, to] = [Math.min(active.column, (range ?? active).column), Math.max(active.column, (range ?? active).column)];
    event.preventDefault();
    event.clipboardData.setData("text/plain", indexes.map(index => columns.slice(from, to + 1).map(column => readCell(drafts[index]!, column.key)).join("\t")).join("\n"));
  };
  const ghost = (): DraftRow => ({ key: "ghost", code: "", name: "", family: "", group: "", unit: "pz", note: "", measures: Array.from({ length: slots }, () => ({ name: "", parameter: "", offset: "", unit: "" })) });
  const suggestions = (row: DraftRow, key: string) => {
    if (key === "family") return [...new Set(data.components.map(component => component.family ?? "").filter(Boolean))];
    if (key === "group") return [...new Set(data.components.filter(component => (component.family ?? "") === row.family).map(component => component.group).filter(Boolean))];
    if (key === "unit") return [...new Set(["pz", ...data.components.map(component => component.unit).filter(Boolean)])];
    if (key === "note") return notes;
    if (key.endsWith(".name")) return [...dimensionPresets];
    if (key.endsWith(".parameter")) return data.parameters.filter(parameter => parameter.type === "number").map(parameter => parameter.unit ? `${parameter.name} (${parameter.unit})` : parameter.name);
    if (key.endsWith(".unit")) {
      const resolved = resolveParameter(data, row.measures[Number(key.slice(1).split(".")[0])]?.parameter ?? "");
      const parameter = "id" in resolved ? data.parameters.find(item => item.id === resolved.id) : undefined;
      return [...new Set([parameter?.unit ?? "", ...["mm", "cm", "m"].filter(unit => parameter && measureConversion(parameter.unit, unit) !== undefined)].filter(Boolean))];
    }
    return [];
  };
  const applicable = plan.counts.new + plan.counts.updated;
  const apply = (mode: "all" | "valid") => {
    if (!applicable || (mode === "all" && plan.counts.error)) return;
    const next = applyBulk(data, plan, mode);
    const errors = new Set(plan.rows.filter(row => row.kind === "error").map(row => row.rowNumber - 1));
    const kept = new Map(drafts.filter((_, index) => errors.has(index) && drafts[index]!.originId).map(row => [row.originId!, row]));
    const created = drafts.filter((row, index) => errors.has(index) && !row.originId);
    baseRef.current = next;
    setDrafts([...draftsFromConfigurator(next, slots).map(row => kept.get(row.originId!) ?? row), ...created]);
    setPreview(false); setSide([]); setBannerNotes([]);
    onApply(next, applySummary(plan));
  };
  return <div className="config-bulk">
    <div className="config-bulk-toolbar"><button type="button" className="config-text-button" onClick={close}><ArrowLeft size={16}/>Elenco componenti</button><h2>Inserimento rapido</h2><button type="button" className="button button-secondary" onClick={() => setPaste({ step: "input", text: "", header: true, columns: [] })}><ClipboardPaste size={16}/>Incolla da Excel</button><button type="button" className="button button-secondary" disabled={!numeric || slots >= MAX_MEASURES} title={!numeric ? "Aggiungi prima un parametro numerico" : undefined} onClick={() => { setSlots(value => value + 1); setDrafts(current => current.map(row => padMeasures(row, slots + 1))); }}><Plus size={16}/>Misura</button><button type="button" className="button button-secondary" onClick={fillDown}>Riempi in basso</button><button type="button" className="config-icon" aria-label="Annulla" disabled={!past.length} onClick={undo}><Undo2 size={16}/></button><button type="button" className="config-icon" aria-label="Ripeti" disabled={!future.length} onClick={redo}><Redo2 size={16}/></button>{!!legacyCount && <button type="button" className="button button-secondary" onClick={() => { if (confirm(legacyConfirmText(legacyCount, dirty))) onConvert(); }}>Converti misure legacy</button>}<label className="config-bulk-filter">Filtra per codice o descrizione<input aria-label="Filtra per codice o descrizione" value={filter} onChange={event => setFilter(event.target.value)}/></label></div>
    <p className="config-hint">Scrivi come in un foglio: Tab e Invio per spostarti, Ctrl+V per incollare da Excel. Niente viene salvato finché non applichi. I numeri usano la virgola o il punto, senza separatore delle migliaia: 1000,5 oppure 1000.5.</p>
    {!!query && <p className="config-hint">Filtro attivo: {visible.length}/{drafts.length}. Copia, riempimento e incolla agiscono sulle righe visibili.</p>}
    {!drafts.length && <p className="config-empty">Inserisci il codice e la descrizione del primo componente, oppure incolla le righe da Excel.</p>}
    <div ref={gridRef} className="config-bulk-grid" role="grid" aria-label="Inserimento rapido componenti" tabIndex={0} onKeyDown={keyDown} onCopy={copy} onPaste={event => { const text = event.clipboardData.getData("text/plain"); if (!text || ((event.target as HTMLElement).closest("input,textarea") && !text.includes("\t") && !/[\r\n]/.test(text))) return; event.preventDefault(); onPasteText(text); }}>
      <table><thead><tr><th rowSpan={2}>#</th><th rowSpan={2}></th>{groupHeaders(columns).map(group => <th key={group.label} colSpan={group.span} className={group.label.startsWith("Misura") ? "is-measure" : undefined}>{group.label}</th>)}</tr><tr>{columns.map(column => <th key={column.key} className={column.group.startsWith("Misura") ? "is-measure" : undefined}>{column.label}{column.required ? " *" : ""}</th>)}</tr></thead>
      <tbody>{visible.map(({ row, index }) => <GridRow key={row.key} row={row} index={index} columns={columns} planned={byNumber.get(index + 1)} component={data.components.find(component => component.id === row.originId)} active={active} editing={editing} numeric={numeric} suggestions={suggestions} onOpen={onOpen} onActivate={(column, extend) => { setActive({ index, column }); if (extend) setRange(current => current ?? active); else setRange(null); setEditing(null); gridRef.current?.focus(); }} onEdit={column => { setActive({ index, column }); setEditing(readCell(row, columns[column]!.key)); }} onCommit={(column, value, how) => { commitCell(index, column, value); setEditing(null); if (how === "tab" || how === "shift-tab") move(0, how === "tab" ? 1 : -1); else if (how === "enter") move(1, 0); else gridRef.current?.focus(); }} onCancel={() => { setEditing(null); gridRef.current?.focus(); }}/>)}
      <tr className="is-ghost">{columns.length ? <><td className="config-bulk-index">+</td><td></td>{columns.map((column, columnIndex) => <td key={column.key} className={active?.index === -1 && active.column === columnIndex ? "is-active" : undefined} onMouseDown={() => { setActive({ index: -1, column: columnIndex }); setEditing(null); gridRef.current?.focus(); }} onDoubleClick={() => { setActive({ index: -1, column: columnIndex }); setEditing(readCell(ghost(), column.key)); }}>{active?.index === -1 && active.column === columnIndex && editing !== null ? <CellInput label={column.label} initial={editing} options={suggestions(ghost(), column.key)} onCommit={(value, how) => { commitCell(-1, columnIndex, value); setEditing(null); if (how === "tab" || how === "shift-tab") move(0, how === "tab" ? 1 : -1); else if (how === "enter") move(1, 0); }} onCancel={() => setEditing(null)}/> : <span className="config-bulk-muted">{column.key === "code" ? "Nuovo codice…" : column.key === "unit" ? "pz" : ""}</span>}</td>)}</> : null}</tr>
      </tbody></table>
    </div>
    <div className="config-bulk-foot"><span className="is-error">✕ {plan.counts.error} {plan.counts.error === 1 ? "errore" : "errori"} in {plan.rows.filter(row => row.kind === "error").length} {plan.rows.filter(row => row.kind === "error").length === 1 ? "riga" : "righe"}</span><span className="is-warn">! {plan.rows.filter(row => row.warnings.length).length} {plan.rows.filter(row => row.warnings.length).length === 1 ? "avviso" : "avvisi"}</span><span className="is-update">✎ {plan.counts.updated} {plan.counts.updated === 1 ? "modificata" : "modificate"}</span><span className="is-new">+ {plan.counts.new} {plan.counts.new === 1 ? "nuova" : "nuove"}</span><span>🔒 {plan.counts.blocked} {plan.counts.blocked === 1 ? "bloccata" : "bloccate"}</span><span className="config-bulk-status">{status}</span><button type="button" className="button button-secondary" onClick={() => { const errors = plan.rows.filter(row => row.kind === "error"); const next = errors.find(row => !active || row.rowNumber - 1 > active.index) ?? errors[0]; if (next) setActive({ index: next.rowNumber - 1, column: 0 }); }}>Vai al prossimo errore</button><button type="button" className="button button-secondary" onClick={close}>Scarta modifiche</button><button type="button" className="button button-primary" onClick={() => setPreview(true)}>Anteprima e applica… ({applicable})</button></div>
    {paste && <PasteDialog data={data} state={paste} onChange={setPaste} onClose={() => setPaste(null)} onPreview={(columns, header, mode) => {
      const parsed = parseSpreadsheet(paste.text);
      const issues = mappingIssues(columns, columns.filter(column => column.target.kind === "ignore").map(column => column.header));
      if (issues.some(issue => issue.includes("Codice") || issue.includes("stesso campo"))) return;
      const merged = mergePaste(data, drafts, editsFromTable(parsed.rows, columns, header), mode, slots);
      update(merged.drafts.map(row => padMeasures(row, Math.max(slots, ...merged.drafts.map(item => item.measures.length)))), true);
      setSlots(current => Math.max(current, ...merged.drafts.map(row => row.measures.length)));
      setBannerNotes([...issues.filter(issue => !issue.includes("Codice") && !issue.includes("stesso campo")), ...merged.notes]);
      setSide(merged.side); setPaste(null); setPreview(true);
    }}/>}
    {preview && <PreviewDialog data={data} plan={plan} side={side} onClose={() => setPreview(false)} onCorrect={rowNumber => { setPreview(false); setActive({ index: rowNumber - 1, column: 0 }); gridRef.current?.focus(); }} onApply={apply}/>}
  </div>;
}
function groupHeaders(columns: ReturnType<typeof gridColumns>) {
  const groups: Array<{ label: string; span: number }> = [];
  for (const column of columns) {
    const last = groups.at(-1);
    if (last?.label === column.group) last.span++;
    else groups.push({ label: column.group, span: 1 });
  }
  return groups;
}
function GridRow({ row, index, columns, planned, component, active, editing, numeric, suggestions, onOpen, onActivate, onEdit, onCommit, onCancel }: { row: DraftRow; index: number; columns: ReturnType<typeof gridColumns>; planned?: PlannedRow; component?: Component; active: { index: number; column: number } | null; editing: string | null; numeric: boolean; suggestions: (row: DraftRow, key: string) => string[]; onOpen: (id: string) => void; onActivate: (column: number, extend: boolean) => void; onEdit: (column: number) => void; onCommit: (column: number, value: string, how?: "tab" | "shift-tab" | "enter") => void; onCancel: () => void }) {
  const legacy = isLegacyComponent(component);
  const changed = new Set((planned?.diffs ?? []).map(diff => diff.label));
  return <tr className={planned?.kind === "error" ? "is-error" : planned?.kind === "updated" ? "is-updated" : legacy ? "is-locked" : undefined}>{<td className="config-bulk-index">{index + 1}</td>}<td className="config-bulk-state" title={planned?.detail}>{planned ? kindMark(planned.kind) : ""}</td>{columns.map((column, columnIndex) => {
    const measure = column.group.startsWith("Misura");
    if (legacy && column.key === "m0.name") return <td key={column.key} className="config-bulk-lock" colSpan={columns.filter(item => item.group.startsWith("Misura")).length}><Lock size={13}/> Misura legacy: converti prima di modificare. {component && <button type="button" className="config-text-button" onClick={() => onOpen(component.id)}>Apri scheda</button>}</td>;
    if (legacy && measure) return null;
    const value = readCell(row, column.key);
    const messages = cellMessages(planned, column.key);
    const isActive = active?.index === index && active.column === columnIndex;
    return <td key={column.key} className={`${isActive ? "is-active" : ""} ${changed.has(fieldLabel(column.key)) ? "is-changed" : ""} ${messages.length ? "is-invalid" : ""}`} aria-invalid={messages.length ? true : undefined} title={messages.join("\n") || undefined} onMouseDown={event => onActivate(columnIndex, event.shiftKey)} onDoubleClick={() => !legacy && (numeric || !measure) && onEdit(columnIndex)}>{isActive && editing !== null && !legacy && (numeric || !measure) ? <CellInput label={`${column.label} di ${row.code || "nuova riga"}`} initial={editing} options={suggestions(row, column.key)} onCommit={(next, how) => onCommit(columnIndex, next, how)} onCancel={onCancel}/> : <span>{value || <span className="config-bulk-muted">{measure && !value ? "—" : ""}</span>}</span>}{isActive && !!messages.length && <div className="config-bulk-tip" role="alert">{messages.map(message => <p key={message}>{message}</p>)}<small>Riga {index + 1} · {messages.length} {messages.length === 1 ? "errore" : "errori"}</small></div>}</td>;
  })}</tr>;
}
function CellInput({ label, initial, options, onCommit, onCancel }: { label: string; options: string[]; onCommit: (value: string, how?: "tab" | "shift-tab" | "enter") => void; onCancel: () => void; initial: string }) {
  const [value, setValue] = useState(initial);
  const done = useRef(false);
  const listId = useId();
  const finish = (next: string, how?: "tab" | "shift-tab" | "enter") => { if (done.current) return; done.current = true; onCommit(next, how); };
  return <><input aria-label={label} autoFocus value={value} list={options.length ? listId : undefined} onChange={event => setValue(event.target.value)} onBlur={event => finish(event.currentTarget.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); finish(event.currentTarget.value, "enter"); } else if (event.key === "Tab") { event.preventDefault(); finish(event.currentTarget.value, event.shiftKey ? "shift-tab" : "tab"); } else if (event.key === "Escape") { event.preventDefault(); done.current = true; onCancel(); } }}/>{!!options.length && <datalist id={listId}>{options.map(option => <option key={option} value={option}/>)}</datalist>}</>;
}
function cellMessages(row: PlannedRow | undefined, key: string): string[] {
  if (!row || (row.kind !== "error" && row.kind !== "blocked")) return [];
  const messages = row.kind === "blocked" ? [row.detail] : row.errors;
  if (row.kind === "blocked") return key === "code" ? messages : [];
  const relevant = messages.filter(message => matchesField(message, key));
  return relevant.length || key !== "code" ? relevant : messages.length === 1 ? messages : [];
}
function matchesField(message: string, key: string): boolean {
  const text = message.toLowerCase();
  if (key === "code") return text.includes("codice");
  if (key === "name") return text.includes("descrizione");
  if (key === "family") return text.includes("famiglia");
  if (key === "group") return text.includes("gruppo");
  if (key.endsWith(".offset")) return text.includes("numero non valido") || text.includes("correzione");
  if (key.endsWith(".unit")) return text.includes("unità");
  if (key.endsWith(".parameter")) return text.includes("parametro");
  if (key.endsWith(".name")) return text.includes("nome della dimensione") || text.includes("buchi") || text.includes("compila parametro");
  return false;
}
function kindMark(kind: RowKind) {
  const symbol = kind === "updated" ? "✎" : kind === "new" ? "+" : kind === "error" ? "✕" : kind === "blocked" ? "🔒" : kind === "unchanged" ? "✓" : "!";
  return <span className={`config-bulk-mark is-${kind}`}>{symbol}</span>;
}
function PasteDialog({ state, onChange, onClose, onPreview }: { data: Configurator; state: { step: "input" | "map"; text: string; header: boolean; columns: MappedColumn[] }; onChange: (state: { step: "input" | "map"; text: string; header: boolean; columns: MappedColumn[] }) => void; onClose: () => void; onPreview: (columns: MappedColumn[], header: boolean, mode: "upsert" | "insert-only") => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [mode, setMode] = useState<"upsert" | "insert-only">("upsert");
  const parsed = parseSpreadsheet(state.text);
  const issues = state.step === "map" ? mappingIssues(state.columns, state.columns.filter(column => column.target.kind === "ignore").map(column => column.header)) : [];
  const blocked = issues.some(issue => issue.includes("Codice") || issue.includes("stesso campo"));
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  const choices = columnTargetChoices(Math.max(8, ...state.columns.map(column => column.target.kind === "measure" ? column.target.index + 1 : 0)));
  return <dialog ref={ref} className="config-definition-dialog config-bulk-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}><form onSubmit={event => { event.preventDefault(); if (state.step === "input") { const header = state.header && looksLikeHeader(parsed.rows[0] ?? []); onChange({ ...state, step: "map", header, columns: mapColumns(parsed.rows, header).columns }); } else if (!blocked) onPreview(state.columns, state.header, mode); }}>
    <header><div><h2 id={titleId}>Incolla da Excel{state.step === "map" ? " · Colonne" : ""}</h2><p>{state.step === "input" ? "Copia le righe in Excel, intestazioni comprese, e incollale qui. Puoi anche scegliere un file CSV o TSV." : "Controlla l’abbinamento ai campi di Nebula. Una cella vuota lascia il valore esistente."}</p></div><button type="button" className="config-icon" aria-label="Chiudi incolla" onClick={onClose}>✕</button></header>
    <div className="config-dialog-body">{state.step === "input" ? <><textarea aria-label="Testo incollato da Excel" rows={8} placeholder="Ctrl+V oppure incolla in quest’area" value={state.text} onChange={event => onChange({ ...state, text: event.target.value })} onKeyDown={event => { if (event.key !== "Tab") return; event.preventDefault(); const el = event.currentTarget; const start = el.selectionStart ?? state.text.length; const end = el.selectionEnd ?? start; const text = `${state.text.slice(0, start)}\t${state.text.slice(end)}`; onChange({ ...state, text }); requestAnimationFrame(() => { el.selectionStart = el.selectionEnd = start + 1; }); }}/><label className="config-checkbox"><input type="checkbox" checked={state.header} onChange={event => onChange({ ...state, header: event.target.checked })}/>La prima riga è l’intestazione</label><label className="config-text-button">Importa file…<input aria-label="Importa file CSV" className="config-bulk-file" type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={async event => { const file = event.target.files?.[0]; if (file) onChange({ ...state, text: (await file.text()).replace(/^\uFEFF/, "") }); }}/></label>{!!state.text && <p className="config-hint">{parsed.rows.length} righe, {Math.max(0, ...parsed.rows.map(row => row.length))} colonne, separatore {parsed.delimiter === "\t" ? "Tab" : parsed.delimiter}.</p>}</> : <><div className="config-bulk-map">{state.columns.map((column, index) => <label key={column.index}>{column.header}<small>{column.example || "—"}</small><select aria-label={`Campo per ${column.header}`} value={targetKey(column.target) || "ignore"} onChange={event => onChange({ ...state, columns: state.columns.map((item, itemIndex) => itemIndex === index ? { ...item, target: choices.find(choice => (targetKey(choice) || "ignore") === event.target.value) ?? { kind: "ignore" }, auto: false } : item) })}>{choices.map(choice => <option key={targetKey(choice) || "ignore"} value={targetKey(choice) || "ignore"}>{targetLabel(choice)}</option>)}</select>{column.auto && <em>automatica</em>}</label>)}</div>{issues.map(issue => <p key={issue} className={issue.includes("ignor") ? "config-hint" : "config-field-error"} role={issue.includes("ignor") ? undefined : "alert"}>{issue}</p>)}<fieldset className="config-bulk-mode"><legend>Righe con un codice già presente</legend><label><input type="radio" name="bulk-mode" checked={mode === "upsert"} onChange={() => setMode("upsert")}/>Aggiorna i campi mappati</label><label><input type="radio" name="bulk-mode" checked={mode === "insert-only"} onChange={() => setMode("insert-only")}/>Salta, importa solo i componenti nuovi</label></fieldset><p className="config-hint">In aggiornamento le celle vuote lasciano il valore esistente. Per i codici ripetuti nell’incolla vale l’ultima riga.</p></>}
    </div><footer><button type="button" className="button button-secondary" onClick={onClose}>Annulla</button>{state.step === "map" && <button type="button" className="button button-secondary" onClick={() => onChange({ ...state, step: "input" })}>Indietro</button>}<button type="submit" className="button button-primary" disabled={state.step === "input" ? !parsed.rows.length : blocked} title={blocked ? "Associa la colonna Codice per continuare." : undefined}>{state.step === "input" ? "Continua" : "Anteprima"}</button></footer>
  </form></dialog>;
}
function PreviewDialog({ data, plan, side, onClose, onCorrect, onApply }: { data: Configurator; plan: BulkPlan; side: PlannedRow[]; onClose: () => void; onCorrect: (rowNumber: number) => void; onApply: (mode: "all" | "valid") => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [filter, setFilter] = useState<RowKind | "all">("all");
  const rows = [...side, ...plan.rows];
  const shown = rows.filter(row => filter === "all" || row.kind === filter);
  const applicable = plan.counts.new + plan.counts.updated;
  useEffect(() => { const dialog = ref.current!; dialog.showModal(); return () => { if (dialog.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className="config-definition-dialog config-bulk-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }}><form onSubmit={event => event.preventDefault()}>
    <header><div><h2 id={titleId}>Anteprima modifiche · {data.title}</h2><p>Controlla le differenze prima di applicare. Le righe con errori restano nella griglia.</p></div><button type="button" className="config-icon" aria-label="Chiudi anteprima" onClick={onClose}>✕</button></header>
    <div className="config-dialog-body"><div className="config-bulk-counts"><span>+ {plan.counts.new} nuovi</span><span>✎ {plan.counts.updated} aggiornati</span><span>= {plan.counts.unchanged} invariati</span><span>✕ {plan.counts.error} con errori</span><span>↓ {side.filter(row => row.kind === "skipped").length} saltati</span><span>↩ {side.filter(row => row.kind === "replaced").length} sostituite</span><span>🔒 {plan.counts.blocked} bloccati</span></div>
    <div className="config-bulk-filters" role="group" aria-label="Filtra esiti">{(["all", "new", "updated", "error", "unchanged", "blocked", "replaced", "skipped"] as const).map(kind => <button type="button" key={kind} className={filter === kind ? "is-active" : ""} onClick={() => setFilter(kind)}>{kind === "all" ? "Tutti" : kindLabel[kind]}</button>)}</div>
    <div className="config-bulk-preview"><div className="config-bulk-preview-head"><span>Esito</span><span>Codice</span><span>Descrizione</span><span>Dettaglio</span></div>{shown.map(row => <div key={`${row.kind}-${row.rowNumber}-${row.code}-${row.detail}`} className={`is-${row.kind}`}><span>{kindLabel[row.kind]}</span><span>{row.code || "‹vuoto›"}</span><span>{row.name}</span><span>{row.diffs.length ? row.diffs.map(diff => <em key={diff.label}>{diff.label}: {diff.before} → {diff.after}</em>) : row.detail}{!!row.warnings.length && <small>{row.warnings.join(" ")}</small>}{row.kind === "error" && <button type="button" className="config-text-button" onClick={() => onCorrect(row.rowNumber)}>Correggi</button>}</span></div>)}{!shown.length && <p className="config-empty">Nessuna riga in questo filtro.</p>}</div>
    {!!plan.newWithoutRule && <p className="config-hint">{plan.newWithoutRule} {plan.newWithoutRule === 1 ? "componente nuovo non è" : "componenti nuovi non sono"} ancora {plan.newWithoutRule === 1 ? "aggiunto" : "aggiunti"} da nessuna regola: comparirà un avviso in Analisi finché non crei la loro regola.</p>}
    {plan.version !== data.version && <p className="config-hint">Il configuratore passerà al formato versione {plan.version} (dimensioni dei componenti).</p>}
    {plan.warnings.map(warning => <p key={warning} className="config-hint">{warning}</p>)}
    <p className="config-hint">{applicable ? `Verranno applicate ${applicable} righe` : "Nessuna modifica da applicare."}{plan.counts.error || plan.counts.blocked || side.length ? ` · escluse ${[plan.counts.error ? `${plan.counts.error} con errori` : "", plan.counts.blocked ? `${plan.counts.blocked} ${plan.counts.blocked === 1 ? "bloccata" : "bloccate"}` : "", side.filter(row => row.kind === "replaced").length ? `${side.filter(row => row.kind === "replaced").length} ${side.filter(row => row.kind === "replaced").length === 1 ? "sostituita" : "sostituite"}` : ""].filter(Boolean).join(", ")}` : ""}</p>
    </div><footer><button type="button" className="button button-secondary" onClick={onClose}>Torna a modificare</button><button type="button" className="button button-secondary" disabled={!applicable || plan.counts.error > 0} title={plan.counts.error ? "Correggi o escludi le righe con errori." : undefined} onClick={() => onApply("all")}>Applica tutto</button><button type="button" className="button button-primary" disabled={!applicable} onClick={() => onApply("valid")}>Applica solo le {applicable} righe valide</button></footer>
  </form></dialog>;
}
