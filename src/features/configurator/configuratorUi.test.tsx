import { useConfiguratorUiStore } from "./configuratorUiStore";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { calculate, type Calculation } from "./calculation";
import type { Condition, Configurator, Selection } from "./model";
import ConfiguratorView from "./ConfiguratorView";
import ConfiguratorInspector from "./ConfiguratorInspector";
import ConfiguratorLibrary from "./ConfiguratorLibrary";
import { emptyConfigurator, exampleConfigurator, parseConfigurator } from "./model";
import { useConfiguratorStore } from "./configuratorStore";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useKnowledgeNavigationStore } from "../knowledge/knowledgeNavigationStore";
import { vaultService } from "../vault/vaultService";
import { renderMarkdownSafe } from "../../infrastructure/markdown/renderMarkdown";
import { navigationKnowledge } from "./navigationKnowledge";
import { TabBar } from "../shell/TabBar";
import type { VaultSnapshot } from "../../domain/vault";
let root:Root|undefined,host:HTMLDivElement|undefined;
const path="Configurators/Pergola.config.json";
const snapshot:VaultSnapshot={name:"Vault",scannedAt:1,stats:{files:2,notes:1,boards:0,directories:1},root:[{id:"config",name:"Configurators",path:"Configurators",type:"directory",extension:"",children:[{id:path,name:"Pergola.config.json",path,type:"file",extension:".json"}]},{id:"note",name:"Scheda.md",path:"Scheda.md",type:"file",extension:".md"}]};
beforeAll(()=>{(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;};});
afterEach(async()=>{if(root)await act(async()=>root!.unmount());host?.remove();root=undefined;host=undefined;useConfiguratorStore.getState().reset();useConfiguratorUiStore.getState().clear();useWorkspaceStore.getState().resetDocuments();useKnowledgeStore.getState().reset();useVaultStore.setState({status:"idle",snapshot:undefined});vi.restoreAllMocks();vi.unstubAllGlobals();});
async function mount(element:React.ReactNode) {host=document.createElement("div");document.body.append(host);root=createRoot(host);await act(async()=>root!.render(element));}
async function click(text:string){const button=[...host!.querySelectorAll("button")].find(b=>b.textContent?.trim()===text)!;expect(button).toBeTruthy();await act(async()=>button.click());}
async function clickLabel(label:string){const button=host!.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;expect(button).toBeTruthy();await act(async()=>button.click());}
async function openFirst(){await act(async()=>{const button=host!.querySelector<HTMLButtonElement>(".config-definition-summary")!;button.focus();button.click();});}
async function select(label:string,value:string){const e=host!.querySelector<HTMLSelectElement>(`select[aria-label="${label}"]`)!;await act(async()=>{e.value=value;e.dispatchEvent(new Event("change",{bubbles:true}));});}
async function input(element:HTMLInputElement,value:string){await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(element,value);element.dispatchEvent(new Event("input",{bubbles:true}));});}
async function openSavedRule(){while(host!.querySelector("dialog"))await click("Annulla");await click("Componenti");await clickLabel("Modifica PR001 · Profilo laterale");await clickLabel("Modifica Profilo del modello A");}
function prepare(data=exampleConfigurator("Pergola")){useVaultStore.setState({status:"ready",snapshot});vi.spyOn(vaultService,"readText").mockResolvedValue({path,content:JSON.stringify(data),size:50,lastModified:1});vi.spyOn(vaultService,"writeText").mockResolvedValue({size:60,lastModified:2});}
describe("configurator integration",()=>{
  it("edits nested O and NON groups, keeps input focus, collapses and persists the exact tree",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await openSavedRule();
    await click("Gruppo");
    await select("Combinazione del gruppo","any");
    const nested=()=>host!.querySelector<HTMLElement>(".logic-all .logic-any")!;
    await act(async()=>[...nested().querySelectorAll("button")].find(b=>b.textContent?.trim()==="Condizione")!.click());
    await act(async()=>{const field=nested().querySelectorAll<HTMLSelectElement>('select[aria-label="Parametro della condizione"]')[1]!;field.value="width";field.dispatchEvent(new Event("change",{bubbles:true}));});
    const value=nested().querySelector<HTMLInputElement>('input[aria-label="Valore"]')!;
    value.focus();await input(value,"4000");await input(value,"4500");expect(document.activeElement).toBe(value);
    expect(nested().querySelector('input[aria-label="Valore"]')).toBe(value);
    await act(async()=>nested().querySelector<HTMLButtonElement>('[aria-label="Comprimi gruppo"]')!.click());
    expect(host!.querySelector(".config-group-collapsed")?.textContent).toContain('O(Modello = "A"; Larghezza = 4500)');
    await clickLabel("Espandi gruppo");await select("Combinazione del gruppo","not");
    expect(host!.querySelector(".logic-not .logic-any")).not.toBeNull();
    expect(host!.querySelector(".config-expression-preview")?.textContent).toContain('NON(O(Modello = "A"; Larghezza = 4500))');
    await click("Applica");await click("Salva");
    const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.version).toBe(3);expect(saved.rules[0]!.expression?.type).toBe("all");
    await openSavedRule();expect(host!.querySelector(".logic-not .logic-any")).not.toBeNull();await click("Annulla");
    await click("Componenti");expect(host!.querySelector('[aria-label="Modifica regola per PR001"]')?.classList.contains("is-conditioned")).toBe(true);
  });
  it("blocks incomplete nested scopes and keeps unconditional root rules available",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await click("Componenti");await clickLabel("Modifica regola per PR001");await clickLabel("Elimina condizione");
    const apply=()=>[...host!.querySelectorAll<HTMLButtonElement>("dialog button")].find(b=>b.textContent==="Applica")!;
    expect(apply().disabled).toBe(false);
    await click("Gruppo");await clickLabel("Elimina condizione");
    expect(apply().disabled).toBe(true);expect(host!.textContent).toContain("Gruppo vuoto");
    await clickLabel("Elimina gruppo");expect(apply().disabled).toBe(false);
    await select("Combinazione condizioni","not");expect(apply().disabled).toBe(true);
    await click("Annulla");expect(useConfiguratorStore.getState().sessions[path]!.data.version).toBe(1);
  });
  it("reorders tree siblings, preserves scopes and cancels nested edits",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await openSavedRule();
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    await click("Gruppo");await select("Combinazione del gruppo","any");await clickLabel("Sposta su elemento 2");
    const children=host!.querySelectorAll(".config-condition-group.logic-all > .config-group-content > .config-tree-child");
    const transfer={setData:vi.fn(),effectAllowed:""};
    const dispatch=async(e:Element,type:string)=>{await act(async()=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,"dataTransfer",{value:transfer});e.dispatchEvent(event);});};
    await dispatch(children[0]!.querySelector(":scope > .config-tree-controls .config-drag-handle")!,"dragstart");await dispatch(children[1]!,"drop");
    expect(host!.querySelector(".config-expression-preview")?.textContent).toContain('E(Modello = "A"; O(Modello = "A"))');
    await clickLabel("Sposta su elemento 2");
    expect(host!.querySelector(".config-expression-preview")?.textContent).toContain('E(O(Modello = "A"); Modello = "A")');
    await click("Annulla");expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
    await openSavedRule();expect(host!.querySelector(".logic-any")).toBeNull();
  });
  it.each(["Parametri", "Componenti"])("keeps %s stable during typing and recalculates when returning to Esplora", async section => {
    const workers: FakeWorker[]=[];
    class FakeWorker {
      onmessage: ((event: MessageEvent<Calculation>)=>void) | null=null;
      onerror: (()=>void) | null=null;
      request?: {data:Configurator;selection:Selection;analysis:boolean};
      stopped=false;
      constructor() {workers.push(this);}
      postMessage(request: NonNullable<FakeWorker["request"]>) {this.request=request;}
      terminate() {this.stopped=true;}
      complete() {const r=this.request!;this.onmessage?.({data:calculate(r.data,r.selection,r.analysis)} as MessageEvent<Calculation>);}
    }
    vi.stubGlobal("Worker",FakeWorker);
    prepare();await mount(<ConfiguratorView path={path}/>);
    await act(async()=>workers.at(-1)!.complete());
    await click(section);
    await openFirst();
    const before=workers.length;
    const field=host!.querySelector<HTMLInputElement>("dialog input:not([type=checkbox])")!;
    field.focus();field.setSelectionRange(0,field.value.length);
    const workspace=host!.querySelector(".config-workspace")!;
    const inserted: string[]=[];
    const observer=new MutationObserver(records=>records.forEach(r=>r.addedNodes.forEach(n=>inserted.push(n.textContent ?? ""))));
    observer.observe(workspace,{childList:true});
    try {
      await input(field,"Edited");await input(field,"Edited again");
      expect(workers.length).toBe(before);
      expect(inserted.some(text=>text.includes("Aggiornamento risultati"))).toBe(false);
      expect(document.activeElement).toBe(field);
      expect(host!.querySelector("dialog input")).toBe(field);
      await click("Applica");
      await act(async()=>useConfiguratorStore.getState().save(path));
      expect(JSON.parse(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1])).toEqual(useConfiguratorStore.getState().sessions[path]!.data);
      await click("Esplora");
      expect(workers.length).toBeGreaterThan(before);
      expect(workers.at(-1)!.request!.data).toBe(useConfiguratorStore.getState().sessions[path]!.data);
      await act(async()=>workers.at(-1)!.complete());
    } finally {observer.disconnect();}
  });
  it("moves project information below the graph and updates the inspector's real BOM from graph choices",async()=>{
    const fixture=exampleConfigurator("Pergola");fixture.components[0]!.note="Scheda.md";
    prepare(fixture);await mount(<><ConfiguratorView path={path}/><ConfiguratorInspector path={path}/></>);
    const inspector=()=>host!.querySelector('.config-components-inspector')!;
    expect(inspector().querySelector('[data-result-component="profile"]')?.textContent).toContain("Possibile");
    await select("Modello",JSON.stringify("A"));await select("LED","false");await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"3000");
    expect(inspector().querySelector('[data-result-component="bracket"] .config-inspector-quantity strong')?.textContent).toBe("3");
    expect(inspector().querySelector('[data-result-component="power"]')).toBeNull();
    await click("Grafo");const details=host!.querySelector('.config-project-details')!;
    expect([...details.querySelectorAll('summary')].map(s=>s.textContent)).toEqual(["Dati del progetto","Schede tecniche (1)","Note collegate (0)"]);
    expect([...details.querySelectorAll('details')].every(d=>!d.open)).toBe(true);
    expect(details.compareDocumentPosition(host!.querySelector('.config-graph')!) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(inspector().textContent).not.toContain("Schede tecniche");expect(inspector().textContent).not.toContain("Regole attive");
    const activate=vi.spyOn(useKnowledgeNavigationStore.getState(),"activate").mockImplementation(()=>{});
    await act(async()=>{details.querySelectorAll<HTMLDetailsElement>('details')[1]!.open=true;});await click("PR001 · Scheda");expect(activate).toHaveBeenCalledWith(path,"Scheda");
    const yes=host!.querySelector('[aria-label="Evidenzia percorsi LED: Sì"]')!;await act(async()=>yes.dispatchEvent(new MouseEvent("click",{bubbles:true})));
    expect(inspector().querySelector('[data-result-component="led-strip"]')?.textContent).toContain("Certo");
    expect(inspector().querySelector('[data-result-component="profile"] .config-inspector-quantity strong')?.textContent).toBe("2");
    expect(inspector().querySelector('[data-result-component="power"] .config-inspector-quantity strong')?.textContent).toBe("1");
    expect(inspector().querySelector('[data-result-component="bracket"] .config-inspector-quantity strong')?.textContent).toBe("3");
    for(let i=0;i<2;i++)await act(async()=>host!.querySelector('.config-graph [data-component-id="profile"]')!.dispatchEvent(new MouseEvent("click",{bubbles:true})));
    expect([...host!.querySelectorAll<HTMLButtonElement>('button')].find(b=>b.textContent==="Mostra tutti i percorsi")!.disabled).toBe(false);
    expect(inspector().querySelector('[data-result-component="power"]')).not.toBeNull();
    await click("Mostra tutti i percorsi");expect(inspector().querySelector('[data-result-component="power"]')).toBeNull();
    await click("Esplora");expect(host!.querySelector<HTMLSelectElement>('[aria-label="LED"]')!.value).toBe("false");
    expect(useConfiguratorStore.getState().sessions[path]!.data).toEqual(fixture);
  });
  it("opens the existing shared component rule from a graph double click or F2, cancels drafts and applies without leaving the graph",async()=>{
    prepare();await mount(<><ConfiguratorView path={path}/><ConfiguratorInspector path={path}/></>);
    await select("Modello",JSON.stringify("A"));await select("LED","true");await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"3000");await click("Grafo");
    await act(async()=>host!.querySelector('[aria-label="Evidenzia percorsi Modello: A"]')!.dispatchEvent(new MouseEvent("click",{bubbles:true,ctrlKey:true})));
    const node=()=>host!.querySelector<SVGGElement>('.config-graph [data-component-id="led-strip"]')!;
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    await act(async()=>{node().focus();node().dispatchEvent(new MouseEvent("click",{bubbles:true}));});expect(host!.querySelector('dialog')).toBeNull();
    await act(async()=>{node().dispatchEvent(new MouseEvent("click",{bubbles:true,detail:2}));node().dispatchEvent(new MouseEvent("dblclick",{bubbles:true,detail:2}));});
    expect(host!.querySelector('dialog h2')?.textContent).toBe("Regola del componente");expect(host!.querySelector<HTMLInputElement>('[aria-label="Quantità"]')!.value).toBe("1");
    expect(host!.querySelector('dialog')?.textContent).toContain("anche ad altri componenti");
    await input(host!.querySelector<HTMLInputElement>('[aria-label="Quantità"]')!,"8");await click("Annulla");
    expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);expect(host!.querySelector('.config-tabs [aria-current="page"]')?.textContent).toBe("Grafo");
    expect(node().getAttribute('aria-pressed')).toBe("true");expect(host!.querySelector('[aria-label="Rimuovi dal percorso Modello: A"]')).not.toBeNull();
    await act(async()=>node().dispatchEvent(new KeyboardEvent("keydown",{key:"F2",bubbles:true,cancelable:true})));
    expect(host!.querySelector<HTMLInputElement>('[aria-label="Quantità"]')!.value).toBe("1");await input(host!.querySelector<HTMLInputElement>('[aria-label="Quantità"]')!,"4");await click("Applica");await click("Salva");
    const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);expect(saved.rules).toHaveLength(before.rules.length);expect(saved.rules.find(r=>r.id==="R2")!.actions.map(a=>a.quantity.amount)).toEqual([4,1]);
    const inspector=host!.querySelector('.config-components-inspector')!;
    expect(inspector.querySelector('[data-result-component="led-strip"] .config-inspector-quantity strong')?.textContent).toBe("4");
    expect(inspector.querySelector('[data-result-component="power"] .config-inspector-quantity strong')?.textContent).toBe("1");
    expect(host!.querySelector('.config-tabs [aria-current="page"]')?.textContent).toBe("Grafo");
  });
  it("updates inspector quantities when a complete graph route is chosen and withholds a BOM for contradictory choices",async()=>{
    const fixture=exampleConfigurator("Route");fixture.parameters[2]!.step=1000;prepare(fixture);await mount(<><ConfiguratorView path={path}/><ConfiguratorInspector path={path}/></>);await click("Grafo");
    const inspector=()=>host!.querySelector('.config-components-inspector')!;
    const route=host!.querySelector<SVGGElement>('.config-graph-route[aria-label*="Profilo del modello A"]')!;
    await act(async()=>route.dispatchEvent(new MouseEvent("click",{bubbles:true})));
    expect(inspector().querySelector('[data-result-component="profile"]')?.textContent).toContain("Certo");
    expect(inspector().querySelector('[data-result-component="profile"] .config-inspector-quantity strong')?.textContent).toBe("2");
    await click("Esplora");await select("Modello",JSON.stringify("B"));await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"3000");await click("Grafo");
    await act(async()=>host!.querySelector('[aria-label="Evidenzia percorsi LED: Sì"]')!.dispatchEvent(new MouseEvent("click",{bubbles:true})));
    expect(inspector().textContent).toContain("Configurazione non valida");expect(inspector().querySelector('[data-result-component]')).toBeNull();
  });
  it("sends graph choices to the worker, withholds stale results and pauses calculations while editing a graph rule",async()=>{
    const workers:FakeWorker[]=[];
    class FakeWorker {
      onmessage:((event:MessageEvent<Calculation>)=>void)|null=null;onerror:(()=>void)|null=null;stopped=false;
      request?:{data:Configurator;selection:Selection;analysis:boolean;conditions:Condition[]};
      constructor(){workers.push(this);}postMessage(r:NonNullable<FakeWorker["request"]>){this.request=r;}terminate(){this.stopped=true;}
      complete(){const r=this.request!;this.onmessage?.({data:calculate(r.data,r.selection,r.analysis,r.conditions)} as MessageEvent<Calculation>);}
    }
    vi.stubGlobal("Worker",FakeWorker);prepare();await mount(<><ConfiguratorView path={path}/><ConfiguratorInspector path={path}/></>);await act(async()=>workers.at(-1)!.complete());await click("Grafo");await act(async()=>workers.at(-1)!.complete());
    const previous=workers.at(-1)!;await act(async()=>host!.querySelector('[aria-label="Evidenzia percorsi Modello: A"]')!.dispatchEvent(new MouseEvent("click",{bubbles:true})));
    const latest=workers.at(-1)!;expect(latest).not.toBe(previous);expect(previous.stopped).toBe(true);expect(latest.request!.conditions).toEqual([{parameter:"model",operator:"eq",value:"A"}]);
    const inspector=()=>host!.querySelector('.config-components-inspector')!;expect(inspector().textContent).toContain("Aggiornamento componenti");
    await act(async()=>previous.complete());expect(inspector().querySelector('[data-result-component]')).toBeNull();await act(async()=>latest.complete());expect(inspector().querySelector('[data-result-component="profile"]')?.textContent).toContain("Certo");
    await act(async()=>host!.querySelector('.config-graph [data-component-id="profile"]')!.dispatchEvent(new MouseEvent("dblclick",{bubbles:true})));
    const count=workers.length, field=host!.querySelector<HTMLInputElement>('[aria-label="Quantità"]')!;field.focus();await input(field,"8");await input(field,"9");
    expect(workers).toHaveLength(count);expect(document.activeElement).toBe(field);expect(host!.querySelector('[aria-label="Quantità"]')).toBe(field);await click("Annulla");
  });
  it("saves an optional per-piece measure, preserves quantities, updates BOM and graph inspector, and exports CSV",async()=>{
    prepare();await mount(<><ConfiguratorView path={path}/><ConfiguratorInspector path={path}/></>);await click("Componenti");await clickLabel("Modifica PR001 · Profilo laterale");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    await click("Dimensione");await select("Unità dimensione 1","cm");
    const offset=host!.querySelector<HTMLInputElement>('[aria-label="Correzione dimensione 1"]')!;offset.focus();await input(offset,"");expect(document.activeElement).toBe(offset);await input(offset,"-1");
    expect(host!.querySelector('[aria-label="Riepilogo del componente"]')?.textContent).toContain("Larghezza → cm − 1 cm");
    await click("Applica");await click("Salva");const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.version).toBe(6);expect(saved.components[0]!.dimensions).toEqual([{id:expect.any(String),name:"Lunghezza",parameter:"width",unit:"cm",offset:-1}]);expect(saved.rules).toEqual(before.rules);
    expect(saved.components[3]!.measure).toBeUndefined();
    await act(async()=>{useConfiguratorStore.getState().reset();vi.mocked(vaultService.readText).mockResolvedValue({path,content:JSON.stringify(saved),size:50,lastModified:3});await useConfiguratorStore.getState().load(path);});
    await clickLabel("Modifica PR001 · Profilo laterale");expect(host!.querySelector<HTMLInputElement>('[aria-label="Correzione dimensione 1"]')!.value).toBe("-1");
    await input(host!.querySelector<HTMLInputElement>('[aria-label="Correzione dimensione 1"]')!,"-2");await click("Annulla");expect(useConfiguratorStore.getState().sessions[path]!.data.components[0]!.dimensions![0]!.offset).toBe(-1);
    await clickLabel("Comprimi famiglia Senza famiglia");await clickLabel("Espandi famiglia Senza famiglia");expect(useConfiguratorStore.getState().sessions[path]!.data.version).toBe(6);
    await clickLabel("Modifica regola per PR001");expect(host!.textContent).toContain("Misura per pezzo: Larghezza → cm − 1 cm");await click("Applica");expect(useConfiguratorStore.getState().sessions[path]!.data.version).toBe(6);
    await click("BOM");await clickLabel("Modello: A");await clickLabel("LED: No");
    const profile=()=>[...host!.querySelectorAll('.config-bom-row')].find(r=>r.querySelector('.config-bom-identity strong')?.textContent==="PR001")!;
    expect(profile().querySelector('.config-bom-measure')?.textContent).toContain("Da definire");
    await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"3000");
    expect(profile().querySelector('.config-bom-measure strong')?.textContent).toBe("299 cm");expect(profile().querySelector('.config-bom-quantity strong')?.textContent).toBe("2");
    const accessory=[...host!.querySelectorAll('.config-bom-row')].find(r=>r.querySelector('.config-bom-identity strong')?.textContent==="ST001")!;
    expect(accessory.querySelector('.config-bom-measure')).toBeNull();expect(accessory.querySelector('.config-bom-quantity strong')?.textContent).toBe("3");
    await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"4000");expect(profile().querySelector('.config-bom-measure strong')?.textContent).toBe("399 cm");
    const create=vi.fn((_blob:Blob)=>"blob:csv"),baseURL=URL;vi.stubGlobal("URL",class extends baseURL {static createObjectURL=create;static revokeObjectURL=vi.fn();});vi.spyOn(HTMLAnchorElement.prototype,"click").mockImplementation(()=>{});
    await click("CSV");const blob=create.mock.calls[0]![0] as unknown as Blob;
    const text=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(blob);});
    expect(text).toContain('"Misura per pezzo";"Unità misura"');expect(text.split("\r\n").find(line=>line.includes('"PR001"'))).toContain(';"2";"pz";');expect(text.split("\r\n").find(line=>line.includes('"PR001"'))).toMatch(/;"399";"cm"$/);
    expect(text.split("\r\n").find(line=>line.includes('"ST001"'))).toMatch(/;"";""$/);
    await click("Grafo");expect(host!.querySelector('[data-result-component="profile"] .config-inspector-measure')?.textContent).toBe("Misura: 399 cm");
    await click("Componenti");await clickLabel("Modifica PR001 · Profilo laterale");await clickLabel("Elimina dimensione 1");await click("Applica");expect(useConfiguratorStore.getState().sessions[path]!.data.components[0]!.measure).toBeUndefined();
    await click("BOM");expect(profile().querySelector('.config-bom-measure')).toBeNull();
  });
  it("saves eligibility on TELO Sì, allows choosing it before MODELLO in BOM and Esplora, and reopens the condition",async()=>{
    const fixture=emptyConfigurator("Telo");fixture.parameters=[{id:"model",name:"MODELLO",type:"choice",values:["TELO","ALTRO"],unit:""},{id:"telo",name:"TELO",type:"boolean",values:[],unit:""}];
    prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Parametri");await clickLabel("Regole del parametro TELO");
    await clickLabel("Selezionabilità TELO: Sì");expect(host!.querySelectorAll('dialog')).toHaveLength(1);
    expect([...host!.querySelectorAll<HTMLSelectElement>('[aria-label="Parametro della condizione"] option')].some(o=>o.value==="telo")).toBe(false);
    expect(host!.querySelector('[aria-label="Condizione per TELO: Sì"]')?.textContent).toContain('MODELLO = "TELO"');
    await click("Applica");await click("Salva");const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.version).toBe(4);expect(saved.rules).toEqual([]);expect(saved.parameters[1]!.optionRules).toHaveLength(1);expect(saved.parameters[1]!.optionRules![0]).toMatchObject({value:true,enabled:true});
    await click("BOM");const yes=()=>host!.querySelector<HTMLButtonElement>('[aria-label="TELO: Sì"]')!;
    expect(yes().disabled).toBe(false);expect(host!.querySelector<HTMLButtonElement>('[aria-label="TELO: No"]')!.disabled).toBe(false);
    await clickLabel("TELO: Sì");expect(yes().getAttribute("aria-pressed")).toBe("true");
    await clickLabel("MODELLO: TELO");expect(yes().disabled).toBe(false);expect(yes().getAttribute("aria-pressed")).toBe("true");
    await clickLabel("MODELLO: TELO");expect(yes().disabled).toBe(false);expect(yes().getAttribute("aria-pressed")).toBe("true");
    await clickLabel("TELO: Sì");await clickLabel("MODELLO: ALTRO");expect(yes().disabled).toBe(true);
    await clickLabel("MODELLO: ALTRO");expect(yes().disabled).toBe(false);
    await clickLabel("MODELLO: TELO");await clickLabel("TELO: Sì");
    await click("Esplora");expect(host!.querySelector<HTMLSelectElement>('[aria-label="TELO"]')!.value).toBe("true");
    await click("Azzera scelte");const options=()=>host!.querySelector<HTMLSelectElement>('[aria-label="TELO"]')!.options;
    expect([...options()].find(o=>o.value==="true")!.disabled).toBe(false);expect([...options()].find(o=>o.value==="false")!.disabled).toBe(false);
    await select("TELO","true");expect(host!.querySelector<HTMLSelectElement>('[aria-label="TELO"]')!.value).toBe("true");
    await select("TELO","");await select("MODELLO",JSON.stringify("ALTRO"));expect([...options()].find(o=>o.value==="true")!.disabled).toBe(true);
    await select("MODELLO",JSON.stringify("TELO"));expect([...options()].find(o=>o.value==="true")!.disabled).toBe(false);await select("TELO","true");
    await click("Genera configurazioni");expect(host!.querySelector('.config-variants')?.textContent).toContain("TELO: Sì");
    await act(async()=>{useConfiguratorStore.getState().reset();vi.mocked(vaultService.readText).mockResolvedValue({path,content:JSON.stringify(saved),size:50,lastModified:3});await useConfiguratorStore.getState().load(path);});
    await click("Parametri");expect(host!.querySelector('[aria-label="Regole del parametro TELO"]')!.classList.contains("is-conditioned")).toBe(true);
    await clickLabel("Modifica TELO");expect(host!.querySelector('.config-parameter-rule-summary')?.textContent).toContain('MODELLO = "TELO"');
    await click("Gestisci vincoli");await clickLabel("Selezionabilità TELO: Sì");expect(host!.querySelector<HTMLSelectElement>('[aria-label="Valore"]')!.value).toBe("TELO");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    await select("Valore","ALTRO");await click("Annulla");expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);await click("Annulla");
    await clickLabel("Regole del parametro TELO");await clickLabel("Rimuovi condizione per TELO: Sì");await click("Applica");
    await click("BOM");await click("Azzera scelte");expect(yes().disabled).toBe(false);
  });
  it("creates a parameter constraint, persists it, reopens it from parameter details and filters BOM options",async()=>{
    const fixture=exampleConfigurator("Vincoli");fixture.rules=fixture.rules.filter(r=>r.id!=="R3");fixture.parameters[2]!.step=1000;
    prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Parametri");await clickLabel("Regole del parametro LED");await click("Vincolo");
    expect(host!.querySelectorAll("dialog")).toHaveLength(1);
    expect([...host!.querySelector<HTMLSelectElement>('[aria-label="Tipo azione"]')!.options].map(o=>o.value)).toEqual(["requireValue","excludeValue"]);
    await act(async()=>{const field=host!.querySelector<HTMLSelectElement>('.config-action [aria-label="Valore"]')!;field.value="B";field.dispatchEvent(new Event("change",{bubbles:true}));});
    const field=host!.querySelector<HTMLInputElement>('dialog input:not([type="checkbox"])')!;field.focus();await input(field,"LED esclude B");expect(document.activeElement).toBe(field);
    await click("Applica");expect(host!.querySelector("dialog")).toBeNull();
    expect(host!.querySelector('[aria-label="Regole del parametro LED"]')!.classList.contains("is-conditioned")).toBe(true);
    await click("Salva");const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.rules.at(-1)).toMatchObject({name:"LED esclude B",parameterIds:["led"],actions:[{type:"excludeValue",parameter:"model",value:"B"}]});
    expect(saved.rules.slice(0,fixture.rules.length)).toEqual(fixture.rules);
    await act(async()=>{useConfiguratorStore.getState().reset();vi.mocked(vaultService.readText).mockResolvedValue({path,content:JSON.stringify(saved),size:50,lastModified:3});await useConfiguratorStore.getState().load(path);});
    await clickLabel("Modifica LED");expect(host!.querySelector('[aria-label="Vincoli del parametro"]')?.textContent).toContain("LED esclude B");
    await click("Gestisci vincoli");await clickLabel("Modifica LED esclude B");expect(host!.querySelector<HTMLInputElement>('dialog input')!.value).toBe("LED esclude B");await click("Annulla");await click("Annulla");
    await click("BOM");await clickLabel("LED: Sì");expect(host!.querySelector<HTMLButtonElement>('[aria-label="Modello: B"]')!.disabled).toBe(true);
    await clickLabel("LED: Sì");expect(host!.querySelector<HTMLButtonElement>('[aria-label="Modello: B"]')!.disabled).toBe(false);
    await clickLabel("Modello: B");expect(host!.querySelector<HTMLButtonElement>('[aria-label="LED: Sì"]')!.disabled).toBe(true);
  });
  it("stages removals, cancels drafts, blocks empty actions and preserves unsaved parameter edits",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await click("Parametri");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    await clickLabel("Regole del parametro LED");expect(host!.textContent).toContain("LED non disponibile sul modello B");
    await clickLabel("Elimina vincolo LED non disponibile sul modello B");await click("Annulla");expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
    await clickLabel("Regole del parametro LED");await click("Vincolo");await clickLabel("Elimina azione");
    expect([...host!.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==="Applica")!.disabled).toBe(true);await click("Annulla");
    await clickLabel("Modifica LED");const name=host!.querySelector<HTMLInputElement>('dialog input')!;await input(name,"Illuminazione");await click("Gestisci vincoli");await click("Annulla");
    expect(host!.querySelector<HTMLInputElement>('dialog input')!.value).toBe("Illuminazione");await click("Gestisci vincoli");await click("Vincolo");await click("Applica");
    expect(useConfiguratorStore.getState().sessions[path]!.data.parameters[1]!.name).toBe("Illuminazione");
    await clickLabel("Regole del parametro Illuminazione");await clickLabel("Elimina vincolo LED non disponibile sul modello B");await click("Applica");
    expect(useConfiguratorStore.getState().sessions[path]!.data.rules.some(r=>r.id==="R3")).toBe(false);
  });
  it("closes the context panel on every BOM entry while preserving choices and other navigation",async()=>{
    const original=useWorkspaceStore.getState().contextPanelOpen;
    try {
      prepare();useWorkspaceStore.getState().setContextPanelOpen(true);await mount(<ConfiguratorView path={path}/>);
      await select("Modello",JSON.stringify("A"));const before=useConfiguratorStore.getState().sessions[path]!.data;
      await click("BOM");expect(useWorkspaceStore.getState().contextPanelOpen).toBe(false);
      expect(host!.querySelector('[aria-label="Modello: A"]')!.getAttribute("aria-pressed")).toBe("true");
      const columns=host!.querySelector('.config-bom-grid')!.children;
      expect(columns[0]!.querySelector('.config-bom-options')).not.toBeNull();
      expect(columns[1]!.querySelector('.config-bom')).not.toBeNull();
      await act(async()=>useWorkspaceStore.getState().setContextPanelOpen(true));
      await click("BOM");expect(useWorkspaceStore.getState().contextPanelOpen).toBe(false);
      await act(async()=>useWorkspaceStore.getState().setContextPanelOpen(true));
      await click("Esplora");expect(useWorkspaceStore.getState().contextPanelOpen).toBe(true);
      expect(host!.querySelector<HTMLSelectElement>('[aria-label="Modello"]')!.value).toBe(JSON.stringify("A"));
      await click("Grafo");expect(useWorkspaceStore.getState().contextPanelOpen).toBe(true);
      await click("BOM");expect(useWorkspaceStore.getState().contextPanelOpen).toBe(false);
      expect(host!.querySelector('[aria-label="Modello: A"]')!.getAttribute("aria-pressed")).toBe("true");
      expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);expect(vaultService.writeText).not.toHaveBeenCalled();
    } finally { useWorkspaceStore.getState().setContextPanelOpen(original); }
  });
  it("toggles BOM option buttons and synchronizes the BOM, inspector and Esplora without changing definitions",async()=>{
    prepare();await mount(<><ConfiguratorView path={path}/><ConfiguratorInspector path={path}/></>);await click("BOM");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    expect(host!.querySelector('.config-bom-grid')).not.toBeNull();expect(host!.querySelectorAll('.config-bom-options select')).toHaveLength(0);
    await clickLabel("Modello: A");expect(host!.querySelector('[aria-label="Modello: A"]')!.getAttribute("aria-pressed")).toBe("true");
    await clickLabel("LED: Sì");await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"4500");
    expect([...host!.querySelectorAll('.config-bom-row')].find(r=>r.textContent?.includes("ST001"))?.querySelector('.config-bom-quantity strong')?.textContent).toBe("5");
    expect(host!.querySelector('.config-components-inspector [data-result-component="led-strip"]')?.textContent).toContain("Certo");
    await clickLabel("LED: Sì");expect(host!.querySelector('[aria-label="LED: Sì"]')!.getAttribute("aria-pressed")).toBe("false");expect(host!.querySelector('.config-components-inspector [data-result-component="led-strip"]')?.textContent).toContain("Possibile");
    await clickLabel("LED: No");await clickLabel("Modello: B");expect(host!.querySelector('[aria-label="Modello: A"]')!.getAttribute("aria-pressed")).toBe("false");expect(host!.querySelector('[aria-label="Modello: B"]')!.getAttribute("aria-pressed")).toBe("true");
    expect([...host!.querySelectorAll('.config-bom-row')].some(r=>r.textContent?.includes("PR001"))).toBe(false);
    await clickLabel("Modello: B");expect(host!.querySelector('[aria-label="Modello: B"]')!.getAttribute("aria-pressed")).toBe("false");
    await click("Esplora");expect(host!.querySelector<HTMLSelectElement>('[aria-label="Modello"]')!.value).toBe("");expect(host!.querySelector<HTMLSelectElement>('[aria-label="LED"]')!.value).toBe("false");expect(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!.value).toBe("4500");
    await click("BOM");expect(host!.querySelector('[aria-label="LED: No"]')!.getAttribute("aria-pressed")).toBe("true");await click("Azzera scelte");
    expect(host!.querySelectorAll('.config-option-button[aria-pressed="true"]')).toHaveLength(0);expect(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!.value).toBe("");
    expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);expect(vaultService.writeText).not.toHaveBeenCalled();
  });
  it("keeps incompatible BOM options disabled and re-enables them when another choice is cleared",async()=>{
    const fixture=exampleConfigurator("Finite");fixture.parameters[2]!.step=1000;prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("BOM");
    await clickLabel("Modello: B");const yes=()=>host!.querySelector<HTMLButtonElement>('[aria-label="LED: Sì"]')!;expect(yes().disabled).toBe(true);expect(yes().title).toContain("LED");
    await clickLabel("LED: Sì");expect(yes().getAttribute("aria-pressed")).toBe("false");
    await clickLabel("Modello: B");expect(yes().disabled).toBe(false);await clickLabel("LED: Sì");expect(host!.querySelector<HTMLButtonElement>('[aria-label="Modello: B"]')!.disabled).toBe(true);
    await clickLabel("LED: Sì");expect(host!.querySelector<HTMLButtonElement>('[aria-label="Modello: B"]')!.disabled).toBe(false);
    await clickLabel("Modello: A");await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"100");
    const active=host!.querySelector<HTMLButtonElement>('[aria-label="Modello: A"]')!;expect(active.classList.contains("is-incompatible")).toBe(true);expect(active.disabled).toBe(false);
    await clickLabel("Modello: A");expect(active.getAttribute("aria-pressed")).toBe("false");await clickLabel("Cancella Larghezza");expect(active.disabled).toBe(false);
  });
  it("shows finite numeric choices as typed buttons, supports zero and keeps the numeric field in sync",async()=>{
    const fixture=exampleConfigurator("Numeric");Object.assign(fixture.parameters[2]!,{min:0,max:2000,step:1000});prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("BOM");
    await clickLabel("Larghezza: 0");expect(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!.value).toBe("0");
    expect([...host!.querySelectorAll('.config-bom-row')].find(r=>r.textContent?.includes("ST001"))?.querySelector('.config-bom-quantity strong')?.textContent).toBe("0");
    await clickLabel("Larghezza: 0");expect(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!.value).toBe("");
    await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"2000");expect(host!.querySelector('[aria-label="Larghezza: 2000"]')!.getAttribute("aria-pressed")).toBe("true");
    await clickLabel("Cancella Larghezza");expect(host!.querySelectorAll('.config-option-button[aria-pressed="true"]')).toHaveLength(0);
  });
  it("bounds long BOM option lists and retains an off-page selected button and its focus when toggled",async()=>{
    const fixture=exampleConfigurator("Long");fixture.parameters[0]!.values=Array.from({length:50},(_,i)=>`V${i+1}`);fixture.rules[0]!.conditions[0]!.value="V50";fixture.rules=fixture.rules.filter(r=>r.id!=="R3");
    prepare(fixture);await mount(<ConfiguratorView path={path}/>);await select("Modello",JSON.stringify("V50"));await click("BOM");
    const group=host!.querySelector('.config-bom-parameter')!;expect(group.querySelectorAll('.config-option-button')).toHaveLength(25);
    const selected=host!.querySelector<HTMLButtonElement>('[aria-label="Modello: V50"]')!;await act(async()=>{selected.focus();selected.click();});
    expect(selected.getAttribute("aria-pressed")).toBe("false");expect(host!.querySelector('[aria-label="Modello: V50"]')).toBe(selected);expect(document.activeElement).toBe(selected);
    await clickLabel("Modello: V50");await click("Mostra altre opzioni di Modello");expect(group.querySelectorAll('.config-option-button')).toHaveLength(49);
    await click("Mostra altre opzioni di Modello");expect(group.querySelectorAll('.config-option-button')).toHaveLength(50);
    await click("Comprimi opzioni di Modello");expect(group.querySelectorAll('.config-option-button')).toHaveLength(25);expect(selected.getAttribute("aria-pressed")).toBe("true");
  });
  it("keeps BOM toggles responsive while worker calculations are pending and ignores old compatibility results",async()=>{
    const workers:FakeWorker[]=[];
    class FakeWorker {
      onmessage:((event:MessageEvent<Calculation>)=>void)|null=null;onerror:(()=>void)|null=null;stopped=false;
      request?:{data:Configurator;selection:Selection;analysis:boolean;conditions:Condition[]};constructor(){workers.push(this);}postMessage(r:NonNullable<FakeWorker["request"]>){this.request=r;}terminate(){this.stopped=true;}complete(){const r=this.request!;this.onmessage?.({data:calculate(r.data,r.selection,r.analysis,r.conditions)} as MessageEvent<Calculation>);}
    }
    vi.stubGlobal("Worker",FakeWorker);prepare();await mount(<ConfiguratorView path={path}/>);await act(async()=>workers.at(-1)!.complete());await click("BOM");
    const button=host!.querySelector<HTMLButtonElement>('[aria-label="Modello: A"]')!;
    await act(async()=>{button.focus();button.click();});const old=workers.at(-1)!;expect(button.getAttribute("aria-pressed")).toBe("true");
    await clickLabel("Modello: A");const latest=workers.at(-1)!;expect(old.stopped).toBe(true);expect(latest.request!.selection.model).toBeUndefined();expect(button.getAttribute("aria-pressed")).toBe("false");
    await act(async()=>old.complete());expect(host!.querySelector<HTMLButtonElement>('[aria-label="Modello: B"]')!.disabled).toBe(false);
    await act(async()=>latest.complete());expect(host!.querySelector('[aria-label="Modello: A"]')).toBe(button);expect(document.activeElement).toBe(button);expect(button.disabled).toBe(false);
  });
  it("updates choices and BOM, filters incompatible branches, and generates variants",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);
    await select("Modello",JSON.stringify("A"));await select("LED","true");await input(host!.querySelector('input[aria-label="Larghezza"]')!,"4500");
    expect(host!.textContent).toContain("Configurazione completa");expect(host!.textContent).toContain("AL001");
    const bracket=[...host!.querySelectorAll(".config-bom-row")].find(r=>r.textContent?.includes("ST001"));expect(bracket?.querySelector(".config-bom-quantity strong")?.textContent).toBe("5");
    await click("Genera configurazioni");expect(host!.querySelectorAll(".config-variants button")).toHaveLength(1);
    await click("Azzera scelte");await select("Modello",JSON.stringify("B"));
    const yes=host!.querySelector<HTMLOptionElement>('select[aria-label="LED"] option[value="true"]');expect(yes?.disabled).toBe(true);
    expect(host!.querySelectorAll(".config-bom-row")).toHaveLength(1);
  });
  it("edits visual rules and quantities and saves the structured file",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await openSavedRule();
    const quantity=host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')!;await input(quantity,"4");await click("Applica");await click("Salva");
    expect(JSON.parse(vi.mocked(vaultService.writeText).mock.calls[0]![1]).rules[0].actions[0].quantity.amount).toBe(4);
    await click("Analisi");expect(host!.textContent).toContain("controllo globale non è completo");
    await click("Grafo");expect(host!.querySelector('svg[aria-label="Grafo dei parametri, regole e componenti"]')).not.toBeNull();
    expect([...host!.querySelectorAll(".config-graph-heading")].map(n=>n.textContent)).toEqual(["Modello1. Modello","LED2. LED","Larghezza3. Larghezza","COMPONENTI"]);
  });

  it.each(["Parametri", "Componenti"])("shows compact %s and cancels edits and new drafts without changing the Vault",async section=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await click(section);
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    expect(host!.querySelectorAll(".config-definition-row").length).toBeGreaterThan(0);
    expect(host!.querySelector(".config-definition-list input")).toBeNull();
    await openFirst();expect(host!.querySelector("dialog")?.open).toBe(true);
    await input(host!.querySelector<HTMLInputElement>("dialog input:not([type=checkbox])")!,"Cancelled draft");
    expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
    await click("Annulla");expect(host!.querySelector("dialog")).toBeNull();
    expect(document.activeElement).toBe(host!.querySelector(".config-definition-summary"));
    await click(section==="Parametri" ? "Parametro" : section==="Componenti" ? "Componente" : "Regola");
    await click("Annulla");expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
    expect(vaultService.writeText).not.toHaveBeenCalled();
  });
  it("groups compact component rows and persists reordering of interleaved group members",async()=>{
    const fixture=exampleConfigurator("Pergola");
    fixture.components[3]!.group="Profili";
    fixture.components=[fixture.components[0]!,fixture.components[1]!,fixture.components[3]!,fixture.components[2]!,{id:"ungrouped",code:"NEW",name:"Senza assegnazione",group:"  ",unit:"pz",note:""}];
    prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    const groups=host!.querySelectorAll(".config-component-group");
    expect([...groups].map(g=>g.querySelector("h3")?.textContent)).toEqual(["Profili","Illuminazione","Senza gruppo"]);
    expect([...groups].map(g=>g.querySelectorAll(".config-definition-row").length)).toEqual([2,2,1]);
    expect(host!.querySelectorAll(".config-definition-list.is-compact")).toHaveLength(3);
    expect([...host!.querySelectorAll(".config-definition-summary > span")].every(s=>!s.textContent?.includes("Profili") && !s.textContent?.includes("Illuminazione"))).toBe(true);
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    await clickLabel("Sposta giù LED001 · Strip LED");await click("Salva");
    const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.components.map(c=>c.id)).toEqual(["profile","power","bracket","led-strip","ungrouped"]);
    expect(saved.rules).toEqual(before.rules);
    for(const c of saved.components)expect(c).toEqual(before.components.find(x=>x.id===c.id));
    await clickLabel("Modifica LED001 · Strip LED");
    await input(host!.querySelectorAll<HTMLInputElement>("dialog input")[2]!,"Profili");await click("Applica");
    const row=host!.querySelector('[data-definition-id="led-strip"]')!;
    expect(row.closest(".config-component-group")?.querySelector("h3")?.textContent).toBe("Profili");
    expect(host!.querySelector('[aria-label="Modifica regola per LED001"]')?.classList.contains("is-conditioned")).toBe(true);
  });
  it("assigns whole groups to families, reorders sections without changing rules and persists collapsed views",async()=>{
    const fixture=exampleConfigurator("Pergola");prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    for(const [group,family] of [["Profili","PROFILI"],["Illuminazione","ACCESSORI"],["Fissaggi","ACCESSORI"]]) {
      await clickLabel(`Assegna famiglia al gruppo ${group}`);await input(host!.querySelector<HTMLInputElement>("dialog input")!,family!);await click("Applica");
    }
    const familyNames=()=>[...host!.querySelectorAll(".config-family-heading h3")].map(h=>h.textContent);
    expect(familyNames()).toEqual(["PROFILI","ACCESSORI"]);
    await clickLabel("Sposta su famiglia ACCESSORI");expect(familyNames()).toEqual(["ACCESSORI","PROFILI"]);
    const groups=host!.querySelectorAll<HTMLElement>('.config-component-family[aria-label="Famiglia ACCESSORI"] .config-component-group');
    const transfer={setData:vi.fn(),effectAllowed:"",dropEffect:""};
    const drag=async(element:Element,type:string,y=1)=>act(async()=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{dataTransfer:{value:transfer},clientY:{value:y}});element.dispatchEvent(e);});
    await drag(groups[0]!.querySelector(".config-component-group-heading .config-drag-handle")!,"dragstart");await act(async()=>groups[0]!.querySelector(".config-component-group-heading .config-drag-handle")!.dispatchEvent(new Event("pointercancel",{bubbles:true})));await drag(groups[1]!.querySelector(".config-component-group-heading")!,"drop");
    expect([...host!.querySelectorAll('.config-component-family[aria-label="Famiglia ACCESSORI"] .config-component-group h3')].map(h=>h.textContent)).toEqual(["Fissaggi","Illuminazione"]);
    await clickLabel("Comprimi gruppo Fissaggi");await clickLabel("Comprimi famiglia ACCESSORI");await click("Salva");
    const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.rules).toEqual(fixture.rules);expect(saved.parameters).toEqual(fixture.parameters);
    expect(saved.components.map(c=>c.id)).toEqual(fixture.components.map(c=>c.id));
    expect(saved.components.filter(c=>c.group==="Illuminazione").every(c=>c.family==="ACCESSORI")).toBe(true);
    await act(async()=>root!.unmount());host!.remove();root=undefined;host=undefined;useConfiguratorStore.getState().reset();vi.mocked(vaultService.readText).mockResolvedValue({path,content:JSON.stringify(saved),size:50,lastModified:2});
    await mount(<ConfiguratorView path={path}/>);await click("Componenti");expect(familyNames()).toEqual(["ACCESSORI","PROFILI"]);
    expect(host!.querySelector('[aria-label="Espandi famiglia ACCESSORI"]')?.getAttribute("aria-expanded")).toBe("false");
    await clickLabel("Espandi famiglia ACCESSORI");expect(host!.querySelector('[aria-label="Espandi gruppo Fissaggi"]')?.getAttribute("aria-expanded")).toBe("false");
    await clickLabel("Espandi gruppo Fissaggi");await clickLabel("Modifica ST001 · Staffa");
    expect(host!.querySelectorAll<HTMLInputElement>("dialog input")[5]!.value).toBe("ACCESSORI");
  });
  it("scopes component reordering to its family and supports touch and keyboard group movement",async()=>{
    const fixture=exampleConfigurator("Scoped");fixture.components.forEach(c=>c.group="Comune");fixture.components[0]!.family="PROFILI";fixture.components[1]!.family="ACCESSORI";fixture.components[2]!.family="ACCESSORI";fixture.components[3]!.family="ACCESSORI";fixture.components[3]!.group="Altro";
    prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    await clickLabel("Sposta giù LED001 · Strip LED");expect(useConfiguratorStore.getState().sessions[path]!.data.components.map(c=>c.id)).toEqual(["profile","power","led-strip","bracket"]);
    const section=host!.querySelector('.config-component-family[aria-label="Famiglia ACCESSORI"]')!;
    const headers=section.querySelectorAll<HTMLElement>('.config-component-group-heading'), handle=headers[0]!.querySelector<HTMLButtonElement>('.config-drag-handle')!;
    handle.setPointerCapture=vi.fn();Object.defineProperty(document,"elementFromPoint",{configurable:true,value:vi.fn(()=>headers[1])});
    const pointer=async(type:string)=>act(async()=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(e,{pointerType:{value:"touch"},pointerId:{value:1},clientX:{value:1},clientY:{value:1}});handle.dispatchEvent(e);});
    await pointer("pointerdown");await pointer("pointermove");await pointer("pointerup");
    expect([...section.querySelectorAll('.config-component-group-heading h3')].map(h=>h.textContent)).toEqual(["Altro","Comune"]);
    await act(async()=>handle.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowUp",altKey:true,bubbles:true,cancelable:true})));
    expect([...section.querySelectorAll('.config-component-group-heading h3')].map(h=>h.textContent)).toEqual(["Comune","Altro"]);
    expect(useConfiguratorStore.getState().sessions[path]!.data.rules).toEqual(fixture.rules);
  });
  it("summarizes only enabled component alternatives on hover and right click without changing or resetting the rule",async()=>{
    const fixture=exampleConfigurator("Pergola");fixture.version=3;
    const original=fixture.rules[0]!;fixture.rules[0]={...original,actions:[],componentIds:["profile","power"],cases:[{...original,id:"a",name:"Profilo attivo"},{...original,id:"b",name:"Alternativa spenta",enabled:false},{...original,id:"c",name:"Altro componente",actions:[{...original.actions[0]!,component:"power"}]}]};
    prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    const button=host!.querySelector<HTMLButtonElement>('[aria-label="Modifica regola per PR001"]')!;
    await act(async()=>button.dispatchEvent(new MouseEvent("mouseover",{bubbles:true})));
    expect(host!.querySelectorAll('.config-rule-preview li')).toHaveLength(1);
    expect(host!.querySelector('.config-rule-preview')?.textContent).toContain("Profilo attivo");
    expect(host!.querySelector('.config-rule-preview')?.textContent).toContain('Modello = "A"');
    expect(host!.querySelector('.config-rule-preview')?.textContent).toContain("Aggiungi · 2");
    expect(host!.querySelector('.config-rule-preview')?.textContent).not.toContain("Alternativa spenta");
    const menu=new MouseEvent("contextmenu",{bubbles:true,cancelable:true});await act(async()=>button.dispatchEvent(menu));expect(menu.defaultPrevented).toBe(true);
    await act(async()=>button.dispatchEvent(new MouseEvent("mouseout",{bubbles:true,relatedTarget:document.body})));
    expect(host!.querySelector('.config-rule-preview')).not.toBeNull();expect(host!.querySelector('dialog')).toBeNull();
    await act(async()=>document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true})));expect(host!.querySelector('.config-rule-preview')).toBeNull();
    await clickLabel("Modifica regola per PR001");expect(host!.querySelectorAll('section.config-rule-alternative')).toHaveLength(4);
    await click("Annulla");expect(useConfiguratorStore.getState().sessions[path]!.data.rules).toEqual(fixture.rules);
  });
  it("adds a component only after applying the popup and retains all detail fields",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    await click("Componente");await click("Modalità completa");
    await act(async()=>host!.querySelector<HTMLInputElement>('input[name="guided-inclusion"][value="catalog"]')!.click());
    await input(host!.querySelector<HTMLInputElement>("#guided-code")!,"NEW001");
    await input(host!.querySelector<HTMLInputElement>("#guided-name")!,"Nuovo profilo");
    await input(host!.querySelector<HTMLInputElement>('[aria-label="Gruppo"]')!,"Profili");
    await input(host!.querySelector<HTMLInputElement>('[aria-label="Scheda tecnica"]')!,"Scheda.md");
    expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
    await click("Crea componente");
    const added=useConfiguratorStore.getState().sessions[path]!.data.components.at(-1)!;
    expect(added).toMatchObject({code:"NEW001",name:"Nuovo profilo",group:"Profili",unit:"pz",note:"Scheda.md"});
    expect(useConfiguratorStore.getState().sessions[path]!.data.rules).toEqual(before.rules);
    await clickLabel("Modifica NEW001 · Nuovo profilo");expect(host!.querySelectorAll<HTMLInputElement>("dialog input")[4]!.value).toBe("Scheda.md");
  });
  it.each(["Parametri", "Componenti"])("reorders %s by drag and keyboard and saves stable IDs and references",async section=>{
    const fixture=exampleConfigurator("Pergola");if(section==="Componenti")fixture.components.forEach(c=>c.group="Unico");
    prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click(section);
    const key=section==="Parametri" ? "parameters" : "components";
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    const original=before[key];const rows=host!.querySelectorAll<HTMLElement>(".config-definition-row");
    const transfer={setData:vi.fn(),effectAllowed:"",dropEffect:""};
    const dispatch=async(element:Element,type:string)=>{await act(async()=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{dataTransfer:{value:transfer},clientY:{value:1}});element.dispatchEvent(event);});};
    await dispatch(rows[0]!.querySelector(".config-drag-handle")!,"dragstart");
    await act(async()=>rows[0]!.querySelector(".config-drag-handle")!.dispatchEvent(new Event("pointercancel",{bubbles:true})));
    await dispatch(rows[2]!,"dragover");expect(rows[2]!.classList.contains("drop-after")).toBe(true);
    await dispatch(rows[2]!,"drop");
    const next=useConfiguratorStore.getState().sessions[path]!.data;
    expect(next[key].map(x=>x.id)).toEqual([original[1]!.id,original[2]!.id,original[0]!.id,...original.slice(3).map(x=>x.id)]);
    expect(next[key].find(x=>x.id===original[0]!.id)).toEqual(original[0]);
    expect(next.rules).toBe(before.rules);
    expect(next[key==="components" ? "rules" : "components"]).toBe(before[key==="components" ? "rules" : "components"]);
    const handle=host!.querySelectorAll(".config-definition-row .config-drag-handle")[2]!;
    await act(async()=>handle.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowUp",altKey:true,bubbles:true,cancelable:true})));
    expect(useConfiguratorStore.getState().sessions[path]!.data[key][1]!.id).toBe(original[0]!.id);
    expect([...host!.querySelectorAll('.config-sr-only[role="status"]')].some(s=>s.textContent?.includes("posizione 2"))).toBe(true);
    const topTitle=host!.querySelector(".config-definition-summary strong")!.textContent!;
    await clickLabel(`Sposta giù ${topTitle}`);
    expect(useConfiguratorStore.getState().sessions[path]!.data[key].map(x=>x.id)).toEqual(original.map(x=>x.id));
    await clickLabel(`Sposta giù ${host!.querySelector(".config-definition-summary strong")!.textContent!}`);
    await click("Salva");const saved=JSON.parse(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved[key].map((x:{id:string})=>x.id)).toEqual(useConfiguratorStore.getState().sessions[path]!.data[key].map(x=>x.id));
    expect(host!.querySelectorAll(".is-dragging, .drop-before, .drop-after")).toHaveLength(0);
  });

  it("supports touch dragging and Escape cancellation of a component draft",async()=>{
    const fixture=exampleConfigurator("Pergola");fixture.components.forEach(c=>c.group="Unico");prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    const rows=host!.querySelectorAll<HTMLElement>(".config-definition-row");
    const handle=rows[0]!.querySelector<HTMLButtonElement>(".config-drag-handle")!;
    handle.setPointerCapture=vi.fn();
    Object.defineProperty(document,"elementFromPoint",{configurable:true,value:vi.fn(()=>rows[1])});
    const pointer=async(type:string)=>{await act(async()=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperties(event,{pointerType:{value:"touch"},pointerId:{value:1},clientX:{value:1},clientY:{value:1}});handle.dispatchEvent(event);});};
    await pointer("pointerdown");await pointer("pointermove");await pointer("pointerup");
    expect(useConfiguratorStore.getState().sessions[path]!.data.components[1]!.id).toBe(before.components[0]!.id);
    const reordered=useConfiguratorStore.getState().sessions[path]!.data;
    await openFirst();await input(host!.querySelector<HTMLInputElement>("dialog input")!,"Cancelled");
    vi.spyOn(window,"confirm").mockReturnValue(false);
    await act(async()=>host!.querySelector("dialog")!.dispatchEvent(new Event("cancel",{cancelable:true,bubbles:true})));
    expect(host!.querySelector("dialog")).not.toBeNull();
    vi.mocked(window.confirm).mockReturnValue(true);
    await act(async()=>host!.querySelector("dialog")!.dispatchEvent(new Event("cancel",{cancelable:true,bubbles:true})));
    expect(host!.querySelector("dialog")).toBeNull();expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(reordered);
  });

  it("creates a conditional rule directly from a component row and persists its real BOM effect",async()=>{
    const fixture=exampleConfigurator("Pergola");fixture.rules=fixture.rules.filter(r=>r.id!=="R2");prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    await clickLabel("Aggiungi regola per AL001");
    expect(host!.querySelector<HTMLSelectElement>("select[aria-label=\"Componente dell'azione\"]")?.value).toBe("power");
    expect(host!.querySelectorAll("dialog")).toHaveLength(1);
    await select("Parametro della condizione","led");await input(host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')!,"2");
    expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
    await click("Applica");await click("Salva");
    const saved=JSON.parse(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.rules.at(-1)).toMatchObject({conditions:[{parameter:"led",operator:"eq",value:true}],actions:[{type:"add",component:"power",quantity:{amount:2}}]});
    expect(saved.rules.slice(0,-1)).toEqual(before.rules);expect(saved.components).toEqual(before.components);
    await click("Esplora");await select("Modello",JSON.stringify("A"));await select("LED","true");await input(host!.querySelector<HTMLInputElement>('input[aria-label="Larghezza"]')!,"3000");
    const power=[...host!.querySelectorAll(".config-bom-row")].find(row=>row.textContent?.includes("AL001"));
    expect(power?.querySelector(".config-bom-quantity strong")?.textContent).toBe("2");
    await select("LED","false");expect([...host!.querySelectorAll(".config-bom-row")].some(row=>row.textContent?.includes("AL001"))).toBe(false);
    await click("Componenti");await clickLabel("Modifica AL001 · Alimentatore");expect(host!.querySelector(".config-component-rules")?.textContent).toContain("Inclusione AL001");
  });
  it.each([false,true])("retains the component draft on rule cancellation and applies both atomically (new=%s)",async isNew=>{
    const fixture=exampleConfigurator("Pergola");if(!isNew)fixture.rules=fixture.rules.filter(r=>r.id!=="R1");prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    if(isNew){
      await click("Componente");
      await input(host!.querySelector<HTMLInputElement>("#guided-code")!,"PENDING001");
      await input(host!.querySelector<HTMLInputElement>("#guided-name")!,"Profilo in bozza");
      await click("Avanti");
      await act(async()=>host!.querySelector<HTMLInputElement>('input[name="guided-inclusion"][value="always"]')!.click());
      await click("Avanti");
      await input(host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')!,"8");
      expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
      await click("Indietro");await click("Indietro");
      expect(host!.querySelector<HTMLInputElement>("#guided-code")!.value).toBe("PENDING001");
      await click("Annulla");
      expect(host!.querySelector("dialog")).toBeNull();
      expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
      expect(vaultService.writeText).not.toHaveBeenCalled();
      await click("Componente");
      await input(host!.querySelector<HTMLInputElement>("#guided-code")!,"PENDING001");
      await input(host!.querySelector<HTMLInputElement>("#guided-name")!,"Profilo in bozza");
      await click("Avanti");
      await act(async()=>host!.querySelector<HTMLInputElement>('input[name="guided-inclusion"][value="always"]')!.click());
      await click("Avanti");
      await input(host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')!,"8");
      await click("Crea componente");await click("Salva");
      const next=useConfiguratorStore.getState().sessions[path]!.data;
      const component=next.components.find(c=>c.code==="PENDING001")!;
      expect(next.components).toHaveLength(before.components.length+1);
      expect(component.name).toBe("Profilo in bozza");
      expect(next.rules.at(-1)?.conditions).toEqual([]);
      expect(next.rules.at(-1)?.actions[0]?.component).toBe(component.id);
      expect(next.rules.at(-1)?.actions[0]?.quantity.amount).toBe(8);
      expect(JSON.parse(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1])).toEqual(next);
      return;
    }
    await openFirst();
    const fields=host!.querySelectorAll<HTMLInputElement>("dialog input");
    await input(fields[0]!,"PENDING001");await input(fields[1]!,"Profilo in bozza");
    await click("Aggiungi regola");expect(host!.querySelectorAll("dialog")).toHaveLength(1);
    expect(host!.querySelector("dialog")?.textContent).toContain("Applica salva il componente e la nuova regola");
    await input(host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')!,"8");
    await click("Annulla");expect(host!.querySelector<HTMLInputElement>("dialog input")?.value).toBe("PENDING001");
    expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);expect(vaultService.writeText).not.toHaveBeenCalled();
    await click("Aggiungi regola");await click("Applica");await click("Salva");
    const next=useConfiguratorStore.getState().sessions[path]!.data;
    const component=next.components.find(c=>c.code==="PENDING001")!;
    expect(next.components).toHaveLength(before.components.length+(isNew ? 1 : 0));
    expect(component.name).toBe("Profilo in bozza");expect(next.rules.at(-1)?.actions[0]?.component).toBe(component.id);
    expect(next.rules.at(-1)?.actions[0]?.quantity.amount).toBe(1);
    if(!isNew) expect(component.id).toBe(before.components[0]!.id);
    expect(JSON.parse(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1])).toEqual(next);
  });
  it("cancels a row shortcut without creating a rule or changing the component",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    await clickLabel("Modifica regola per LED001");await click("Annulla");
    expect(host!.querySelector("dialog")).toBeNull();expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
    expect(vaultService.writeText).not.toHaveBeenCalled();
  });
  it("reopens a saved component rule from its card and updates the same rule without duplication",async()=>{
    const fixture=exampleConfigurator("Pergola");fixture.rules=fixture.rules.filter(r=>r.id!=="R2");prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Componenti");await clickLabel("Aggiungi regola per AL001");
    await select("Parametro della condizione","led");await clickLabel("Nega condizione");
    await input(host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')!,"2");await click("Applica");await click("Salva");
    const serialized=vi.mocked(vaultService.writeText).mock.calls.at(-1)![1];
    const saved=parseConfigurator(serialized), id=saved.rules.at(-1)!.id;
    await act(async()=>root!.unmount());root=undefined;host!.remove();useConfiguratorStore.getState().reset();
    vi.mocked(vaultService.readText).mockResolvedValue({path,content:serialized,size:serialized.length,lastModified:2});
    await mount(<ConfiguratorView path={path}/>);await click("Componenti");await clickLabel("Modifica AL001 · Alimentatore");
    const card=host!.querySelector('.config-component-rules')!;
    expect(card.textContent).toContain("Inclusione AL001");expect(card.textContent).toContain("NON(LED = Sì)");
    await clickLabel("Modifica Inclusione AL001");
    await input(host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')!,"7");await click("Applica");await click("Salva");
    const updated=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(updated.rules).toHaveLength(saved.rules.length);
    expect(updated.rules.filter(r=>r.id===id)).toHaveLength(1);
    expect(updated.rules.find(r=>r.id===id)?.actions[0]?.quantity.amount).toBe(7);
    await clickLabel("Modifica AL001 · Alimentatore");await clickLabel("Modifica Inclusione AL001");
    expect(host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')?.value).toBe("7");
  });
  it("edits shared and inactive rules from component cards and cancels without changing saved data",async()=>{
    const fixture=exampleConfigurator("Pergola");fixture.rules[1]!.enabled=false;
    prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Componenti");await clickLabel("Modifica LED001 · Strip LED");
    expect(host!.querySelector(".config-component-rules")?.textContent).toContain("Disattivata");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    await clickLabel("Modifica Kit illuminazione");expect(host!.textContent).toContain("collegata anche ad altri componenti");
    await input(host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')!,"8");await click("Annulla");
    expect(host!.querySelector(".config-component-rules")).not.toBeNull();expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
    await clickLabel("Modifica Kit illuminazione");await input(host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')!,"3");await click("Applica");
    expect(useConfiguratorStore.getState().sessions[path]!.data.rules).toHaveLength(before.rules.length);
    await clickLabel("Modifica AL001 · Alimentatore");await clickLabel("Modifica Kit illuminazione");
    expect(host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')?.value).toBe("3");
    await click("Annulla");await click("Annulla");await clickLabel("Modifica LED001 · Strip LED");await clickLabel("Modifica Kit illuminazione");
    expect(host!.querySelector<HTMLInputElement>('input[aria-label="Quantità"]')?.value).toBe("3");
    expect(host!.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false);
  });
  it("opens the existing component rule from the row instead of resetting it or appending another",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    expect(host!.querySelector('[aria-label="Aggiungi regola per PR001"]')).toBeNull();
    await clickLabel("Modifica regola per PR001");
    expect(host!.querySelector<HTMLSelectElement>('[aria-label="Parametro della condizione"]')?.value).toBe("model");
    expect(host!.querySelector<HTMLInputElement>('[aria-label="Quantità"]')?.value).toBe("2");
    await input(host!.querySelector<HTMLInputElement>('[aria-label="Quantità"]')!,"6");await click("Applica");await click("Salva");
    const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.rules).toHaveLength(before.rules.length);expect(saved.rules[0]!.id).toBe("R1");
    await clickLabel("Modifica regola per PR001");expect(host!.querySelector<HTMLInputElement>('[aria-label="Quantità"]')?.value).toBe("6");
    await click("Annulla");await clickLabel("Modifica PR001 · Profilo laterale");
    expect(host!.querySelectorAll('.config-component-rules .config-definition-row')).toHaveLength(1);
    expect([...host!.querySelectorAll('dialog button')].some(b=>b.textContent?.trim()==="Aggiungi regola")).toBe(false);
  });
  it("shows all legacy alternatives in one component rule and persists consolidation without hidden active rules",async()=>{
    const fixture=exampleConfigurator("Legacy");fixture.rules.push({...fixture.rules[0]!,id:"extra",name:"Extra LED",conditions:[{parameter:"led",operator:"eq",value:true}],actions:[{...fixture.rules[0]!.actions[0]!,quantity:{amount:3,divisor:1,rounding:"none"}}]});
    prepare(fixture);await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    const before=useConfiguratorStore.getState().sessions[path]!.data;
    await clickLabel("Modifica PR001 · Profilo laterale");
    expect(host!.querySelectorAll('.config-component-rules .config-definition-row')).toHaveLength(1);
    await click("Modifica regola");
    expect(host!.querySelectorAll('.config-rule-alternative')).toHaveLength(2);
    expect([...host!.querySelectorAll<HTMLInputElement>('[aria-label="Quantità"]')].map(i=>i.value)).toEqual(["2","3"]);
    await click("Annulla");expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(before);
    await click("Modifica regola");await click("Applica");await click("Salva");
    const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.version).toBe(3);expect(saved.rules.some(r=>r.id==="extra")).toBe(false);expect(saved.rules[0]!.cases).toHaveLength(2);
    await clickLabel("Modifica regola per PR001");expect(host!.querySelectorAll('.config-rule-alternative')).toHaveLength(2);await click("Annulla");
    await click("Esplora");await select("Modello",JSON.stringify("A"));await select("LED","true");await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"3000");
    const profile=[...host!.querySelectorAll('.config-bom-row')].find(r=>r.textContent?.includes("PR001"));
    expect(profile?.querySelector('.config-bom-quantity strong')?.textContent).toBe("5");
  });
  it("retains the sole component association after changing its action to a parameter constraint",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await click("Componenti");await clickLabel("Modifica regola per PR001");
    await select("Tipo azione","requireValue");await select("Parametro del vincolo","led");await click("Applica");await click("Salva");
    await clickLabel("Modifica regola per PR001");expect(host!.querySelector<HTMLSelectElement>('[aria-label="Tipo azione"]')?.value).toBe("requireValue");
    expect(useConfiguratorStore.getState().sessions[path]!.data.rules).toHaveLength(4);
  });
  it("has no rules tab and keeps general parameter constraints editable",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);
    expect([...host!.querySelectorAll(".config-tabs button")].some(b=>b.textContent?.trim()==="Regole")).toBe(false);
    await click("Componenti");
    expect(host!.querySelector('[data-definition-id="profile"] .config-component-description')?.textContent).toContain("Profilo laterale");
    await act(async()=>{host!.querySelector<HTMLDetailsElement>(".config-general-constraints")!.open=true;});
    await clickLabel("Modifica LED non disponibile sul modello B");
    expect(host!.querySelector<HTMLSelectElement>('[aria-label="Tipo azione"]')?.value).toBe("excludeValue");
    await click("Annulla");
  });
  it("creates an example in the Vault and opens it as a document",async()=>{
    prepare();const create=vi.spyOn(vaultService,"createConfigurator").mockResolvedValue({path,snapshot});
    await mount(<ConfiguratorLibrary/>);await input(host!.querySelector("input")!,"Pergola");await act(async()=>host!.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click());
    await act(async()=>host!.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
    expect(create).toHaveBeenCalledWith("Pergola",expect.stringContaining('"model"'));
    expect(useWorkspaceStore.getState().tabs.at(-1)?.path).toBe(path);expect(useWorkspaceStore.getState().tabs.at(-1)?.title).toBe("Pergola");
  });
  it("resolves links from notes without putting configurator data in the Markdown index",()=>{
    prepare();const html=renderMarkdownSafe("[[Configurators/Pergola.config.json]]",navigationKnowledge());expect(html).toContain("is-resolved");
    useKnowledgeNavigationStore.getState().activate("Scheda.md","Pergola");expect(useWorkspaceStore.getState().tabs.at(-1)?.path).toBe(path);
    expect(useKnowledgeStore.getState().documents[path]).toBeUndefined();
  });
  it("keeps a dirty configurator tab open when saving fails",async()=>{
    prepare();await useConfiguratorStore.getState().load(path);useConfiguratorStore.getState().edit(path,{...useConfiguratorStore.getState().sessions[path]!.data,title:"Dirty"});
    vi.mocked(vaultService.writeText).mockRejectedValue(new Error("External conflict"));
    useWorkspaceStore.getState().openEntry(snapshot.root[0]!.children![0]!);await mount(<TabBar/>);
    await act(async()=>host!.querySelector<HTMLButtonElement>('[aria-label="Chiudi Pergola"]')!.click());
    expect(useWorkspaceStore.getState().tabs).toHaveLength(2);expect(useConfiguratorStore.getState().sessions[path]!.error).toBe("External conflict");
  });
});

