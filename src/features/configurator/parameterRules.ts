import type { Configurator, Parameter, Rule } from "./model";
import { newAction, uid } from "./model";
import { initialValue } from "./ConditionControls";
import { expandRule, ruleComponentIds } from "./componentRules";
import { conditionSummary, ruleConditions } from "./expressions";
import { analyze, valueLabel } from "./engine";

/** Parameter constraints remain separate from rules which include components. */
export function parameterRules(data:Configurator,id:string):Rule[] {
  return data.rules.filter(rule=>!ruleComponentIds(rule).length &&
    expandRule(rule).every(r=>r.actions.every(a=>a.type==="requireValue" || a.type==="excludeValue")) &&
    (rule.parameterIds?.includes(id) || ruleConditions(rule).some(c=>c.parameter===id) ||
      expandRule(rule).some(r=>r.actions.some(a=>a.parameter===id))));
}

export function newParameterRule(data:Configurator,parameter:Parameter):Rule {
  const target=data.parameters.find(p=>p.id!==parameter.id) ?? parameter;
  return {id:uid(),parameterIds:[parameter.id],name:`Vincolo ${parameter.name}`,enabled:true,match:"all",
    conditions:[{parameter:parameter.id,operator:"eq",value:initialValue(parameter)}],
    actions:[{...newAction(),type:"excludeValue",parameter:target.id,value:initialValue(target)}]};
}

export function parameterRuleSummary(rule:Rule,data:Configurator):string {
  return expandRule(rule).map(r=>`${conditionSummary(r,data)} → ${r.actions.map(a=>
    `${a.type==="requireValue" ? "Richiedi" : "Escludi"} ${data.parameters.find(p=>p.id===a.parameter)?.name ?? "Parametro mancante"}: ${valueLabel(a.value)}`
  ).join("; ")}`).join(" | ");
}

export function parameterRuleProblems(data:Configurator,rule:Rule):string[] {
  // Validate the draft with the same typed domains and expression checks used by
  // the calculation worker, without unrelated component-definition errors.
  const issues=analyze({...data,components:[],rules:[rule]});
  const actions=expandRule(rule).flatMap(r=>r.actions);
  return [...new Set([
    ...issues.filter(i=>i.severity==="error").map(i=>i.message),
    ...(!actions.length ? ["Aggiungi almeno un vincolo su un valore."] : []),
    ...(actions.some(a=>a.type!=="requireValue" && a.type!=="excludeValue") ? ["Usa solo vincoli sui valori dei parametri."] : []),
  ])];
}
