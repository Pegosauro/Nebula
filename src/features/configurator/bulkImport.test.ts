import { describe, expect, it } from "vitest";
import { exampleConfigurator, parseConfigurator, type Configurator } from "./model";
import { allComponentProblems } from "./definitionValidation";
import {
  applyBulk, applyCellBlock, applySummary, columnTargetChoices, convertLegacyMeasures, DECIMAL_FORMAT_ERROR, draftsFromConfigurator,
  draftToEdit, editsFromTable, looksLikeHeader, mapColumns, mappingIssues, mergePaste, parseDecimal, parseSpreadsheet, planBulk,
  targetLabel, type MappedColumn, type RowEdit,
} from "./bulkImport";

function ids() { let n = 0; return () => `id-${++n}`; }
function pergola(): Configurator {
  const data = exampleConfigurator("Pergola");
  data.version = 6;
  data.components[0]!.dimensions = [
    { id: "d1", name: "Larghezza", parameter: "width", offset: -1, unit: "cm" },
    { id: "d2", name: "Altezza", parameter: "width", offset: -2, unit: "cm" },
  ];
  data.components[1] = { ...data.components[1]!, measure: { parameter: "width", offset: -1, unit: "cm" } };
  data.components[2]!.family = "PROFILI";
  return data;
}
function plan(data: Configurator, edits: RowEdit[], duplicatePolicy: "last-wins" | "error" = "last-wins") {
  return planBulk(data, edits, { duplicatePolicy, uid: ids(), warnings: [] });
}

describe("parseSpreadsheet and decimals", () => {
  it("parses quoted TSV, semicolon CSV, comma CSV, a BOM and a trailing empty row", () => {
    const tsv = parseSpreadsheet("\uFEFFCodice\tDescrizione\t\"linea\n2\"\r\nPR001\tTraverso\t\"virgolette \"\"ok\"\"\"\r\n");
    expect(tsv.delimiter).toBe("\t");
    expect(tsv.rows).toEqual([["Codice", "Descrizione", "linea\n2"], ["PR001", "Traverso", "virgolette \"ok\""]]);
    expect(parseSpreadsheet("Codice;Descrizione;Corr.\nPR001;Traverso;-1\n").delimiter).toBe(";");
    expect(parseSpreadsheet("Codice,Descrizione\nPR001,Traverso\n").rows[1]).toEqual(["PR001", "Traverso"]);
  });
  it("accepts a comma or a dot and rejects thousands separators", () => {
    expect(parseDecimal("1000,5")).toEqual({ value: 1000.5 });
    expect(parseDecimal("1000.5")).toEqual({ value: 1000.5 });
    expect(parseDecimal(" 1.200 ")).toEqual({ value: 1.2 });
    expect(parseDecimal("−2")).toEqual({ value: -2 });
    expect(parseDecimal("")).toEqual({ empty: true });
    expect(parseDecimal("1.000,5")).toEqual({ error: DECIMAL_FORMAT_ERROR });
    expect(parseDecimal("1,000.5")).toEqual({ error: DECIMAL_FORMAT_ERROR });
    expect(parseDecimal("1.000.000")).toEqual({ error: DECIMAL_FORMAT_ERROR });
    expect(parseDecimal("abc")).toEqual({ error: DECIMAL_FORMAT_ERROR });
  });
});