describe("compact dimension editor",()=>{
  it("edits two axes, validates drafts, saves and reopens them, and shows the same result in BOM and graph",async()=>{
    const data=exampleConfigurator("Telo");data.parameters.push({id:"height",name:"Altezza",type:"number",values:[],unit:"cm"});
    prepare(data);await mount(<><ConfiguratorView path={path}/><ConfiguratorInspector path={path}/></>);await click("Componenti");await clickLabel("Modifica PR001 · Profilo laterale");
    await click("Dimensione");await select("Nome dimensione 1","Larghezza");await select("Unità dimensione 1","cm");await input(host!.querySelector<HTMLInputElement>('[aria-label="Correzione dimensione 1"]')!,"-2");
    await click("Dimensione");await select("Nome dimensione 2","Altezza");await select("Parametro dimensione 2","height");
    const offset=host!.querySelector<HTMLInputElement>('[aria-label="Correzione dimensione 2"]')!;await input(offset,"");
    const apply=()=>[...host!.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==="Applica")!;
    expect(apply().disabled).toBe(true);await input(offset,"-3");expect(apply().disabled).toBe(false);
    await select("Nome dimensione 2","Larghezza");expect(apply().disabled).toBe(true);expect(host!.textContent).toContain("nome della dimensione già usato");
    await select("Nome dimensione 2","Altezza");await click("Applica");await click("Salva");
    const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.version).toBe(6);expect(saved.components[0]!.dimensions).toMatchObject([{name:"Larghezza",parameter:"width",offset:-2,unit:"cm"},{name:"Altezza",parameter:"height",offset:-3,unit:"cm"}]);expect(saved.rules).toEqual(data.rules);
    await clickLabel("Modifica PR001 · Profilo laterale");expect(host!.querySelectorAll('.config-dimension-row')).toHaveLength(2);expect(host!.querySelector<HTMLInputElement>('[aria-label="Correzione dimensione 2"]')!.value).toBe("-3");await click("Annulla");
    await click("BOM");await clickLabel("Modello: A");await clickLabel("LED: No");await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"3000");await input(host!.querySelector<HTMLInputElement>('[aria-label="Altezza"]')!,"400");
    const row=[...host!.querySelectorAll('.config-bom-row')].find(r=>r.querySelector('.config-bom-identity strong')?.textContent==="PR001")!;
    expect(row.querySelector('.config-bom-measure strong')?.textContent).toBe("L 298 × H 397 cm");expect(row.querySelector('.config-bom-quantity strong')?.textContent).toBe("2");
    await click("Grafo");expect(host!.querySelector('[data-result-component="profile"] .config-inspector-measure')?.textContent).toBe("Misura: L 298 × H 397 cm");
    await click("Componenti");await clickLabel("Modifica PR001 · Profilo laterale");await select("Nome dimensione 2","custom");await input(host!.querySelector<HTMLInputElement>('[aria-label="Nome personalizzato dimensione 2"]')!,"Taglio");
    await clickLabel("Elimina dimensione 1");await click("Applica");const dimension=useConfiguratorStore.getState().sessions[path]!.data.components[0]!.dimensions!;
    expect(dimension).toHaveLength(1);expect(dimension[0]).toMatchObject({id:saved.components[0]!.dimensions![1]!.id,name:"Taglio",parameter:"height",offset:-3});
  });
  it("opens a legacy measurement without rewriting it, and preserves it when a second axis is canceled",async()=>{
    const data=exampleConfigurator("Legacy");data.version=5;data.components[0]!.measure={parameter:"width",offset:-1,unit:"cm"};
    prepare(data);await mount(<ConfiguratorView path={path}/>);await click("Componenti");await clickLabel("Modifica PR001 · Profilo laterale");
    expect(host!.querySelector<HTMLInputElement>('[aria-label="Correzione dimensione 1"]')!.value).toBe("-1");await click("Applica");
    expect(useConfiguratorStore.getState().sessions[path]!.data).toEqual(data);
    await clickLabel("Modifica PR001 · Profilo laterale");await click("Dimensione");await click("Annulla");
    expect(useConfiguratorStore.getState().sessions[path]!.data).toEqual(data);
  });
});

