import { describe, expect, it } from "vitest";
import { evaluate } from "./engine";
import { conditionsOf, ruleExpression } from "./expressions";
import { commitGuidedComponent, guidedProblems, newGuidedDraft, type GuidedDraft } from "./guidedComponent";
import { exampleConfigurator, parseConfigurator, type Configurator } from "./model";

function ready(mode: GuidedDraft["mode"], patch?: (draft: GuidedDraft) => void) {
  const data = exampleConfigurator("Pergola");
  const draft = newGuidedDraft();
  draft.component.code = "NEW1";
  draft.component.name = "Nuovo pezzo";
  draft.mode = mode;
  patch?.(draft);
  return { data, draft };
}

function row(data: Configurator, id: string, selection: Record<string, string | number | boolean> = {}) {
  const result = evaluate(data, selection);
  return { bom: result.bom.find(item => item.component === id), possible: result.possible.some(item => item.component === id) };
}

describe("creazione guidata dei componenti", () => {
  it("starts without a mode and without a condition taken from the first parameter", () => {
    const data = exampleConfigurator("Pergola");
    const draft = newGuidedDraft();
    expect(draft.mode).toBeUndefined();
    expect(conditionsOf(draft.expression)).toEqual([]);
    expect(JSON.stringify(draft.expression)).not.toContain(data.parameters[0]!.id);
    expect(draft.quantity).toEqual({ amount: 1, divisor: 1, rounding: "none" });
    expect(draft.component).toMatchObject({ group: "", unit: "pz", note: "" });
    expect(draft.component.dimensions).toBeUndefined();
    expect(draft.component.properties).toBeUndefined();
  });

  it("includes an always-present component in every BOM and keeps the previous rules", () => {
    const { data, draft } = ready("always", item => { item.quantity.amount = 4; });
    const next = commitGuidedComponent(data, draft);
    const rule = next.rules.at(-1)!;
    expect(next.components.at(-1)).toMatchObject({ code: "NEW1", name: "Nuovo pezzo", unit: "pz" });
    expect(next.rules.slice(0, -1)).toEqual(data.rules);
    expect(rule).toMatchObject({ conditions: [], match: "all", enabled: true, componentIds: [draft.component.id] });
    expect(rule.expression).toBeUndefined();
    expect(rule.actions).toEqual([expect.objectContaining({ type: "add", component: draft.component.id, quantity: expect.objectContaining({ amount: 4, divisor: 1, rounding: "none" }) })]);
    expect(next.version).toBe(3);
    expect(row(next, draft.component.id).bom).toMatchObject({ quantity: 4, certain: true });
    expect(row(next, draft.component.id, { model: "B", led: false, width: 1000 }).bom).toMatchObject({ quantity: 4, certain: true });
    expect(row(next, "profile", { model: "A", led: true, width: 3000 }).bom?.quantity).toBe(2);
    const parsed = parseConfigurator(JSON.stringify(next));
    expect(row(parsed, draft.component.id, { model: "B" }).bom?.quantity).toBe(4);
  });

  it("uses the same quantity rules as the rule editor, including a numeric parameter", () => {
    const { data, draft } = ready("always", item => { item.quantity = { amount: 1, parameter: "width", divisor: 1000, rounding: "ceil" }; });
    const next = commitGuidedComponent(data, draft);
    expect(row(next, draft.component.id).bom).toMatchObject({ certain: true, quantity: undefined });
    expect(row(next, draft.component.id, { width: 3500 }).bom?.quantity).toBe(4);
    draft.quantity.amount = -1;
    expect(guidedProblems(data, draft).join(" ")).toContain("Controlla quantità");
    draft.quantity.amount = 1;
    draft.quantity.divisor = 0;
    expect(guidedProblems(data, draft).join(" ")).toContain("divisore");
    expect(() => commitGuidedComponent(data, draft)).toThrow(/divisore|quantità/);
  });

  it("includes a conditional component only when its explicit condition matches", () => {
    const { data, draft } = ready("conditional", item => {
      item.quantity.amount = 2;
      item.expression = { id: "root", type: "all", children: [{ id: "leaf", type: "condition", condition: { parameter: "led", operator: "eq", value: true } }] };
    });
    const next = commitGuidedComponent(data, draft);
    const rule = next.rules.at(-1)!;
    expect(conditionsOf(ruleExpression(rule))).toEqual([{ parameter: "led", operator: "eq", value: true }]);
    expect(rule.conditions).toEqual([{ parameter: "led", operator: "eq", value: true }]);
    expect(row(next, draft.component.id, { model: "A", led: true, width: 2000 }).bom).toMatchObject({ quantity: 2, certain: true });
    expect(row(next, draft.component.id, { model: "A", led: false, width: 2000 }).bom).toBeUndefined();
    expect(row(next, draft.component.id, { model: "B", led: false, width: 2000 }).possible).toBe(false);
    expect(row(next, draft.component.id).bom).toBeUndefined();
    const parsed = parseConfigurator(JSON.stringify(next));
    expect(row(parsed, draft.component.id, { led: true }).bom?.quantity).toBe(2);
    expect(row(parsed, draft.component.id, { led: false }).bom).toBeUndefined();
  });

  it("rejects a conditional component until every condition is explicitly valid", () => {
    const { data, draft } = ready("conditional");
    expect(guidedProblems(data, draft).join(" ")).toContain("Nessuna condizione è preselezionata");
    draft.expression = { id: "root", type: "all", children: [{ id: "leaf", type: "condition", condition: { parameter: "", operator: "eq", value: "" } }] };
    expect(guidedProblems(data, draft).join(" ")).toContain("Scegli il parametro");
    draft.expression = { id: "root", type: "all", children: [{ id: "leaf", type: "condition", condition: { parameter: "model", operator: "eq", value: "Z" } }] };
    expect(guidedProblems(data, draft).join(" ")).toContain("non ha un valore valido");
    draft.expression = { id: "root", type: "all", children: [] };
    const empty = exampleConfigurator("Pergola");
    empty.parameters = [];
    draft.component.code = "NEW1";
    expect(guidedProblems(empty, draft).join(" ")).toContain("Aggiungi un parametro");
    expect(() => commitGuidedComponent(data, draft)).toThrow(/condizione|parametro/);
  });

  it("adds a catalog component without an inclusion rule and without a BOM row", () => {
    const { data, draft } = ready("catalog", item => { item.component.group = "Accessori"; item.component.note = "Schede/a.md"; });
    const before = structuredClone(data);
    const next = commitGuidedComponent(data, draft);
    expect(data).toEqual(before);
    expect(next.rules).toEqual(data.rules);
    expect(next.version).toBe(1);
    expect(next.components.at(-1)).toMatchObject({ code: "NEW1", group: "Accessori", note: "Schede/a.md" });
    expect(row(next, draft.component.id).bom).toBeUndefined();
    expect(row(next, draft.component.id).possible).toBe(false);
    expect(row(next, draft.component.id, { model: "A", led: true, width: 5000 }).bom).toBeUndefined();
    expect(row(next, draft.component.id, { model: "A", led: true, width: 5000 }).possible).toBe(false);
    expect(parseConfigurator(JSON.stringify(next)).components.at(-1)?.code).toBe("NEW1");
  });

  it("keeps code, description and optional dimension or property validation on the existing domain", () => {
    const { data, draft } = ready("catalog");
    draft.component.code = " pr001 ";
    expect(guidedProblems(data, draft).join(" ")).toContain("già usato");
    draft.component.code = "NEW1";
    draft.component.name = "   ";
    expect(guidedProblems(data, draft).join(" ")).toContain("descrizione");
    draft.component.name = "Nuovo pezzo";
    draft.component.dimensions = [{ id: "d", name: "", parameter: "", offset: Number.NaN, unit: "" }];
    expect(guidedProblems(data, draft).join(" ")).toContain("dimensione");
    draft.component.dimensions = undefined;
    draft.component.properties = [{ id: "p", name: "Finitura", parameter: "missing" }];
    expect(guidedProblems(data, draft).join(" ")).toContain("parametro di testo");
    expect(guidedProblems(data, { ...draft, mode: undefined }).join(" ")).toContain("Scegli quando il componente entra in distinta");
  });
});
