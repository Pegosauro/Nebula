import { ComponentPropertyValues } from "./ComponentPropertyValues";
import { componentProperties } from "./componentProperties";
import type { Component, Configurator, Rule } from "./model";
import { componentMeasurements, dimensionsLabel, hasDimensions, measureFormula } from "./componentMeasure";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useConfiguratorStore } from "./configuratorStore";
export function ComponentSummary({ data, component, rule }: { data: Configurator; component: Component; rule?: Rule }) {
  const path = useWorkspaceStore(state => state.tabs.find(tab => tab.id === state.activeTabId)?.path);
  const selection = useConfiguratorStore(state => path ? state.sessions[path]?.preview?.selection : undefined);
  const result = componentMeasurements(data,component,selection ?? {});
  const actions = [rule, ...(rule?.cases ?? [])].flatMap(r => r?.actions ?? []).filter(a => a.type === "add" && a.component === component.id);
  const quantities = actions.map(a => a.quantity.parameter ? `${a.quantity.amount} × ${data.parameters.find(p => p.id === a.quantity.parameter)?.name ?? "Parametro mancante"} ÷ ${a.quantity.divisor}${a.quantity.rounding === "none" ? "" : a.quantity.rounding === "ceil" ? " (per eccesso)" : " (per difetto)"}` : `${a.quantity.amount.toLocaleString("it-IT")} ${component.unit}`);
  return <div className="config-component-summary" aria-label="Riepilogo del componente"><strong>{component.code || "Nuovo componente"}</strong><span>Quantità: {quantities.length ? quantities.join("; ") : "da impostare nella regola"}</span>{hasDimensions(component) && <span>Misura / pezzo: {result.values.every(v=>v.value===undefined) ? measureFormula(data,component) : dimensionsLabel(component,{dimensions:result.values,measure:result.values[0]?.value})}</span>}<ComponentPropertyValues component={component} values={componentProperties(component,selection ?? {})}/></div>;
}
