import { describe, expect, it } from "vitest";
import type { ConditionNode, Configurator } from "./model";
import { emptyConfigurator, newAction, parseConfigurator } from "./model";
import { analyze, enumerate, evaluate, optionAvailability, optionRuleProblems } from "./engine";
import { calculate } from "./calculation";
import { commitRule } from "./componentRules";

const model=(value="TELO"):ConditionNode=>({id:"model",type:"condition",condition:{parameter:"model",operator:"eq",value}});
function fixture():Configurator {
  return {...emptyConfigurator("Telo"),version:4,parameters:[
    {id:"model",name:"MODELLO",type:"choice",values:["TELO","ALTRO"],unit:""},
    {id:"telo",name:"TELO",type:"boolean",values:[],unit:"",optionRules:[{value:true,enabled:true,expression:model()}]},
  ],components:[{id:"sheet",code:"T001",name:"Telo",group:"Teli",unit:"pz",note:""}],rules:[
    {id:"include",name:"Inclusione telo",enabled:true,match:"all",conditions:[{parameter:"telo",operator:"eq",value:true}],actions:[{...newAction(),component:"sheet"}]},
  ]};
}
describe("option eligibility conditions",()=>{
  it("keeps the guarded value open until an explicit prerequisite contradicts it and keeps false independent",()=>{
    const data=fixture(),telo=data.parameters[1]!;
    expect(optionAvailability(data,telo,true,{})).toMatchObject({allowed:true,pending:true});
    expect(optionAvailability(data,telo,true,{model:"ALTRO"})).toMatchObject({allowed:false,pending:false});
    expect(optionAvailability(data,telo,true,{model:"TELO"}).allowed).toBe(true);
    expect(optionAvailability(data,telo,false,{}).allowed).toBe(true);
    expect(evaluate(data,{telo:true}).pending.join()).toContain("selezionabile solo se");
    expect(evaluate(data,{telo:true,model:"ALTRO"}).errors.join()).toContain("selezionabile solo se");
  });
  it("filters full variants and graph comparisons without treating an unselected prerequisite as false",()=>{
    const data=fixture();
    expect(enumerate(data).solutions.map(s=>s.selection)).toEqual([{model:"TELO",telo:true},{model:"TELO",telo:false},{model:"ALTRO",telo:false}]);
    expect(calculate(data,{model:"ALTRO"},false).result.bom).toEqual([]);
    const selected=calculate(data,{telo:true},false,[{parameter:"model",operator:"eq",value:"TELO"}]);
    expect(selected.result.bom[0]).toMatchObject({component:"sheet",quantity:1,certain:true});
    expect(calculate(data,{telo:true},false,[{parameter:"model",operator:"ne",value:"TELO"}]).enumeration.solutions).toEqual([]);
    data.parameters[1]!.optionRules![0]!.expression={id:"not",type:"not",child:model("ALTRO")};
    expect(optionAvailability(data,data.parameters[1]!,true,{}).allowed).toBe(true);
    expect(optionAvailability(data,data.parameters[1]!,true,{model:"TELO"}).allowed).toBe(true);
  });
  it("supports nested E/O/NON, disabled rules and numeric zero with typed domains",()=>{
    const data=fixture();data.parameters.push({id:"size",name:"Misura",type:"number",values:[],min:0,max:2,step:1,unit:""});
    const expression:ConditionNode={id:"all",type:"all",children:[model(),{id:"any",type:"any",children:[
      {id:"not",type:"not",child:{id:"size1",type:"condition",condition:{parameter:"size",operator:"eq",value:1}}},
      {id:"size2",type:"condition",condition:{parameter:"size",operator:"gte",value:2}},
    ]}]};
    data.parameters[1]!.optionRules![0]!.expression=expression;
    expect(optionRuleProblems(data,data.parameters[1]!)).toEqual([]);
    expect(optionAvailability(data,data.parameters[1]!,true,{model:"TELO"}).allowed).toBe(true);
    expect(optionAvailability(data,data.parameters[1]!,true,{model:"TELO",size:0}).allowed).toBe(true);
    expect(optionAvailability(data,data.parameters[1]!,true,{model:"TELO",size:1}).allowed).toBe(false);
    data.parameters[2]!.optionRules=[{value:0,enabled:true,expression:model()}];
    expect(optionAvailability(data,data.parameters[2]!,0,{}).allowed).toBe(true);
    expect(optionAvailability(data,data.parameters[2]!,1,{}).allowed).toBe(true);
    data.parameters[1]!.optionRules![0]!.enabled=false;
    expect(optionAvailability(data,data.parameters[1]!,true,{}).allowed).toBe(true);
  });
  it("persists the nested condition in format 4, preserves it during component edits and rejects malformed files",()=>{
    const data=fixture(),restored=parseConfigurator(JSON.stringify(data));
    expect(restored).toEqual(data);
    expect(commitRule(restored,{...restored.rules[0]!,name:"Updated"}).version).toBe(4);
    expect(parseConfigurator(JSON.stringify(commitRule(restored,restored.rules[0]!))).parameters).toEqual(data.parameters);
    expect(()=>parseConfigurator(JSON.stringify({...data,version:3}))).toThrow("versione 4");
    for(const optionRules of [null,{},[{value:true,enabled:"yes",expression:model()}],[{value:true,enabled:true}],Array(2).fill({value:true,enabled:true,expression:model()})]){
      const invalid=structuredClone(data);Object.assign(invalid.parameters[1]!,{optionRules});
      expect(()=>parseConfigurator(JSON.stringify(invalid))).toThrow("selezionabilità");
    }
  });
  it("reports self references, missing parameters, empty scopes and removed values",()=>{
    const data=fixture(),p=data.parameters[1]!,rule=p.optionRules![0]!;
    rule.expression={id:"self",type:"condition",condition:{parameter:"telo",operator:"eq",value:true}};
    expect(analyze(data).map(i=>i.message).join()).toContain("altro parametro");
    rule.expression=model();data.parameters=data.parameters.filter(p=>p.id!=="model");
    expect(optionRuleProblems(data,p).join()).toContain("parametro della condizione mancante");
    rule.expression={id:"empty",type:"any",children:[]};
    expect(optionRuleProblems(data,p).join()).toContain("Gruppo vuoto");
    Object.assign(rule,{value:"gone",enabled:false});
    expect(optionRuleProblems(data,p).join()).toContain("valore non più presente");
  });
});
