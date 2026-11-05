import type { Component, ComponentDimension, Configurator, Parameter } from "./model";
import { configVersion, uid } from "./model";
import { allComponentProblems } from "./definitionValidation";

export const DECIMAL_FORMAT_ERROR = "Numero non valido: usa 1000,5 o 1000.5, senza separatore delle migliaia.";
export const LEGACY_MEASURE_ERROR = "misura legacy. Usa «Converti misure legacy» prima di modificare le dimensioni.";
export const MAX_MEASURES = 32;
export const MAX_VISIBLE_MEASURES = 32;

export type DecimalParse = { empty: true } | { value: number } | { error: string };
export function parseDecimal(raw: string): DecimalParse {
  const text = raw.trim().replace(/\u2212/g, "-");
  if (!text) return { empty: true };
  if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(text)) return { error: DECIMAL_FORMAT_ERROR };
  const value = Number(text.replace(",", "."));
  return Number.isFinite(value) ? { value } : { error: DECIMAL_FORMAT_ERROR };
}
export function formatDecimal(value: number): string {
  return Number.isFinite(value) ? String(value).replace(".", ",") : "";
}

const fold = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
export type FlatField = "code" | "name" | "family" | "group" | "unit" | "note";
export type MeasureSlot = "name" | "parameter" | "offset" | "unit";
export type ColumnTarget = { kind: "flat"; field: FlatField } | { kind: "measure"; index: number; slot: MeasureSlot } | { kind: "ignore" };
export type SpreadsheetDelimiter = "\t" | ";" | ",";

const flatHeaders: Record<string, FlatField> = {
  codice: "code", code: "code", cod: "code",
  descrizione: "name", description: "name", nome: "name", name: "name",
  famiglia: "family", family: "family",
  gruppo: "group", gruppoassieme: "group", group: "group", assieme: "group",
  unita: "unit", um: "unit", unit: "unit", udm: "unit",
  scheda: "note", schedatecnica: "note", nota: "note", note: "note",
};
const ignoredHeaders = new Set(["quantita", "qty", "quantity", "stato", "status", "regole", "rules", "misuraperpezzo", "unitamisura"]);
const bareMeasure: Record<string, MeasureSlot> = {
  parammisura: "parameter", parametromisura: "parameter", parametrimisura: "parameter",
  corr: "offset", correzione: "offset", corrmisura: "offset", correzioneoffset: "offset",
  umisura: "unit", nomemisura: "name", misura: "name",
};
const measureSlots = ["name", "parameter", "offset", "unit"] as const;
const slotToken: Record<string, MeasureSlot> = {
  nome: "name", name: "name", param: "parameter", parametro: "parameter", parameter: "parameter",
  offset: "offset", corr: "offset", correzione: "offset", unita: "unit", unit: "unit", um: "unit",
};

export function isLegacyComponent(component: Component | undefined): boolean {
  return !!component && component.measure !== undefined && component.dimensions === undefined;
}
export function parameterLabel(data: Configurator, id: string): string {
  const parameter = data.parameters.find(item => item.id === id);
  if (!parameter) return id;
  return parameter.unit ? `${parameter.name} (${parameter.unit})` : parameter.name;
}
export function resolveParameter(data: Configurator, raw: string): { id: string } | { error: string } {
  const text = raw.trim();
  const numeric = data.parameters.filter(parameter => parameter.type === "number");
  if (numeric.some(parameter => parameter.id === text)) return { id: text };
  const label = (parameter: Parameter) => (parameter.unit ? `${parameter.name} (${parameter.unit})` : parameter.name).toLowerCase();
  const matches = numeric.filter(parameter => parameter.name.toLowerCase() === text.toLowerCase() || label(parameter) === text.toLowerCase());
  if (matches.length > 1) return { error: `Il nome «${text}» corrisponde a più parametri numerici.` };
  if (matches.length === 1) return { id: matches[0]!.id };
  return { id: text };
}
export function displayParameter(data: Configurator, raw: string): string {
  if (!raw) return "";
  const resolved = resolveParameter(data, raw);
  return "id" in resolved && data.parameters.some(parameter => parameter.id === resolved.id && parameter.type === "number") ? parameterLabel(data, resolved.id) : raw;
}

