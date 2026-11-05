import { describe, expect, it } from "vitest";
import { componentMeasure, measureConversion, measureFormula, measureProblems } from "./componentMeasure";
import { analyze, enumerate, evaluate, summarize } from "./engine";
import { calculate } from "./calculation";
import { commitRule } from "./componentRules";
import { configVersion, exampleConfigurator, newAction, parseConfigurator } from "./model";

function fixture() {
  const data=exampleConfigurator("Misure");data.version=5;
  Object.assign(data.parameters[2]!,{min:300,max:500,step:100,unit:"cm"});
  data.components[0]!.measure={parameter:"width",offset:-1,unit:"cm"};
  return data;
}
describe("component measurements",()=>{
  it("calculates 300 cm minus 1 cm as 299 cm independently of quantities and accessories",()=>{
    const data=fixture(),result=evaluate(data,{model:"A",led:false,width:300});
    expect(result.errors).toEqual([]);
    expect(result.bom.find(r=>r.component==="profile")).toMatchObject({quantity:2,measure:299});
    const accessory=result.bom.find(r=>r.component==="bracket")!;
    expect(accessory.quantity).toBe(1);expect(accessory).not.toHaveProperty("measure");
    expect(measureFormula(data,data.components[0]!)).toBe("Larghezza − 1 cm");
    expect(componentMeasure(data,data.components[0]!,{width:400}).value).toBe(399);
  });
  it("converts mm/cm/m before applying a signed offset, including fractional and zero results",()=>{
    const data=fixture(),c=data.components[0]!;data.parameters[2]!.unit="mm";
    expect(componentMeasure(data,c,{width:3000}).value).toBe(299);
    c.measure!.unit="m";c.measure!.offset=.1;
    expect(componentMeasure(data,c,{width:3000}).value).toBe(3.1);
    c.measure!.unit="cm";c.measure!.offset=0;
    expect(componentMeasure(data,c,{width:0}).value).toBe(0);
    expect(measureFormula(data,c)).toBe("Larghezza → cm");
    expect(measureConversion("CM"," mm ")).toBe(10);
    expect(measureConversion("custom","custom")).toBe(1);
    expect(measureConversion("mm","pz")).toBeUndefined();
    expect(measureConversion("mm","constructor")).toBeUndefined();
  });
  it("keeps unknown and varying lengths separate from fixed quantities under variants and graph ranges",()=>{
    const data=fixture();
    expect(evaluate(data,{model:"A",led:false}).bom.find(r=>r.component==="profile")).toMatchObject({quantity:2,measure:undefined});
    const all=summarize(data,{model:"A",led:false},enumerate(data,{model:"A",led:false}));
    expect(all.bom.find(r=>r.component==="profile")).toMatchObject({quantity:2,measure:undefined});
    const range=calculate(data,{model:"A",led:false},false,[{parameter:"width",operator:"gte",value:300},{parameter:"width",operator:"lte",value:400}]);
    expect(range.enumeration.solutions).toHaveLength(2);
    expect(range.result.bom.find(r=>r.component==="profile")).toMatchObject({quantity:2,measure:undefined});
    const exact=calculate(data,{model:"A",led:false,width:300},false);
    expect(exact.result.bom.find(r=>r.component==="profile")).toMatchObject({quantity:2,measure:299});
    data.parameters[2]!.step=undefined;
    expect(calculate(data,{model:"A",led:false},false).result.bom.find(r=>r.component==="profile")?.measure).toBeUndefined();
  });
  it("sums overlapping inclusions without adding or multiplying the per-piece measurement",()=>{
    const data=fixture();data.rules.push({...data.rules[0]!,id:"extra",actions:[{...newAction(),component:"profile",quantity:{amount:3,divisor:1,rounding:"none"}}]});
    expect(evaluate(data,{model:"A",led:false,width:300}).bom.find(r=>r.component==="profile")).toMatchObject({quantity:5,measure:299});
  });
  it("rejects negative included measurements and invalid sources without blocking an absent component",()=>{
    const data=fixture(),c=data.components[0]!;c.measure!.offset=-400;
    expect(evaluate(data,{model:"A",led:false,width:300}).errors.join()).toContain("misura calcolata");
    expect(evaluate(data,{model:"B",led:false,width:300}).errors).toEqual([]);
    expect(enumerate(data,{model:"A",led:false}).solutions.map(s=>s.selection.width)).toEqual([400,500]);
    c.measure!.parameter="led";expect(measureProblems(data,c).join()).toContain("parametro numerico");
    c.measure!.parameter="missing";expect(analyze(data).map(i=>i.message).join()).toContain("parametro numerico");
    c.measure!.parameter="width";c.measure!.unit="pz";expect(measureProblems(data,c).join()).toContain("unità della misura incompatibile");
  });
  it("persists format 5, rejects malformed measurements and preserves the version through other edits",()=>{
    const data=fixture();expect(parseConfigurator(JSON.stringify(data))).toEqual(data);
    expect(()=>parseConfigurator(JSON.stringify({...data,version:4}))).toThrow("versione 5");
    for(const measure of [null,{}, {parameter:"width",offset:null,unit:"cm"},{parameter:4,offset:0,unit:"cm"},{parameter:"width",offset:0,unit:4}]){
      const invalid=structuredClone(data);Object.assign(invalid.components[0]!,{measure});
      expect(()=>parseConfigurator(JSON.stringify(invalid))).toThrow("Misura del componente");
    }
    expect(commitRule(data,data.rules[0]!).version).toBe(5);
    expect(configVersion(5,3)).toBe(5);expect(configVersion(5,4)).toBe(5);
    const old=exampleConfigurator("Old");expect(parseConfigurator(JSON.stringify(old))).toEqual(old);
  });
});
