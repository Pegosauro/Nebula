import { describe, expect, it } from "vitest";
import { analyze, domain, enumerate, evaluate, summarize } from "./engine";
import { emptyConfigurator, exampleConfigurator, newAction, parseConfigurator } from "./model";

describe("configurator engine",()=>{
  it("resolves certain components, open alternatives and calculated BOM",()=>{
    const d=exampleConfigurator("Pergola");
    const partial=evaluate(d,{model:"A",led:true});
    expect(partial.bom.map(r=>r.component)).toEqual(["profile","led-strip","power","bracket"]);
    expect(partial.bom.find(r=>r.component==="bracket")?.quantity).toBeUndefined();
    const complete=evaluate(d,{model:"A",led:true,width:4500});
    expect(complete.errors).toEqual([]);
    expect(complete.bom.find(r=>r.component==="bracket")?.quantity).toBe(5);
    expect(complete.bom.find(r=>r.component==="profile")?.quantity).toBe(2);
    expect(complete.bom.find(r=>r.component==="power")?.reasons).toEqual(["R2"]);
  });
  it("does not activate a not-equal condition on an unset parameter",()=>{
    const d=exampleConfigurator("Test"); d.rules[0]!.conditions[0]!.operator="ne";
    expect(evaluate(d,{}).bom.some(r=>r.component==="profile")).toBe(false);
    expect(evaluate(d,{}).possible.some(r=>r.component==="profile")).toBe(true);
  });
  it("filters forbidden LED values and enumerates every finite variant",()=>{
    const d=exampleConfigurator("Test");
    expect(evaluate(d,{model:"B",led:true,width:3000}).errors.join()).toContain("non può essere Sì");
    const variants=enumerate(d,{width:3000});
    expect(variants.exhaustive).toBe(true); expect(variants.examined).toBe(4); expect(variants.solutions).toHaveLength(3);
    expect(variants.solutions.every(s=>s.selection.model!=="B" || s.selection.led===false)).toBe(true);
  });
  it("declares free numeric domains and enumeration caps as incomplete",()=>{
    const d=exampleConfigurator("Test");
    expect(enumerate(d).exhaustive).toBe(false); expect(enumerate(d).examined).toBe(0);
    d.parameters[2]!.step=1000;
    expect(domain(d.parameters[2]!)).toEqual([2000,3000,4000,5000,6000]);
    expect(enumerate(d).solutions).toHaveLength(15);
    expect(enumerate(d,{},3).exhaustive).toBe(false);
  });
  it("sums multiple inclusion quantities and reports inclusion/exclusion conflicts",()=>{
    const d=exampleConfigurator("Test");
    d.rules.push({...d.rules[0]!,id:"extra",name:"Extra",actions:[{...newAction(),component:"profile"}]});
    expect(evaluate(d,{model:"A"}).bom.find(r=>r.component==="profile")?.quantity).toBe(3);
    d.rules.push({id:"exclude",name:"No profilo",enabled:true,match:"all",conditions:[],actions:[{...newAction(),type:"exclude",component:"profile"}]});
    expect(evaluate(d,{model:"A"}).errors.join()).toContain("richiesto ed escluso");
    expect(enumerate(d,{width:3000}).solutions).toHaveLength(1);
  });
  it("never claims a component is certain when a pending rule may exclude it",()=>{
    const d=exampleConfigurator("Test");
    d.rules.push({id:"exclude",name:"No profilo LED",enabled:true,match:"all",conditions:[{parameter:"led",operator:"eq",value:true}],actions:[{...newAction(),type:"exclude",component:"profile"}]});
    const r=evaluate(d,{model:"A"});
    expect(r.bom.some(row=>row.component==="profile")).toBe(false); expect(r.possible.some(row=>row.component==="profile")).toBe(true);
    const precise=summarize(d,{model:"A",width:3000},enumerate(d,{model:"A",width:3000}));
    expect(precise.bom.some(row=>row.component==="profile")).toBe(true);
    expect(precise.possible.some(row=>row.component==="power")).toBe(false);
  });
  it("enforces required values, component requirements and exclusive alternatives",()=>{
    const d=exampleConfigurator("Test");
    d.rules.push({id:"req",name:"Richieste",enabled:true,match:"all",conditions:[],actions:[{...newAction(),type:"requireValue",parameter:"model",value:"A"},{...newAction(),type:"requireComponent",component:"power"},{...newAction(),type:"oneOf",components:["profile","led-strip"]}]});
    expect(enumerate(d,{width:3000}).solutions).toHaveLength(0);
    d.rules[4]!.actions.pop();
    expect(enumerate(d,{width:3000}).solutions).toHaveLength(1);
  });
  it("reports contradictory required values even before choices are made",()=>{
    const d=exampleConfigurator("Test");
    d.rules.push({id:"req",name:"Contraddizione",enabled:true,match:"all",conditions:[],actions:[{...newAction(),type:"requireValue",parameter:"model",value:"A"},{...newAction(),type:"requireValue",parameter:"model",value:"B"}]});
    expect(evaluate(d,{}).errors.join()).toContain("obbligatori incompatibili");
  });
  it("supports OR and numerical intervals with fractional quantities",()=>{
    const d=exampleConfigurator("Test");
    d.rules[0]!.match="any";d.rules[0]!.conditions.push({parameter:"width",operator:"gt",value:4000});
    expect(evaluate(d,{model:"B",led:false,width:5000}).bom.some(r=>r.component==="profile")).toBe(true);
    d.rules[0]!.match="all";d.rules[0]!.conditions=[{parameter:"width",operator:"gte",value:3000},{parameter:"width",operator:"lte",value:4000}];
    expect(evaluate(d,{width:3500}).bom.some(r=>r.component==="profile")).toBe(true);
    expect(evaluate(d,{width:4500}).bom.some(r=>r.component==="profile")).toBe(false);
  });
  it("flags invalid references, duplicate codes and duplicate rules",()=>{
    const d=exampleConfigurator("Test");
    d.rules.push({...d.rules[0]!,id:"dup"});d.components[1]!.code="PR001";d.rules[0]!.actions[0]!.component="missing";
    const issues=analyze(d).map(i=>i.message).join();
    expect(issues).toContain("Codice duplicato");expect(issues).toContain("componente dell'azione mancante");
    d.rules[4]!.actions[0]!.component="missing";
    expect(analyze(d).some(i=>i.message.includes("regola duplicata"))).toBe(true);
  });
  it("rejects out-of-range or off-step numeric choices",()=>{
    const d=exampleConfigurator("Test");d.parameters[2]!.step=500;
    expect(evaluate(d,{width:1000}).errors).toHaveLength(1);
    expect(evaluate(d,{width:2250}).errors).toHaveLength(1);
    expect(evaluate(d,{width:2500}).errors).toHaveLength(0);
  });
  it("round-trips structured files and rejects invalid schemas",()=>{
    const d=exampleConfigurator("Test");expect(parseConfigurator(JSON.stringify(d))).toEqual(d);
    expect(()=>parseConfigurator('{"version":99}')).toThrow();
    d.rules[0]!.conditions[0]!.value=NaN;
    expect(()=>parseConfigurator(JSON.stringify(d))).toThrow();
    expect(enumerate(emptyConfigurator("Empty")).solutions).toHaveLength(1);
  });
});
