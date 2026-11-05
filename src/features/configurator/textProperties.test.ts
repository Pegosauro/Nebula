import { describe, expect, it } from "vitest";
import { acceptsParameterValue, exampleConfigurator, newAction, parseConfigurator, type Configurator } from "./model";
import { analyze, domain, enumerate, evaluate, parameterNeedsInput } from "./engine";
import { calculate } from "./calculation";
import { componentProperties, propertyProblems } from "./componentProperties";
import { removalDependencies, ruleActionProblems } from "./definitionValidation";
import { measureProblems } from "./componentMeasure";
import { bomCsv } from "./ConfiguratorResults";
import { commitRule } from "./componentRules";
import { buildGraphPaths } from "./graphPaths";

function fixture():Configurator {
  const data=exampleConfigurator("Proprietà");data.version=7;
  Object.assign(data.parameters[2]!,{unit:"cm",min:300,max:500,step:100});
  data.parameters.push({id:"material",name:"Materiale",type:"text",values:[],unit:""});
  data.components[0]!.measure={parameter:"width",offset:-1,unit:"cm"};
  data.components[0]!.properties=[{id:"material-property",name:"Materiale",parameter:"material"}];
  return data;
}
const selection={model:"A",led:false,width:300};
describe("text parameters and component properties",()=>{
  it("accepts arbitrary strings without creating a finite numeric or choice domain",()=>{
    const p=fixture().parameters[3]!;
    expect(acceptsParameterValue(p,'PVC 650; "bianco" / è')).toBe(true);
    expect(acceptsParameterValue(p,42)).toBe(false);expect(acceptsParameterValue(p,false)).toBe(false);
    expect(domain({...p,min:0,max:4,step:1,values:["old"]})).toBeUndefined();
  });
  it("keeps empty metadata optional for enumeration and does not alter dimensions, quantities or accessory rows",()=>{
    const data=fixture(),result=calculate(data,selection,false);
    expect(result.issues.filter(i=>i.severity==="error")).toEqual([]);
    expect(result.enumeration.exhaustive).toBe(true);expect(result.enumeration.solutions).toHaveLength(1);
    expect(parameterNeedsInput(data,data.parameters[3]!)).toBe(false);
    expect(result.result.bom.find(r=>r.component==="profile")).toMatchObject({quantity:2,measure:299,properties:[{id:"material-property",value:undefined}]});
    const withText=calculate(data,{...selection,material:"PVC 650"},false);
    expect(withText.result.bom.find(r=>r.component==="profile")).toMatchObject({quantity:2,measure:299,properties:[{id:"material-property",value:"PVC 650"}]});
    expect(withText.result.bom.find(r=>r.component==="bracket")).not.toHaveProperty("properties");
    expect(withText.enumeration.solutions[0]!.selection.material).toBe("PVC 650");
    const open=calculate(data,{model:"A",led:false,material:"PVC"},false);
    expect(open.enumeration.solutions).toHaveLength(3);expect(open.result.bom.find(r=>r.component==="profile")!.properties).toEqual([{id:"material-property",value:"PVC"}]);
  });
  it("supports equality and inequality rules and leaves an unresolved text domain open",()=>{
    const data=fixture();data.rules[0]!.conditions=[{parameter:"material",operator:"eq",value:"PVC"}];
    expect(analyze(data).filter(i=>i.severity==="error")).toEqual([]);
    expect(parameterNeedsInput(data,data.parameters[3]!)).toBe(true);
    const pending=enumerate(data,selection);expect(pending.exhaustive).toBe(false);expect(pending.reason).toContain("parametri di testo");
    expect(evaluate(data,{...selection,material:"PVC"}).bom.some(r=>r.component==="profile")).toBe(true);
    expect(evaluate(data,{...selection,material:"pvc"}).bom.some(r=>r.component==="profile")).toBe(false);
    data.rules[0]!.conditions[0]!.operator="ne";
    expect(evaluate(data,{...selection,material:"Poliestere"}).bom.some(r=>r.component==="profile")).toBe(true);
    data.rules[0]!.conditions[0]!.operator="gt";expect(analyze(data).map(i=>i.message).join()).toContain("condizione non valida per Materiale");
  });
  it("propagates text required by a rule, checks exclusions and permits conditions on a literal text option",()=>{
    const data=fixture();data.rules.push({id:"material-rule",name:"Materiale automatico",enabled:true,match:"all",conditions:[],actions:[{...newAction(),type:"requireValue",parameter:"material",value:"PVC"}]});
    expect(ruleActionProblems(data,data.rules.at(-1)!)).toEqual([]);
    expect(calculate(data,selection,false).result.bom.find(r=>r.component==="profile")!.properties).toEqual([{id:"material-property",value:"PVC"}]);
    expect(evaluate(data,{...selection,material:"Altro"}).errors.join()).toContain("deve essere PVC");
    data.rules.at(-1)!.actions[0]!.type="excludeValue";
    expect(evaluate(data,{...selection,material:"PVC"}).errors.join()).toContain("non può essere PVC");
    data.rules.pop();data.parameters[3]!.optionRules=[{value:"PVC",enabled:true,expression:{id:"model",type:"condition",condition:{parameter:"model",operator:"eq",value:"A"}}}];
    expect(evaluate(data,{...selection,model:"B",material:"PVC"}).errors.join()).toContain("selezionabile solo se");
  });
  it("keeps text graph conditions and detects contradictory text selections",()=>{
    const data=fixture();data.rules[0]!.conditions=[{parameter:"material",operator:"eq",value:"PVC"}];
    expect(buildGraphPaths(data).routes.some(r=>r.conditions.some(c=>c.parameter==="material" && c.value==="PVC"))).toBe(true);
    const selected=calculate(data,selection,false,[{parameter:"material",operator:"eq",value:"PVC"}]);
    expect(selected.enumeration.exhaustive).toBe(true);expect(selected.result.bom.find(r=>r.component==="profile")!.properties).toEqual([{id:"material-property",value:"PVC"}]);
    expect(calculate(data,selection,false,[{parameter:"material",operator:"eq",value:"PVC"},{parameter:"material",operator:"ne",value:"PVC"}]).enumeration.solutions).toHaveLength(0);
  });
  it("validates property sources and unique names, includes deletion dependencies and rejects text for numeric formulas",()=>{
    const data=fixture(),c=data.components[0]!;
    expect(removalDependencies(data,"material","parameter")).toContain("Proprietà: PR001");
    expect(analyze(data).some(i=>i.message.includes("Materiale: parametro senza effetto"))).toBe(false);
    c.properties!.push({id:"duplicate",name:" materiale ",parameter:"material"});expect(propertyProblems(data,c).join()).toContain("già usato");
    c.properties!.pop();data.parameters[3]!.type="number";expect(analyze(data).map(i=>i.message).join()).toContain("scegli un parametro di testo");
    data.parameters[3]!.type="text";c.properties![0]!.parameter="missing";expect(propertyProblems(data,c).join()).toContain("parametro di testo");
    c.measure!.parameter="material";expect(measureProblems(data,c).join()).toContain("parametro numerico");
    data.rules[0]!.actions[0]!.quantity.parameter="material";expect(analyze(data).map(i=>i.message).join()).toContain("quantità o parametro numerico");
  });
  it("persists format 7, preserves earlier formats and rejects malformed property definitions",()=>{
    const data=fixture();expect(parseConfigurator(JSON.stringify(data))).toEqual(data);expect(commitRule(data,data.rules[0]!).version).toBe(7);
    expect(()=>parseConfigurator(JSON.stringify({...data,version:6}))).toThrow("versione 7");
    for(const properties of [null,{},[null],[{}],[{id:"a",name:"A",parameter:4}],[{id:"",name:"A",parameter:"material"}],Array(33).fill(data.components[0]!.properties![0]),[data.components[0]!.properties![0],data.components[0]!.properties![0]]]){
      const bad=structuredClone(data);Object.assign(bad.components[0]!,{properties});expect(()=>parseConfigurator(JSON.stringify(bad))).toThrow("Proprietà del componente");
    }
    const old=exampleConfigurator("Vecchio");old.version=6;const text=JSON.stringify(old);expect(JSON.stringify(parseConfigurator(text))).toBe(text);
  });
  it("exports quoted text properties in dedicated columns and leaves unassigned properties empty",()=>{
    const data=fixture(),value='PVC; "Bianco"\nLotto 7',result=evaluate(data,{...selection,material:value}),text=bomCsv(data,result.bom);
    expect(text).toContain('"Proprietà: Materiale"');expect(text).toContain('"PVC; ""Bianco""\nLotto 7"');
    expect(componentProperties(data.components[0]!,{material:"<b>PVC</b>"})[0]!.value).toBe("<b>PVC</b>");
    expect(bomCsv(data,evaluate(data,selection).bom).split("\r\n").find(line=>line.includes('"PR001"'))).toMatch(/;"299";"cm";""$/);
    expect(text.split("\r\n").find(line=>line.includes('"ST001"'))).toMatch(/;"";"";""$/);
  });
});

