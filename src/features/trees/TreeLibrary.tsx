import { useState } from "react";
import { ListTree, Plus } from "lucide-react";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { demoTree } from "./demoTree";
import { treeEntries } from "./entries";
import { newTree, treeTitle } from "./model";
import { useTreeStore } from "./treeStore";

export function TreePanel() {
  const snapshot = useVaultStore(state => state.snapshot);
  const open = useWorkspaceStore(state => state.openEntry);
  const entries = treeEntries(snapshot?.root ?? []);
  return (
    <section className="side-panel" aria-label="Strutture">
      <div className="panel-header"><h2>Strutture</h2></div>
      <div className="config-side-list">
        {entries.map(entry => <button key={entry.path} onClick={() => open(entry, true)}><ListTree size={17} /><span>{treeTitle(entry.name)}</span></button>)}
        {!entries.length && <p>Crea una struttura ad albero, indipendente dai configuratori.</p>}
        <button onClick={() => { useWorkspaceStore.getState().activateTab("workspace-home"); useWorkspaceStore.getState().setActivity("structures"); }}><Plus size={17} />Nuova struttura</button>
      </div>
    </section>
  );
}

export default function TreeLibrary() {
  const snapshot = useVaultStore(state => state.snapshot);
  const [title, setTitle] = useState("");
  const [rootCode, setRootCode] = useState("FL");
  const [rootName, setRootName] = useState("");
  const [example, setExample] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const entries = treeEntries(snapshot?.root ?? []);
  const create = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const tree = example ? { ...demoTree(), title: title.trim() } : newTree(title.trim(), rootCode, rootName.trim());
      await useTreeStore.getState().create(tree);
      setTitle("");
      setRootName("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Creazione non riuscita.");
    } finally { setBusy(false); }
  };
  return (
    <div className="config-workspace">
      <header className="config-heading"><ListTree size={25} /><div><h1>Strutture</h1><p>Alberi liberi, con codici, categorie e oggetti. Non sono legati a un configuratore.</p></div></header>
      <section className="config-card">
        <h2>Nuova struttura</h2>
        <form className="config-create" onSubmit={event => { event.preventDefault(); void create(); }}>
          <label>Nome della struttura<input required value={title} onChange={event => setTitle(event.target.value)} placeholder="Es. FL · Tenda finestra" maxLength={120} /></label>
          <label>Codice della radice<input required value={example ? "FL" : rootCode} disabled={example} onChange={event => setRootCode(event.target.value)} placeholder="Es. FL" maxLength={40} /></label>
          <label>Nome della radice<input required value={example ? "Tenda finestra" : rootName} disabled={example} onChange={event => setRootName(event.target.value)} placeholder="Es. Tenda finestra" maxLength={120} /></label>
          <label className="config-checkbox"><input type="checkbox" checked={example} onChange={event => setExample(event.target.checked)} />Parti dall'esempio FL · Tenda finestra</label>
          <button className="button button-primary" disabled={busy || !title.trim() || (!example && (!rootCode.trim() || !rootName.trim()))}><Plus size={16} />{busy ? "Creazione…" : "Crea struttura"}</button>
        </form>
        {error && <p role="alert" className="config-error">{error}</p>}
      </section>
      <div className="config-library">
        {entries.map(entry => <button className="config-card" key={entry.path} onClick={() => useWorkspaceStore.getState().openEntry(entry, true)}><ListTree size={22} /><strong>{treeTitle(entry.name)}</strong><small>{entry.path}</small></button>)}
      </div>
    </div>
  );
}
