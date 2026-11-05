import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import ConfiguratorView from "./ConfiguratorView";
import { useConfiguratorStore } from "./configuratorStore";
import { defaultConfiguratorUi, useConfiguratorUiStore } from "./configuratorUiStore";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { vaultService } from "../vault/vaultService";
import { parseConfigurator, type Configurator } from "./model";
import { calculate } from "./calculation";
import { optionAvailability } from "./engine";
import { parameterErrors, removalDependencies } from "./definitionValidation";
import { filterCatalog } from "./CatalogFilters";
import files from "../vault/testVaultFiles.json";
const path = "Configurators/Pergola dimostrativa.config.json";
const fresh = () => parseConfigurator(files[path]);
let host: HTMLDivElement, root: Root;
beforeAll(() => { (globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true; HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;}; });
afterEach(async()=>{if(root)await act(async()=>root.unmount());host?.remove();useConfiguratorStore.getState().reset();useConfiguratorUiStore.getState().clear();useVaultStore.setState({status:"idle",snapshot:undefined});useWorkspaceStore.getState().resetDocuments();vi.restoreAllMocks();});
async function prepare(data=fresh()) {
  useVaultStore.setState({status:"ready"});
  useWorkspaceStore.getState().openEntry({id:path,name:path.split("/").at(-1)!,path,type:"file",extension:".json"});
  vi.spyOn(vaultService,"readText").mockResolvedValue({path,content:JSON.stringify(data),size:40,lastModified:1});
  vi.spyOn(vaultService,"writeText").mockResolvedValue({size:50,lastModified:2});
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
  await act(async()=>root.render(<ConfiguratorView path={path}/>));
}
async function click(text:string) {const button=[...host.querySelectorAll<HTMLButtonElement>("button")].find(b=>b.textContent?.trim()===text);expect(button,`button ${text}`).toBeTruthy();await act(async()=>button!.click());}
async function label(text:string){const b=host.querySelector<HTMLElement>(`[aria-label="${text}"]`);expect(b,`control ${text}`).toBeTruthy();await act(async()=>b!.click());}
async function input(element:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(element,value);element.dispatchEvent(new Event("input",{bubbles:true}));});}
describe("populated configurator workflows",()=>{
  it("has valid realistic fixtures, optional choices, separate quantities and per-piece lengths",()=>{
    const data=fresh(), result=calculate(data,{model:"TELO",width:300,depth:300,led:false,telo:true,color:"Bianco",mount:"Addossata"},true);
    expect(result.issues.filter(i=>i.severity==="error")).toEqual([]);
    expect(result.result.bom.find(r=>r.component==="c01")).toMatchObject({quantity:2,measure:299,certain:true});
    expect(result.enumeration.exhaustive).toBe(true);
    expect(optionAvailability(data,data.parameters.find(p=>p.id==="telo")!,true,{}).allowed).toBe(true);
    expect(optionAvailability(data,data.parameters.find(p=>p.id==="telo")!,true,{model:"BASE"}).allowed).toBe(false);
    expect(calculate(parseConfigurator(files["Configurators/Diagnostica intenzionale.config.json"]),{},true).issues.filter(i=>i.severity==="error").length).toBeGreaterThan(1);
  });
  it("keeps selected values, the active view and graph zoom after unmount and remount",async()=>{
    await prepare();await click("BOM");await label("TELO: Sì");await label("MODELLO: TELO");await input(host.querySelector<HTMLInputElement>('input[aria-label="Larghezza"]')!,"300");
    expect(host.querySelector('.config-bom')?.textContent).toContain("299 cm");
    await act(async()=>root.render(<div>Nota esterna</div>));
    await act(async()=>root.render(<ConfiguratorView path={path}/>));
    expect(host.querySelector('[aria-current="page"]')?.textContent).toBe("BOM");
    expect(host.querySelector('[aria-label="TELO: Sì"]')?.getAttribute("aria-pressed")).toBe("true");
    expect(host.querySelector<HTMLInputElement>('input[aria-label="Larghezza"]')?.value).toBe("300");
    await click("Grafo");await label("Aumenta zoom del grafo");
    const zoom=host.querySelector('[aria-label="Zoom del grafo"]')?.textContent;
    await click("Componenti");await click("Grafo");expect(host.querySelector('[aria-label="Zoom del grafo"]')?.textContent).toBe(zoom);
    expect(JSON.parse(localStorage.getItem("nebula.configurator-ui.v1")!).state.projects[`session:${path}`].selection.width).toBe(300);
  });
  it("filters the populated catalog and protects reorder operations while hidden entries exist",async()=>{
    await prepare();await click("Componenti");const before=useConfiguratorStore.getState().sessions[path]!.data;
    await input(host.querySelector<HTMLInputElement>('.config-catalog-filters input')!,"PR001");
    expect(host.querySelectorAll('.config-definition-list.is-compact .config-definition-row')).toHaveLength(1);
    expect(host.querySelectorAll('.config-definition-list.is-compact .config-drag-handle')).toHaveLength(0);
    expect(host.querySelector<HTMLButtonElement>('[aria-label="Trascina famiglia PROFILI"]')?.disabled).toBe(true);
    expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
    await click("Azzera filtri");expect(host.querySelectorAll('.config-definition-list.is-compact .config-definition-row')).toHaveLength(24);
  });
  it("blocks duplicate component codes inline and protects an edited dialog when closed",async()=>{
    await prepare();await click("Componenti");await label("Modifica PR001 · Traverso frontale");
    await input(host.querySelector<HTMLInputElement>('dialog input')!,"PR002");
    expect(host.querySelector('#component-code-error')?.textContent).toContain("già usato");
    expect([...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==="Applica")?.disabled).toBe(true);
    const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
    await label("Chiudi dettagli");expect(confirm).toHaveBeenCalledWith("Scartare le modifiche non applicate?");expect(host.querySelector('dialog')).not.toBeNull();
    confirm.mockReturnValue(true);await label("Chiudi dettagli");expect(host.querySelector('dialog')).toBeNull();expect(useConfiguratorStore.getState().sessions[path]!.data.components[0]!.code).toBe("PR001");
  });
  it("shows dependency names before deleting a parameter and leaves the project untouched on cancel",async()=>{
    await prepare();await click("Parametri");const confirm=vi.spyOn(window,"confirm").mockReturnValue(false);
    await label("Elimina parametro Larghezza");
    expect(confirm.mock.calls[0]?.[0]).toContain("Misura: PR001");
    expect(confirm.mock.calls[0]?.[0]).toContain("Inclusione AC011");
    expect(useConfiguratorStore.getState().sessions[path]!.data.parameters.some(p=>p.id==="width")).toBe(true);
  });
  it("groups by family by default, keeps quantities separate, and filters without empty families",async()=>{
    await prepare();await click("BOM");
    const optional=[...host.querySelectorAll('.config-bom-row')].find(row=>row.textContent?.includes("AC007"))!;
    expect(optional.querySelector('.config-bom-state')?.textContent).toBe("Possibile");
    expect(optional.querySelector('.config-bom-quantity')?.textContent).toBe("1pz");
    await input(host.querySelector<HTMLInputElement>('.config-bom-search input')!,"PR001");expect(host.querySelectorAll('.config-bom-row')).toHaveLength(1);
    expect(host.querySelectorAll('.config-bom-group')).toHaveLength(1);
    expect(host.querySelector('.config-bom-group > summary > span')?.textContent).toBe("PROFILI");
    expect(host.querySelector('.config-bom-group > summary > small')?.textContent).toBe("1");
    await input(host.querySelector<HTMLInputElement>('.config-bom-search input')!,"");
    expect([...host.querySelectorAll('.config-bom-group > summary > span')].map(n=>n.textContent)).toEqual(["PROFILI","ACCESSORI"]);
    expect(host.querySelectorAll('.config-bom-group')[1]?.querySelectorAll('.config-bom-row')).toHaveLength(18);
    expect(host.querySelectorAll('.config-bom-row')).toHaveLength(24);
    await input(host.querySelector<HTMLInputElement>('.config-bom-search input')!,"inesistente");
    expect(host.querySelectorAll('.config-bom-group')).toHaveLength(0);expect(host.textContent).toContain("Nessun componente corrisponde");
  });
  it("validates numeric bounds and choice values without accepting malformed definitions",()=>{
    expect(parameterErrors({...fresh().parameters[0]!,values:["A","A"]}).values).toContain("una sola volta");
    expect(parameterErrors({...fresh().parameters[3]!,min:500,max:200,step:0})).toMatchObject({max:expect.any(String),step:expect.any(String)});
    expect(removalDependencies(fresh(),"width","parameter")).toContain("Misura: PR001");
    expect(filterCatalog(fresh(),{query:"traverso",family:"PROFILI",group:"",rule:"yes",measure:"yes"})).toHaveLength(2);
  });
});
describe("graph tools and immediate validation",()=>{
  it("combines parameter selections without a modifier key and adapts the graph viewport",async()=>{
    await prepare();await click("Grafo");await click("Selezione multipla");
    const nodes=[...host.querySelectorAll<SVGGElement>('[data-node-id]')];
    const model=nodes.find(n=>n.getAttribute('aria-label')?.includes('MODELLO: TELO'))!;
    const led=nodes.find(n=>n.getAttribute('aria-label')?.includes('LED: Sì'))!;
    await act(async()=>model.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    const currentLed=[...host.querySelectorAll<SVGGElement>('[data-node-id]')].find(n=>n.getAttribute('aria-label')?.includes('LED: Sì')) ?? led;
    await act(async()=>currentLed.dispatchEvent(new MouseEvent('click',{bubbles:true})));
    const memory=useConfiguratorUiStore.getState().projects[`session:${path}`]!;
    expect(memory.graphSelection.parameters).toEqual(expect.arrayContaining(["model","led"]));
    Object.defineProperty(host.querySelector('.config-path-graph'),"clientWidth",{configurable:true,value:640});
    await click("Adatta alla finestra");expect(Number.parseInt(host.querySelector('[aria-label="Zoom del grafo"]')!.textContent!)).toBeLessThan(100);
    await input(host.querySelector<HTMLInputElement>('.config-graph-tools input[type="search"]')!,"Traverso frontale");
    expect(host.querySelector('[aria-label="Risultati ricerca componenti"]')?.textContent).toContain("PR001");
  });
  it("blocks repeated parameter values at the input and keeps the original definition on cancel",async()=>{
    await prepare();await click("Parametri");await label("Modifica MODELLO");
    const field=host.querySelector<HTMLTextAreaElement>('dialog textarea')!;
    await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(field,"BASE\nBASE");field.dispatchEvent(new Event("input",{bubbles:true}));});
    expect(host.querySelector('#parameter-values-error')?.textContent).toContain("una sola volta");
    expect([...host.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==="Applica")?.disabled).toBe(true);
    await click("Annulla");expect(useConfiguratorStore.getState().sessions[path]!.data.parameters[0]!.values).toEqual(["BASE","TELO","BIO"]);
  });
});