describe("text presets and independent component values",()=>{
  it("offers finite presets when custom text is disabled and rejects values outside the list",()=>{
    const data=fixture();data.version=8;Object.assign(data.parameters[3]!,{values:["PVC","Acrilico"],allowCustom:false});
    expect(domain(data.parameters[3]!)).toEqual(["PVC","Acrilico"]);
    expect(acceptsParameterValue(data.parameters[3]!,"Altro")).toBe(false);
    expect(evaluate(data,{...selection,material:"Altro"}).errors.join()).toContain("fuori dal dominio");
    expect(evaluate(data,{...selection,material:"PVC"}).errors).toEqual([]);
    expect(calculate(data,selection,false).enumeration.solutions).toHaveLength(1);
    data.parameters[3]!.allowCustom=true;expect(domain(data.parameters[3]!)).toBeUndefined();
    expect(evaluate(data,{...selection,material:"Altro"}).errors).toEqual([]);
  });
  it("enumerates closed text domains used by rules and validates empty or duplicate option lists",()=>{
    const data=fixture();data.version=8;Object.assign(data.parameters[3]!,{values:["PVC","Acrilico"],allowCustom:false});
    data.rules[0]!.conditions=[{parameter:"material",operator:"eq",value:"PVC"}];
    const result=calculate(data,selection,false);expect(result.enumeration.exhaustive).toBe(true);expect(result.enumeration.solutions).toHaveLength(2);
    expect(result.result.possible.find(r=>r.component==="profile")!.properties).toEqual([{id:"material-property",value:"PVC"}]);
    data.parameters[3]!.values=[];expect(analyze(data).some(i=>i.severity==="error")).toBe(true);
    data.parameters[3]!.values=["PVC"," PVC "];expect(analyze(data).map(i=>i.message).join()).toContain("scelte uniche");
  });
  it("lets one component override a closed BOM parameter without changing other components or quantities",()=>{
    const data=fixture();data.version=8;Object.assign(data.parameters[3]!,{values:["PVC","Acrilico"],allowCustom:false});
    data.components[0]!.properties![0]!.value="Alluminio speciale";
    data.components[3]!.properties=[{id:"bracket-material",name:"Materiale",parameter:"material"}];
    expect(propertyProblems(data,data.components[0]!)).toEqual([]);
    for(const material of ["PVC","Acrilico"]){
      const result=calculate(data,{...selection,material},false);
      expect(result.result.bom.find(r=>r.component==="profile")).toMatchObject({quantity:2,measure:299,properties:[{value:"Alluminio speciale"}]});
      expect(result.result.bom.find(r=>r.component==="bracket")!.properties).toEqual([{id:"bracket-material",value:material}]);
      const text=bomCsv(data,result.result.bom);expect(text.split("\r\n").find(l=>l.includes('"PR001"'))).toMatch(/;"Alluminio speciale"$/);
    }
    data.components[0]!.properties![0]!.value=" ";expect(propertyProblems(data,data.components[0]!).join()).toContain("inserisci il valore");
  });
  it("persists format 8 and preserves free text behavior for legacy format 7",()=>{
    const data=fixture();expect(acceptsParameterValue(data.parameters[3]!,"Qualsiasi valore")).toBe(true);
    data.version=8;data.parameters[3]!.allowCustom=false;data.parameters[3]!.values=["PVC"];
    data.components[0]!.properties![0]!.value="Speciale";
    expect(parseConfigurator(JSON.stringify(data))).toEqual(data);
    expect(()=>parseConfigurator(JSON.stringify({...data,version:7}))).toThrow("versione 8");
    const malformed=structuredClone(data);Object.assign(malformed.parameters[3]!,{allowCustom:"no"});expect(()=>parseConfigurator(JSON.stringify(malformed))).toThrow("personalizzato non valida");
    const bad=structuredClone(data);Object.assign(bad.components[0]!.properties![0]!,{value:42});expect(()=>parseConfigurator(JSON.stringify(bad))).toThrow("Proprietà del componente");
    delete data.parameters[3]!.allowCustom;expect(()=>parseConfigurator(JSON.stringify({...data,version:7}))).toThrow("versione 8");
  });
});
