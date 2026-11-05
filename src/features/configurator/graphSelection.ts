import type { Condition, Selection } from "./model";
import type { PathGraph } from "./graphPaths";
export interface GraphSelection { parameters: string[]; conditions: Condition[] }
export const emptyGraphSelection:GraphSelection={parameters:[],conditions:[]};
/** A graph choice overrides only its own parameter; all other Esplora choices remain. */
export function graphInput(base:Selection,selection:GraphSelection):Selection {
  const result={...base};
  selection.parameters.forEach(id=>delete result[id]);
  for(const c of selection.conditions)if(c.operator==="eq")result[c.parameter]=c.value;
  return result;
}
export function graphChoices(graph:PathGraph,nodeIds:string[],routeId?:string):GraphSelection {
  const nodes=nodeIds.flatMap(id=>{const n=graph.nodes.find(n=>n.id===id);return n ? [n] : [];});
  const conditions=[...nodes.flatMap(n=>n.conditions),...(routeId ? graph.routes.find(r=>r.id===routeId)?.conditions ?? [] : [])];
  const unique=[...new Map(conditions.map(c=>[JSON.stringify([c.parameter,c.operator,c.value]),c])).values()];
  const parameters=[...new Set([...nodes.flatMap(n=>n.conditions.length ? n.conditions.map(c=>c.parameter) : n.id==="always" ? [] : [JSON.parse(n.id)[0] as string]),...unique.map(c=>c.parameter)])].filter(id=>typeof id==="string");
  return {parameters,conditions:unique};
}
