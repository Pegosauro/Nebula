import { describe, expect, it } from "vitest";
import { componentHierarchy, orderedComponents } from "./componentHierarchy";
import { exampleConfigurator, parseConfigurator } from "./model";

describe("component families and group layout",()=>{
  it("keeps identical group names in separate families, retains interleaved member order and appends new sections",()=>{
    const data=exampleConfigurator("Families");
    data.components.forEach(c=>c.group="Comune");data.components[0]!.family=" PROFILI ";data.components[2]!.family="PROFILI";data.components[1]!.family="ACCESSORI";data.components[3]!.family="NUOVA";
    data.componentLayout=[{name:"Eliminata",collapsed:true,groups:[]},{name:"ACCESSORI",collapsed:true,groups:[{name:"Comune",collapsed:true}]}];
    const before=structuredClone(data);
    const families=componentHierarchy(data);
    expect(families.map(f=>f.name)).toEqual(["ACCESSORI","PROFILI","NUOVA"]);
    expect(families[0]).toMatchObject({collapsed:true,groups:[{name:"Comune",collapsed:true}]});
    expect(families[1]!.groups[0]!.components.map(c=>c.id)).toEqual(["profile","power"]);
    expect(orderedComponents(data).map(c=>c.id)).toEqual(["led-strip","profile","power","bracket"]);
    expect(data).toEqual(before);
    expect(parseConfigurator(JSON.stringify(data))).toEqual(data);
  });
  it("opens old files unchanged and rejects malformed layout metadata before a save",()=>{
    const data=exampleConfigurator("Old");expect(parseConfigurator(JSON.stringify(data))).toEqual(data);expect(componentHierarchy(data)[0]!.name).toBe("");
    for(const componentLayout of [null,{},[{name:"A",collapsed:"yes",groups:[]}],[{name:"A",collapsed:false,groups:[{name:"G",collapsed:false},{name:"G",collapsed:true}]}],[{name:"A",collapsed:false,groups:[]},{name:"A",collapsed:true,groups:[]}]])expect(()=>parseConfigurator(JSON.stringify({...data,componentLayout}))).toThrow("Organizzazione");
    expect(()=>parseConfigurator(JSON.stringify({...data,components:[{...data.components[0],family:42}]}))).toThrow("Componenti");
  });
});
