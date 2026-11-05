import { describe, expect, it } from "vitest";
import { buildGraphPaths, focusedRoutes, logicalPaths, selectedRoutes, projectGraphPaths, unconstrainedOrigin } from "./graphPaths";
import { expressionMatches, matches } from "./engine";
import { exampleConfigurator, type ConditionNode } from "./model";

let id=0;
const leaf=(parameter:string):ConditionNode=>({id:String(id++),type:"condition",condition:{parameter,operator:"eq",value:true}});
const group=(type:"all"|"any",...children:ConditionNode[]):ConditionNode=>({id:String(id++),type,children});
const not=(child:ConditionNode):ConditionNode=>({id:String(id++),type:"not",child});
describe("parameter paths",()=>{
  it("expands E/O/NON into equivalent alternatives without turning O into simultaneous requirements",()=>{
    const tree=group("all",leaf("x"),group("any",leaf("a"),leaf("b")),not(group("all",leaf("n"),leaf("t"))));
    const expanded=logicalPaths(tree);
    expect(expanded.truncated).toBe(false);expect(expanded.paths).toHaveLength(4);
    for(let bits=0;bits<32;bits++) {
      const s=Object.fromEntries(["x","a","b","n","t"].map((p,i)=>[p,!!(bits&(1<<i))]));
      const active=expanded.paths.some(conditions=>matches({id:"",name:"",enabled:true,match:"all",conditions,actions:[]},s));
      expect(active).toBe(expressionMatches(tree,s));
    }
  });
  it("preserves parameter insertion order, merges matching values and reaches actual action targets",()=>{
    const data=exampleConfigurator("Graph");
    const graph=buildGraphPaths(data);
    const r1nodes=graph.nodes.filter(n=>n.rules.includes("R1"));
    expect(r1nodes.map(n=>data.parameters[n.column]!.id)).toEqual(["model","led","width"]);
    expect(r1nodes[0]!.conditions[0]!.value).toBe("A");
    expect(r1nodes[1]!.conditions).toEqual([]);
    const terminal=graph.edges.find(e=>e.rule.id==="R1" && e.terminal)!;
    expect(terminal.to).toBe("c:profile");expect(terminal.action).toBe("add");
    expect(graph.general).toBe(1);
    data.parameters.reverse();
    expect(buildGraphPaths(data).nodes.filter(n=>n.rules.includes("R1")).map(n=>data.parameters[n.column]!.id)).toEqual(["width","led","model"]);
    data.rules[0]!.enabled=false;
    expect(buildGraphPaths(data).edges.some(e=>e.rule.id==="R1")).toBe(false);
  });
  it("merges equal values with different incoming prefixes but keeps complete route identities",()=>{
    const data=exampleConfigurator("Shared");
    data.rules=[data.rules[0]!,{...data.rules[0]!,id:"other",conditions:[{parameter:"model",operator:"eq",value:"B"}],actions:[{...data.rules[0]!.actions[0]!,component:"power"}]}];
    const graph=buildGraphPaths(data);
    expect(graph.nodes.filter(n=>n.column===0)).toHaveLength(2);
    expect(graph.nodes.filter(n=>n.column===1)).toHaveLength(1);
    expect(graph.nodes.filter(n=>n.column===2)).toHaveLength(1);
    expect(graph.routes).toHaveLength(2);
    const modelA=graph.nodes.find(n=>n.column===0 && n.conditions[0]?.value==="A")!;
    const selected=focusedRoutes(graph,{kind:"node",id:modelA.id});
    expect(graph.routes.filter(r=>selected.has(r.id)).map(r=>r.component)).toEqual(["profile"]);
    // Shared future nodes must not manufacture a route A -> power.
    expect(graph.edges.filter(e=>selected.has(e.routeId) && e.terminal).map(e=>e.to)).toEqual(["c:profile"]);
    const shared=graph.nodes.find(n=>n.column===1)!;
    expect(focusedRoutes(graph,{kind:"node",id:shared.id}).size).toBe(2);
    expect(focusedRoutes(graph,{kind:"component",id:"power"}).size).toBe(1);
    data.rules[0]!.conditions.push({...data.rules[0]!.conditions[0]!});
    expect(buildGraphPaths(data).nodes.filter(n=>n.column===0)).toHaveLength(2);
  });
  it("bounds path expansion, reports truncation and rejects incomplete groups",()=>{
    const tree=group("all",...Array.from({length:8},(_,i)=>group("any",leaf(`a${i}`),leaf(`b${i}`))));
    expect(logicalPaths(tree).paths).toHaveLength(64);expect(logicalPaths(tree).truncated).toBe(true);
    expect(logicalPaths(not(group("any"))).paths).toEqual([]);
    const data=exampleConfigurator("Empty");data.parameters=[];data.rules=data.rules.filter(r=>!r.conditions.length);
    expect(buildGraphPaths(data).nodes[0]?.id).toBe("always");
    expect(buildGraphPaths(data).edges[0]?.to).toBe("c:bracket");
  });
  it("admits wildcard alternatives per selected parameter without losing another parameter's constraints or mixing prefixes",()=>{
    const data=exampleConfigurator("Compatible");data.version=2;
    const base=data.rules[0]!;
    data.rules=[
      {...base,id:"nested",conditions:[],expression:{id:"root",type:"all",children:[{id:"model-a",type:"condition",condition:{parameter:"model",operator:"eq",value:"A"}},{id:"or",type:"any",children:[{id:"yes",type:"condition",condition:{parameter:"led",operator:"eq",value:true}},{id:"wide",type:"condition",condition:{parameter:"width",operator:"gt",value:3000}}]}]}},
      {...base,id:"other-prefix",conditions:[{parameter:"model",operator:"eq",value:"B"},{parameter:"led",operator:"eq",value:false}]},
      {...base,id:"independent",conditions:[]},
    ];
    const graph=buildGraphPaths(data), before=JSON.stringify(graph);
    const find=(column:number,value:unknown)=>graph.nodes.find(n=>n.column===column && n.conditions.some(c=>c.value===value))!.id;
    const a=find(0,"A"), b=find(0,"B"), yes=find(1,true), wide=find(2,3000), anyLed=graph.nodes.find(n=>n.column===1 && !n.conditions.length)!.id;
    const routes=(ids:string[])=>graph.routes.filter(r=>selectedRoutes(graph,ids).has(r.id));
    expect(routes([a,yes]).map(r=>r.rule.id)).toEqual(["nested","nested","independent"]);
    expect(routes([b,yes]).map(r=>r.rule.id)).toEqual(["independent"]);
    expect(routes([a,yes,wide]).map(r=>r.rule.id)).toEqual(["nested","nested","independent"]);
    expect(routes([anyLed]).map(r=>r.rule.id)).toEqual(["nested","independent"]);
    expect(selectedRoutes(graph,["missing"]).size).toBe(0);
    const focused=focusedRoutes(graph,{kind:"node",id:yes});expect([...focused]).toEqual([...selectedRoutes(graph,[yes])]);
    expect(JSON.stringify(graph)).toBe(before);
  });
  it("projects saved alternatives independently, skips every neutral position and retains exclusion markers and routes without parameters",()=>{
    const data=exampleConfigurator("Projected");
    data.rules=[{...data.rules[0]!,conditions:[{parameter:"model",operator:"eq",value:"A"},{parameter:"width",operator:"gte",value:3000}],actions:[{...data.rules[0]!.actions[0]!,type:"exclude"}]},{...data.rules[1]!,conditions:[]},{...data.rules[2]!,conditions:[{parameter:"led",operator:"eq",value:true}],actions:[data.rules[0]!.actions[0]!]}];
    const graph=buildGraphPaths(data), before=JSON.stringify(graph), compact=projectGraphPaths(graph,false);
    expect(new Set(compact.edges.map(e=>e.id)).size).toBe(compact.edges.length);
    for(const route of graph.routes){
      const edges=compact.edges.filter(e=>e.routeId===route.id), retained=route.nodes.filter(id=>graph.nodes.find(n=>n.id===id)!.conditions.length);
      expect(edges.map(e=>e.from)).toEqual(retained.length ? retained : [unconstrainedOrigin]);
      expect(edges.at(-1)).toMatchObject({to:`c:${route.component}`,terminal:true,action:route.action,rule:route.rule,conditions:route.conditions});
      for(let i=0;i<edges.length-1;i++)expect(edges[i]!.to).toBe(edges[i+1]!.from);
    }
    expect(compact.originRoutes).toHaveLength(2);expect(compact.nodes.every(n=>n.conditions.length>0)).toBe(true);
    expect(projectGraphPaths(graph,true).edges).toBe(graph.edges);expect(projectGraphPaths(graph,true).nodes).toBe(graph.nodes);expect(JSON.stringify(graph)).toBe(before);
    data.parameters=[];data.rules=data.rules.filter(r=>!r.conditions.length);const noParameters=projectGraphPaths(buildGraphPaths(data),false);
    expect(noParameters.nodes[0]!.id).toBe("always");expect(noParameters.originRoutes).toEqual([]);expect(noParameters.edges).toHaveLength(2);
  });

});