describe("column mapping", () => {
  it("auto-matches Italian headers, ignores unknown and calculated columns, and requires code", () => {
    const text = "Codice\tDescrizione\tFamiglia\tGruppo\tUM\tScheda\tParam. misura\tCorr.\tU. misura\tPeso\tQuantità\tMisura per pezzo\nPR001\tTraverso\tPROFILI\tTelaio\tpz\tSchede/c01.md\tLarghezza\t-2\tcm\t1,2\t2\t299 cm";
    const { rows } = parseSpreadsheet(text);
    expect(looksLikeHeader(rows[0]!)).toBe(true);
    const mapped = mapColumns(rows, true);
    expect(mapped.columns.map(column => targetLabel(column.target))).toEqual([
      "Codice", "Descrizione", "Famiglia", "Gruppo", "Unità", "Scheda tecnica", "Misura 1 · parametro", "Misura 1 · correzione", "Misura 1 · unità", "— Ignora —", "— Ignora —", "— Ignora —",
    ]);
    expect(mapped.columns[6]!.auto).toBe(true);
    expect(mapped.warnings.some(warning => warning.includes("Peso"))).toBe(true);
    expect(mapped.warnings.some(warning => warning.includes("Codice"))).toBe(false);
    const noCode = mapped.columns.map(column => column.target.kind === "flat" && column.target.field === "code" ? { ...column, target: { kind: "ignore" as const } } : column);
    expect(mappingIssues(noCode).join(" ")).toContain("Associa la colonna Codice");
    expect(editsFromTable(rows, mapped.columns, true)).toEqual([expect.objectContaining({ rowNumber: 1, code: "PR001", name: "Traverso", family: "PROFILI", unit: "pz", note: "Schede/c01.md", measures: [expect.objectContaining({ parameter: "Larghezza", offset: "-2", unit: "cm" })] })]);
  });
  it("matches numbered measure headers and falls back to column order", () => {
    const rows = [["M2 offset", "M1 nome", "codice"], ["-3", "Altezza", "PR009"]];
    const mapped = mapColumns(rows, true);
    expect(mapped.columns.map(column => targetLabel(column.target))).toEqual(["Misura 2 · correzione", "Misura 1 · nome", "Codice"]);
    const positional = mapColumns([["PR010", "Staffa", "ACCESSORI"]], false);
    expect(positional.columns.map(column => column.target)).toEqual([{ kind: "flat", field: "code" }, { kind: "flat", field: "name" }, { kind: "flat", field: "family" }]);
    expect(columnTargetChoices(1).some(target => target.kind === "measure" && target.index === 7)).toBe(true);
  });
});

