import { ComponentPropertyValues } from "./ComponentPropertyValues";
import { X } from "lucide-react";
import { useConfiguratorStore } from "./configuratorStore";
import { componentHierarchy } from "./componentHierarchy";
import { conditionSummary } from "./expressions";
import { dimensionsLabel, hasDimensions } from "./componentMeasure";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { IconButton } from "../../components/ui/IconButton";
export default function ConfiguratorInspector({path}:{path:string}) {
  const data=useConfiguratorStore(s=>s.sessions[path]?.data), preview=useConfiguratorStore(s=>s.sessions[path]?.preview);
  const current=!!data && preview?.data===data;
  const result=current ? preview.result : undefined;
  const rows=new Map([...(result?.bom ?? []),...(result?.possible ?? [])].map(row=>[row.component,row]));
  const invalid=current && (preview.invalid || preview.errors.length>0);
  const conditions=current ? [...Object.entries(preview.selection).map(([parameter,value])=>({parameter,value,operator:"eq" as const})),...preview.conditions.filter(c=>c.operator!=="eq")] : [];
  return <aside className="context-panel config-components-inspector" aria-label="Componenti della configurazione"><div className="panel-header"><h2>Componenti</h2><IconButton label="Chiudi pannello contestuale" onClick={()=>useWorkspaceStore.getState().setContextPanelOpen(false)}><X size={16}/></IconButton></div><div className="context-content">
    <div className="config-inspector-status"><strong>{invalid ? "Configurazione non valida" : current && preview.complete ? "Configurazione completa" : "Configurazione parziale"}</strong>{conditions.length>0 && <p>{conditionSummary({id:"selection",name:"",enabled:true,actions:[],conditions,match:"all"},data!)}</p>}</div>
    {current && preview.updating ? <p role="status">Aggiornamento componenti…</p> : !result ? <p className="config-hint">Apri Esplora o Grafo per calcolare i componenti delle scelte correnti.</p> : invalid ? <div role="status"><p>Nessuna distinta valida per queste scelte.</p>{preview.errors.map((e,i)=><p className="config-inspector-error" key={i}>{e}</p>)}</div> : <>
      <p className="config-inspector-count">{result.bom.length} certi · {result.possible.length} possibili</p>
      {!rows.size && <p>Nessun componente incluso con queste scelte.</p>}
      {componentHierarchy(data!).map(f=>{const groups=f.groups.map(g=>({...g,components:g.components.filter(c=>rows.has(c.id))})).filter(g=>g.components.length);return !groups.length ? null : <section key={f.name} className="config-inspector-family"><h3>{f.name || "Senza famiglia"}</h3>{groups.map(g=><section key={g.name} className="config-inspector-group"><h4>{g.name || "Senza gruppo"}</h4>{g.components.map(c=>{const row=rows.get(c.id)!;return <div key={c.id} className="config-inspector-component" data-result-component={c.id}><div><strong>{c.code}</strong><span>{c.name}</span>{hasDimensions(c) && <span className="config-inspector-measure">Misura: {dimensionsLabel(c,row)}</span>}<ComponentPropertyValues component={c} values={row.properties}/><small className={row.certain ? "is-certain" : "is-possible"}>{row.certain ? "Certo" : "Possibile"}</small></div><div className="config-inspector-quantity"><strong>{row.quantity?.toLocaleString("it-IT") ?? "Da definire"}</strong><small>{row.quantity===undefined ? "Quantità variabile" : c.unit}</small></div></div>;})}</section>)}</section>;})}
      {preview?.reason && <p className="config-inspector-notice">{preview.reason} I componenti possibili e le quantità restano da confermare.</p>}
    </>}
  </div></aside>;
}