export interface HeaderMatch { target: ColumnTarget; recognized: boolean }
export function matchHeader(header: string): HeaderMatch | undefined {
  const key = fold(header);
  if (!key) return;
  const prefix = /^(?:m|misura)(\d{1,2})(nome|name|param|parametro|parameter|offset|corr|correzione|unita|unit|um)$/.exec(key);
  const suffix = /^(nome|name|param|parametro|parameter|offset|corr|correzione|unita|unit|um)(?:m|misura)(\d{1,2})$/.exec(key);
  if (prefix || suffix) {
    const index = Number(prefix ? prefix[1] : suffix![2]);
    const slot = slotToken[prefix ? prefix[2]! : suffix![1]!];
    if (index >= 1 && index <= MAX_MEASURES && slot) return { target: { kind: "measure", index: index - 1, slot }, recognized: true };
  }
  const onlyIndex = /^(?:m|misura)(\d{1,2})$/.exec(key);
  if (onlyIndex) {
    const index = Number(onlyIndex[1]);
    if (index >= 1 && index <= MAX_MEASURES) return { target: { kind: "measure", index: index - 1, slot: "name" }, recognized: true };
  }
  if (bareMeasure[key]) return { target: { kind: "measure", index: 0, slot: bareMeasure[key] }, recognized: true };
  if (flatHeaders[key]) return { target: { kind: "flat", field: flatHeaders[key] }, recognized: true };
  if (ignoredHeaders.has(key) || key.startsWith("proprieta")) return { target: { kind: "ignore" }, recognized: true };
  return;
}
export function looksLikeHeader(cells: string[]): boolean {
  const filled = cells.map(cell => cell.trim()).filter(Boolean);
  if (filled.length < 2) return false;
  const recognized = filled.filter(cell => matchHeader(cell)?.recognized).length;
  return recognized >= 2 && recognized * 2 >= filled.length;
}
export function targetKey(target: ColumnTarget): string {
  if (target.kind === "ignore") return "";
  if (target.kind === "flat") return target.field;
  return `m${target.index}.${target.slot}`;
}
export function targetLabel(target: ColumnTarget): string {
  if (target.kind === "ignore") return "— Ignora —";
  if (target.kind === "flat") return { code: "Codice", name: "Descrizione", family: "Famiglia", group: "Gruppo", unit: "Unità", note: "Scheda tecnica" }[target.field];
  const slot = { name: "nome", parameter: "parametro", offset: "correzione", unit: "unità" }[target.slot];
  return `Misura ${target.index + 1} · ${slot}`;
}
export function columnTargetChoices(highest = 8): ColumnTarget[] {
  const choices: ColumnTarget[] = [{ kind: "ignore" }, ...(["code", "name", "family", "group", "unit", "note"] as const).map(field => ({ kind: "flat" as const, field }))];
  for (let index = 0; index < Math.min(MAX_MEASURES, Math.max(8, highest)); index++) for (const slot of measureSlots) choices.push({ kind: "measure", index, slot });
  return choices;
}

export function parseSpreadsheet(source: string): { rows: string[][]; delimiter: SpreadsheetDelimiter } {
  const text = source.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [[]];
  let value = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"' && (quoted || !value)) {
      if (quoted && text[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (ch === delimiter || ch === "\n" || ch === "\r")) {
      rows.at(-1)!.push(value);
      value = "";
      if (ch !== delimiter) { if (ch === "\r" && text[i + 1] === "\n") i++; rows.push([]); }
    } else value += ch;
  }
  rows.at(-1)!.push(value);
  while (rows.length && rows.at(-1)!.every(cell => cell === "")) rows.pop();
  return { rows, delimiter };
}
function detectDelimiter(text: string): SpreadsheetDelimiter {
  const counts: Record<SpreadsheetDelimiter, number> = { "\t": 0, ";": 0, ",": 0 };
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === '"') {
      if (quoted && text[i + 1] === '"') { i++; continue; }
      quoted = !quoted;
    } else if (!quoted && (ch === "\n" || ch === "\r")) break;
    else if (!quoted && (ch === "\t" || ch === ";" || ch === ",")) counts[ch]++;
  }
  if (counts["\t"] > 0) return "\t";
  if (counts[";"] > 0 && counts[";"] >= counts[","]) return ";";
  if (counts[","] > 0) return ",";
  return "\t";
}

export interface MappedColumn { index: number; header: string; example: string; target: ColumnTarget; auto: boolean; recognized: boolean }
export function mapColumns(rows: string[][], header: boolean): { columns: MappedColumn[]; warnings: string[] } {
  const width = Math.max(0, ...rows.map(row => row.length));
  const headers = header ? rows[0] ?? [] : [];
  const examples = rows[header ? 1 : 0] ?? [];
  const defaults = gridColumns(Math.min(MAX_MEASURES, Math.max(1, Math.ceil(Math.max(0, width - 6) / 4))));
  const columns: MappedColumn[] = [];
  const ignored: string[] = [];
  for (let index = 0; index < width; index++) {
    const label = header ? headers[index] ?? "" : `Colonna ${index + 1}`;
    const matched = header ? matchHeader(label) : undefined;
    let target: ColumnTarget = matched?.target ?? (!header ? targetFromKey(defaults[index]?.key) : { kind: "ignore" });
    const recognized = header ? !!matched?.recognized : index < defaults.length;
    const auto = recognized && target.kind !== "ignore";
    if (target.kind === "ignore") ignored.push(label.trim() || `Colonna ${index + 1}`);
    columns.push({ index, header: label.trim() || `Colonna ${index + 1}`, example: examples[index] ?? "", target, auto, recognized });
  }
  return { columns, warnings: mappingIssues(columns, ignored) };
}
function targetFromKey(key: string | undefined): ColumnTarget {
  if (!key) return { kind: "ignore" };
  if (key.startsWith("m")) {
    const [index, slot] = key.slice(1).split(".") as [string, MeasureSlot];
    return { kind: "measure", index: Number(index), slot };
  }
  return { kind: "flat", field: key as FlatField };
}
export function mappingIssues(columns: MappedColumn[], ignored: string[] = []): string[] {
  const issues: string[] = [];
  const seen = new Map<string, string>();
  for (const column of columns) {
    const key = targetKey(column.target);
    if (!key) continue;
    const previous = seen.get(key);
    if (previous) issues.push(`«${column.header}» e «${previous}» sono associate allo stesso campo.`);
    else seen.set(key, column.header);
  }
  if (!columns.some(column => column.target.kind === "flat" && column.target.field === "code")) issues.push("Associa la colonna Codice per continuare.");
  const names = ignored.filter(Boolean);
  if (names.length) issues.push(names.length === 1 ? `Colonna ignorata: «${names[0]}».` : `Colonne ignorate: ${names.map(name => `«${name}»`).join(", ")}.`);
  return issues;
}

