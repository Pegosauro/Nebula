import { afterEach, describe, expect, it, vi } from "vitest";
import { vaultService } from "../vault/vaultService";
import { useConfiguratorStore } from "./configuratorStore";
import { exampleConfigurator } from "./model";
const path="Configurators/Test.config.json";
afterEach(()=>{useConfiguratorStore.getState().reset();vi.restoreAllMocks();});
const snapshot=()=>({path,content:JSON.stringify(exampleConfigurator("Test")),size:20,lastModified:1});
describe("configurator Vault sessions",()=>{
  it("keeps calculated previews out of Vault data and clears them with their sessions",async()=>{
    vi.spyOn(vaultService,"readText").mockResolvedValue(snapshot());const write=vi.spyOn(vaultService,"writeText");
    await useConfiguratorStore.getState().load(path);const session=useConfiguratorStore.getState().sessions[path]!;
    useConfiguratorStore.getState().preview(path,{data:session.data,selection:{model:"A"},conditions:[],result:{bom:[],possible:[],errors:[],pending:[],matched:[]},invalid:false,complete:false,updating:false,errors:[]});
    expect(useConfiguratorStore.getState().sessions[path]!.saved).toBe(session.saved);expect(useConfiguratorStore.getState().sessions[path]!.data).toBe(session.data);expect(await useConfiguratorStore.getState().save(path)).toBe(true);expect(write).not.toHaveBeenCalled();
    useConfiguratorStore.getState().reset();expect(useConfiguratorStore.getState().sessions).toEqual({});
  });
  it("serializes concurrent writes and preserves edits made during saving",async()=>{
    vi.spyOn(vaultService,"readText").mockResolvedValue(snapshot());
    const write=vi.spyOn(vaultService,"writeText");
    let complete!:()=>void;
    write.mockImplementationOnce(()=>new Promise(resolve=>{complete=()=>resolve({size:21,lastModified:2});}));
    write.mockResolvedValue({size:22,lastModified:3});
    const s=useConfiguratorStore.getState();await s.load(path);
    s.edit(path,{...s.sessions[path]?.data ?? useConfiguratorStore.getState().sessions[path]!.data,title:"First"});
    const saving=s.save(path);
    s.edit(path,{...useConfiguratorStore.getState().sessions[path]!.data,title:"Second"});
    complete();await saving;expect(useConfiguratorStore.getState().sessions[path]!.data.title).toBe("Second");
    expect(await s.flush()).toBe(true);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]![2]).toEqual({size:21,lastModified:2});
    expect(JSON.parse(useConfiguratorStore.getState().sessions[path]!.saved).title).toBe("Second");
  });
  it("preserves the draft and blocks flushing after an external conflict",async()=>{
    vi.spyOn(vaultService,"readText").mockResolvedValue(snapshot());
    vi.spyOn(vaultService,"writeText").mockRejectedValue(new Error("Il file è stato modificato da un'altra applicazione."));
    await useConfiguratorStore.getState().load(path);
    useConfiguratorStore.getState().edit(path,{...useConfiguratorStore.getState().sessions[path]!.data,title:"Draft"});
    expect(await useConfiguratorStore.getState().flush()).toBe(false);
    expect(useConfiguratorStore.getState().sessions[path]!.data.title).toBe("Draft");
    expect(useConfiguratorStore.getState().sessions[path]!.error).toContain("altra applicazione");
  });
  it("reloads clean external changes but never discards dirty edits",async()=>{
    const read=vi.spyOn(vaultService,"readText").mockResolvedValue(snapshot());
    await useConfiguratorStore.getState().load(path);
    read.mockResolvedValue({...snapshot(),content:JSON.stringify(exampleConfigurator("External")),size:30,lastModified:2});
    await useConfiguratorStore.getState().checkExternalChanges();
    expect(useConfiguratorStore.getState().sessions[path]!.data.title).toBe("External");
    useConfiguratorStore.getState().edit(path,{...useConfiguratorStore.getState().sessions[path]!.data,title:"Draft"});
    read.mockResolvedValue({...snapshot(),lastModified:3});
    await useConfiguratorStore.getState().checkExternalChanges();
    expect(useConfiguratorStore.getState().sessions[path]!.data.title).toBe("Draft");
    expect(useConfiguratorStore.getState().sessions[path]!.error).toContain("modificato");
  });
  it("does not install a late load into a different Vault",async()=>{
    let complete!:(v:ReturnType<typeof snapshot>)=>void;
    vi.spyOn(vaultService,"readText").mockImplementation(()=>new Promise(resolve=>{complete=resolve;}));
    const loading=useConfiguratorStore.getState().load(path);useConfiguratorStore.getState().reset();complete(snapshot());await loading;
    expect(useConfiguratorStore.getState().sessions).toEqual({});
  });
  it("opens the same path in a new Vault without waiting for an obsolete load",async()=>{
    let complete!:(v:ReturnType<typeof snapshot>)=>void;
    const read=vi.spyOn(vaultService,"readText");
    read.mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
    const old=useConfiguratorStore.getState().load(path);
    useConfiguratorStore.getState().reset();
    read.mockResolvedValue({...snapshot(),content:JSON.stringify(exampleConfigurator("New Vault"))});
    await useConfiguratorStore.getState().load(path);
    complete(snapshot());await old;
    expect(useConfiguratorStore.getState().sessions[path]!.data.title).toBe("New Vault");
  });
  it("does not restore a session after its file has been removed",async()=>{
    let complete!:(v:ReturnType<typeof snapshot>)=>void;
    vi.spyOn(vaultService,"readText").mockImplementationOnce(()=>new Promise(resolve=>{complete=resolve;}));
    const old=useConfiguratorStore.getState().load(path);
    useConfiguratorStore.getState().remove(path);complete(snapshot());await old;
    expect(useConfiguratorStore.getState().sessions).toEqual({});
  });
});
