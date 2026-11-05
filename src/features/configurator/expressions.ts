import type { Condition, ConditionNode, Configurator, Rule } from "./model";

export const operatorLabels = {eq:"=",ne:"≠",gt:">",gte:"≥",lt:"<",lte:"≤"};
export const logicLabels = {all:"E",any:"O",not:"NON"};
export function ruleExpression(rule: Rule): ConditionNode {
  return rule.expression ?? {id:`${rule.id}:root`,type:rule.conditions.length ? rule.match : "all",children:rule.conditions.map((condition,i)=>({id:`${rule.id}:condition:${i}`,type:"condition",condition}))};
}
export function conditionsOf(node: ConditionNode): Condition[] {
  if (node.type === "condition") return [node.condition];
  return node.type === "not" ? conditionsOf(node.child) : node.children.flatMap(conditionsOf);
}
export const ruleConditions = (rule: Rule):Condition[] => [...(rule.expression ? conditionsOf(rule.expression) : rule.conditions),...(rule.cases?.flatMap(c=>ruleConditions(c)) ?? [])];
export function expressionLabel(node: ConditionNode, data: Configurator): string {
  if (node.type === "condition") {
    const c=node.condition, v=typeof c.value === "boolean" ? c.value ? "Sì" : "No" : JSON.stringify(c.value);
    return `${data.parameters.find(p=>p.id===c.parameter)?.name ?? "Parametro mancante"} ${operatorLabels[c.operator]} ${v}`;
  }
  if (node.type === "not") return `NON(${expressionLabel(node.child,data)})`;
  return `${logicLabels[node.type]}(${node.children.map(c=>expressionLabel(c,data)).join("; ") || "vuoto"})`;
}
export function conditionSummary(rule: Rule, data: Configurator): string {
  const n=ruleExpression(rule);
  if(rule.cases){const alternatives=rule.cases.map(c=>`${c.name}${c.enabled ? "" : " (disattivata)"}: ${conditionSummary(c,data)}`).join(" | ");return `${n.type==="all" && !n.children.length ? "" : `Condizione comune: ${expressionLabel(n,data)} · `}${alternatives}`;}
  return n.type === "all" && !n.children.length ? "Sempre" : expressionLabel(n,data);
}
export function expressionKey(node: ConditionNode): string {
  if (node.type === "condition") return JSON.stringify(node.condition);
  if (node.type === "not") return `not(${expressionKey(node.child)})`;
  return `${node.type}(${node.children.map(expressionKey).sort().join(";")})`;
}
export function expressionProblems(node: ConditionNode): string[] {
  let count=0;
  const visit=(n:ConditionNode,depth:number):string[]=>{
    if (++count>1000 || depth>32) return ["Albero troppo complesso: massimo 32 livelli e 1000 elementi."];
    if (n.type === "condition") return [];
    if (n.type === "not") return visit(n.child,depth+1);
    if (!n.children.length && !(depth===0 && n.type==="all")) return ["Gruppo vuoto: aggiungi una condizione o elimina il gruppo."];
    return n.children.flatMap(child=>visit(child,depth+1));
  };
  return [...new Set(visit(node,0))];
}
// Only conjunction scopes can have simultaneous, contradictory requirements.
export function conjunctions(node: ConditionNode): Condition[][] {
  if (node.type === "condition") return [];
  if (node.type === "not") return [];
  const direct = (n: ConditionNode): Condition[] => n.type === "condition" ? [n.condition] : n.type === "all" ? n.children.flatMap(direct) : [];
  return [...(node.type === "all" ? [direct(node)] : []),...node.children.flatMap(conjunctions)];
}