export interface MeasureCells { name?: string; parameter?: string; offset?: string; unit?: string }
export interface RowEdit {
  rowNumber: number;
  originId?: string;
  code?: string;
  name?: string;
  family?: string;
  group?: string;
  unit?: string;
  note?: string;
  measures?: Array<MeasureCells | undefined>;
}
export function editsFromTable(rows: string[][], columns: MappedColumn[], header: boolean): RowEdit[] {
  return rows.slice(header ? 1 : 0).map((row, index) => {
    const edit: RowEdit = { rowNumber: index + 1, measures: [] };
    for (const column of columns) {
      const value = row[column.index] ?? "";
      if (column.target.kind === "flat") edit[column.target.field] = value;
      else if (column.target.kind === "measure") {
        const measures = edit.measures ??= [];
        const cell = measures[column.target.index] ?? {};
        cell[column.target.slot] = value;
        measures[column.target.index] = cell;
      }
    }
    return edit;
  }).filter(editHasValues);
}
function editHasValues(edit: RowEdit): boolean {
  if ([edit.code, edit.name, edit.family, edit.group, edit.unit, edit.note].some(value => value)) return true;
  return (edit.measures ?? []).some(cell => !!cell && Object.values(cell).some(value => value));
}
const cellFilled = (value: string | undefined) => value !== undefined && value !== "";
function measureAttempted(edit: RowEdit): boolean {
  return (edit.measures ?? []).some(cell => !!cell && measureSlots.some(slot => cellFilled(cell[slot])));
}

export type RowKind = "new" | "updated" | "unchanged" | "error" | "skipped" | "blocked" | "replaced";
export interface FieldDiff { label: string; before: string; after: string }
export interface PlannedRow {
  rowNumber: number;
  originId?: string;
  kind: RowKind;
  code: string;
  name: string;
  errors: string[];
  warnings: string[];
  diffs: FieldDiff[];
  detail: string;
  component?: Component;
  replacedBy?: number;
}
export interface BulkPlan {
  rows: PlannedRow[];
  warnings: string[];
  version: Configurator["version"];
  counts: Record<RowKind, number>;
  newWithoutRule: number;
}
export interface PlanOptions {
  duplicatePolicy?: "last-wins" | "error";
  /** Paste edits without originId update the component with the same code. Grid rows update only their own id. */
  matchByCode?: boolean;
  skipExisting?: boolean;
  warnings?: string[];
  uid?: () => string;
}
const emptyCounts = (): Record<RowKind, number> => ({ new: 0, updated: 0, unchanged: 0, error: 0, skipped: 0, blocked: 0, replaced: 0 });

