import { describe, expect, it } from "vitest";
import { componentDimensions, dimensionsLabel, measureFormula, measureProblems } from "./componentMeasure";
import { calculate } from "./calculation";
import { analyze, evaluate } from "./engine";
import { bomCsv } from "./ConfiguratorResults";
import { filterCatalog } from "./CatalogFilters";
import { removalDependencies } from "./definitionValidation";
import { commitRule } from "./componentRules";
import { exampleConfigurator, parseConfigurator } from "./model";

function fixture() {
  const data=exampleConfigurator("Telo");data.version=6;
  Object.assign(data.parameters[2]!,{unit:"cm",min:300,max:500,step:100});
  data.parameters.push({id:"height",name:"Altezza",type:"number",values:[],unit:"cm",min:400,max:600,step:100});
  data.components[0]!.dimensions=[{id:"L",name:"Larghezza",parameter:"width",offset:-2,unit:"cm"},{id:"H",name:"Altezza",parameter:"height",offset:-3,unit:"cm"}];
  return data;
}
const selection={model:"A",led:false,width:300,height:400};
describe("component dimensions",()=>{
  it("calculates independent dimensions while keeping quantities and accessories unchanged",()=>{
    const data=fixture(),result=evaluate(data,selection),row=result.bom.find(r=>r.component==="profile")!;
    expect(result.errors).toEqual([]);
    expect(row).toMatchObject({quantity:2,dimensions:[{id:"L",value:298},{id:"H",value:397}]});
    expect(dimensionsLabel(data.components[0]!,row)).toBe("L 298 × H 397 cm");
    expect(measureFormula(data,data.components[0]!)).toBe("L: Larghezza − 2 cm · H: Altezza − 3 cm");
    expect(result.bom.find(r=>r.component==="bracket")).not.toHaveProperty("dimensions");
    data.rules.push({...data.rules[0]!,id:"extra",actions:data.rules[0]!.actions});
    expect(evaluate(data,selection).bom.find(r=>r.component==="profile")).toMatchObject({quantity:4,dimensions:row.dimensions});
  });
  it("aggregates each axis independently over variants and graph ranges without recovering a varying axis",()=>{
    const data=fixture(),partial={model:"A",led:false,height:400};
    const result=calculate(data,partial,false),row=result.result.bom.find(r=>r.component==="profile")!;
    expect(result.enumeration.solutions).toHaveLength(3);
    expect(row.dimensions).toEqual([{id:"L",value:undefined},{id:"H",value:397}]);
    expect(dimensionsLabel(data.components[0]!,row)).toBe("L Da definire × H 397 cm");
    const focused=calculate(data,partial,false,[{parameter:"width",operator:"eq",value:300}]);
    expect(focused.result.bom.find(r=>r.component==="profile")!.dimensions).toEqual([{id:"L",value:298},{id:"H",value:397}]);
    data.parameters[2]!.step=undefined;
    expect(calculate(data,partial,false).result.bom.find(r=>r.component==="profile")!.dimensions).toEqual(row.dimensions);
  });
  it("converts axes independently and labels mixed units, zeros, custom names and colliding symbols",()=>{
    const data=fixture(),component=data.components[0]!;
    data.parameters[2]!.unit="mm";component.dimensions![0]!.offset=0;
    component.dimensions![1]!.unit="m";component.dimensions![1]!.offset=0;
    const row=evaluate(data,{...selection,width:3000}).bom.find(r=>r.component==="profile")!;
    expect(dimensionsLabel(component,row)).toBe("L 300 cm × H 4 m");
    component.dimensions![0]!.name="Lunghezza";component.dimensions![1]!.name="Larghezza";
    expect(dimensionsLabel(component,row)).toBe("Lunghezza 300 cm × Larghezza 4 m");
    component.dimensions![1]!.name="constructor";
    expect(dimensionsLabel(component,row)).toBe("L 300 cm × constructor 4 m");
    component.dimensions!.pop();expect(dimensionsLabel(component,{dimensions:[{id:"L",value:0}]})).toBe("0 cm");
  });
  it("validates every dimension and rejects a negative second axis only when the component is included",()=>{
    const data=fixture(),c=data.components[0]!;c.dimensions![1]!.offset=-500;
    expect(evaluate(data,selection).errors.join()).toContain("PR001 · Altezza: la misura calcolata");
    expect(evaluate(data,{...selection,model:"B"}).errors).toEqual([]);
    c.dimensions![1]!.parameter="missing";expect(analyze(data).map(i=>i.message).join()).toContain("parametro numerico");
    c.dimensions![1]!.parameter="height";c.dimensions![1]!.unit="pz";expect(measureProblems(data,c).join()).toContain("incompatibile");
    c.dimensions![1]!.unit="cm";c.dimensions![1]!.name=" larghezza ";expect(measureProblems(data,c).join()).toContain("già usato");
    c.dimensions![1]!.name="";expect(measureProblems(data,c).join()).toContain("nome della dimensione");
  });
  it("preserves old files and persists version 6 through other edits while rejecting malformed dimensions",()=>{
    const old=exampleConfigurator("Vecchio");old.version=5;old.components[0]!.measure={parameter:"width",offset:-1,unit:"cm"};
    const text=JSON.stringify(old);expect(JSON.stringify(parseConfigurator(text))).toBe(text);
    expect(componentDimensions(old.components[0]!)[0]).toMatchObject(old.components[0]!.measure!);
    const data=fixture();expect(parseConfigurator(JSON.stringify(data))).toEqual(data);expect(commitRule(data,data.rules[0]!).version).toBe(6);
    expect(()=>parseConfigurator(JSON.stringify({...data,version:5}))).toThrow("versione 6");
    for(const dimensions of [null,{},[null],[{}],[{id:"a",name:"A",parameter:"width",offset:"0",unit:"cm"}],Array(33).fill(data.components[0]!.dimensions![0]),[data.components[0]!.dimensions![0],data.components[0]!.dimensions![0]]]){
      const invalid=structuredClone(data);Object.assign(invalid.components[0]!,{dimensions});expect(()=>parseConfigurator(JSON.stringify(invalid))).toThrow("Dimensioni del componente");
    }
    data.components[0]!.measure=old.components[0]!.measure;expect(()=>parseConfigurator(JSON.stringify(data))).toThrow("Dimensioni del componente");
  });
  it("includes all axes in dependencies, catalog filters and parameter usage analysis",()=>{
    const data=fixture();expect(removalDependencies(data,"height","parameter")).toContain("Misura: PR001");
    expect(filterCatalog(data,{query:"",family:"",group:"",rule:"",measure:"yes"}).map(c=>c.id)).toEqual(["profile"]);
    expect(analyze(data).filter(i=>i.message.includes("Altezza: parametro senza effetto"))).toEqual([]);
  });
  it("exports readable dimensions plus separate numeric values and units, preserving the single-measure CSV",()=>{
    const data=fixture(),result=evaluate(data,selection),text=bomCsv(data,result.bom),header=text.split("\r\n")[0]!;
    expect(header).toContain('"Larghezza";"Unità Larghezza";"Altezza";"Unità Altezza"');
    const line=text.split("\r\n").find(l=>l.includes('"PR001"'))!;
    expect(line).toContain('"L 298 × H 397 cm"');expect(line).toMatch(/;"298";"cm";"397";"cm"$/);
    expect(text.split("\r\n").find(l=>l.includes('"ST001"'))).toMatch(/;"";"";"";""$/);
    data.components[0]!.dimensions!.pop();const single=bomCsv(data,evaluate(data,selection).bom);
    expect(single.split("\r\n")[0]).toMatch(/;"Misura per pezzo";"Unità misura"$/);
    expect(single.split("\r\n").find(l=>l.includes('"PR001"'))).toMatch(/;"298";"cm"$/);
  });
});
