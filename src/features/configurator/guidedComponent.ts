import type { Component, ConditionNode, Configurator, Quantity, Rule } from "./model";
import { acceptsParameterValue, configVersion, newAction, newQuantity, uid } from "./model";
import { allComponentProblems, componentErrors, ruleActionProblems } from "./definitionValidation";
import { measureProblems } from "./componentMeasure";
import { propertyProblems } from "./componentProperties";
import { commitRule } from "./componentRules";
import { conditionsOf, expressionProblems } from "./expressions";

export const inclusionModes = ["always", "conditional", "catalog"] as const;
export type InclusionMode = (typeof inclusionModes)[number];
export const inclusionLabels: Record<InclusionMode, string> = {
  always: "Sempre presente",
  conditional: "Solo in certe condizioni",
  catalog: "Solo catalogo",
};
export const inclusionDescriptions: Record<InclusionMode, string> = {
  always: "Entra nella distinta in ogni configurazione, senza condizioni.",
  conditional: "Entra nella distinta solo quando le condizioni che configuri sono vere.",
  catalog: "Resta nel catalogo. Non viene creata alcuna inclusione automatica.",
};

export const guidedSteps = ["identity", "presence", "inclusion", "catalog", "dimensions", "properties"] as const;
export type GuidedStep = (typeof guidedSteps)[number];
export const guidedStepLabels: Record<GuidedStep, string> = {
  identity: "Codice",
  presence: "Presenza",
  inclusion: "Inclusione",
  catalog: "Catalogo",
  dimensions: "Dimensioni",
  properties: "Proprietà",
};

export interface GuidedDraft {
  component: Component;
  ruleId: string;
  mode?: InclusionMode;
  quantity: Quantity;
  expression: ConditionNode;
}

export function newGuidedDraft(): GuidedDraft {
  return {
    component: { id: uid(), code: "", name: "", group: "", unit: "pz", note: "" },
    ruleId: uid(),
    quantity: newQuantity(),
    expression: { id: uid(), type: "all", children: [] },
  };
}

const presenceProblem = "Scegli quando il componente entra in distinta.";

export function guidedInclusionProblems(data: Configurator, draft: GuidedDraft): string[] {
  if (!draft.mode || draft.mode === "catalog") return [];
  const scope: Configurator = { ...data, components: [...data.components.filter(component => component.id !== draft.component.id), draft.component] };
  const problems = ruleActionProblems(scope, inclusionRule(draft));
  if (draft.mode === "conditional") problems.unshift(...conditionalProblems(data, draft.expression));
  return [...new Set(problems)];
}

function conditionalProblems(data: Configurator, expression: ConditionNode): string[] {
  const problems: string[] = [];
  if (!conditionsOf(expression).length) {
    problems.push(data.parameters.length
      ? "Aggiungi almeno una condizione. Nessuna condizione è preselezionata."
      : "Aggiungi un parametro prima di definire le condizioni di inclusione.");
  }
  problems.push(...expressionProblems(expression));
  for (const condition of conditionsOf(expression)) {
    const parameter = data.parameters.find(item => item.id === condition.parameter);
    if (!parameter) problems.push("Scegli il parametro di ogni condizione.");
    else if (["eq", "ne"].includes(condition.operator) ? !acceptsParameterValue(parameter, condition.value) : parameter.type !== "number" || typeof condition.value !== "number") problems.push(`La condizione su ${parameter.name} non ha un valore valido.`);
  }
  return problems;
}

export function guidedStepProblems(data: Configurator, draft: GuidedDraft, step: GuidedStep): string[] {
  if (step === "identity") return Object.values(componentErrors(data, draft.component));
  if (step === "presence") return draft.mode ? [] : [presenceProblem];
  if (step === "inclusion") return draft.mode ? guidedInclusionProblems(data, draft) : [presenceProblem];
  if (step === "dimensions") return measureProblems(data, draft.component);
  if (step === "properties") return propertyProblems(data, draft.component);
  return [];
}

export function guidedProblems(data: Configurator, draft: GuidedDraft): string[] {
  return [...new Set([
    ...allComponentProblems(data, draft.component),
    ...(draft.mode ? guidedInclusionProblems(data, draft) : [presenceProblem]),
  ])];
}

export function firstInvalidGuidedStep(data: Configurator, draft: GuidedDraft): GuidedStep | undefined {
  return guidedSteps.find(step => step !== "catalog" && guidedStepProblems(data, draft, step).length > 0);
}

function inclusionRule(draft: GuidedDraft): Rule {
  const code = draft.component.code.trim() || draft.component.name.trim() || "componente";
  const action = { ...newAction(), component: draft.component.id, quantity: { ...draft.quantity } };
  const base = { id: draft.ruleId, name: `Inclusione ${code}`, enabled: true, componentIds: [draft.component.id], actions: [action] };
  if (draft.mode !== "conditional") return { ...base, match: "all", conditions: [] };
  const expression = draft.expression;
  const flat = expression.type !== "condition" && expression.type !== "not" && expression.children.every(node => node.type === "condition");
  return {
    ...base,
    match: expression.type === "any" ? "any" : "all",
    conditions: flat ? expression.children.flatMap(node => node.type === "condition" ? [node.condition] : []) : [],
    expression,
  };
}

function componentVersion(component: Component): Configurator["version"] {
  if (component.properties !== undefined) return component.properties.some(property => property.value !== undefined) ? 8 : 7;
  if (component.dimensions !== undefined) return 6;
  if (component.measure) return 5;
  return 1;
}

/** Persist the component and, only for the two inclusion modes, its single rule. */
export function commitGuidedComponent(data: Configurator, draft: GuidedDraft): Configurator {
  const problems = guidedProblems(data, draft);
  if (problems.length) throw new Error(problems[0]);
  const component = structuredClone(draft.component);
  const next: Configurator = { ...data, version: configVersion(data.version, componentVersion(component)), components: [...data.components, component] };
  if (draft.mode === "catalog") return next;
  return commitRule(next, structuredClone(inclusionRule(draft)));
}