export function planBulk(data: Configurator, edits: RowEdit[], options: PlanOptions = {}): BulkPlan {
  const createId = options.uid ?? uid;
  const policy = options.duplicatePolicy ?? "last-wins";
  const replaced = new Map<number, number>();
  if (policy === "last-wins") {
    const groups = new Map<string, number[]>();
    edits.forEach((edit, index) => {
      const code = edit.code?.trim().toLowerCase();
      if (!code) return;
      groups.set(code, [...(groups.get(code) ?? []), index]);
    });
    for (const indexes of groups.values()) {
      if (indexes.length < 2) continue;
      const winner = edits[indexes.at(-1)!]!.rowNumber;
      for (const index of indexes.slice(0, -1)) replaced.set(index, winner);
    }
  }
  const pending: Array<{ edit: RowEdit; base?: Component; component?: Component; errors: string[]; warnings: string[]; diffs: FieldDiff[]; blocked: boolean }> = [];
  edits.forEach((edit, index) => {
    if (replaced.has(index)) return;
    const base = edit.originId
      ? data.components.find(component => component.id === edit.originId)
      : options.matchByCode === false ? undefined : data.components.find(component => !!edit.code?.trim() && component.code.trim().toLowerCase() === edit.code.trim().toLowerCase());
    if (options.skipExisting && base && !edit.originId) {
      pending.push({ edit, base, errors: [], warnings: [], diffs: [], blocked: false, component: undefined });
      return;
    }
    pending.push({ edit, base, ...compose(data, edit, base, createId) });
  });
  const byId = new Map(data.components.map(component => [component.id, component]));
  const extras: Component[] = [];
  for (const row of pending) {
    if (!row.component || row.blocked || isLegacyComponent(row.base)) continue;
    if (byId.has(row.component.id)) byId.set(row.component.id, row.component);
    else extras.push(row.component);
  }
  const catalog = [...data.components.map(component => byId.get(component.id) ?? component), ...extras];
  const virtual = { ...data, components: catalog };
  const rows: PlannedRow[] = edits.map((edit, index) => {
    const winner = replaced.get(index);
    if (winner !== undefined) return planned(edit, "replaced", edit.code?.trim() ?? "", edit.name ?? "", [], [], [], `Sostituita da riga ${winner} (stesso codice): non applicata.`, undefined, winner);
    const row = pending.find(item => item.edit === edit)!;
    if (options.skipExisting && row.base && !edit.originId && !row.component) return planned(edit, "skipped", row.base.code, row.base.name, [], [], [], "Saltata: il codice esiste già. Vengono importati solo i componenti nuovi.");
    const official = row.component && !row.blocked ? allComponentProblems(virtual, row.component) : [];
    const errors = [...row.errors, ...official.filter(message => !(row.errors.includes(DECIMAL_FORMAT_ERROR) && message.includes("correzione della misura non valida")))];
    const warnings = row.blocked || errors.length ? [] : row.warnings;
    const kind: RowKind = row.blocked ? "blocked" : errors.length ? "error" : row.base ? (row.diffs.length ? "updated" : "unchanged") : "new";
    const component = kind === "new" || kind === "updated" ? row.component : undefined;
    return planned(edit, kind, component?.code || row.base?.code || edit.code?.trim() || "", component?.name || row.base?.name || edit.name || "", errors, warnings, kind === "blocked" ? [] : row.diffs, detailFor(kind, errors, row.diffs, component, data, row.base), component);
  });
  const counts = emptyCounts();
  for (const row of rows) counts[row.kind]++;
  const applicable = rows.filter(row => row.kind === "new" || row.kind === "updated");
  let version = data.version;
  for (const row of applicable) {
    if (!row.component?.dimensions) continue;
    const previous = data.components.find(component => component.id === row.component!.id);
    if (!previous || JSON.stringify(previous.dimensions) !== JSON.stringify(row.component.dimensions)) version = configVersion(version, 6);
  }
  return { rows, warnings: options.warnings ?? [], version, counts, newWithoutRule: counts.new };
}
function planned(edit: RowEdit, kind: RowKind, code: string, name: string, errors: string[], warnings: string[], diffs: FieldDiff[], detail: string, component?: Component, replacedBy?: number): PlannedRow {
  return { rowNumber: edit.rowNumber, originId: edit.originId ?? component?.id, kind, code, name, errors, warnings, diffs, detail, ...(component ? { component } : {}), ...(replacedBy !== undefined ? { replacedBy } : {}) };
}
function detailFor(kind: RowKind, errors: string[], diffs: FieldDiff[], component: Component | undefined, data: Configurator, base: Component | undefined): string {
  if (kind === "blocked") return `${base?.code ?? "Componente"}: ${LEGACY_MEASURE_ERROR} La riga non viene applicata.`;
  if (kind === "error") return errors.join(" ");
  if (kind === "unchanged") return "Nessuna differenza.";
  if (kind === "new" && component) {
    const measures = (component.dimensions ?? []).map((dimension, index) => `M${index + 1} ${dimension.name}=${parameterLabel(data, dimension.parameter)} ${formatDecimal(dimension.offset)} ${dimension.unit}`).join(" · ");
    return [`Nuovo`, component.family || "Senza famiglia", component.group || "Senza gruppo", component.unit, measures].filter(Boolean).join(" · ");
  }
  return diffs.map(diff => `${diff.label}: ${diff.before} → ${diff.after}`).join(" · ");
}
function blank(value: string | undefined, base: Component | undefined, current: string, fallback: string): string {
  if (value === undefined || value === "") return base ? current : fallback;
  return value;
}
function compose(data: Configurator, edit: RowEdit, base: Component | undefined, createId: () => string): { component?: Component; errors: string[]; warnings: string[]; diffs: FieldDiff[]; blocked: boolean } {
  const legacy = isLegacyComponent(base);
  const attempted = measureAttempted(edit);
  if (legacy && !attempted) return { errors: [], warnings: [], diffs: [], blocked: true };
  const errors: string[] = [];
  const diffs: FieldDiff[] = [];
  if (legacy && attempted) errors.push(`${base?.code || "Componente"}: ${LEGACY_MEASURE_ERROR}`);
  let code = base?.code ?? "";
  if (cellFilled(edit.code)) {
    const trimmed = edit.code!.trim();
    const same = !!base && trimmed.toLowerCase() === base.code.trim().toLowerCase();
    code = same && !edit.originId ? base!.code : same && trimmed === base!.code.trim() ? base!.code : trimmed;
  }
  const name = blank(edit.name, base, base?.name ?? "", "");
  const group = blank(edit.group, base, base?.group ?? "", "");
  const unit = blank(edit.unit, base, base?.unit ?? "", "pz");
  const note = blank(edit.note, base, base?.note ?? "", "");
  const family = blank(edit.family, base, base?.family ?? "", "");
  if (base && !legacy) {
    if (code !== base.code) diffs.push({ label: "Codice", before: base.code || "(vuoto)", after: code || "(vuoto)" });
    pushText(diffs, "Descrizione", base.name, name);
    pushText(diffs, "Famiglia", base.family ?? "", family);
    pushText(diffs, "Gruppo", base.group, group);
    pushText(diffs, "Unità", base.unit, unit);
    pushText(diffs, "Scheda tecnica", base.note, note);
  }
  const measures = legacy ? { dimensions: undefined, errors: [] as string[], diffs: [] as FieldDiff[] } : mergeMeasures(data, edit, base, createId);
  errors.push(...measures.errors);
  if (!legacy) diffs.push(...measures.diffs);
  const id = base?.id ?? createId();
  const component: Component = {
    ...(base ?? { id, code: "", name: "", group: "", unit: "pz", note: "" }),
    id, code, name, group, unit, note,
    ...(family ? { family } : { family: undefined }),
    ...(base?.properties ? { properties: base.properties } : {}),
    ...(measures.dimensions ? { dimensions: measures.dimensions, measure: undefined } : base?.measure && !measures.dimensions ? { measure: base.measure, dimensions: undefined } : { dimensions: base?.dimensions, measure: undefined }),
  };
  if (!family) delete component.family;
  if (!measures.dimensions && !base?.dimensions) delete component.dimensions;
  if (measures.dimensions || !base?.measure) delete component.measure;
  const warnings: string[] = [];
  if (!legacy && !errors.length) {
    const families = new Set(data.components.map(item => item.family ?? "").filter(Boolean));
    const groups = new Set(data.components.map(item => item.group).filter(Boolean));
    if (family && !families.has(family) && family !== (base?.family ?? "")) warnings.push(`Famiglia nuova: ${family}.`);
    if (group && !groups.has(group) && group !== (base?.group ?? "")) warnings.push(`Gruppo nuovo: ${group}.`);
  }
  return { component, errors, warnings, diffs, blocked: false };
}
function pushText(diffs: FieldDiff[], label: string, before: string, after: string) {
  if (before !== after) diffs.push({ label, before: before || "(vuoto)", after: after || "(vuoto)" });
}
function mergeMeasures(data: Configurator, edit: RowEdit, base: Component | undefined, createId: () => string): { dimensions?: ComponentDimension[]; errors: string[]; diffs: FieldDiff[] } {
  const existing = base?.dimensions ?? [];
  const inputs = edit.measures ?? [];
  const attempted = (index: number) => {
    const cell = inputs[index];
    return !!cell && measureSlots.some(slot => cellFilled(cell[slot]));
  };
  let highest = existing.length - 1;
  inputs.forEach((_, index) => { if (attempted(index)) highest = Math.max(highest, index); });
  const errors: string[] = [];
  const diffs: FieldDiff[] = [];
  for (let index = 0; index <= highest; index++) if (index >= existing.length && !attempted(index)) errors.push(`M${highest + 1} è compilato ma M${index + 1} manca: le misure non possono avere buchi.`);
  const next: ComponentDimension[] = [];
  for (let index = 0; index <= highest; index++) {
    const current = existing[index];
    const cell = inputs[index] ?? {};
    const mark = (slot: string, before: string, after: string) => { if (before !== after) diffs.push({ label: `M${index + 1} ${slot}`, before: before || "(vuoto)", after: after || "(vuoto)" }); };
    if (!current) {
      if (!attempted(index)) continue;
      if (!cellFilled(cell.parameter) || !cellFilled(cell.offset) || !cellFilled(cell.unit)) { errors.push(`M${index + 1}: compila parametro, correzione e unità, oppure lascia il gruppo vuoto.`); continue; }
      const parsed = parseDecimal(cell.offset ?? "");
      if (!("value" in parsed)) { errors.push("error" in parsed ? parsed.error : DECIMAL_FORMAT_ERROR); continue; }
      const resolved = resolveParameter(data, cell.parameter ?? "");
      if ("error" in resolved) errors.push(resolved.error);
      const parameter = "id" in resolved ? resolved.id : cell.parameter ?? "";
      const name = cellFilled(cell.name) ? cell.name! : `Misura ${index + 1}`;
      const unit = cell.unit ?? "";
      next.push({ id: createId(), name, parameter, offset: parsed.value, unit });
      mark("nome", "", name); mark("parametro", "", displayParameter(data, parameter)); mark("correzione", "", formatDecimal(parsed.value)); mark("unità", "", unit);
      continue;
    }
    let name = current.name, parameter = current.parameter, offset = current.offset, unit = current.unit;
    if (cellFilled(cell.name) && cell.name !== current.name) { mark("nome", current.name, cell.name!); name = cell.name!; }
    if (cellFilled(cell.parameter)) {
      const resolved = resolveParameter(data, cell.parameter!);
      if ("error" in resolved) errors.push(resolved.error);
      const id = "id" in resolved ? resolved.id : cell.parameter!;
      if (id !== current.parameter) { mark("parametro", parameterLabel(data, current.parameter), displayParameter(data, id)); parameter = id; }
    }
    if (cellFilled(cell.offset)) {
      const parsed = parseDecimal(cell.offset!);
      if (!("value" in parsed)) errors.push("error" in parsed ? parsed.error : DECIMAL_FORMAT_ERROR);
      else if (parsed.value !== current.offset) { mark("correzione", formatDecimal(current.offset), formatDecimal(parsed.value)); offset = parsed.value; }
    }
    if (cellFilled(cell.unit) && cell.unit !== current.unit) { mark("unità", current.unit, cell.unit!); unit = cell.unit!; }
    next.push({ ...current, name, parameter, offset, unit });
  }
  if (next.length > MAX_MEASURES) errors.push("Dimensioni del componente non valide.");
  if (next.length !== highest + 1) return { dimensions: existing.length ? existing : undefined, errors, diffs };
  return { dimensions: next.length ? next : undefined, errors, diffs };
}

