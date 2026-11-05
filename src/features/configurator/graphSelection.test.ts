import { describe, expect, it } from "vitest";
import { calculate } from "./calculation";
import { enumerate } from "./engine";
import { graphChoices, graphInput } from "./graphSelection";
import { buildGraphPaths } from "./graphPaths";
import { exampleConfigurator, newAction, type Condition } from "./model";
const condition=(parameter:string,operator:Condition["operator"],value:Condition["value"]):Condition=>({parameter,operator,value});
describe("graph configuration results",()=>{
  it("overrides only clicked parameter values, supports neutral steps and reads a complete route without modifying the source",()=>{
    const data=exampleConfigurator("Graph"), before=JSON.stringify(data), graph=buildGraphPaths(data);
    const yes=graph.nodes.find(n=>n.conditions.some(c=>c.parameter==="led" && c.value===true))!;
    const base={model:"A",led:false,width:3000};
    const selected=graphChoices(graph,[yes.id]);expect(graphInput(base,selected)).toEqual({model:"A",led:true,width:3000});
    const any=graph.nodes.find(n=>n.column===1 && !n.conditions.length)!;
    expect(graphInput(base,graphChoices(graph,[any.id]))).toEqual({model:"A",width:3000});
    const route=graph.routes.find(r=>r.rule.id==="R1")!;expect(graphChoices(graph,[],route.id).conditions).toEqual(route.conditions);
    expect(JSON.stringify(data)).toBe(before);expect(base.led).toBe(false);
  });
  it("calculates real quantities and certainties under unequal comparisons and preserves all general constraints",()=>{
    const data=exampleConfigurator("Finite");data.parameters[2]!.step=1000;
    const conditions=[condition("model","ne","B"),condition("led","eq",true),condition("width","gte",3000),condition("width","lte",4000)];
    const result=calculate(data,{led:true},false,conditions);
    expect(result.enumeration.exhaustive).toBe(true);expect(result.enumeration.solutions).toHaveLength(2);
    expect(result.result.bom.find(r=>r.component==="profile")).toMatchObject({certain:true,quantity:2});
    expect(result.result.bom.find(r=>r.component==="bracket")).toMatchObject({certain:true,quantity:undefined});
    const invalid=calculate(data,{model:"B",led:true,width:3000},false);
    expect(invalid.result.errors.length).toBeGreaterThan(0);expect(invalid.enumeration.solutions).toHaveLength(0);
  });
  it("keeps numeric quantities undefined for ranges and rejects contradictory ranges before claiming a valid result",()=>{
    const data=exampleConfigurator("Free");
    data.rules.push({id:"wide",name:"Largo",enabled:true,match:"all",conditions:[condition("width","gt",3000)],actions:[{...newAction(),component:"profile",quantity:{amount:3,divisor:1,rounding:"none"}}]});
    data.rules.push({id:"narrow",name:"Stretto",enabled:true,match:"all",conditions:[condition("width","lt",2000)],actions:[{...newAction(),component:"power"}]});
    data.rules.push({id:"implied-wide",name:"Intervallo incluso",enabled:true,match:"all",conditions:[condition("width","gte",3000)],actions:[{...newAction(),component:"led-strip"}]});
    const selected=[condition("width","gt",3000)];
    const result=calculate(data,{model:"B",led:false},false,selected);
    expect([...result.result.bom,...result.result.possible].some(r=>r.component==="power")).toBe(false);expect(result.result.bom.find(r=>r.component==="led-strip")?.certain).toBe(true);
    expect(result.enumeration.exhaustive).toBe(false);expect(result.result.bom.find(r=>r.component==="profile")).toMatchObject({certain:true,quantity:3});
    expect(result.result.bom.find(r=>r.component==="bracket")?.quantity).toBeUndefined();
    for(const constraints of [[condition("width","gt",4000),condition("width","lte",4000)],[condition("width","gt",4000),condition("width","lt",3000)],[condition("width","gte",4000),condition("width","lte",4000),condition("width","ne",4000)]])expect(enumerate(data,{},undefined,constraints)).toMatchObject({exhaustive:true,solutions:[]});
    expect(enumerate(data,{width:4000,model:"B",led:false},undefined,[condition("width","gt",3000),condition("width","eq",4000)]).solutions).toHaveLength(1);
  });
  it("retains bounded enumeration and does not call a sample's components certain",()=>{
    const data=exampleConfigurator("Limited");data.parameters[2]!.step=1;
    const result=enumerate(data,{},1,[condition("led","ne",false)]);
    expect(result.examined).toBe(1);expect(result.exhaustive).toBe(false);expect(result.solutions.every(s=>s.selection.led===true)).toBe(true);
    const partial=calculate(exampleConfigurator("Partial"),{},false);
    expect(partial.result.possible.some(r=>r.component==="profile" && !r.certain)).toBe(true);
  });
  it("evaluates negated nested alternatives of a component's master rule under graph restrictions",()=>{
    const data=exampleConfigurator("Nested");data.version=3;
    const first={...data.rules[0]!,conditions:[],expression:{id:"not",type:"not" as const,child:{id:"yes",type:"condition" as const,condition:condition("led","eq",true)}}};
    const second={...data.rules[1]!,match:"any" as const,conditions:[condition("model","eq","A"),condition("led","eq",true)]};
    data.rules=[{id:"master",name:"Regola unica",enabled:true,match:"all",conditions:[],actions:[],componentIds:["profile","power","led-strip"],cases:[first,second]}];
    const no=calculate(data,{model:"B",width:3000},false,[condition("led","ne",true)]);
    expect(no.result.bom.map(r=>r.component)).toEqual(["profile"]);expect(no.result.bom[0]!.quantity).toBe(2);
    const yes=calculate(data,{model:"B",width:3000},false,[condition("led","ne",false)]);
    expect(yes.result.bom.map(r=>r.component)).toEqual(["led-strip","power"]);expect(yes.result.possible).toEqual([]);
  });

});