describe("text component properties",()=>{
  it("creates a text parameter, links it to a component and keeps its value across BOM, Explore, graph and reopening",async()=>{
    prepare();await mount(<><ConfiguratorView path={path}/><ConfiguratorInspector path={path}/></>);await click("Parametri");await click("Parametro");
    await input(host!.querySelector<HTMLInputElement>('dialog input')!,"Materiale");await select("Tipo parametro","text");
    expect(host!.querySelector('dialog textarea[aria-label="Opzioni di testo"]')).not.toBeNull();expect(host!.querySelector('dialog input[type="number"]')).toBeNull();
    await click("Applica");const parameter=useConfiguratorStore.getState().sessions[path]!.data.parameters.find(p=>p.name==="Materiale")!;expect(parameter.type).toBe("text");
    await click("Componenti");await clickLabel("Modifica PR001 · Profilo laterale");await click("Proprietà");
    expect(host!.querySelector<HTMLInputElement>('[aria-label="Nome proprietà 1"]')!.value).toBe("Materiale");
    expect(host!.querySelector<HTMLSelectElement>('[aria-label="Parametro proprietà 1"]')!.value).toBe(parameter.id);
    await click("Applica");await click("Salva");const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.version).toBe(8);expect(saved.components[0]!.properties).toMatchObject([{name:"Materiale",parameter:parameter.id}]);
    vi.mocked(vaultService.readText).mockResolvedValue({path,content:JSON.stringify(saved),size:60,lastModified:2});
    await click("BOM");await clickLabel("Modello: A");await clickLabel("LED: No");await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"3000");
    const row=()=>[...host!.querySelectorAll('.config-bom-row')].find(r=>r.querySelector('.config-bom-identity strong')?.textContent==="PR001")!;
    expect(row().querySelector('.config-property-values')?.textContent).toContain("Da definire");expect(host!.querySelector('.config-result-status strong')?.textContent).toBe("Configurazione completa");
    const text='Alluminio; "RAL 7016"';await input(host!.querySelector<HTMLInputElement>('[aria-label="Materiale"]')!,text);
    expect(row().querySelector('.config-property-values dd')?.textContent).toBe(text);expect(row().querySelector('.config-bom-quantity strong')?.textContent).toBe("2");
    await click("Esplora");expect(host!.querySelector<HTMLInputElement>('[aria-label="Materiale"]')!.value).toBe(text);
    await click("Grafo");expect(host!.querySelector('[data-result-component="profile"] .config-property-values dd')?.textContent).toBe(text);
    await act(async()=>root!.render(<div>Altra nota</div>));await act(async()=>root!.render(<><ConfiguratorView path={path}/><ConfiguratorInspector path={path}/></>));
    await click("BOM");expect(host!.querySelector<HTMLInputElement>('[aria-label="Materiale"]')!.value).toBe(text);
    await input(host!.querySelector<HTMLInputElement>('[aria-label="Materiale"]')!,"<img src=x onerror=alert(1)>");expect(row().querySelector('.config-property-values img')).toBeNull();expect(row().querySelector('.config-property-values dd')?.textContent).toContain("<img");
    await clickLabel("Cancella Materiale");expect(row().querySelector('.config-property-values dd')?.textContent).toBe("Da definire");
  });
  it("validates property drafts and preserves associations on cancel",async()=>{
    const data=exampleConfigurator("Testo");data.version=7;data.parameters.push({id:"material",name:"Materiale",type:"text",values:[],unit:""});
    prepare(data);await mount(<ConfiguratorView path={path}/>);await click("Componenti");await clickLabel("Modifica PR001 · Profilo laterale");await click("Proprietà");await click("Proprietà");
    const apply=()=>[...host!.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==="Applica")!;
    await input(host!.querySelector<HTMLInputElement>('[aria-label="Nome proprietà 2"]')!," materiale ");expect(apply().disabled).toBe(true);expect(host!.textContent).toContain("nome della proprietà già usato");
    await clickLabel("Elimina proprietà 2");await select("Parametro proprietà 1","");expect(apply().disabled).toBe(true);
    await select("Parametro proprietà 1","material");await click("Applica");const saved=structuredClone(useConfiguratorStore.getState().sessions[path]!.data);
    await clickLabel("Modifica PR001 · Profilo laterale");await input(host!.querySelector<HTMLInputElement>('[aria-label="Nome proprietà 1"]')!,"Finitura");await click("Annulla");expect(useConfiguratorStore.getState().sessions[path]!.data).toEqual(saved);
    await clickLabel("Modifica PR001 · Profilo laterale");expect(host!.querySelector<HTMLInputElement>('[aria-label="Nome proprietà 1"]')!.value).toBe("Materiale");await clickLabel("Elimina proprietà 1");await click("Applica");expect(useConfiguratorStore.getState().sessions[path]!.data.components[0]!.properties).toEqual([]);
  });
});