export function applyBulk(data: Configurator, plan: BulkPlan, mode: "all" | "valid" = "valid"): Configurator {
  if (mode === "all" && plan.counts.error > 0) throw new Error("Correggi o escludi le righe con errori.");
  const replacements = new Map<string, Component>();
  const created: Component[] = [];
  for (const row of plan.rows) {
    if (!row.component || (row.kind !== "new" && row.kind !== "updated")) continue;
    if (row.kind === "updated") replacements.set(row.component.id, row.component);
    else created.push(row.component);
  }
  if (!replacements.size && !created.length) return data;
  const components = data.components.map(component => replacements.get(component.id) ?? component).concat(created.filter(component => !data.components.some(current => current.id === component.id)));
  return { ...data, version: plan.version, components };
}
export function applySummary(plan: BulkPlan): string {
  const created = plan.counts.new, updated = plan.counts.updated, errors = plan.counts.error, applied = created + updated;
  const text = `Applicate ${applied} ${applied === 1 ? "riga" : "righe"}: ${created} ${created === 1 ? "nuovo componente" : "nuovi componenti"}, ${updated} ${updated === 1 ? "aggiornato" : "aggiornati"}.`;
  return errors ? `${text} ${errors} ${errors === 1 ? "riga con errori resta" : "righe con errori restano"} nella griglia.` : text;
}

