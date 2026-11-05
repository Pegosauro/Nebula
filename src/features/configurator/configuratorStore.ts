import { serializeConfigurator } from "./serializeConfigurator";
import { create } from "zustand";
import { isPathInside } from "../../domain/path";
import { findVaultEntry } from "../../domain/vault";
import type { ExpectedFileMetadata } from "../../infrastructure/filesystem/vaultFileOperations";
import { vaultService } from "../vault/vaultService";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import type { Evaluation } from "./engine";
import type { Condition, Selection } from "./model";
import { emptyConfigurator, exampleConfigurator, parseConfigurator, type Configurator } from "./model";

export interface ConfiguratorPreview { data:Configurator; selection:Selection; conditions:Condition[]; result?:Evaluation; invalid:boolean; updating:boolean; complete:boolean; errors:string[]; reason?:string }
interface Session { preview?:ConfiguratorPreview; data: Configurator; saved: string; expected: ExpectedFileMetadata; error?: string; saving: boolean }
interface State {
  sessions: Record<string,Session>;
  load: (path: string, force?: boolean) => Promise<void>;
  edit: (path: string, data: Configurator) => void;
  preview: (path:string,preview:ConfiguratorPreview) => void;
  save: (path: string) => Promise<boolean>;
  flush: (path?: string) => Promise<boolean>;
  reset: () => void;
  remap: (oldPath: string,newPath: string) => void;
  remove: (path: string) => void;
  create: (title: string, example: boolean) => Promise<string>;
  checkExternalChanges: () => Promise<void>;
}
const timers = new Map<string,ReturnType<typeof setTimeout>>();
const loading = new Map<string,Promise<void>>();
const saves = new Map<string,Promise<boolean>>();
const loadEpochs = new Map<string,number>();
let generation = 0;
export const useConfiguratorStore = create<State>((set,get)=>({
  sessions: {},
  load: async (path,force = false) => {
    if(force) {clearTimeout(timers.get(path));timers.delete(path);}
    if (loading.has(path)) return loading.get(path);
    const currentGeneration = generation;
    const loadEpoch=loadEpochs.get(path) ?? 0;
    const task = (async()=>{
      const existing = get().sessions[path];
      if (saves.has(path)) await saves.get(path);
      const snapshot = await vaultService.readText(path);
      if (!force && existing) {
        const latest = get().sessions[path];
        if (snapshot.size===latest?.expected.size && snapshot.lastModified===latest.expected.lastModified) return;
        if (latest && serializeConfigurator(latest.data)!==latest.saved) throw new Error("Il file è stato modificato da un'altra applicazione. Esporta la bozza o ricarica dal Vault.");
      }
      const data = parseConfigurator(snapshot.content);
      if (currentGeneration !== generation || loadEpoch!==(loadEpochs.get(path) ?? 0)) return;
      set(state=>({sessions:{...state.sessions,[path]:{data,saved:serializeConfigurator(data),expected:{size:snapshot.size,lastModified:snapshot.lastModified},saving:false}}}));
    })();
    loading.set(path,task);
    try { await task; } finally { if (loading.get(path)===task) loading.delete(path); }
  },
  preview: (path,preview) => set(state=>{const session=state.sessions[path];return !session || session.preview===preview ? state : {sessions:{...state.sessions,[path]:{...session,preview}}};}),
  edit: (path,data) => {
    set(state=>{const s=state.sessions[path]; return s ? {sessions:{...state.sessions,[path]:{...s,data,error:undefined}}} : state;});
    clearTimeout(timers.get(path));
    timers.set(path,setTimeout(()=>{timers.delete(path);void get().save(path);},700));
  },
  save: async path => {
    clearTimeout(timers.get(path));timers.delete(path);
    const previous = saves.get(path);
    if (previous) { if (!await previous) return false; return get().save(path); }
    const session = get().sessions[path];
    if (!session || serializeConfigurator(session.data)===session.saved) return true;
    const currentGeneration = generation;
    const content = serializeConfigurator(session.data);
    const task = (async()=>{
      set(state=>({sessions:{...state.sessions,[path]:{...state.sessions[path]!,saving:true,error:undefined}}}));
      try {
        // Validate structure before writing. Incomplete rule definitions remain editable.
        parseConfigurator(content);
        const expected = await vaultService.writeText(path,JSON.stringify(session.data,null,2)+"\n",session.expected);
        if (generation===currentGeneration) set(state=>({sessions:{...state.sessions,[path]:{...state.sessions[path]!,saved:content,expected,saving:false}}}));
        return true;
      } catch (error) {
        if (generation===currentGeneration) set(state=>({sessions:{...state.sessions,[path]:{...state.sessions[path]!,saving:false,error:error instanceof Error ? error.message : "Salvataggio non riuscito."}}}));
        return false;
      }
    })();
    saves.set(path,task);
    try { return await task; } finally { if(saves.get(path)===task) saves.delete(path); }
  },
  flush: async path => {
    const paths = Object.keys(get().sessions).filter(p=>!path || isPathInside(p,path));
    for (const p of paths) {
      let clean=false;
      for(let attempt=0;attempt<10;attempt++) {
        if (!await get().save(p)) return false;
        const session=get().sessions[p];
        if (!session || serializeConfigurator(session.data)===session.saved) {clean=true;break;}
      }
      if(!clean) return false;
    }
    return true;
  },
  reset: () => { generation++; for (const timer of timers.values()) clearTimeout(timer);timers.clear();loading.clear();saves.clear();loadEpochs.clear();set({sessions:{}}); },
  remap: (oldPath,newPath) => set(state=>({sessions:Object.fromEntries(Object.entries(state.sessions).map(([path,s])=>[isPathInside(path,oldPath)?`${newPath}${path.slice(oldPath.length)}`:path,s]))})),
  remove: path => {
    for(const [p,t] of timers) if(isPathInside(p,path)) {clearTimeout(t);timers.delete(p);}
    for(const p of new Set([...loading.keys(),...Object.keys(get().sessions)])) if(isPathInside(p,path)) {loadEpochs.set(p,(loadEpochs.get(p) ?? 0)+1);loading.delete(p);}
    set(state=>({sessions:Object.fromEntries(Object.entries(state.sessions).filter(([p])=>!isPathInside(p,path)))}));
  },
  create: async (title,example) => {
    const data = example ? exampleConfigurator(title) : emptyConfigurator(title);
    const result = await vaultService.createConfigurator(title,JSON.stringify(data,null,2)+"\n");
    useVaultStore.setState({snapshot:result.snapshot});
    const entry = findVaultEntry(result.snapshot.root,result.path);
    if(entry) useWorkspaceStore.getState().openEntry(entry);
    return result.path;
  },
  checkExternalChanges: async () => {
    for (const path of Object.keys(get().sessions)) {
      try { await get().load(path); }
      catch(error) { set(state=>{const s=state.sessions[path];return s?{sessions:{...state.sessions,[path]:{...s,error:error instanceof Error?error.message:"Verifica del file non riuscita."}}}:state;}); }
    }
  },
}));
