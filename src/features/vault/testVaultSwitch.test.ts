import { afterEach, describe, expect, it, vi } from "vitest";
import { useVaultStore } from "./vaultStore";
import { vaultService } from "./vaultService";
import { useDocumentStore, type DocumentSession } from "../editor/documentStore";
import { useConfiguratorStore } from "../configurator/configuratorStore";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import type { VaultSnapshot } from "../../domain/vault";
const original:VaultSnapshot={name:"Personale",root:[],scannedAt:1,stats:{files:0,directories:0,notes:0,boards:0}};
const session=(path:string):DocumentSession=>({path,loaded:true,content:"Modifiche personali",savedContent:"Prima",size:5,lastModified:1,status:"dirty"});
afterEach(()=>{vi.restoreAllMocks();useDocumentStore.getState().reset();useConfiguratorStore.getState().reset();useVaultStore.setState({status:"idle",snapshot:undefined,error:undefined});});
describe("switching to the demo Vault",()=>{
  it("flushes every open note by its real path before replacing the active Vault",async()=>{
    useVaultStore.setState({status:"ready",snapshot:original});
    useDocumentStore.setState({sessions:{"Prima.md":session("Prima.md"),"Cartella/Seconda.md":session("Cartella/Seconda.md")}});
    const flush=vi.spyOn(useDocumentStore.getState(),"flushPaths").mockResolvedValue(true);
    vi.spyOn(useConfiguratorStore.getState(),"flush").mockResolvedValue(true);
    const open=vi.spyOn(vaultService,"openTestVault").mockResolvedValue({...original,name:"Nebula-Vault-Test"});
    vi.spyOn(vaultService,"recentVaults").mockResolvedValue([]);
    vi.spyOn(useKnowledgeStore.getState(),"rebuild").mockResolvedValue();
    await useVaultStore.getState().openTestVault();
    expect(flush.mock.calls).toEqual([["Prima.md"],["Cartella/Seconda.md"]]);
    expect(open).toHaveBeenCalledOnce();expect(useVaultStore.getState().snapshot?.name).toBe("Nebula-Vault-Test");
  });
  it("keeps the original Vault and unsaved text if any note cannot be saved",async()=>{
    useVaultStore.setState({status:"ready",snapshot:original});
    useDocumentStore.setState({sessions:{"Prima.md":session("Prima.md")}});
    vi.spyOn(useDocumentStore.getState(),"flushPaths").mockResolvedValue(false);
    const open=vi.spyOn(vaultService,"openTestVault");
    await useVaultStore.getState().openTestVault();
    expect(open).not.toHaveBeenCalled();expect(useVaultStore.getState().snapshot).toBe(original);
    expect(useDocumentStore.getState().sessions["Prima.md"]!.content).toBe("Modifiche personali");
    expect(useVaultStore.getState().error).toContain("conflitti delle note");expect(useVaultStore.getState().status).toBe("ready");
  });
});
