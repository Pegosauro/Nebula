import type { Component, Configurator, Parameter } from "./model";
import { conditionsOf } from "./expressions";
import { ruleUsesComponent } from "./componentRules";
import { acceptsParameterValue, allowsCustomText } from "./model";
import { propertyProblems } from "./componentProperties";
import { componentDimensions, measureProblems } from "./componentMeasure";
export type FieldErrors = Record<string, string>;
export function parameterErrors(parameter: Parameter): FieldErrors {
  const errors: FieldErrors = {};
  if (!parameter.name.trim()) errors.name = "Inserisci il nome del parametro.";
  if (parameter.type === "choice" || parameter.type === "text") {
    const values = parameter.values.map(v => v.trim());
    if (((parameter.type === "choice" || !allowsCustomText(parameter)) && !values.length) || values.some(v => !v)) errors.values = "Inserisci valori non vuoti, uno per riga.";
    else if (new Set(values).size !== values.length) errors.values = "Ogni valore deve comparire una sola volta.";
  }
  if (parameter.type === "number") {
    if (parameter.min !== undefined && !Number.isFinite(parameter.min)) errors.min = "Inserisci un minimo valido.";
    if (parameter.max !== undefined && !Number.isFinite(parameter.max)) errors.max = "Inserisci un massimo valido.";
    if (parameter.min !== undefined && parameter.max !== undefined && parameter.min > parameter.max) errors.max = "Il massimo deve essere maggiore o uguale al minimo.";
    if (parameter.step !== undefined && (!Number.isFinite(parameter.step) || parameter.step <= 0)) errors.step = "Il passo deve essere maggiore di zero.";
  }
  return errors;
}
export function componentErrors(data: Configurator, component: Component): FieldErrors {
  const errors: FieldErrors = {};
  if (!component.code.trim()) errors.code = "Inserisci il codice del componente.";
  else if (data.components.some(c => c.id !== component.id && c.code.trim().toLowerCase() === component.code.trim().toLowerCase())) errors.code = "Questo codice è già usato da un altro componente.";
  if (!component.name.trim()) errors.name = "Inserisci la descrizione.";
  return errors;
}
export function removalDependencies(data: Configurator, id: string, kind: "parameter" | "component"): string[] {
  const items = new Set<string>();
  for (const rule of data.rules) {
    const cases = [rule, ...(rule.cases ?? [])];
    const used = kind === "component" ? ruleUsesComponent(rule, id) : rule.parameterIds?.includes(id) || cases.some(r => (r.expression ? conditionsOf(r.expression) : r.conditions).some(c => c.parameter === id) || r.actions.some(a => a.parameter === id || a.quantity.parameter === id));
    if (used) items.add(`Regola: ${rule.name}`);
  }
  if (kind === "parameter") {
    for (const c of data.components) if (componentDimensions(c).some(m => m.parameter === id)) items.add(`Misura: ${c.code}`);
    for (const c of data.components) if (c.properties?.some(p=>p.parameter===id)) items.add(`Proprietà: ${c.code}`);
    for (const p of data.parameters) for (const rule of p.optionRules ?? []) if (conditionsOf(rule.expression).some(c => c.parameter === id)) items.add(`Selezionabilità: ${p.name} · ${String(rule.value)}`);
  }
  return [...items];
}
export function confirmRemoval(data: Configurator, id: string, kind: "parameter" | "component", label: string): boolean {
  const dependencies = removalDependencies(data, id, kind);
  return confirm(`Eliminare ${label}?${dependencies.length ? `\n\n${dependencies.length} dipendenze da correggere:\n${dependencies.map(item => `• ${item}`).join("\n")}\n\nI riferimenti restano visibili in Analisi. Proseguire?` : "\nNessuna dipendenza rilevata."}`);
}
export function allComponentProblems(data: Configurator, component: Component): string[] { return [...Object.values(componentErrors(data, component)), ...measureProblems(data, component), ...propertyProblems(data, component)]; }
export function ruleActionProblems(data: Configurator, rule: import("./model").Rule): string[] {
  const problems: string[] = [];
  for (const scope of [rule,...(rule.cases ?? [])]) {
    if (!scope.actions.length && !rule.cases?.length) problems.push("Aggiungi almeno un’azione alla regola.");
    for (const action of scope.actions) {
      if (["add","exclude","requireComponent"].includes(action.type) && !data.components.some(c => c.id === action.component)) problems.push("Scegli il componente dell’azione.");
      if (action.type === "add" && (!Number.isFinite(action.quantity.amount) || action.quantity.amount < 0 || !Number.isFinite(action.quantity.divisor) || action.quantity.divisor <= 0 || action.quantity.parameter && !data.parameters.some(p => p.id === action.quantity.parameter && p.type === "number"))) problems.push("Controlla quantità, parametro numerico e divisore positivo.");
      if (["requireValue","excludeValue"].includes(action.type)) {
        const p = data.parameters.find(p => p.id === action.parameter);
        if (!p || !acceptsParameterValue(p,action.value)) problems.push("Scegli un parametro e un valore validi per il vincolo.");
      }
      if (action.type === "oneOf" && (new Set(action.components).size < 2 || action.components.some(id => !data.components.some(c => c.id === id)))) problems.push("Scegli almeno due componenti alternativi validi.");
    }
  }
  return [...new Set(problems)];
}
