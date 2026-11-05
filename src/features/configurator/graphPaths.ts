import type { Condition, ConditionNode, Configurator, Rule } from "./model";
import { expressionProblems, ruleExpression } from "./expressions";

import { expandedRules } from "./componentRules";
import { orderedComponents } from "./componentHierarchy";
const inverse:Record<Condition["operator"],Condition["operator"]>={eq:"ne",ne:"eq",gt:"lte",gte:"lt",lt:"gte",lte:"gt"};
export function logicalPaths(node:ConditionNode,limit=64): { paths:Condition[][]; truncated:boolean } {
  let truncated=false;
  const visit=(n:ConditionNode,negated=false):Condition[][]=>{
    if(n.type==="condition")return [[negated ? {...n.condition,operator:inverse[n.condition.operator]} : n.condition]];
    if(n.type==="not")return visit(n.child,!negated);
    const all=(n.type==="all")!==negated;
    let result:Condition[][]=all ? [[]] : [];
    for(const child of n.children) {
      const next=visit(child,negated);
      if(all) {
        const product:Condition[][]=[];
        for(const a of result)for(const b of next){if(product.length<limit)product.push([...a,...b]);else truncated=true;}
        result=product;
      }else {if(result.length+next.length>limit)truncated=true;result=[...result,...next].slice(0,limit);}
    }
    return result;
  };
  if(expressionProblems(node).length)return {paths:[],truncated:false};
  return {paths:visit(node),truncated};
}
export interface PathNode { id:string; column:number; row:number; conditions:Condition[]; rules:string[] }
export interface PathRoute { id:string; rule:Rule; conditions:Condition[]; nodes:string[]; component:string; action:string }
export interface PathEdge { id:string; from:string; to:string; rule:Rule; conditions:Condition[]; action:string; terminal:boolean; routeId:string }
export interface PathGraph { nodes:PathNode[]; edges:PathEdge[]; routes:PathRoute[]; components:Configurator["components"]; truncated:boolean; incomplete:number; general:number }
const conditionKey=(c:Condition)=>JSON.stringify([c.parameter,c.operator,c.value]);
function canonicalConditions(conditions:Condition[]) {
  return [...new Map(conditions.map(c=>[conditionKey(c),c])).values()].toSorted((a,b)=>conditionKey(a).localeCompare(conditionKey(b)));
}
export function buildGraphPaths(data:Configurator):PathGraph {
  const nodes:PathNode[]=[], edges:PathEdge[]=[], routes:PathRoute[]=[];
  const byKey=new Map<string,PathNode>();
  const counts=data.parameters.map(()=>0);
  const visibleComponents=new Set<string>();
  let truncated=false, incomplete=0, general=0, total=0;
  for(const rule of expandedRules(data).filter(r=>r.enabled)) {
    const directTargets=rule.actions.flatMap(a=>["add","exclude","requireComponent"].includes(a.type) ? [{id:a.component,action:a.type}] : a.type==="oneOf" ? a.components.map(id=>({id,action:a.type})) : []).filter(t=>data.components.some(c=>c.id===t.id));
    const targets=directTargets.length ? directTargets : (rule.componentIds ?? []).filter(id=>data.components.some(c=>c.id===id)).map(id=>({id,action:"valueConstraint"}));
    if(!targets.length){general++;continue;}
    if(expressionProblems(ruleExpression(rule)).length){incomplete++;continue;}
    const expanded=logicalPaths(ruleExpression(rule));truncated ||= expanded.truncated;
    const uniquePaths=[...new Map(expanded.paths.map(path=>{const normalized=canonicalConditions(path);return [JSON.stringify(normalized.map(conditionKey)),normalized] as const;})).values()];
    for(const [pathIndex,path] of uniquePaths.entries()) {
      if(total++>=256){truncated=true;break;}
      if(path.some(c=>!data.parameters.some(p=>p.id===c.parameter))){incomplete++;continue;}
      const routeNodes:string[]=[];
      for(let column=0;column<data.parameters.length;column++) {
        const conditions=path.filter(c=>c.parameter===data.parameters[column]!.id);
        // A value/comparison belongs to this parameter once, regardless of its incoming paths.
        const key=JSON.stringify([data.parameters[column]!.id,conditions.map(conditionKey)]);
        let node=byKey.get(key);
        if(!node){node={id:key,column,row:counts[column]!,conditions,rules:[]};counts[column]!++;byKey.set(key,node);nodes.push(node);}
        if(!node.rules.includes(rule.id))node.rules.push(rule.id);
        routeNodes.push(node.id);
      }
      if(!routeNodes.length){let node=byKey.get("always");if(!node){node={id:"always",column:0,row:0,conditions:[],rules:[]};byKey.set("always",node);nodes.push(node);}if(!node.rules.includes(rule.id))node.rules.push(rule.id);routeNodes.push(node.id);}
      for(const [targetIndex,target] of targets.entries()) {
        const id=JSON.stringify([rule.id,pathIndex,targetIndex]);
        routes.push({id,rule,conditions:path,nodes:routeNodes,component:target.id,action:target.action});
        visibleComponents.add(target.id);
        for(let i=1;i<routeNodes.length;i++)edges.push({id:`e${edges.length}`,from:routeNodes[i-1]!,to:routeNodes[i]!,rule,conditions:path,action:"",terminal:false,routeId:id});
        edges.push({id:`e${edges.length}`,from:routeNodes.at(-1)!,to:`c:${target.id}`,rule,conditions:path,action:target.action,terminal:true,routeId:id});
      }
    }
  }
  return {nodes,edges,routes,components:orderedComponents(data).filter(c=>visibleComponents.has(c.id)),truncated,incomplete,general};
}
export type GraphFocus={kind:"node"|"component"|"route";id:string};
/** Select complete saved routes, never a reachability walk through merged nodes. */
export function focusedRoutes(graph:PathGraph,focus?:GraphFocus):Set<string> {
  if(focus?.kind==="node")return selectedRoutes(graph,[focus.id]);
  return new Set(graph.routes.filter(r=>!focus || (focus.kind==="component" ? r.component===focus.id : r.id===focus.id)).map(r=>r.id));
}

