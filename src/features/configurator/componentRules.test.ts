import { describe, expect, it } from "vitest";
import { analyze, enumerate, evaluate } from "./engine";
import { componentRule, commitRule, ruleUsesComponent } from "./componentRules";
import { exampleConfigurator, newAction, parseConfigurator } from "./model";
import { buildGraphPaths } from "./graphPaths";

describe("one component rule",()=>{
  it("reopens the same rule and preserves its ID and nested condition tree",()=>{
    const data=exampleConfigurator("Single");
    const opened=componentRule(data,"profile");
    expect(opened.rule?.id).toBe("R1");expect(opened.rule?.conditions).toEqual(data.rules[0]!.conditions);
    const saved=commitRule(data,opened.rule!,opened.source.map(r=>r.id));
    const reopened=componentRule(saved,"profile");
    expect(saved.rules).toHaveLength(data.rules.length);expect(reopened.rule).toEqual(opened.rule);
    expect(parseConfigurator(JSON.stringify(saved))).toEqual(saved);
  });
  it("consolidates overlapping rules with different quantities without losing additive effects or exclusions",()=>{
    const data=exampleConfigurator("Overlap");
    data.rules.push({...data.rules[0]!,id:"extra",name:"Extra LED",conditions:[{parameter:"led",operator:"eq",value:true}],actions:[{...newAction(),component:"profile",quantity:{amount:3,divisor:1,rounding:"none"}}]});
    data.rules.push({...data.rules[0]!,id:"no",name:"No profilo",conditions:[{parameter:"model",operator:"eq",value:"B"}],actions:[{...newAction(),type:"exclude",component:"profile"}]});
    const opened=componentRule(data,"profile");expect(opened.rule?.cases).toHaveLength(3);
    const saved=commitRule(data,opened.rule!,opened.source.map(r=>r.id));
    expect(saved.rules.filter(r=>ruleUsesComponent(r,"profile"))).toHaveLength(1);
    expect(saved.rules.some(r=>r.id==="extra" || r.id==="no")).toBe(false);
    for(const model of ["A","B"])for(const led of [true,false])for(const width of [2000,4500]) {
      const selection={model,led,width},before=evaluate(data,selection),after=evaluate(saved,selection);
      expect(after.bom.map(r=>[r.component,r.quantity]).sort()).toEqual(before.bom.map(r=>[r.component,r.quantity]).sort());
      expect(after.possible.map(r=>[r.component,r.quantity]).sort()).toEqual(before.possible.map(r=>[r.component,r.quantity]).sort());
      expect(after.errors.length>0).toBe(before.errors.length>0);
      expect(after.matched.some(id=>id===opened.rule!.id)).toBe(before.matched.some(id=>opened.source.some(r=>r.id===id)));
    }
    expect(evaluate(saved,{model:"A",led:true,width:3000}).bom.find(r=>r.component==="profile")?.quantity).toBe(5);
    expect(enumerate(saved,{width:3000}).solutions.map(s=>s.selection)).toEqual(enumerate(data,{width:3000}).solutions.map(s=>s.selection));
    expect(parseConfigurator(JSON.stringify(saved))).toEqual(saved);
    expect(analyze(saved).some(i=>i.message.includes("senza azioni"))).toBe(false);
    expect(buildGraphPaths(saved).components.some(c=>c.id==="profile")).toBe(true);
  });
  it("uses a single OR expression for identical actions that cannot overlap",()=>{
    const data=exampleConfigurator("OR");
    data.rules.push({...data.rules[0]!,id:"modelB",conditions:[{parameter:"model",operator:"eq",value:"B"}]});
    const opened=componentRule(data,"profile");
    expect(opened.rule?.cases).toBeUndefined();expect(opened.rule?.expression?.type).toBe("any");
    const saved=commitRule(data,opened.rule!,opened.source.map(r=>r.id));
    for(const model of ["A","B"])expect(evaluate(saved,{model,led:false,width:3000}).bom.find(r=>r.component==="profile")?.quantity).toBe(2);
  });
  it("consolidates shared rules transitively and preserves inactive alternatives and common constraints",()=>{
    const data=exampleConfigurator("Shared");
    data.rules.push({...data.rules[1]!,id:"powerExtra",name:"Extra",enabled:false,actions:[{...newAction(),component:"power"}]});
    const opened=componentRule(data,"led-strip");
    expect(opened.source.map(r=>r.id)).toEqual(["R2","powerExtra"]);
    const saved=commitRule(data,opened.rule!,opened.source.map(r=>r.id));
    expect(saved.rules.filter(r=>ruleUsesComponent(r,"power"))).toHaveLength(1);
    expect(saved.rules.filter(r=>ruleUsesComponent(r,"led-strip"))).toHaveLength(1);
    expect(saved.rules.find(r=>ruleUsesComponent(r,"power"))?.cases?.some(c=>!c.enabled)).toBe(true);
    expect(evaluate(saved,{model:"A",led:true,width:3000}).bom.find(r=>r.component==="power")?.quantity).toBe(1);
    const root=saved.rules.find(r=>ruleUsesComponent(r,"power"))!;
    root.expression={id:"common",type:"condition",condition:{parameter:"model",operator:"eq",value:"B"}};
    expect(evaluate(saved,{model:"A",led:true,width:3000}).bom.some(r=>r.component==="power")).toBe(false);
  });
  it("keeps a parameter constraint associated with its component and rejects malformed version 3 files",()=>{
    const data=exampleConfigurator("Pinned"),draft=componentRule(data,"profile").rule!;
    draft.actions=[{...newAction(),type:"requireValue",parameter:"led",value:true}];
    const saved=commitRule(data,draft);
    expect(componentRule(saved,"profile").rule?.actions[0]?.type).toBe("requireValue");
    expect(buildGraphPaths(saved).components.some(c=>c.id==="profile")).toBe(true);
    expect(parseConfigurator(JSON.stringify(saved))).toEqual(saved);
    const invalid=structuredClone(saved);invalid.version=2;
    expect(()=>parseConfigurator(JSON.stringify(invalid))).toThrow("versione 3");
    invalid.version=3;invalid.rules[0]!.cases=[{...data.rules[0]!,id:"duplicate"},{...data.rules[0]!,id:"duplicate"}];
    expect(()=>parseConfigurator(JSON.stringify(invalid))).toThrow("Alternative");
  });
});
