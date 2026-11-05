import type { Configurator, Condition, ConditionNode, Rule, RuleCase } from "./model";
import { configVersion } from "./model";
import { ruleExpression } from "./expressions";

export const always = (n:ConditionNode) => n.type==="all" && !n.children.length;
function copyTree(node:ConditionNode,prefix:string):ConditionNode {
  let i=0;
  const copy=(n:ConditionNode):ConditionNode=>{const id=`${prefix}:${i++}`;return n.type==="condition" ? {...n,id,condition:{...n.condition}} : n.type==="not" ? {...n,id,child:copy(n.child)} : {...n,id,children:n.children.map(copy)};};
  return copy(node);
}
function and(a:ConditionNode,b:ConditionNode,id:string):ConditionNode {
  if(always(a))return copyTree(b,id);
  if(always(b))return copyTree(a,id);
  return {id,type:"all",children:[copyTree(a,`${id}:a`),copyTree(b,`${id}:b`)]};
}
export type EffectiveRule=Rule & {ownerId:string};
export function expandRule(rule:Rule):EffectiveRule[] {
  if(!rule.cases)return [{...rule,ownerId:rule.id}];
  return [
    ...(rule.actions.length ? [{...rule,cases:undefined,ownerId:rule.id}] : []),
    ...rule.cases.map(c=>({...c,componentIds:rule.componentIds,id:JSON.stringify([rule.id,c.id]),name:`${rule.name} · ${c.name}`,enabled:rule.enabled && c.enabled,match:"all" as const,conditions:[],expression:and(ruleExpression(rule),ruleExpression(c),`${rule.id}:${c.id}:effective`),ownerId:rule.id})),
  ];
}
export const expandedRules=(data:Configurator)=>data.rules.flatMap(expandRule);
export function ruleComponentIds(rule:Rule):string[] {
  return [...new Set([...(rule.componentIds ?? []),...[...rule.actions,...(rule.cases?.flatMap(c=>c.actions) ?? [])].flatMap(a=>["add","exclude","requireComponent"].includes(a.type) ? a.component ? [a.component] : [] : a.type==="oneOf" ? a.components : [])])];
}
export const ruleUsesComponent=(rule:Rule,id:string)=>ruleComponentIds(rule).includes(id);
export function connectedRules(data:Configurator,ids:string[]):Rule[] {
  const owners=new Set(ids),selected=new Set<string>();
  let changed=true;
  while(changed){changed=false;for(const r of data.rules){if(selected.has(r.id))continue;const links=ruleComponentIds(r);if(links.some(id=>owners.has(id))){selected.add(r.id);links.forEach(id=>owners.add(id));changed=true;}}}
  return data.rules.filter(r=>selected.has(r.id));
}
function requiredConditions(n:ConditionNode):Condition[] {
  return n.type==="condition" ? [n.condition] : n.type==="all" ? n.children.flatMap(requiredConditions) : [];
}
function disjoint(a:RuleCase,b:RuleCase) {
  const ac=requiredConditions(ruleExpression(a)),bc=requiredConditions(ruleExpression(b));
  return ac.some(x=>bc.some(y=>x.parameter===y.parameter && (x.operator==="eq" && y.operator==="eq" && x.value!==y.value || x.operator==="eq" && y.operator==="ne" && x.value===y.value || x.operator==="ne" && y.operator==="eq" && x.value===y.value)));
}
/** Keep different quantities/actions and overlapping inclusions as visible alternatives. */
export function mergeComponentRules(data:Configurator,rules:Rule[],extraOwners:string[]=[]):Rule|undefined {
  if(!rules.length)return;
  const owners=[...new Set([...extraOwners,...rules.flatMap(ruleComponentIds)])];
  if(rules.length===1){
    const r=rules[0]!;
    if(r.cases?.length===1 && !r.actions.length){const e=expandRule(r)[0]!;return {id:r.id,name:r.name,enabled:e.enabled,match:e.match,conditions:e.conditions,expression:e.expression,actions:structuredClone(e.actions),componentIds:owners};}
    return {...structuredClone(r),componentIds:owners};
  }
  const cases:RuleCase[]=rules.flatMap(r=>expandRule(r).map((effective,i)=>({id:`${r.id}:${i}`,name:effective.name,enabled:effective.enabled,match:"all",conditions:[],expression:copyTree(ruleExpression(effective),`${r.id}:${i}:saved`),actions:structuredClone(effective.actions)})));
  const id=rules[0]!.id;
  const name=owners.length===1 ? `Regola ${data.components.find(c=>c.id===owners[0])?.code || "componente"}` : "Regola componenti collegati";
  if(cases.length && cases.every(c=>c.enabled===cases[0]!.enabled && JSON.stringify(c.actions)===JSON.stringify(cases[0]!.actions)) && cases.every((a,i)=>cases.slice(i+1).every(b=>disjoint(a,b)))) {
    return {id,name,enabled:cases[0]!.enabled,match:"any",conditions:[],componentIds:owners,expression:{id:`${id}:merged`,type:"any",children:cases.map(c=>copyTree(ruleExpression(c),`${c.id}:merged`))},actions:cases[0]!.actions};
  }
  return {id,name,enabled:true,match:"all",conditions:[],actions:[],componentIds:owners,cases};
}
export function componentRule(data:Configurator,id:string) {
  const source=connectedRules(data,[id]);
  return {source,rule:mergeComponentRules(data,source,[id])};
}
export function commitRule(data:Configurator,draft:Rule,replacedIds:string[]=[draft.id]):Configurator {
  const replaced=new Set(replacedIds);
  const index=data.rules.findIndex(r=>replaced.has(r.id));
  const pending=data.rules.filter(r=>!replaced.has(r.id));
  pending.splice(index<0 ? pending.length : Math.min(index,pending.length),0,draft);
  const interim={...data,rules:pending};
  const connected=connectedRules(interim,ruleComponentIds(draft));
  const merged=connected.length ? mergeComponentRules(interim,connected)! : draft;
  const consumed=new Set(connected.map(r=>r.id));
  const first=pending.findIndex(r=>consumed.has(r.id) || r.id===draft.id);
  const rules=pending.filter(r=>!consumed.has(r.id) && r.id!==draft.id);
  rules.splice(Math.min(first,rules.length),0,merged);
  return {...data,version:configVersion(data.version,merged.parameterIds || merged.componentIds || merged.cases ? 3 : merged.expression ? 2 : 1),rules};
}