export function convertLegacyMeasures(data: Configurator, createId: () => string = uid): { data: Configurator; count: number } {
  let count = 0;
  const components = data.components.map(component => {
    if (!component.measure || component.dimensions) return component;
    count++;
    const measure = component.measure;
    return { ...component, measure: undefined, dimensions: [{ id: createId(), name: "Lunghezza", parameter: measure.parameter, offset: measure.offset, unit: measure.unit }] };
  });
  return count ? { data: { ...data, version: configVersion(data.version, 6), components }, count } : { data, count };
}

export interface DraftMeasure { name: string; parameter: string; offset: string; unit: string }
export interface DraftRow {
  key: string;
  originId?: string;
  code: string;
  name: string;
  family: string;
  group: string;
  unit: string;
  note: string;
  measures: DraftMeasure[];
  legacyAttempt?: DraftMeasure[];
}
export interface GridColumn { key: string; label: string; group: string; required?: boolean }
export const emptyMeasure = (): DraftMeasure => ({ name: "", parameter: "", offset: "", unit: "" });
export function gridColumns(slots: number): GridColumn[] {
  const flat: GridColumn[] = [
    { key: "code", label: "Codice", group: "Dati del componente", required: true },
    { key: "name", label: "Descrizione", group: "Dati del componente", required: true },
    { key: "family", label: "Famiglia", group: "Dati del componente" },
    { key: "group", label: "Gruppo", group: "Dati del componente" },
    { key: "unit", label: "Unità", group: "Dati del componente" },
    { key: "note", label: "Scheda tecnica", group: "Dati del componente" },
  ];
  const labels = { name: "Nome", parameter: "Parametro", offset: "Corr. ±", unit: "Unità" } as const;
  const measures: GridColumn[] = [];
  for (let index = 0; index < slots; index++) for (const slot of measureSlots) measures.push({ key: `m${index}.${slot}`, label: labels[slot], group: `Misura ${index + 1}` });
  return [...flat, ...measures];
}
export function measureSlotCount(data: Configurator): number {
  const used = data.components.reduce((max, component) => Math.max(max, component.dimensions?.length ?? 0), 0);
  return Math.min(MAX_VISIBLE_MEASURES, Math.max(1, used));
}
export function componentToDraft(data: Configurator, component: Component, slots: number, key = component.id): DraftRow {
  const legacy = isLegacyComponent(component);
  return {
    key, originId: component.id, code: component.code, name: component.name, family: component.family ?? "", group: component.group, unit: component.unit, note: component.note,
    measures: Array.from({ length: slots }, (_, index) => {
      const dimension = legacy ? undefined : component.dimensions?.[index];
      return dimension ? { name: dimension.name, parameter: displayParameter(data, dimension.parameter), offset: formatDecimal(dimension.offset), unit: dimension.unit } : emptyMeasure();
    }),
  };
}
export function draftsFromConfigurator(data: Configurator, slots: number): DraftRow[] {
  return data.components.map(component => componentToDraft(data, component, slots));
}
export function readCell(row: DraftRow, key: string): string {
  if (key.startsWith("m")) {
    const [index, slot] = key.slice(1).split(".") as [string, MeasureSlot];
    return row.measures[Number(index)]?.[slot] ?? "";
  }
  return key === "code" ? row.code : key === "name" ? row.name : key === "family" ? row.family : key === "group" ? row.group : key === "unit" ? row.unit : row.note;
}
export function writeCell(row: DraftRow, key: string, value: string): DraftRow {
  const next: DraftRow = { ...row, measures: row.measures.map(measure => ({ ...measure })), legacyAttempt: undefined };
  if (key.startsWith("m")) {
    const [index, slot] = key.slice(1).split(".") as [string, MeasureSlot];
    const position = Number(index);
    while (next.measures.length <= position) next.measures.push(emptyMeasure());
    next.measures[position] = { ...next.measures[position]!, [slot]: value };
    return next;
  }
  if (key === "code") next.code = value.trim();
  else if (key === "name") next.name = value;
  else if (key === "family") next.family = value;
  else if (key === "group") next.group = value;
  else if (key === "unit") next.unit = value;
  else next.note = value;
  return next;
}
export function draftToEdit(row: DraftRow, rowNumber: number): RowEdit {
  const source = row.legacyAttempt ?? row.measures;
  return {
    rowNumber, originId: row.originId, code: row.code, name: row.name, family: row.family, group: row.group, unit: row.unit, note: row.note,
    measures: source.map(measure => ({ ...measure })),
  };
}
export function draftIsClean(data: Configurator, draft: DraftRow): boolean {
  if (!draft.originId || draft.legacyAttempt?.some(measure => measureSlots.some(slot => measure[slot]))) return false;
  const plan = planBulk(data, [draftToEdit(draft, 1)], { duplicatePolicy: "error", uid: () => "draft-check" });
  const row = plan.rows[0]!;
  return (row.kind === "unchanged" || row.kind === "blocked") && row.errors.length === 0;
}
export function padMeasures(row: DraftRow, slots: number): DraftRow {
  if (row.measures.length >= slots) return row;
  return { ...row, measures: [...row.measures, ...Array.from({ length: slots - row.measures.length }, emptyMeasure)] };
}

