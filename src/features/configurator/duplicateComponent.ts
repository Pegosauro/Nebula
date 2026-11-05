import type { Action, Component, ConditionNode, Configurator, Rule, RuleCase } from "./model";
import { configVersion, uid } from "./model";
import { mergeComponentRules, ruleUsesComponent } from "./componentRules";

function cloneExpression(node:ConditionNode):ConditionNode {
  if(node.type==="condition")return {...node,id:uid(),condition:{...node.condition}};
  if(node.type==="not")return {...node,id:uid(),child:cloneExpression(node.child)};
  return {...node,id:uid(),children:node.children.map(cloneExpression)};
}
/** Copy this component's effects; other catalog components remain shared dependencies. */
function cloneActions(actions:Action[],source:string,target:string):Action[] {
  return actions.flatMap(action=>{
    if((action.type==="add" || action.type==="exclude") && action.component!==source)return [];
    const copy=structuredClone(action);
    if(["add","exclude","requireComponent"].includes(copy.type) && copy.component===source)copy.component=target;
    if(copy.type==="oneOf")copy.components=copy.components.map(id=>id===source ? target : id);
    return [copy];
  });
}
function cloneScope(scope:RuleCase,source:string,target:string):RuleCase {
  return {id:uid(),name:scope.name,enabled:scope.enabled,match:scope.match,conditions:structuredClone(scope.conditions),...(scope.expression ? {expression:cloneExpression(scope.expression)} : {}),actions:cloneActions(scope.actions,source,target)};
}
export function duplicateComponent(data:Configurator,id:string):{data:Configurator;component:Component} {
  const index=data.components.findIndex(c=>c.id===id),source=data.components[index];
  if(!source)throw new Error("Componente da duplicare non trovato.");
  const used=new Set(data.components.map(c=>c.code.trim().toLocaleLowerCase()));
  const base=`${source.code.trim() || "COMPONENTE"}-COPIA`;
  let code=base,suffix=2;
  while(used.has(code.toLocaleLowerCase()))code=`${base}-${suffix++}`;
  const component:Component={...structuredClone(source),id:uid(),code,name:`${source.name} (copia)`};
  if(component.dimensions)component.dimensions=component.dimensions.map(d=>({...d,id:uid()}));
  if(component.properties)component.properties=component.properties.map(p=>({...p,id:uid()}));
  const copies:Rule[]=data.rules.filter(rule=>ruleUsesComponent(rule,id)).flatMap(rule=>{
    const scope=cloneScope(rule,id,component.id);
    const cases=rule.cases?.map(c=>cloneScope(c,id,component.id)).filter(c=>c.actions.length);
    if(!scope.actions.length && !cases?.length)return [];
    return [{...scope,name:`${rule.name} · ${code}`,componentIds:[component.id],...(rule.parameterIds ? {parameterIds:[...rule.parameterIds]} : {}),...(cases?.length ? {cases} : {})}];
  });
  const components=[...data.components];components.splice(index+1,0,component);
  const next={...data,components};
  const rule=mergeComponentRules(next,copies,[component.id]);
  return {component,data:{...next,version:rule ? configVersion(data.version,3) : data.version,rules:rule ? [...data.rules,rule] : [...data.rules]}};
}
