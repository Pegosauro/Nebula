import { useState } from "react";
import { GitBranch, Plus } from "lucide-react";
import { configuratorEntries } from "./entries";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useConfiguratorStore } from "./configuratorStore";
import { configTitle } from "./model";

export function ConfiguratorPanel() {
  const snapshot = useVaultStore(s=>s.snapshot);
  const open = useWorkspaceStore(s=>s.openEntry);
  const entries = configuratorEntries(snapshot?.root ?? []);
  return <section className="side-panel" aria-label="Configuratori"><div className="panel-header"><h2>Configuratori</h2></div><div className="config-side-list">{entries.map(e=><button key={e.path} onClick={()=>open(e,true)}><GitBranch size={17}/><span>{configTitle(e.name)}</span></button>)}{!entries.length && <p>Crea un configuratore per collegare parametri, profili e accessori.</p>}<button onClick={()=>{useWorkspaceStore.getState().activateTab("workspace-home");useWorkspaceStore.getState().setActivity("configurators");}}><Plus size={17}/>Nuovo configuratore</button></div></section>;
}
export default function ConfiguratorLibrary() {
  const snapshot = useVaultStore(s=>s.snapshot);
  const [title,setTitle] = useState("");
  const [example,setExample] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState<string>();
  const entries = configuratorEntries(snapshot?.root ?? []);
  const create = async () => {
    setBusy(true);setError(undefined);
    try { await useConfiguratorStore.getState().create(title.trim(),example); }
    catch(e) {setError(e instanceof Error ? e.message : "Creazione non riuscita.");}
    finally {setBusy(false);}
  };
  return <div className="config-workspace"><header className="config-heading"><GitBranch size={25}/><div><h1>Configuratori</h1><p>Parametri, componenti e regole dei tuoi progetti.</p></div></header><section className="config-card"><h2>Nuovo configuratore</h2><form className="config-create" onSubmit={e=>{e.preventDefault();void create();}}><label>Nome del progetto<input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Es. Pergola X" maxLength={120}/></label><label className="config-checkbox"><input type="checkbox" checked={example} onChange={e=>setExample(e.target.checked)}/>Parti da un esempio modificabile (modello, LED e staffe)</label><button className="button button-primary" disabled={busy || !title.trim()}><Plus size={16}/>{busy ? "Creazione…" : "Crea configuratore"}</button></form>{error && <p role="alert" className="config-error">{error}</p>}</section><div className="config-library">{entries.map(entry=><button className="config-card" key={entry.path} onClick={()=>useWorkspaceStore.getState().openEntry(entry)}><GitBranch size={22}/><strong>{configTitle(entry.name)}</strong><small>{entry.path}</small></button>)}</div></div>;
}