export interface PasteMerge { drafts: DraftRow[]; notes: string[]; side: PlannedRow[] }
export function mergePaste(data: Configurator, drafts: DraftRow[], edits: RowEdit[], mode: "upsert" | "insert-only", slots: number, createKey: () => string = uid): PasteMerge {
  const next = drafts.map(row => padMeasures({ ...row, measures: row.measures.map(measure => ({ ...measure })) }, slots));
  const groups = new Map<string, RowEdit[]>();
  const anonymous: RowEdit[] = [];
  for (const edit of edits) {
    const code = edit.code?.trim().toLowerCase();
    if (!code) anonymous.push(edit);
    else groups.set(code, [...(groups.get(code) ?? []), edit]);
  }
  const side: PlannedRow[] = [];
  const winners: RowEdit[] = [...anonymous];
  for (const group of groups.values()) {
    const winner = group.at(-1)!;
    winners.push(winner);
    for (const edit of group.slice(0, -1)) side.push({ rowNumber: edit.rowNumber, kind: "replaced", code: edit.code?.trim() ?? "", name: edit.name ?? "", errors: [], warnings: [], diffs: [], detail: `Sostituita da riga ${winner.rowNumber} (stesso codice): non applicata.`, replacedBy: winner.rowNumber });
  }
  winners.sort((a, b) => a.rowNumber - b.rowNumber);
  let skipped = 0;
  for (const edit of winners) {
    const code = edit.code?.trim() ?? "";
    const key = code.toLowerCase();
    const existing = key ? data.components.find(component => component.code.trim().toLowerCase() === key) : undefined;
    if (mode === "insert-only" && existing) {
      skipped++;
      side.push({ rowNumber: edit.rowNumber, kind: "skipped", code: existing.code, name: existing.name, errors: [], warnings: [], diffs: [], detail: "Saltata: il codice esiste già. Vengono importati solo i componenti nuovi." });
      continue;
    }
    if (existing && isLegacyComponent(existing)) {
      const index = ensureDraft(next, data, existing, slots);
      if (measureAttempted(edit)) next[index] = { ...next[index]!, legacyAttempt: attemptMeasures(edit, Math.max(slots, edit.measures?.length ?? 0)) };
      continue;
    }
    const index = existing ? ensureDraft(next, data, existing, slots) : next.findIndex(row => !row.originId && row.code.trim().toLowerCase() === key && key);
    if (index >= 0) next[index] = overlayDraft(data, next[index]!, edit);
    else next.push(draftFromEdit(data, edit, slots, createKey()));
  }
  const notes: string[] = [];
  const replaced = side.filter(row => row.kind === "replaced").length;
  if (replaced) notes.push(`${replaced} ${replaced === 1 ? "riga sostituita" : "righe sostituite"}: per i codici duplicati vale l'ultima riga.`);
  if (skipped) notes.push(`${skipped} ${skipped === 1 ? "riga saltata" : "righe saltate"} perché il codice esiste già.`);
  return { drafts: next, notes, side };
}
function ensureDraft(drafts: DraftRow[], data: Configurator, component: Component, slots: number): number {
  const index = drafts.findIndex(row => row.originId === component.id);
  if (index >= 0) return index;
  drafts.push(componentToDraft(data, component, slots));
  return drafts.length - 1;
}
function attemptMeasures(edit: RowEdit, slots: number): DraftMeasure[] {
  return Array.from({ length: Math.max(slots, edit.measures?.length ?? 0) }, (_, index) => ({
    name: edit.measures?.[index]?.name ?? "", parameter: edit.measures?.[index]?.parameter ?? "", offset: edit.measures?.[index]?.offset ?? "", unit: edit.measures?.[index]?.unit ?? "",
  }));
}
function overlayDraft(data: Configurator, draft: DraftRow, edit: RowEdit): DraftRow {
  const next = padMeasures({ ...draft, measures: draft.measures.map(measure => ({ ...measure })), legacyAttempt: undefined }, Math.max(draft.measures.length, edit.measures?.length ?? 0));
  if (cellFilled(edit.code)) {
    const trimmed = edit.code!.trim();
    next.code = trimmed.toLowerCase() === draft.code.trim().toLowerCase() ? draft.code.trim() : trimmed;
  }
  if (cellFilled(edit.name)) next.name = edit.name!;
  if (cellFilled(edit.family)) next.family = edit.family!;
  if (cellFilled(edit.group)) next.group = edit.group!;
  if (cellFilled(edit.unit)) next.unit = edit.unit!;
  if (cellFilled(edit.note)) next.note = edit.note!;
  edit.measures?.forEach((cell, index) => {
    if (!cell) return;
    while (next.measures.length <= index) next.measures.push(emptyMeasure());
    const measure = { ...next.measures[index]! };
    if (cellFilled(cell.name)) measure.name = cell.name!;
    if (cellFilled(cell.parameter)) measure.parameter = displayParameter(data, cell.parameter!);
    if (cellFilled(cell.offset)) measure.offset = cell.offset!;
    if (cellFilled(cell.unit)) measure.unit = cell.unit!;
    next.measures[index] = measure;
  });
  return next;
}
function draftFromEdit(data: Configurator, edit: RowEdit, slots: number, key: string): DraftRow {
  const length = Math.max(slots, edit.measures?.length ?? 0);
  return {
    key, code: edit.code?.trim() ?? "", name: edit.name ?? "", family: edit.family ?? "", group: edit.group ?? "", unit: edit.unit || "pz", note: edit.note ?? "",
    measures: Array.from({ length }, (_, index) => ({
      name: edit.measures?.[index]?.name ?? "",
      parameter: edit.measures?.[index]?.parameter ? displayParameter(data, edit.measures[index]!.parameter!) : "",
      offset: edit.measures?.[index]?.offset ?? "",
      unit: edit.measures?.[index]?.unit ?? "",
    })),
  };
}
export function applyCellBlock(drafts: DraftRow[], slots: number, rowIndexes: number[], column: number, block: string[][], skip: (row: DraftRow) => boolean, createRow: () => DraftRow): { drafts: DraftRow[]; ignoredColumns: number } {
  const columns = gridColumns(slots);
  const next = drafts.map(row => padMeasures({ ...row, measures: row.measures.map(measure => ({ ...measure })) }, slots));
  let ignored = 0;
  block.forEach((line, rowIndex) => {
    const mapped = rowIndexes[rowIndex];
    let index = mapped ?? next.length;
    if (index >= next.length) { next.push(createRow()); index = next.length - 1; }
    if (next[index]?.originId && skip(next[index]!)) return;
    let current = next[index]!;
    line.forEach((value, cellIndex) => {
      const position = column + cellIndex;
      if (position >= columns.length) { ignored = Math.max(ignored, position - columns.length + 1); return; }
      if (value === "" && current.originId) return;
      current = writeCell(current, columns[position]!.key, value);
    });
    next[index] = current;
  });
  return { drafts: next, ignoredColumns: ignored };
}
export function reconcileDrafts(previous: Configurator, next: Configurator, drafts: DraftRow[], slots: number): DraftRow[] {
  const previousIds = new Map(previous.components.map(component => [component.id, component]));
  const nextIds = new Map(next.components.map(component => [component.id, component]));
  const seen = new Set<string>();
  const kept: DraftRow[] = [];
  for (const draft of drafts) {
    if (!draft.originId) { kept.push(padMeasures(draft, slots)); continue; }
    seen.add(draft.originId);
    const before = previousIds.get(draft.originId);
    const after = nextIds.get(draft.originId);
    if (!after) { if (before && !draftIsClean(previous, draft)) kept.push(draft); continue; }
    const converted = !!before && isLegacyComponent(before) && !isLegacyComponent(after);
    kept.push(converted || !before || draftIsClean(previous, draft) ? componentToDraft(next, after, Math.max(slots, after.dimensions?.length ?? 0), draft.key) : padMeasures(draft, slots));
  }
  for (const component of next.components) if (!seen.has(component.id) && !kept.some(row => row.originId === component.id)) kept.push(componentToDraft(next, component, slots));
  return kept;
}
