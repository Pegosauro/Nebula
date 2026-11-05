import { Link2 } from "lucide-react";
import type { Configurator } from "./model";
import { navigationKnowledge } from "./navigationKnowledge";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useKnowledgeNavigationStore } from "../knowledge/knowledgeNavigationStore";
export function ConfiguratorDetails({data,path}:{data:Configurator;path:string}) {
  useKnowledgeStore(s=>s.revision);
  const backlinks=navigationKnowledge().documents[path]?.incoming ?? [], sheets=data.components.filter(c=>c.note);
  return <section className="config-project-details" aria-label="Informazioni del configuratore">
    <details className="config-card"><summary>Dati del progetto</summary><div className="config-info-body"><strong>{data.title}</strong><p className="config-hint">{path}</p><dl><div><dt>Parametri</dt><dd>{data.parameters.length}</dd></div><div><dt>Componenti</dt><dd>{data.components.length}</dd></div><div><dt>Regole attive</dt><dd>{data.rules.filter(r=>r.enabled).length}</dd></div></dl></div></details>
    <details className="config-card"><summary>Schede tecniche ({sheets.length})</summary><div className="config-info-body">{sheets.length ? sheets.map(c=><button type="button" key={c.id} className="config-text-button" onClick={()=>useKnowledgeNavigationStore.getState().activate(path,c.note.replace(/\.md$/i,""))}><Link2 size={14}/>{c.code} · {c.note.replace(/\.md$/i,"")}</button>) : <p className="config-hint">Nessuna scheda tecnica collegata.</p>}</div></details>
    <details className="config-card"><summary>Note collegate ({backlinks.length})</summary><div className="config-info-body">{backlinks.length ? backlinks.map(n=><button type="button" key={n} className="config-text-button" onClick={()=>useKnowledgeNavigationStore.getState().choose(n)}><Link2 size={14}/>{n.replace(/\.md$/i,"")}</button>) : <p className="config-hint">Nessuna nota collegata.</p>}</div></details>
  </section>;
}