describe("text options and component overrides",()=>{
  it("edits predefined options and controls custom text in BOM and Explore",async()=>{
    const data=exampleConfigurator("Opzioni");data.version=8;data.parameters.push({id:"material",name:"Materiale",type:"text",values:[],allowCustom:true,unit:""});data.components[0]!.properties=[{id:"material",name:"Materiale",parameter:"material"}];
    prepare(data);await mount(<ConfiguratorView path={path}/>);await click("Parametri");await clickLabel("Modifica Materiale");
    const custom=()=>host!.querySelector<HTMLInputElement>('[aria-label="Consenti testo personalizzato"]')!;
    expect(custom().checked).toBe(true);await act(async()=>custom().click());
    const apply=()=>[...host!.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==="Applica")!;
    expect(apply().disabled).toBe(true);
    const options=host!.querySelector<HTMLTextAreaElement>('[aria-label="Opzioni di testo"]')!;
    const setOptions=async(value:string)=>{await act(async()=>{Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,"value")!.set!.call(options,value);options.dispatchEvent(new Event("input",{bubbles:true}));});};
    await setOptions("PVC\nPVC");expect(apply().disabled).toBe(true);await setOptions("PVC\nAcrilico");expect(apply().disabled).toBe(false);await click("Applica");await click("Salva");
    const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);expect(saved.parameters.at(-1)).toMatchObject({values:["PVC","Acrilico"],allowCustom:false});
    await click("BOM");expect(host!.querySelector('input[aria-label="Materiale"]')).toBeNull();
    await clickLabel("Modello: A");await clickLabel("LED: No");await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"3000");
    const preset=host!.querySelector<HTMLButtonElement>('[aria-label="Materiale: PVC"]')!;expect(preset.disabled).toBe(false);await clickLabel("Materiale: PVC");
    const profile=()=>[...host!.querySelectorAll('.config-bom-row')].find(r=>r.querySelector('.config-bom-identity strong')?.textContent==="PR001")!;
    expect(profile().querySelector('.config-property-values dd')?.textContent).toBe("PVC");
    await click("Esplora");expect(host!.querySelector<HTMLSelectElement>('select[aria-label="Materiale"]')!.value).toBe(JSON.stringify("PVC"));await select("Materiale",JSON.stringify("Acrilico"));expect(profile().querySelector('.config-property-values dd')?.textContent).toBe("Acrilico");
    await click("Parametri");await clickLabel("Modifica Materiale");expect(custom().checked).toBe(false);await act(async()=>custom().click());await click("Applica");await click("BOM");
    expect(host!.querySelector('[aria-label="Materiale: PVC"]')).not.toBeNull();await input(host!.querySelector<HTMLInputElement>('input[aria-label="Materiale"]')!,"Materiale speciale");expect(profile().querySelector('.config-property-values dd')?.textContent).toBe("Materiale speciale");
    await click("Parametri");await clickLabel("Modifica Materiale");await act(async()=>custom().click());await click("Applica");await click("BOM");expect(host!.querySelector('input[aria-label="Materiale"]')).toBeNull();expect(profile().querySelector('.config-property-values dd')?.textContent).toBe("Da definire");
  });
  it("saves an autonomous component value, preserves it when BOM changes and can return to the shared value",async()=>{
    const data=exampleConfigurator("Autonomia");data.version=8;data.parameters.push({id:"material",name:"Materiale",type:"text",values:["PVC","Acrilico"],allowCustom:false,unit:""});
    data.components[0]!.properties=[{id:"profile-material",name:"Materiale",parameter:"material"}];data.components[3]!.properties=[{id:"bracket-material",name:"Materiale",parameter:"material"}];
    prepare(data);await mount(<><ConfiguratorView path={path}/><ConfiguratorInspector path={path}/></>);await click("Componenti");await clickLabel("Modifica PR001 · Profilo laterale");
    expect(host!.querySelector<HTMLSelectElement>('[aria-label="Origine proprietà 1"]')!.value).toBe("bom");await select("Origine proprietà 1","component");await input(host!.querySelector<HTMLInputElement>('[aria-label="Valore proprietà 1"]')!,"Alluminio speciale");await click("Applica");await click("Salva");
    const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);expect(saved.components[0]!.properties![0]!.value).toBe("Alluminio speciale");expect(saved.parameters.at(-1)!.values).toEqual(["PVC","Acrilico"]);
    await click("BOM");await clickLabel("Modello: A");await clickLabel("LED: No");await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"3000");
    const property=(code:string)=>[...host!.querySelectorAll('.config-bom-row')].find(r=>r.querySelector('.config-bom-identity strong')?.textContent===code)!.querySelector('.config-property-values dd')?.textContent;
    await clickLabel("Materiale: PVC");expect(property("PR001")).toBe("Alluminio speciale");expect(property("ST001")).toBe("PVC");await clickLabel("Materiale: Acrilico");expect(property("PR001")).toBe("Alluminio speciale");expect(property("ST001")).toBe("Acrilico");
    await click("Grafo");expect(host!.querySelector('[data-result-component="profile"] .config-property-values dd')?.textContent).toBe("Alluminio speciale");
    await click("Componenti");await clickLabel("Modifica PR001 · Profilo laterale");expect(host!.querySelector<HTMLInputElement>('[aria-label="Valore proprietà 1"]')!.value).toBe("Alluminio speciale");await input(host!.querySelector<HTMLInputElement>('[aria-label="Valore proprietà 1"]')!,"");expect([...host!.querySelectorAll<HTMLButtonElement>('dialog button')].find(b=>b.textContent==="Applica")!.disabled).toBe(true);await click("Annulla");
    await clickLabel("Modifica PR001 · Profilo laterale");await select("Origine proprietà 1","bom");await click("Applica");await click("BOM");expect(property("PR001")).toBe("Acrilico");
  });
});