describe("upsert plan", () => {
  it("keeps rules, ids and properties, appends new components, and bumps version only for dimensions", () => {
    const data = pergola();
    data.version = 7;
    data.parameters.push({ id: "material", name: "Materiale", type: "text", values: [], unit: "" });
    data.components[0]!.properties = [{ id: "mat", name: "Materiale", parameter: "material" }];
    const same = plan(data, data.components.map((component, index) => ({ rowNumber: index + 1, code: component.code, name: component.name, group: component.group, unit: component.unit, note: component.note })));
    expect(same.counts).toMatchObject({ new: 0, error: 0, updated: 0 });
    expect(same.rows.filter(row => row.kind === "blocked").map(row => row.code)).toEqual(["LED001"]);
    const renamed = plan(data, [{ rowNumber: 1, code: " pr001 ", name: "Traverso nuovo", group: "", unit: "", note: "" }]);
    expect(renamed.rows[0]).toMatchObject({ kind: "updated", code: "PR001" });
    expect(renamed.rows[0]!.diffs.map(diff => diff.label)).toEqual(["Descrizione"]);
    expect(renamed.rows[0]!.component).toMatchObject({ id: "profile", code: "PR001", name: "Traverso nuovo", properties: data.components[0]!.properties });
    expect(renamed.rows[0]!.component!.dimensions).toEqual(data.components[0]!.dimensions);
    expect(renamed.version).toBe(7);
    const flat = exampleConfigurator("Vecchio");
    const onlyName = plan(flat, [{ rowNumber: 1, code: "PR001", name: "Profilo aggiornato" }]);
    expect(onlyName.version).toBe(1);
    const created = plan(data, Array.from({ length: 10 }, (_, index) => ({ rowNumber: index + 1, code: `N${index + 1}`, name: `Nuovo ${index + 1}`, unit: "pz" })));
    const applied = applyBulk(data, created);
    expect(applied.components.slice(-10).map(component => component.code)).toEqual(Array.from({ length: 10 }, (_, index) => `N${index + 1}`));
    expect(applied.components.slice(-10).every(component => component.id.startsWith("id-"))).toBe(true);
    expect(applied.rules).toBe(data.rules);
    expect(applied.components[0]).toBe(data.components[0]);
    expect(parseConfigurator(JSON.stringify(applied)).components).toHaveLength(data.components.length + 10);
  });
  it("lets the last pasted code win and reports an error for manual duplicates", () => {
    const data = pergola();
    const pasted = plan(data, [
      { rowNumber: 4, code: "PR030", name: "Prima" },
      { rowNumber: 9, code: "pr030 ", name: "Ultima", family: "NUOVA" },
    ]);
    expect(pasted.rows.map(row => row.kind)).toEqual(["replaced", "new"]);
    expect(pasted.rows[0]!.detail).toContain("Sostituita da riga 9");
    expect(pasted.rows[1]!.component).toMatchObject({ code: "pr030", name: "Ultima", family: "NUOVA", unit: "pz", group: "" });
    expect(pasted.rows[1]!.warnings.join(" ")).toContain("Famiglia nuova");
    const manual = planBulk(data, [
      { rowNumber: 1, originId: "profile", code: "PR001", name: "Profilo laterale", group: "Profili", unit: "pz", note: "" },
      { rowNumber: 2, code: "pr001", name: "Copia" },
    ], { duplicatePolicy: "error", matchByCode: false, uid: ids() });
    expect(manual.rows.every(row => row.kind === "error")).toBe(true);
    expect(manual.rows.every(row => row.errors.some(error => error.includes("già usato")))).toBe(true);
    expect(() => applyBulk(data, manual, "all")).toThrow(/errori/);
  });
  it("keeps an empty cell, trims only the code, and stores a new code with its typed case", () => {
    const data = pergola();
    const kept = plan(data, [{ rowNumber: 1, code: "PR001", name: "", group: "", family: "", unit: "", note: "", measures: [{ name: "", parameter: "", offset: "", unit: "" }] }]);
    expect(kept.rows[0]!.kind).toBe("unchanged");
    const spaced = plan(data, [{ rowNumber: 1, code: "  ST010  ", name: " Staffa  ", group: " Fissaggi " }]);
    expect(spaced.rows[0]!.component).toMatchObject({ code: "ST010", name: " Staffa  ", group: " Fissaggi ", unit: "pz" });
    expect(applyBulk(data, spaced).components.at(-1)!.code).toBe("ST010");
  });
});

