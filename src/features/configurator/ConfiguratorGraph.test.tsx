import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ConfiguratorGraph } from "./ConfiguratorGraph";
import { buildGraphPaths } from "./graphPaths";
import { emptyConfigurator, newAction, type Configurator, type Selection } from "./model";

let root:Root,host:HTMLDivElement;
beforeAll(()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();});
function fixture():Configurator {
  const data=emptyConfigurator("Shared");
  data.parameters=[{id:"model",name:"Modello",type:"choice",values:["A","B"],unit:""},{id:"led",name:"LED",type:"boolean",values:[],unit:""},{id:"fix",name:"Fissaggio",type:"choice",values:["NAKED","Parete"],unit:""}];
  data.components=["C1","C2","C3","C4"].map(id=>({id,code:id,name:`Componente ${id}`,group:"",unit:"pz",note:""}));
  data.rules=[
    {id:"r1",name:"Primo",enabled:true,match:"all",conditions:[{parameter:"model",operator:"eq",value:"A"},{parameter:"fix",operator:"ne",value:"NAKED"}],actions:[{...newAction(),component:"C1"}]},
    {id:"r2",name:"Secondo",enabled:true,match:"all",conditions:[{parameter:"model",operator:"eq",value:"B"},{parameter:"fix",operator:"eq",value:"NAKED"}],actions:[{...newAction(),component:"C2"}]},
    {id:"r3",name:"Terzo",enabled:true,match:"all",conditions:[{parameter:"model",operator:"eq",value:"A"},{parameter:"fix",operator:"eq",value:"NAKED"}],actions:[{...newAction(),component:"C3"},{...newAction(),component:"C4"}]},
  ];
  return data;
}
function wildcardFixture():Configurator {
  const data=fixture();data.components=["A_LED","A_BASE","B_BASE","LED_ANY_MODEL","NO_LED","ALWAYS","NOT_NAKED"].map(id=>({id,code:id,name:id,group:"Comune",unit:"pz",note:""}));
  const model=(value:string)=>({parameter:"model",operator:"eq" as const,value});
  const led=(value:boolean)=>({parameter:"led",operator:"eq" as const,value});
  data.rules=[
    {id:"a-led",name:"LED per A",enabled:true,match:"all",conditions:[model("A"),led(true)],actions:[{...newAction(),component:"A_LED"}]},
    {id:"a-base",name:"Base per A",enabled:true,match:"all",conditions:[model("A")],actions:[{...newAction(),component:"A_BASE"}]},
    {id:"b-base",name:"Base per B",enabled:true,match:"all",conditions:[model("B")],actions:[{...newAction(),component:"B_BASE"}]},
    {id:"led",name:"LED indipendente dal modello",enabled:true,match:"all",conditions:[led(true)],actions:[{...newAction(),component:"LED_ANY_MODEL"}]},
    {id:"no-led",name:"Senza LED",enabled:true,match:"all",conditions:[led(false)],actions:[{...newAction(),component:"NO_LED"}]},
    {id:"always",name:"Sempre necessario",enabled:true,match:"all",conditions:[],actions:[{...newAction(),component:"ALWAYS"}]},
    {id:"not-naked",name:"Condizione successiva",enabled:true,match:"all",conditions:[model("A"),{parameter:"fix",operator:"ne",value:"NAKED"}],actions:[{...newAction(),component:"NOT_NAKED"}]},
  ];return data;
}
async function mount(data:Configurator,selection:Selection={}){host=document.createElement("div");document.body.append(host);root=createRoot(host);await act(async()=>root.render(<ConfiguratorGraph data={data} selection={selection}/>));}
async function press(element:Element,key?:string){await act(async()=>element.dispatchEvent(key ? new KeyboardEvent("keydown",{key,bubbles:true,cancelable:true}) : new MouseEvent("click",{bubbles:true})));}
const nodes=()=>[...host.querySelectorAll<SVGGElement>(".config-graph-parameter")];
const findNode=(text:string)=>nodes().find(n=>n.querySelector("text")?.textContent===text)!;
describe("merged parameter graph",()=>{
  it("shows one shared value, omits equals signs and marks only unequal comparisons red",async()=>{
    const data=fixture();await mount(data);
    expect(nodes().filter(n=>n.querySelector("text")?.textContent==="Qualsiasi valore")).toHaveLength(0);
    await act(async()=>host.querySelector<HTMLInputElement>('.config-graph-actions input[type="checkbox"]')!.click());
    expect(nodes().filter(n=>n.querySelector("text")?.textContent==="Qualsiasi valore")).toHaveLength(1);
    expect(nodes().filter(n=>n.querySelector("text")?.textContent==="NAKED")).toHaveLength(1);
    expect(findNode("≠ NAKED").querySelector(".config-graph-negated")?.textContent).toBe("≠ NAKED");
    expect(findNode("NAKED").querySelector(".config-graph-negated")).toBeNull();
    expect(nodes().some(n=>n.querySelector("text")?.textContent?.startsWith("="))).toBe(false);
    const graph=buildGraphPaths(data);
    const colors=graph.routes.map(route=>[...host.querySelectorAll<SVGGElement>(".config-graph-route")].find(g=>g.dataset.routeId===route.id)!.querySelector<SVGPathElement>(".config-edge")!.style.stroke);
    expect(new Set(colors).size).toBe(graph.routes.length);
    const parallel=graph.edges.filter(e=>e.from===graph.nodes.find(n=>n.column===1)!.id && e.to===graph.nodes.find(n=>n.column===2 && n.conditions[0]?.operator==="eq")!.id);
    const curves=parallel.map(e=>[...host.querySelectorAll<SVGGElement>(".config-graph-route")].find(g=>g.dataset.routeId===e.routeId && g.querySelector(".config-edge")?.getAttribute("d")?.startsWith("M 500"))!.querySelector(".config-edge")!.getAttribute("d"));
    expect(new Set(curves).size).toBe(parallel.length);
  });
  it("follows the selected parameter's complete routes upstream and downstream without crossing through shared nodes",async()=>{
    const data=fixture();await mount(data);
    await press(findNode("A"));
    expect(host.querySelector('[data-component-id="C2"]')?.classList.contains("is-unrelated")).toBe(true);
    for(const id of ["C1","C3","C4"])expect(host.querySelector(`[data-component-id="${id}"]`)?.classList.contains("is-unrelated")).toBe(false);
    const graph=buildGraphPaths(data), bRoute=graph.routes.find(r=>r.rule.id==="r2")!;
    const unrelated=[...host.querySelectorAll<SVGGElement>(".config-graph-route")].filter(g=>g.dataset.routeId===bRoute.id);
    expect(unrelated.length).toBe(2);expect(unrelated.every(g=>g.classList.contains("is-unrelated"))).toBe(true);
    await press(findNode("NAKED"),"Enter");
    expect(findNode("A").classList.contains("is-unrelated")).toBe(false);
    expect(findNode("B").classList.contains("is-unrelated")).toBe(false);
    expect(host.querySelector('[data-component-id="C1"]')?.classList.contains("is-unrelated")).toBe(true);
    await press(findNode("NAKED"),"Escape");expect(host.querySelectorAll(".is-unrelated")).toHaveLength(0);
    await press(findNode("B"));await press(findNode("B"));expect(host.querySelectorAll(".is-unrelated")).toHaveLength(0);
  });
  it("uses Ctrl and Command to intersect complete routes, hides branches, preserves colors and restores removed selections",async()=>{
    const data=fixture();await mount(data);
    const ctrl=async(text:string,meta=false)=>act(async()=>findNode(text).dispatchEvent(new MouseEvent("click",{bubbles:true,ctrlKey:!meta,metaKey:meta})));
    const graph=buildGraphPaths(data), routeId=graph.routes.find(r=>r.rule.id==="r3")!.id;
    const color=host.querySelector<SVGPathElement>(`[data-route-id='${routeId}'] .config-edge`)!.style.stroke;
    await ctrl("A");expect(findNode("A").getAttribute("aria-pressed")).toBe("true");expect(host.querySelector('[data-component-id="C2"]')).toBeNull();expect(nodes().some(n=>n.querySelector("text")?.textContent==="B")).toBe(false);
    await ctrl("NAKED",true);
    expect([...host.querySelectorAll<SVGGElement>('[data-component-id]')].map(c=>c.dataset.componentId)).toEqual(["C3","C4"]);
    expect(nodes()).toHaveLength(2);expect(host.querySelector(".config-graph-selection strong")?.textContent).toBe("2 percorsi");
    expect(host.querySelector<SVGPathElement>(`[data-route-id='${routeId}'] .config-edge`)!.style.stroke).toBe(color);
    await ctrl("A");expect(host.querySelector('[data-component-id="C2"]')).not.toBeNull();expect(findNode("B")).toBeTruthy();
    await press(findNode("NAKED"),"Escape");expect(host.querySelectorAll('[data-component-id]')).toHaveLength(4);expect(host.querySelector('.config-graph-selection')).toBeNull();
    // A normal focused node becomes the first constraint when Ctrl adds another.
    await press(findNode("A"));await ctrl("NAKED");expect(host.querySelectorAll('[data-component-id]')).toHaveLength(2);
    await press(host.querySelector('[aria-label="Rimuovi dal percorso Modello: A"]')!);expect(host.querySelectorAll('[data-component-id]')).toHaveLength(3);
  });
  it("places components in the same saved family and group order even with interleaved records and collapsed catalog sections",async()=>{
    const data=fixture();data.components[0]!.family="PROFILI";data.components[0]!.group="Telaio";data.components[2]!.family="PROFILI";data.components[2]!.group="Telaio";
    data.components[1]!.family="ACCESSORI";data.components[1]!.group="Fissaggi";data.components[3]!.family="ACCESSORI";data.components[3]!.group="Luci";
    data.componentLayout=[{name:"ACCESSORI",collapsed:true,groups:[{name:"Luci",collapsed:true},{name:"Fissaggi",collapsed:false}]},{name:"PROFILI",collapsed:false,groups:[{name:"Telaio",collapsed:false}]}];
    await mount(data);expect([...host.querySelectorAll<SVGGElement>('[data-component-id]')].map(c=>c.dataset.componentId)).toEqual(["C4","C2","C1","C3"]);
    expect([...host.querySelectorAll('.config-graph-section-heading')].map(h=>h.querySelector("title")?.textContent)).toEqual(["ACCESSORI","Luci","Fissaggi","PROFILI","Telaio"]);
    const positions=[...host.querySelectorAll('[data-component-id] rect')].map(r=>Number(r.getAttribute("y")));expect(positions).toEqual([...positions].sort((a,b)=>a-b));
  });

  it("supports Ctrl with keyboard and ignores additions that have no active or open route",async()=>{
    await mount(fixture(),{model:"A",fix:"NAKED"});
    await act(async()=>findNode("B").dispatchEvent(new MouseEvent("click",{bubbles:true,ctrlKey:true})));
    expect(host.querySelector('.config-graph-selection')).toBeNull();
    for(const text of ["A","NAKED"])await act(async()=>findNode(text).dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",ctrlKey:true,bubbles:true,cancelable:true})));
    expect(host.querySelectorAll('[data-component-id]')).toHaveLength(2);expect(host.querySelector('.config-graph-selection strong')?.textContent).toBe("2 percorsi");
    await press(host.querySelector('[aria-label="Rimuovi dal percorso Modello: A"]')!,"Escape");expect(host.querySelectorAll('[data-component-id]')).toHaveLength(4);
  });

  it("includes unconstrained component routes in single-click focus and in multi-choice filters while excluding contradictory branches",async()=>{
    const data=wildcardFixture(), before=JSON.stringify(data);await mount(data);
    await press(findNode("Sì"));
    for(const id of ["A_LED","A_BASE","B_BASE","LED_ANY_MODEL","ALWAYS","NOT_NAKED"])expect(host.querySelector(`[data-component-id="${id}"]`)?.classList.contains("is-unrelated")).toBe(false);
    expect(host.querySelector('[data-component-id="NO_LED"]')?.classList.contains("is-unrelated")).toBe(true);
    expect(host.querySelector('.config-graph-origin')?.classList.contains("is-unrelated")).toBe(false);
    // The wildcard is included, but the actual selected value is the only pressed node.
    const toggle=host.querySelector<HTMLInputElement>('.config-graph-actions input[type="checkbox"]')!;await act(async()=>toggle.click());
    const wildcard=host.querySelector<SVGGElement>('[aria-label="Evidenzia percorsi LED: Qualsiasi valore"]')!;
    expect(wildcard.classList.contains("is-unrelated")).toBe(false);expect(wildcard.getAttribute("aria-pressed")).toBe("false");
    expect(findNode("Sì").getAttribute("aria-pressed")).toBe("true");
    await act(async()=>findNode("A").dispatchEvent(new MouseEvent("click",{bubbles:true,ctrlKey:true})));
    expect([...host.querySelectorAll<SVGGElement>('[data-component-id]')].map(c=>c.dataset.componentId)).toEqual(["A_LED","A_BASE","LED_ANY_MODEL","ALWAYS","NOT_NAKED"]);
    expect(host.querySelector('.config-graph-selection strong')?.textContent).toBe("5 percorsi");
    await act(async()=>toggle.click());expect(host.querySelectorAll('[data-component-id]')).toHaveLength(5);expect(nodes().some(n=>n.querySelector("text")?.textContent==="Qualsiasi valore")).toBe(false);
    await press(findNode("≠ NAKED"),"Escape");expect(host.querySelectorAll('[data-component-id]')).toHaveLength(7);expect(JSON.stringify(data)).toBe(before);
  });
  it("bypasses unconstrained intermediate nodes and preserves route identity, color and an always-origin across the detail toggle",async()=>{
    const data=wildcardFixture(), graph=buildGraphPaths(data);await mount(data);
    const path=graph.routes.find(r=>r.rule.id==="not-naked")!, always=graph.routes.find(r=>r.rule.id==="always")!;
    const segments=(id:string)=>[...host.querySelectorAll<SVGGElement>('.config-graph-route')].filter(e=>e.dataset.routeId===id);
    expect(segments(path.id)).toHaveLength(2);expect(segments(always.id)).toHaveLength(1);
    expect(host.querySelector('.config-graph-origin text')?.textContent).toBe("Sempre");
    const first=segments(path.id)[0]!.querySelector<SVGPathElement>('.config-edge')!, color=first.style.stroke;
    expect(first.getAttribute("d")).toContain(", 560 "); // Model goes directly to the third column, skipping LED.
    await act(async()=>host.querySelector<HTMLInputElement>('.config-graph-actions input')!.click());
    expect(segments(path.id)).toHaveLength(3);expect(segments(always.id)).toHaveLength(3);expect(host.querySelector('.config-graph-origin')).toBeNull();
    expect(segments(path.id).every(e=>e.querySelector<SVGPathElement>('.config-edge')!.style.stroke===color)).toBe(true);
    // Explicitly selecting the wildcard still means only routes without a LED condition.
    await press(host.querySelector('[aria-label="Evidenzia percorsi LED: Qualsiasi valore"]')!);
    expect(host.querySelector('[data-component-id="A_LED"]')?.classList.contains("is-unrelated")).toBe(true);
    expect(host.querySelector('[data-component-id="A_BASE"]')?.classList.contains("is-unrelated")).toBe(false);
    await act(async()=>host.querySelector<HTMLInputElement>('.config-graph-actions input')!.click());
    expect(host.querySelector('[data-component-id="A_BASE"]')?.classList.contains("is-unrelated")).toBe(false);
  });

});
