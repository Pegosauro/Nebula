import { ComponentPropertyValues } from "./ComponentPropertyValues";
import { propertyEntries } from "./componentProperties";
import { useEffect, useState } from "react";
import { Download, Info, Link2 } from "lucide-react";
import { useKnowledgeNavigationStore } from "../knowledge/knowledgeNavigationStore";
import { componentHierarchy } from "./componentHierarchy";
import { readableCondition } from "./RulePreview";
import { ruleExpression } from "./expressions";
import { componentDimensions, dimensionsLabel, hasDimensions, measurementValues, measureFormula } from "./componentMeasure";
import { valueLabel, type BomRow, type Enumeration, type Evaluation } from "./engine";
import type { Configurator, Selection } from "./model";

export function download(name: string,content: string,type: string) { const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000); }
const csvCell = (value:unknown) => `"${String(value ?? "").replaceAll('"','""')}"`;
const csv = (rows:unknown[][])=>"\uFEFF"+rows.map(row=>row.map(csvCell).join(";")).join("\r\n");
export function Bom({data,result,path}: {data:Configurator;result:Evaluation;path:string}) {
  const [query,setQuery] = useState("");
  const [order,setOrder] = useState("catalog");
  const activate=useKnowledgeNavigationStore(s=>s.activate);
  const byId = new Map([...result.bom,...result.possible].map(row => [row.component,row]));
  const search = query.trim().toLocaleLowerCase();
  const families = componentHierarchy(data);
  let components = families.flatMap(f => f.groups.flatMap(g => g.components)).filter(c => byId.has(c.id) && (!search || `${c.code} ${c.name}`.toLocaleLowerCase().includes(search)));
  if(order === "code") components = components.toSorted((a,b) => a.code.localeCompare(b.code, "it", {numeric:true}));
  if(order === "state") components = components.toSorted((a,b) => Number(byId.get(b.id)!.certain) - Number(byId.get(a.id)!.certain));
  const row = (c: Configurator["components"][number]) => {
    const value = byId.get(c.id)!;
    return <div className="config-bom-row" key={c.id} role="row">
      <div className="config-bom-identity" role="cell"><strong>{c.code}</strong></div>
      <div className="config-bom-description" role="cell"><span>{c.name}</span><ComponentPropertyValues component={c} values={value.properties}/></div>
      <div className={hasDimensions(c) ? "config-bom-measure" : "config-bom-no-measure"} role="cell" title={hasDimensions(c) ? measureFormula(data,c) : undefined}>{hasDimensions(c) ? <strong>{dimensionsLabel(c,value)}</strong> : "—"}</div>
      <div className="config-bom-quantity" role="cell"><strong>{value.quantity?.toLocaleString("it-IT") ?? "Da definire"}</strong>{value.quantity !== undefined && <small>{c.unit}</small>}</div>
      <span className={`config-bom-state ${value.certain ? "is-certain" : "is-possible"}`} role="cell">{value.certain ? "Certo" : "Possibile"}</span>
      <details><summary aria-label={`Dettagli distinta per ${c.code}`} title="Dettagli del componente"><Info size={15} aria-hidden="true"/></summary><div className="config-bom-reasons">
        {hasDimensions(c) && <p>Misura per pezzo: {measureFormula(data,c)}</p>}{c.family && <p>Famiglia: {c.family}</p>}{c.group && <p>Gruppo / assieme: {c.group}</p>}
        {!value.certain && <p>Il componente dipende da scelte ancora aperte. La quantità si riferisce alla sua eventuale inclusione.</p>}
        {value.reasons.map(id => { const rule = data.rules.find(r => r.id === id); return <p key={id}><strong>{rule?.name ?? id}</strong>{rule && <span> · {readableCondition(ruleExpression(rule),data)}</span>}</p>; })}
        {c.note && <button className="config-text-button" onClick={()=>activate(path,c.note.replace(/\.md$/i,""))}><Link2 size={14}/>Apri scheda tecnica</button>}
      </div></details>
    </div>;
  };
  return <div className="config-bom">
    <div className="config-bom-tools"><label className="config-bom-search">Cerca nella distinta<input type="search" placeholder="Codice o descrizione" value={query} onChange={e=>setQuery(e.target.value)}/></label><label>Ordine<select value={order} onChange={e=>setOrder(e.target.value)}><option value="catalog">Catalogo</option><option value="code">Codice</option><option value="state">Stato</option></select></label></div>
    {!components.length ? <p className="config-empty">{query ? "Nessun componente corrisponde alla ricerca." : "Nessun componente incluso con queste scelte."}</p> : <div className="config-bom-scroll" role="table" aria-label="Distinta componenti">
      <div className="config-bom-head" role="row">{["Codice","Descrizione","Misura / pz","Quantità","Stato",""].map((label,i)=><span role="columnheader" key={i}>{label}</span>)}</div>
      {families.map(f => {
        const family = components.filter(c => (c.family ?? "").trim() === f.name);
        return family.length ? <details className="config-bom-group" key={f.name} open><summary><span>{f.name || "Senza famiglia"}</span><small>{family.length}</small></summary><div role="rowgroup">{family.map(row)}</div></details> : null;
      })}
    </div>}
  </div>;
}
export function bomCsv(data:Configurator,rows:BomRow[]):string {
  const multi=data.components.some(c=>componentDimensions(c).length>1);
  const names=multi ? [...new Map(data.components.flatMap(c=>componentDimensions(c)).map(d=>[d.name.trim().toLocaleLowerCase(),d.name.trim()])).entries()] : [];
  const properties=[...new Map(data.components.flatMap(c=>c.properties ?? []).map(p=>[p.name.trim().toLocaleLowerCase(),p.name.trim()])).entries()];
  return csv([["Codice","Descrizione","Gruppo","Quantità","Unità","Stato","Regole","Misura per pezzo","Unità misura",...names.flatMap(([,name])=>[name,`Unità ${name}`]),...properties.map(([,name])=>`Proprietà: ${name}`)],...rows.map(row=>{
    const c=data.components.find(c=>c.id===row.component),dimensions=c ? componentDimensions(c) : [],values=c ? measurementValues(c,row) : [];
    return [c?.code,c?.name,c?.group,row.quantity,c?.unit,row.certain?"Certo":"Possibile",row.reasons.map(id=>data.rules.find(r=>r.id===id)?.name).join(" | "),dimensions.length>1 ? dimensionsLabel(c!,row) : values[0]?.value,dimensions.length===1 ? dimensions[0]!.unit : "",...names.flatMap(([key])=>{
      const i=dimensions.findIndex(d=>d.name.trim().toLocaleLowerCase()===key);
      return i<0 ? ["",""] : [values[i]?.value,dimensions[i]!.unit];
    }),...properties.map(([name])=>c ? propertyEntries(c,row.properties).find(p=>p.name.trim().toLocaleLowerCase()===name)?.value : "")];
  })]);
}
export function exportBom(data:Configurator,rows:BomRow[]) { download(`${data.title}-BOM.csv`,bomCsv(data,rows),"text/csv;charset=utf-8"); }
export function VariantList({data,enumeration,select}: {data:Configurator;enumeration:Enumeration;select:(s:Selection)=>void}) {
  const [page,setPage]=useState(0);
  useEffect(()=>setPage(0),[enumeration]);
  const solutions=enumeration.solutions;
  return <div className="config-card"><div className="config-section-heading"><h3>{enumeration.exhaustive?`${solutions.length.toLocaleString("it-IT")} configurazioni valide`:`${solutions.length.toLocaleString("it-IT")} configurazioni trovate (elenco parziale)`}</h3>{solutions.length>0 && <button className="button button-secondary" onClick={()=>download(`${data.title}-varianti.csv`,csv([data.parameters.map(p=>p.name),...solutions.map(s=>data.parameters.map(p=>s.selection[p.id]===undefined ? "" : valueLabel(s.selection[p.id]!)))]),"text/csv;charset=utf-8")}><Download size={16}/>CSV varianti</button>}</div>{enumeration.reason && <p className="config-warning">{enumeration.reason}</p>}<div className="config-variants">{solutions.slice(page*50,(page+1)*50).map((s,i)=><button key={i} onClick={()=>select(s.selection)}>{data.parameters.map(p=>`${p.name}: ${valueLabel(s.selection[p.id]!)}`).join(" · ") || "Configurazione senza parametri"}</button>)}</div>{solutions.length>50 && <div className="config-actions"><button className="button" disabled={!page} onClick={()=>setPage(p=>p-1)}>Precedenti</button><span>Pagina {page+1} / {Math.ceil(solutions.length/50)}</span><button className="button" disabled={(page+1)*50>=solutions.length} onClick={()=>setPage(p=>p+1)}>Successive</button></div>}</div>;
}