describe("measures", () => {
  it("updates and appends dimensions by position without removing the others", () => {
    const data = pergola();
    const updated = plan(data, [{ rowNumber: 1, code: "PR001", measures: [undefined, { offset: "-4" }] }]);
    expect(updated.rows[0]).toMatchObject({ kind: "updated" });
    expect(updated.rows[0]!.component!.dimensions).toEqual([
      data.components[0]!.dimensions![0],
      { ...data.components[0]!.dimensions![1], offset: -4 },
    ]);
    expect(updated.version).toBe(6);
    const added = plan(data, [{ rowNumber: 1, code: "PR001", measures: [undefined, undefined, { parameter: "Larghezza", offset: "0", unit: "mm" }] }]);
    expect(added.rows[0]!.component!.dimensions).toHaveLength(3);
    expect(added.rows[0]!.component!.dimensions![2]).toMatchObject({ id: "id-1", name: "Misura 3", parameter: "width", offset: 0, unit: "mm" });
    expect(added.rows[0]!.component!.dimensions![0]!.id).toBe("d1");
    const gap = plan(data, [{ rowNumber: 1, code: "AC999", name: "Nuovo", measures: [undefined, { name: "Altezza", parameter: "width", offset: "1", unit: "cm" }] }]);
    expect(gap.rows[0]!.errors.join(" ")).toContain("M2 è compilato ma M1 manca");
    const partial = plan(data, [{ rowNumber: 1, code: "AC999", name: "Nuovo", measures: [{ name: "Lunghezza", parameter: "width" }] }]);
    expect(partial.rows[0]!.errors.join(" ")).toContain("compila parametro, correzione e unità");
    const invalid = plan(data, [{ rowNumber: 1, code: "PR001", measures: [{ offset: "1.000,5", unit: "kg" }] }]);
    expect(invalid.rows[0]!.errors.join(" ")).toContain(DECIMAL_FORMAT_ERROR);
    expect(invalid.rows[0]!.errors.join(" ")).toContain("incompatibile");
    expect(invalid.rows[0]!.kind).toBe("error");
    const ambiguous = exampleConfigurator("Doppio");
    ambiguous.parameters.push({ ...ambiguous.parameters[2]!, id: "width-2", name: "Larghezza" });
    expect(plan(ambiguous, [{ rowNumber: 1, code: "NEW", name: "X", measures: [{ parameter: "Larghezza", offset: "1", unit: "mm" }] }]).rows[0]!.errors.join(" ")).toContain("più parametri");
    expect(plan(data, [{ rowNumber: 1, code: "PR001", measures: Array.from({ length: 33 }, () => ({ parameter: "width", offset: "0", unit: "cm" })) }]).rows[0]!.errors).toContain("Dimensioni del componente non valide.");
  });
  it("blocks a legacy measure and converts all of them after an explicit command", () => {
    const data = pergola();
    const blocked = plan(data, [{ rowNumber: 1, code: "led001 ", name: "Strip cambiata" }]);
    expect(blocked.rows[0]).toMatchObject({ kind: "blocked", code: "LED001" });
    expect(blocked.rows[0]!.detail).toContain("Converti misure legacy");
    expect(applyBulk(data, blocked).components[1]).toBe(data.components[1]);
    const invalid = plan(data, [{ rowNumber: 1, code: "LED001", measures: [{ parameter: "width", offset: "1", unit: "cm" }] }]);
    expect(invalid.rows[0]!.kind).toBe("error");
    expect(invalid.counts.error).toBe(1);
    expect(applyBulk(data, invalid).components[1]!.measure).toEqual(data.components[1]!.measure);
    const converted = convertLegacyMeasures(data, ids());
    expect(converted.count).toBe(1);
    expect(converted.data.version).toBe(6);
    expect(converted.data.components[1]).toMatchObject({ id: "led-strip", measure: undefined, dimensions: [{ id: "id-1", name: "Lunghezza", parameter: "width", offset: -1, unit: "cm" }] });
    expect(converted.data.components[0]).toBe(data.components[0]);
    expect(convertLegacyMeasures(converted.data)).toMatchObject({ count: 0, data: converted.data });
    expect(parseConfigurator(JSON.stringify(converted.data)).components[1]!.dimensions).toHaveLength(1);
    const high = { ...data, version: 8 as const };
    expect(convertLegacyMeasures(high, ids()).data.version).toBe(8);
  });
});