describe("component duplication",()=>{
  it("duplicates from the row menu, opens the new details and saves independent rules",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    const original=structuredClone(useConfiguratorStore.getState().sessions[path]!.data);
    await act(async()=>host!.querySelector<HTMLElement>('[aria-label="Azioni PR001"]')!.click());await clickLabel("Duplica componente PR001");
    const field=host!.querySelector<HTMLInputElement>('dialog input')!;expect(field.value).toBe("PR001-COPIA");
    const copy=useConfiguratorStore.getState().sessions[path]!.data.components.find(c=>c.code==="PR001-COPIA")!;
    expect(copy.id).not.toBe("profile");expect(useConfiguratorStore.getState().sessions[path]!.data.components[1]!.id).toBe(copy.id);
    await input(field,"PR900");await click("Applica");await clickLabel("Modifica regola per PR900");
    await input(host!.querySelector<HTMLInputElement>('[aria-label="Quantità"]')!,"7");await click("Applica");await click("Salva");
    const saved=parseConfigurator(vi.mocked(vaultService.writeText).mock.calls.at(-1)![1]);
    expect(saved.components).toHaveLength(5);expect(saved.rules.filter(r=>original.rules.some(old=>old.id===r.id))).toEqual(original.rules);
    await click("BOM");await clickLabel("Modello: A");await clickLabel("LED: Sì");await input(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza"]')!,"3000");
    const quantity=(code:string)=>[...host!.querySelectorAll('.config-bom-row')].find(r=>r.querySelector('.config-bom-identity strong')?.textContent===code)?.querySelector('.config-bom-quantity strong')?.textContent;
    expect(quantity("PR001")).toBe("2");expect(quantity("PR900")).toBe("7");expect(quantity("AL001")).toBe("1");
    vi.mocked(vaultService.readText).mockResolvedValue({path,content:JSON.stringify(saved),size:60,lastModified:2});
    await act(async()=>{useConfiguratorStore.getState().reset();await useConfiguratorStore.getState().load(path);});
    await click("Componenti");await clickLabel("Modifica PR900 · Profilo laterale (copia)");expect(host!.querySelector('dialog')?.textContent).toContain("Profilo del modello A");await click("Annulla");
  });
  it("duplicates a filtered component without removing hidden catalog entries",async()=>{
    prepare();await mount(<ConfiguratorView path={path}/>);await click("Componenti");
    const original=structuredClone(useConfiguratorStore.getState().sessions[path]!.data);
    await input(host!.querySelector<HTMLInputElement>('.config-catalog-filters input')!,"ST001");
    await clickLabel("Duplica componente ST001");await click("Annulla");
    const data=useConfiguratorStore.getState().sessions[path]!.data;
    expect(data.components).toHaveLength(5);expect(data.components.filter(c=>original.components.some(old=>old.id===c.id))).toEqual(original.components);
    expect(data.components.find(c=>c.code==="ST001-COPIA")!.group).toBe("Fissaggi");expect(host!.querySelectorAll('.config-definition-list.is-compact .config-definition-row')).toHaveLength(2);
  });
});
