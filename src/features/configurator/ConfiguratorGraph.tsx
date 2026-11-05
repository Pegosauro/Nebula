import { ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { defaultGraphView, type GraphViewState } from "./configuratorUiStore";
import { useId, useMemo, useRef, useState } from "react";
import type { Condition, Configurator, Selection } from "./model";
import { conditionSummary, operatorLabels } from "./expressions";
import { matches, valueLabel } from "./engine";
import { buildGraphPaths, focusedRoutes, selectedRoutes, projectGraphPaths, unconstrainedOrigin, type GraphFocus } from "./graphPaths";

import { componentHierarchy } from "./componentHierarchy";
import { emptyGraphSelection, graphChoices, type GraphSelection } from "./graphSelection";
import { ruleUsesComponent } from "./componentRules";
const step=270, rowStep=72, boxWidth=210;
const pathMatches=(conditions:Condition[],selection:Selection)=>matches({id:"path",name:"",enabled:true,match:"all",conditions,actions:[]},selection);
const labels:Record<string,string>={add:"Aggiungi",exclude:"Escludi",requireComponent:"Richiedi",oneOf:"Uno solo",valueConstraint:"Vincolo sui parametri"};
const palette=["#8b5cf6","#269ab0","#d28b36","#a467a2","#30a189","#cf526f","#677fce","#94922b","#bd64cf","#2387ae"];
export const graphConditionLabel=(c:Condition)=>c.operator==="eq" ? valueLabel(c.value) : `${operatorLabels[c.operator]} ${valueLabel(c.value)}`;
export function ConfiguratorGraph({data,selection,onConfigurationChange,onEditComponent,configurationSelected=false,viewState,onViewChange}: {viewState?:GraphViewState;onViewChange?:(patch:Partial<GraphViewState>)=>void;data:Configurator;selection:Selection;onConfigurationChange?:(selection:GraphSelection)=>void;onEditComponent?:(id:string)=>void;configurationSelected?:boolean}) {
  const [localView,setLocalView] = useState(defaultGraphView);
  const view = viewState ?? localView;
  const updateView = (patch: Partial<GraphViewState>) => { if(onViewChange) onViewChange(patch); else setLocalView(current => ({...current,...patch})); };
  const {focus,selectedNodes,showUnconstrained,zoom,multiSelect,query} = view;
  const viewport = useRef<HTMLDivElement>(null);
  const setFocus = (focus: GraphFocus | undefined) => updateView({focus});
  const setSelectedNodes = (selectedNodes: string[]) => updateView({selectedNodes});
  const setShowUnconstrained = (showUnconstrained: boolean) => updateView({showUnconstrained});
  const markerId=useId().replaceAll(":","");
  const graph=useMemo(()=>buildGraphPaths(data),[data]);
  const projected=useMemo(()=>projectGraphPaths(graph,showUnconstrained),[graph,showUnconstrained]);
  const routeMap=useMemo(()=>new Map(graph.routes.map(r=>[r.id,r])),[graph]);
  const validFocus=focus && (focus.kind==="node" ? graph.nodes.some(n=>n.id===focus.id) : focus.kind==="component" ? graph.components.some(c=>c.id===focus.id) : routeMap.has(focus.id)) ? focus : undefined;
  const selected=selectedNodes.filter(id=>graph.nodes.some(n=>n.id===id));
  const visibleRoutes=selectedRoutes(graph,selected);
  const activeRoutes=new Set([...focusedRoutes(graph,validFocus)].filter(id=>visibleRoutes.has(id)));
  const visibleRouteList=graph.routes.filter(r=>visibleRoutes.has(r.id));
  const visibleNodeIds=new Set(visibleRouteList.flatMap(r=>r.nodes)), visibleComponentIds=new Set(visibleRouteList.map(r=>r.component));
  const shownNodes=projected.nodes.filter(n=>!selected.length || visibleNodeIds.has(n.id));
  const shownComponents=graph.components.filter(c=>!selected.length || visibleComponentIds.has(c.id));
  const shownComponentIds=new Set(shownComponents.map(c=>c.id));
  const shownEdges=projected.edges.filter(e=>visibleRoutes.has(e.routeId));
  const interestedNodes=new Set(graph.routes.filter(r=>activeRoutes.has(r.id)).flatMap(r=>r.nodes));
  const interestedComponents=new Set(graph.routes.filter(r=>activeRoutes.has(r.id)).map(r=>r.component));
  const statuses=useMemo(()=>new Map(graph.routes.map(r=>[r.id,pathMatches(r.conditions,selection)])),[graph,selection]);
  const nodeRoutes=new Map<string,string[]>();
  for(const route of graph.routes)for(const id of route.nodes){const list=nodeRoutes.get(id) ?? [];list.push(route.id);nodeRoutes.set(id,list);}
  const columns=Math.max(1,data.parameters.length), width=(columns+1)*step+20;
  const columnRows=new Map<number,number>();
  const coordinates=new Map(shownNodes.map(n=>{const row=columnRows.get(n.column) ?? 0;columnRows.set(n.column,row+1);return [n.id,{x:20+n.column*step,y:76+row*rowStep}] as const;}));
  const originRoutes=projected.originRoutes.filter(id=>visibleRoutes.has(id));
  if(originRoutes.length){const row=columnRows.get(0) ?? 0;coordinates.set(unconstrainedOrigin,{x:20,y:76+row*rowStep});columnRows.set(0,row+1);}
  const headers:{key:string;label:string;y:number;family:boolean}[]=[];
  let terminalY=48;
  for(const family of componentHierarchy(data)) {
    const groups=family.groups.map(g=>({...g,components:g.components.filter(c=>shownComponentIds.has(c.id))})).filter(g=>g.components.length);
    if(!groups.length)continue;
    headers.push({key:JSON.stringify([family.name]),label:family.name || "Senza famiglia",y:terminalY,family:true});terminalY+=22;
    for(const group of groups) {
      headers.push({key:JSON.stringify([family.name,group.name]),label:group.name || "Senza gruppo",y:terminalY,family:false});terminalY+=34;
      for(const c of group.components){coordinates.set(`c:${c.id}`,{x:20+columns*step,y:terminalY});terminalY+=rowStep;}
    }
  }
  const height=Math.max(224,terminalY,Math.max(0,...columnRows.values())*rowStep+80);
  const bundles=new Map<string,string[]>();
  for(const edge of shownEdges){const key=JSON.stringify([edge.from,edge.to]), ids=bundles.get(key) ?? [];ids.push(edge.routeId);bundles.set(key,ids);}
  const colors=new Map(graph.routes.map((r,i)=>[r.id,palette[i] ?? `hsl(${(i*137.508)%360} 64% 48%)`]));
  const component=validFocus?.kind==="component" ? data.components.find(c=>c.id===validFocus.id) : undefined;
  const route=validFocus?.kind==="route" ? routeMap.get(validFocus.id) : undefined;
  const node=validFocus?.kind==="node" ? graph.nodes.find(n=>n.id===validFocus.id) : undefined;
  const rule=route?.rule;
  const reset=()=>{setFocus(undefined);setSelectedNodes([]);onConfigurationChange?.(emptyGraphSelection);};
  const select=(next:GraphFocus)=>{const nextFocus=focus?.kind===next.kind && focus.id===next.id ? undefined : next;setFocus(nextFocus);if(next.kind==="route")onConfigurationChange?.(graphChoices(graph,selected,nextFocus?.id));};
  const selectNode=(id:string,additive:boolean)=>{
    if(!additive){const nextFocus=validFocus?.kind==="node" && validFocus.id===id ? undefined : {kind:"node" as const,id};setSelectedNodes([]);setFocus(nextFocus);onConfigurationChange?.(graphChoices(graph,nextFocus ? [id] : []));return;}
    const n=graph.nodes.find(n=>n.id===id)!;
    const seed=selected.length ? selected : validFocus?.kind==="node" ? [validFocus.id] : [];
    const next=selected.includes(id) ? selected.filter(x=>x!==id) : [...seed.filter(x=>graph.nodes.find(n=>n.id===x)?.column!==n.column),id];
    const routes=selectedRoutes(graph,next);
    if(next.includes(id) && ![...routes].some(route=>routeMap.get(route)!.nodes.includes(id) && statuses.get(route)!==false))return;
    setSelectedNodes(next);setFocus(undefined);onConfigurationChange?.(graphChoices(graph,next));
  };
  const nodeLabel=(conditions:Condition[])=>conditions.length ? conditions.map(graphConditionLabel).join(" E ") : data.parameters.length ? "Qualsiasi valore" : "Sempre";
  return <section className="config-section" onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();reset();}}}><div className="config-section-heading"><h2>Grafo della configurazione</h2><div className="config-graph-actions"><label className="config-checkbox"><input type="checkbox" checked={showUnconstrained} onChange={e=>setShowUnconstrained(e.target.checked)}/>Mostra passaggi senza vincoli</label><button type="button" className="config-text-button" disabled={!validFocus && !selected.length && !configurationSelected} onClick={reset}>Mostra tutti i percorsi</button></div></div><details className="config-graph-help"><summary>Come usare il grafo</summary><p className="config-hint">Parametri nell’ordine scelto, poi componenti. Le voci uguali sono condivise; ogni colore identifica un percorso. Seleziona una voce per evidenziare i suoi percorsi precedenti e successivi. Tieni premuto Ctrl (⌘ su Mac) e seleziona più parametri per ridurre il grafo ai percorsi compatibili con tutte le scelte. Sono inclusi anche i percorsi senza vincoli sui parametri selezionati. I passaggi “Qualsiasi valore” sono nascosti nella vista compatta. Clicca di nuovo o premi Esc per mostrare tutto. Doppio clic su un componente per modificare la sua regola.</p></details>
    <div className="config-graph-tools" role="group" aria-label="Strumenti del grafo">
      <button type="button" className="button button-secondary" aria-label="Riduci zoom del grafo" disabled={zoom<=.1} onClick={()=>updateView({zoom:Math.max(.1,zoom-.15)})}><ZoomOut size={16}/></button>
      <output aria-label="Zoom del grafo">{Math.round(zoom*100)}%</output>
      <button type="button" className="button button-secondary" aria-label="Aumenta zoom del grafo" disabled={zoom>=2} onClick={()=>updateView({zoom:Math.min(2,zoom+.15)})}><ZoomIn size={16}/></button>
      <button type="button" className="button button-secondary" onClick={()=>updateView({zoom:Math.max(.1,Math.min(1,(viewport.current?.clientWidth ?? width)/width))})}><Maximize2 size={16}/>Adatta alla finestra</button>
      <button type="button" className={`button button-secondary ${multiSelect ? "is-active" : ""}`} aria-pressed={multiSelect} onClick={()=>updateView({multiSelect:!multiSelect})}>Selezione multipla</button>
      <label>Cerca componente nel grafo<input type="search" placeholder="Codice o descrizione" value={query} onChange={e=>updateView({query:e.target.value})}/></label>
    </div>
    {query.trim() && <div className="config-graph-search-results" aria-label="Risultati ricerca componenti">{data.components.filter(c=>`${c.code} ${c.name}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).slice(0,12).map(c=><button type="button" key={c.id} className="config-text-button" onClick={()=>setFocus({kind:"component",id:c.id})}>{c.code} · {c.name}</button>)}{!data.components.some(c=>`${c.code} ${c.name}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())) && <span>Nessun componente trovato.</span>}</div>}

    {!!selected.length && <div className="config-graph-selection" aria-label="Parametri selezionati nel percorso"><strong>{visibleRoutes.size} {visibleRoutes.size===1 ? "percorso" : "percorsi"}</strong>{selected.map(id=>{const n=graph.nodes.find(n=>n.id===id)!;const label=`${data.parameters[n.column]?.name ?? "Sempre"}: ${nodeLabel(n.conditions)}`;return <button type="button" key={id} className="config-text-button" aria-label={`Rimuovi dal percorso ${label}`} onClick={()=>{const next=selected.filter(x=>x!==id);setSelectedNodes(next);setFocus(undefined);onConfigurationChange?.(graphChoices(graph,next));}}>{label} ×</button>;})}</div>}
    <div className="config-graph-legend"><span>Percorso attivo</span><span className="is-pending">Scelte aperte</span><span className="is-inactive">Non applicabile</span><span>× Esclusione componente</span></div>
    {graph.truncated && <p className="config-warning">Il grafo mostra un sottoinsieme dei percorsi (massimo 64 alternative per regola e 256 percorsi complessivi). Il calcolo della distinta usa tutte le regole.</p>}
    {graph.incomplete>0 && <p className="config-warning">Alcuni percorsi hanno definizioni incomplete: verifica Analisi.</p>}
    {graph.general>0 && <p className="config-hint">{graph.general} vincoli senza componente sono gestibili in Componenti → Vincoli generali.</p>}
    {!!selected.length && !visibleRoutes.size && <p className="config-empty">Nessun percorso completo è compatibile con tutte le voci selezionate. Rimuovi una selezione o mostra tutti i percorsi.</p>}
    {!graph.edges.length && <p className="config-empty">Nessun percorso verso un componente. Aggiungi una regola dalla scheda del componente.</p>}
    <div ref={viewport} className="config-graph config-path-graph"><svg viewBox={`0 0 ${width} ${height}`} style={{width:width*zoom,minWidth:width*zoom,height:height*zoom}} role="group" aria-label="Grafo dei parametri, regole e componenti" onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();reset();}}}>
      <defs><marker id={markerId} viewBox="0 0 12 12" refX="10" refY="6" markerWidth="9" markerHeight="9" orient="auto"><path d="M 2 2 L 10 10 M 2 10 L 10 2" fill="none" stroke="var(--danger)" strokeWidth="2"/></marker></defs>
      {data.parameters.map((p,i)=><text key={p.id} x={20+i*step} y="30" className="config-graph-heading"><title>{p.name}</title>{i+1}. {p.name.length>25 ? `${p.name.slice(0,24)}…` : p.name}</text>)}
      {!data.parameters.length && <text x="20" y="30" className="config-graph-heading">SEMPRE</text>}
      <text x={20+columns*step} y="30" className="config-graph-heading">COMPONENTI</text>
      {headers.map(h=><text key={h.key} x={20+columns*step} y={h.y} className={`config-graph-section-heading ${h.family ? "is-family" : ""}`}><title>{h.label}</title>{h.label.length>27 ? `${h.label.slice(0,26)}…` : h.label}</text>)}
      {shownEdges.toSorted((a,b)=>Number(activeRoutes.has(a.routeId))-Number(activeRoutes.has(b.routeId))).map(edge=>{
        const from=coordinates.get(edge.from)!,to=coordinates.get(edge.to)!;
        const related=activeRoutes.has(edge.routeId), status=statuses.get(edge.routeId), excluded=edge.action==="exclude";
        const lanes=bundles.get(JSON.stringify([edge.from,edge.to]))!, lane=lanes.indexOf(edge.routeId);
        const offset=(lane-(lanes.length-1)/2)*Math.min(4,32/Math.max(1,lanes.length-1));
        const d=`M ${from.x+boxWidth} ${from.y+offset} C ${from.x+boxWidth+28} ${from.y+offset}, ${to.x-28} ${to.y+offset}, ${to.x} ${to.y+offset}`;
        const description=`${edge.rule.name} · ${conditionSummary(edge.rule,data)}${edge.terminal ? ` · ${labels[edge.action]}` : ""}`;
        return <g key={edge.id} data-route-id={edge.routeId} role="button" tabIndex={0} aria-label={`Mostra percorso ${description}`} aria-pressed={validFocus?.kind==="route" && validFocus.id===edge.routeId} className={`config-graph-route ${status===false ? "is-inactive" : ""} ${related ? "" : "is-unrelated"}`} onClick={()=>select({kind:"route",id:edge.routeId})} onKeyDown={e=>{if(e.key==="Enter" || e.key===" "){e.preventDefault();select({kind:"route",id:edge.routeId});}}}>
          <path className="config-edge-hit" style={{strokeWidth:lanes.length>1 ? 4 : 14}} d={d}/>
          <path style={{stroke:related ? colors.get(edge.routeId) : "var(--text-muted)",strokeWidth:validFocus && related ? 2.7 : 1.6}} className={`config-edge ${status===undefined ? "is-pending" : ""}`} markerEnd={excluded ? `url(#${markerId})` : undefined} d={d}/><title>{description}</title>
        </g>;
      })}
      {!!originRoutes.length && (()=>{const {x,y}=coordinates.get(unconstrainedOrigin)!;const related=originRoutes.some(id=>activeRoutes.has(id));return <g className={`config-graph-origin ${related ? "" : "is-unrelated"}`} data-graph-origin="unconstrained"><rect x={x} y={y-24} width={boxWidth} height="48" rx="7"/><text x={x+12} y={y+5}>Sempre</text><title>Componenti senza condizioni sui parametri</title></g>;})()}
      {shownNodes.map(n=>{const {x,y}=coordinates.get(n.id)!;const relevant=nodeRoutes.get(n.id)!.filter(id=>activeRoutes.has(id));
        const status=relevant.some(id=>statuses.get(id)===true) ? true : relevant.some(id=>statuses.get(id)===undefined) ? undefined : false;
        const text=nodeLabel(n.conditions), title=`${data.parameters[n.column]?.name ?? "Sempre"}: ${text}`;
        let remaining=26;
        const pieces=n.conditions.length ? n.conditions.map((c,i)=>{const label=`${i ? " E " : ""}${graphConditionLabel(c)}`;const clipped=label.slice(0,Math.max(0,remaining));remaining-=label.length;return <tspan key={i} className={c.operator==="ne" ? "config-graph-negated" : undefined}>{clipped}</tspan>;}) : text;
        return <g key={n.id} data-node-id={n.id} role="button" tabIndex={0} aria-label={`Evidenzia percorsi ${title}`} aria-pressed={selected.includes(n.id) || (validFocus?.kind==="node" && validFocus.id===n.id)} className={`config-graph-parameter ${status===false ? "is-inactive" : ""} ${interestedNodes.has(n.id) ? "" : "is-unrelated"} ${selected.includes(n.id) || (validFocus?.kind==="node" && validFocus.id===n.id) ? "is-selected" : ""}`} onClick={e=>selectNode(n.id,multiSelect || e.ctrlKey || e.metaKey)} onKeyDown={e=>{if(e.key==="Enter" || e.key===" "){e.preventDefault();selectNode(n.id,multiSelect || e.ctrlKey || e.metaKey);}}}><rect x={x} y={y-24} width={boxWidth} height="48" rx="7"/><text x={x+12} y={y+5}>{pieces}{text.length>26 ? "…" : ""}</text><title>{title}</title></g>;
      })}
      {shownComponents.map(c=>{const {x,y}=coordinates.get(`c:${c.id}`)!;return <g key={c.id} data-component-id={c.id} role="button" tabIndex={0} aria-label={`Mostra regole per ${c.code}`} aria-description={onEditComponent ? "Doppio clic o F2 per modificare la regola del componente." : undefined} aria-pressed={validFocus?.kind==="component" && validFocus.id===c.id} className={`${validFocus?.kind==="component" && validFocus.id===c.id ? "is-selected" : ""} ${interestedComponents.has(c.id) ? "" : "is-unrelated"}`} onClick={()=>select({kind:"component",id:c.id})} onDoubleClick={e=>{if(!onEditComponent)return;e.preventDefault();setFocus({kind:"component",id:c.id});onEditComponent(c.id);}} onKeyDown={e=>{if(e.key==="F2" && onEditComponent){e.preventDefault();onEditComponent(c.id);return;}if(e.key==="Enter" || e.key===" "){e.preventDefault();select({kind:"component",id:c.id});}}}><rect x={x} y={y-24} width={boxWidth} height="48" rx="7"/><text x={x+12} y={y-3}>{c.code.slice(0,24)}</text><text x={x+12} y={y+15} className="config-graph-component-description">{c.name.length>27 ? `${c.name.slice(0,26)}…` : c.name}</text><title>{c.code} · {c.name}{onEditComponent ? " · Doppio clic: modifica regola" : ""}</title></g>;})}
    </svg></div>
    {node && <details className="config-expression-preview config-graph-details" key={node.id}><summary>{data.parameters[node.column]?.name ?? "Sempre"}: {nodeLabel(node.conditions)}</summary><span>{activeRoutes.size} {activeRoutes.size===1 ? "percorso compatibile" : "percorsi compatibili"}{node.conditions.length ? " · Inclusi i percorsi senza vincoli su questo parametro." : ""}</span></details>}
    {rule && <details className="config-expression-preview config-graph-details" key={route!.id}><summary>{rule.name} · {labels[route!.action]} {data.components.find(c=>c.id===route!.component)?.code}</summary><code>{conditionSummary(rule,data)}</code></details>}
    {component && <details className="config-card config-graph-details" key={component.id}><summary>{component.code} · <span className="config-component-description">{component.name}</span></summary>{onEditComponent && <button type="button" className="config-text-button" onClick={()=>onEditComponent(component.id)}>Modifica regola del componente</button>}{data.rules.filter(r=>ruleUsesComponent(r,component.id)).map(r=><p key={r.id}>{r.name} · {conditionSummary(r,data)} · {!r.enabled ? "disattivata" : matches(r,selection)===true ? "attiva" : matches(r,selection)===false ? "non applicabile" : "condizioni ancora aperte"}</p>)}</details>}
  </section>;
}