describe("drafts and paste merge", () => {
  it("reuses the component validators and round-trips an unchanged catalog", () => {
    const data = pergola();
    const drafts = draftsFromConfigurator(data, 2);
    const round = planBulk(data, drafts.map((draft, index) => draftToEdit(draft, index + 1)), { duplicatePolicy: "error", matchByCode: false, uid: ids() });
    expect(round.counts.error).toBe(0);
    expect(round.counts.new).toBe(0);
    expect(round.rows.filter(row => row.kind === "unchanged").length).toBe(data.components.length - 1);
    const invalid = planBulk(data, [{ rowNumber: 1, code: "", name: "" }], { duplicatePolicy: "error", matchByCode: false, uid: ids() });
    const shell = { id: "new", code: "", name: "", group: "", unit: "pz", note: "" };
    expect(invalid.rows[0]!.errors).toEqual(allComponentProblems({ ...data, components: [...data.components, shell] }, shell));
  });
  it("merges a paste by code, keeps blanks, and records replaced or skipped rows", () => {
    const data = pergola();
    const drafts = draftsFromConfigurator(data, 2);
    const merged = mergePaste(data, drafts, [
      { rowNumber: 1, code: "PR001", name: "", group: "Telaio rinforzato", measures: [{ offset: "" }, { offset: "-5" }] },
      { rowNumber: 2, code: "PR001", name: "Prima" },
      { rowNumber: 3, code: "PR001", name: "Vince" },
      { rowNumber: 4, code: "LED001", name: "Non si applica", measures: [{ offset: "3" }] },
      { rowNumber: 5, code: "AC026", name: "Kit viti" },
    ], "upsert", 2, ids());
    expect(merged.side.map(row => row.kind)).toEqual(["replaced", "replaced"]);
    expect(merged.notes.join(" ")).toContain("2 righe sostituite");
    const profile = merged.drafts.find(row => row.originId === "profile")!;
    expect(profile).toMatchObject({ code: "PR001", name: "Vince", group: data.components[0]!.group });
    expect(profile.measures[1]!.offset).toBe(String(data.components[0]!.dimensions![1]!.offset).replace(".", ","));
    const edited = mergePaste(data, drafts, [{ rowNumber: 1, code: "PR001", group: "Telaio rinforzato", measures: [undefined, { offset: "-5" }] }], "upsert", 2, ids());
    const reinforced = edited.drafts.find(row => row.originId === "profile")!;
    expect(reinforced.group).toBe("Telaio rinforzato");
    expect(reinforced.measures[1]!.offset).toBe("-5");
    expect(reinforced.measures[0]!.name).toBe("Larghezza");
    expect(merged.drafts.find(row => row.originId === "led-strip")!.legacyAttempt?.[0]?.offset).toBe("3");
    expect(merged.drafts.at(-1)).toMatchObject({ code: "AC026", name: "Kit viti", unit: "pz" });
    const skip = mergePaste(data, drafts, [{ rowNumber: 1, code: "PR001", name: "No" }, { rowNumber: 2, code: "ZX1", name: "Solo nuovo" }], "insert-only", 1, ids());
    expect(skip.side[0]!.kind).toBe("skipped");
    expect(skip.drafts.some(row => row.code === "ZX1")).toBe(true);
    expect(skip.drafts.find(row => row.originId === "profile")!.name).toBe(data.components[0]!.name);
  });
  it("writes a positional block without clearing existing cells or locked rows", () => {
    const data = pergola();
    const drafts = draftsFromConfigurator(data, 1);
    const pasted = applyCellBlock(drafts, 1, [0, 1], 0, [["  PR009  ", "", "NUOVA"], ["LED009", "Ignorato"]], row => row.originId === "led-strip", () => ({ key: "new", code: "", name: "", family: "", group: "", unit: "pz", note: "", measures: [{ name: "", parameter: "", offset: "", unit: "" }] }));
    expect(pasted.drafts[0]).toMatchObject({ code: "PR009", name: data.components[0]!.name, family: "NUOVA" });
    expect(pasted.drafts[1]!.code).toBe("LED001");
    const extra = applyCellBlock(drafts, 1, [drafts.length], 0, [["ZZ1", "Ultimo", "", "", "", "", "", "", "1.000,5"]], () => false, () => ({ key: "ghost", code: "", name: "", family: "", group: "", unit: "pz", note: "", measures: [{ name: "", parameter: "", offset: "", unit: "" }] }));
    expect(extra.drafts.at(-1)).toMatchObject({ code: "ZZ1", name: "Ultimo" });
    expect(extra.drafts.at(-1)!.measures[0]!.offset).toBe("1.000,5");
    expect(extra.ignoredColumns).toBe(0);
    expect(applySummary(plan(data, [{ rowNumber: 1, code: "ZZ1", name: "Ultimo" }]))).toContain("1 riga: 1 nuovo componente");
  });
  it("rejects a duplicate mapped field", () => {
    const columns = [{ index: 0, header: "Codice", example: "", target: { kind: "flat", field: "code" }, auto: true, recognized: true }, { index: 1, header: "Code", example: "", target: { kind: "flat", field: "code" }, auto: true, recognized: true }] as MappedColumn[];
    expect(mappingIssues(columns).join(" ")).toContain("stesso campo");
  });
});
