import { describe, expect, it } from "vitest";
import { duplicateComponent } from "./duplicateComponent";
import { componentRule, commitRule } from "./componentRules";
import { analyze, evaluate } from "./engine";
import { conditionsOf } from "./expressions";
import { exampleConfigurator, newAction, parseConfigurator, type ConditionNode, type Rule } from "./model";

const choice={model:"A",led:true,width:3000};
const rows=(data:ReturnType<typeof exampleConfigurator>)=>evaluate(data,choice).bom;
const expressionIds=(node?:ConditionNode):string[]=>!node ? [] : [node.id,...(node.type==="condition" ? [] : node.type==="not" ? expressionIds(node.child) : node.children.flatMap(expressionIds))];
describe("duplicate a configurator component",()=>{
  it("copies all component data and regenerates identifiers without sharing mutable definitions",()=>{
    const data=exampleConfigurator("Copy");data.version=8;
    data.parameters.push({id:"material",name:"Materiale",type:"text",values:["PVC"],allowCustom:true,unit:""});
    Object.assign(data.components[0]!,{family:"PROFILI",note:"Schede/PR001.md",dimensions:[{id:"L",name:"Larghezza",parameter:"width",offset:-1,unit:"cm"}],properties:[{id:"mat",name:"Materiale",parameter:"material",value:"Alluminio"}]});
    const before=structuredClone(data),copy=duplicateComponent(data,"profile");
    expect(data).toEqual(before);expect(copy.data.version).toBe(8);expect(copy.data.components[1]).toEqual(copy.component);
    expect(copy.component).toMatchObject({code:"PR001-COPIA",name:"Profilo laterale (copia)",family:"PROFILI",group:"Profili",note:"Schede/PR001.md",unit:"pz"});
    expect(copy.component.id).not.toBe("profile");expect(copy.component.dimensions![0]!.id).not.toBe("L");expect(copy.component.properties![0]!.id).not.toBe("mat");
    expect(rows(copy.data).find(r=>r.component===copy.component.id)).toMatchObject({quantity:2,dimensions:[{value:299}],properties:[{value:"Alluminio"}]});
    copy.component.dimensions![0]!.offset=-9;copy.component.properties![0]!.value="PVC";
    expect(data.components[0]!.dimensions![0]!.offset).toBe(-1);expect(data.components[0]!.properties![0]!.value).toBe("Alluminio");
    expect(parseConfigurator(JSON.stringify(copy.data))).toEqual(copy.data);
  });
  it("copies shared component rules without adding other components twice and allows independent edits",()=>{
    const data=exampleConfigurator("Shared"),before=structuredClone(data),copy=duplicateComponent(data,"led-strip");
    expect(rows(copy.data).find(r=>r.component==="power")!.quantity).toBe(1);
    expect(rows(copy.data).find(r=>r.component==="led-strip")!.quantity).toBe(1);
    expect(rows(copy.data).find(r=>r.component===copy.component.id)!.quantity).toBe(1);
    const owned=componentRule(copy.data,copy.component.id);expect(owned.source).toHaveLength(1);
    const draft=structuredClone(owned.rule!);draft.actions[0]!.quantity.amount=7;
    const edited=commitRule(copy.data,draft,owned.source.map(r=>r.id));
    expect(rows(edited).find(r=>r.component===copy.component.id)!.quantity).toBe(7);
    expect(rows(edited).find(r=>r.component==="led-strip")!.quantity).toBe(1);expect(rows(edited).find(r=>r.component==="power")!.quantity).toBe(1);
    expect(edited.rules.filter(r=>before.rules.some(old=>old.id===r.id))).toEqual(before.rules);
  });
  it("preserves nested conditions, common constraints, additive alternatives and disabled branches",()=>{
    const data=exampleConfigurator("Nested");data.version=3;
    const rule:Rule={id:"nested",name:"Profilo",enabled:true,match:"all",conditions:[],componentIds:["profile","bracket"],expression:{id:"root",type:"not",child:{id:"eqB",type:"condition",condition:{parameter:"model",operator:"eq",value:"B"}}},actions:[{...newAction(),type:"requireValue",parameter:"led",value:true}],cases:[
      {id:"yes",name:"Due profili",enabled:true,match:"all",conditions:[{parameter:"led",operator:"eq",value:true}],actions:[{...newAction(),component:"profile",quantity:{amount:2,divisor:1,rounding:"none"}},{...newAction(),component:"bracket"}]},
      {id:"extra",name:"Tre extra",enabled:true,match:"all",conditions:[],actions:[{...newAction(),component:"profile",quantity:{amount:3,divisor:1,rounding:"none"}}]},
      {id:"disabled",name:"Disattiva",enabled:false,match:"all",conditions:[],actions:[{...newAction(),component:"profile",quantity:{amount:100,divisor:1,rounding:"none"}}]},
      {id:"other",name:"Solo altro",enabled:true,match:"all",conditions:[],actions:[{...newAction(),component:"bracket"}]},
    ]};
    data.rules=[rule];const copy=duplicateComponent(data,"profile"),cloned=copy.data.rules[1]!;
    expect(cloned.cases).toHaveLength(3);expect(cloned.cases!.find(c=>c.name==="Disattiva")!.enabled).toBe(false);
    expect(expressionIds(cloned.expression).some(id=>expressionIds(rule.expression).includes(id))).toBe(false);
    expect(cloned.cases!.every(c=>!rule.cases!.some(old=>old.id===c.id))).toBe(true);
    expect(conditionsOf(cloned.expression!)).toEqual(conditionsOf(rule.expression!));
    for(const model of ["A","B"])for(const led of [true,false]){
      const selected={...choice,model,led},before=evaluate(data,selected),after=evaluate(copy.data,selected);
      expect(after.bom.filter(r=>r.component!==copy.component.id).map(r=>[r.component,r.quantity])).toEqual(before.bom.map(r=>[r.component,r.quantity]));
      expect(after.bom.find(r=>r.component===copy.component.id)?.quantity).toBe(before.bom.find(r=>r.component==="profile")?.quantity);
    }
    expect(rows(copy.data).find(r=>r.component===copy.component.id)!.quantity).toBe(5);
    expect(parseConfigurator(JSON.stringify(copy.data))).toEqual(copy.data);expect(analyze(copy.data).filter(i=>i.severity==="error")).toEqual([]);
  });
  it("remaps exclusions and component constraints while preserving shared dependency references",()=>{
    const data=exampleConfigurator("Constraints");data.version=3;
    data.rules.push({id:"constraints",name:"Dipendenze",enabled:false,match:"all",conditions:[],componentIds:["profile"],actions:[{...newAction(),type:"exclude",component:"profile"},{...newAction(),type:"requireComponent",component:"power"},{...newAction(),type:"oneOf",components:["profile","power"]}]});
    const copy=duplicateComponent(data,"profile"),cloned=copy.data.rules.at(-1)!;
    const actions=[...cloned.actions,...(cloned.cases?.flatMap(c=>c.actions) ?? [])];
    expect(actions.some(a=>a.type==="exclude" && a.component===copy.component.id)).toBe(true);
    expect(actions.some(a=>a.type==="requireComponent" && a.component==="power")).toBe(true);
    expect(actions.some(a=>a.type==="oneOf" && a.components.includes(copy.component.id) && a.components.includes("power") && !a.components.includes("profile"))).toBe(true);
    expect(data.rules.at(-1)!.actions[0]!.component).toBe("profile");
  });
  it("keeps copied codes unique with case-insensitive comparisons and supports components without rules",()=>{
    const data=exampleConfigurator("Codes");data.rules=[];
    data.components[1]!.code=" pr001-copia ";data.components[2]!.code="PR001-COPIA-2";
    const first=duplicateComponent(data,"profile"),second=duplicateComponent(first.data,"profile");
    expect(first.component.code).toBe("PR001-COPIA-3");expect(second.component.code).toBe("PR001-COPIA-4");
    expect(first.data.rules).toEqual([]);expect(first.data.version).toBe(1);expect(parseConfigurator(JSON.stringify(first.data))).toEqual(first.data);
    expect(()=>duplicateComponent(data,"missing")).toThrow("non trovato");
  });
});