/** Each choice admits its exact comparison or an unconstrained step in that column.
 * Intersect complete routes, so a wildcard cannot join unrelated saved branches. */
export function selectedRoutes(graph:PathGraph,nodeIds:string[]):Set<string> {
  if(!nodeIds.length)return new Set(graph.routes.map(r=>r.id));
  const byId=new Map(graph.nodes.map(n=>[n.id,n]));
  const wildcards=new Map(graph.nodes.filter(n=>!n.conditions.length).map(n=>[n.column,n.id]));
  const choices=nodeIds.map(id=>{const n=byId.get(id), wildcard=n?.conditions.length ? wildcards.get(n.column) : undefined;return new Set(wildcard ? [id,wildcard] : [id]);});
  return new Set(graph.routes.filter(r=>choices.every(ids=>r.nodes.some(id=>ids.has(id)))).map(r=>r.id));
}

export const unconstrainedOrigin="origin:unconstrained";
/** Rebuild each route independently for display; projection never changes its logic,
 * identity or colour and never creates crossings through shared neutral nodes. */
export function projectGraphPaths(graph:PathGraph,showUnconstrained:boolean):{nodes:PathNode[];edges:PathEdge[];originRoutes:string[]} {
  if(showUnconstrained)return {nodes:graph.nodes,edges:graph.edges,originRoutes:[]};
  const nodes=graph.nodes.filter(n=>n.conditions.length || n.id==="always"), kept=new Set(nodes.map(n=>n.id));
  const edges:PathEdge[]=[], originRoutes:string[]=[];
  for(const route of graph.routes) {
    const steps=route.nodes.filter(id=>kept.has(id));
    if(!steps.length){steps.push(unconstrainedOrigin);originRoutes.push(route.id);}
    for(let i=0;i<steps.length;i++) {
      const terminal=i===steps.length-1, from=steps[i]!, to=terminal ? `c:${route.component}` : steps[i+1]!;
      edges.push({id:JSON.stringify([route.id,from,to]),from,to,rule:route.rule,conditions:route.conditions,action:terminal ? route.action : "",terminal,routeId:route.id});
    }
  }
  return {nodes,edges,originRoutes};
}
