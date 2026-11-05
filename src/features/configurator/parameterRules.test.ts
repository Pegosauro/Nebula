import { describe, expect, it } from "vitest";
import { newParameterRule, parameterRuleProblems, parameterRules, parameterRuleSummary } from "./parameterRules";
import { analyze, evaluate } from "./engine";
import { calculate } from "./calculation";
import { commitRule } from "./componentRules";
import { exampleConfigurator, newAction, parseConfigurator } from "./model";

describe("parameter constraints",()=>{
  it("discovers legacy constraints from both involved parameters without pulling in component rules",()=>{
    const data=exampleConfigurator("Old");
    expect(parameterRules(data,"model").map(r=>r.id)).toEqual(["R3"]);
    expect(parameterRules(data,"led").map(r=>r.id)).toEqual(["R3"]);
    expect(parameterRules(data,"width")).toEqual([]);
    expect(parameterRuleSummary(data.rules[2]!,data)).toContain("Escludi LED: Sì");
  });
  it("saves an explicit association even after condition changes, preserving component rules and older files",()=>{
    const data=exampleConfigurator("New"), before=structuredClone(data.rules);
    const draft=newParameterRule(data,data.parameters[1]!);
    expect(draft.conditions[0]).toEqual({parameter:"led",operator:"eq",value:true});
    draft.conditions=[{parameter:"model",operator:"eq",value:"A"}];
    draft.actions=[{...newAction(),type:"requireValue",parameter:"width",value:3000}];
    const saved=commitRule(data,draft), restored=parseConfigurator(JSON.stringify(saved));
    expect(restored.version).toBe(3);expect(restored.rules.slice(0,before.length)).toEqual(before);
    expect(parameterRules(restored,"led").some(r=>r.id===draft.id)).toBe(true);
    expect(parameterRules(restored,"model").some(r=>r.id===draft.id)).toBe(true);
    expect(data.rules).toEqual(before);
    expect(parseConfigurator(JSON.stringify(data))).toEqual(data);
  });
  it("uses nested E/O/NON exclusions and requirements in BOM and graph calculations",()=>{
    const data=exampleConfigurator("Nested");data.rules=data.rules.filter(r=>r.id!=="R3");data.parameters[2]!.step=1000;
    const draft=newParameterRule(data,data.parameters[1]!);
    draft.expression={id:"all",type:"all",children:[
      {id:"led",type:"condition",condition:{parameter:"led",operator:"eq",value:true}},
      {id:"any",type:"any",children:[
        {id:"not",type:"not",child:{id:"not-a",type:"condition",condition:{parameter:"model",operator:"eq",value:"A"}}},
        {id:"wide",type:"condition",condition:{parameter:"width",operator:"gte",value:4000}},
      ]},
    ]};
    draft.actions=[{...newAction(),type:"excludeValue",parameter:"model",value:"B"},{...newAction(),type:"requireValue",parameter:"width",value:4000}];
    const saved=commitRule(data,draft);expect(parameterRuleProblems(saved,draft)).toEqual([]);
    expect(evaluate(saved,{led:true,model:"B",width:4000}).errors.join()).toContain("non può essere B");
    expect(evaluate(saved,{led:true,model:"A",width:5000}).errors.join()).toContain("deve essere 4000");
    const result=calculate(saved,{},false,[{parameter:"led",operator:"eq",value:true}]);
    expect(result.enumeration.exhaustive).toBe(true);expect(result.enumeration.solutions).toHaveLength(3);
    expect(result.enumeration.solutions.every(s=>s.selection.model==="A")).toBe(true);
    saved.rules.find(r=>r.id===draft.id)!.enabled=false;
    expect(calculate(saved,{},false,[{parameter:"led",operator:"eq",value:true}]).enumeration.solutions).toHaveLength(10);
  });
  it("rejects broken ownership and invalid typed targets, and reports deleted owners",()=>{
    const data=exampleConfigurator("Invalid"), draft=newParameterRule(data,data.parameters[0]!);
    data.rules.push(draft);data.version=3;
    for(const parameterIds of [null,[],[1],[""],["model","model"]]){
      const invalid=structuredClone(data);Object.assign(invalid.rules.at(-1)!,{parameterIds});
      expect(()=>parseConfigurator(JSON.stringify(invalid))).toThrow("Associazioni dei parametri");
    }
    expect(()=>parseConfigurator(JSON.stringify({...data,version:2}))).toThrow("versione 3");
    draft.actions[0]!.value="wrong type";
    expect(parameterRuleProblems(data,draft).join()).toContain("vincolo su parametro non valido");
    draft.parameterIds=["missing"];
    expect(analyze(data).map(i=>i.message).join()).toContain("parametro associato mancante");
  });
});
