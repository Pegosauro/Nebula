import { TextParameterInput } from "./TextParameterInput";
import { defaultConfiguratorUi, useConfiguratorUiStore } from "./configuratorUiStore";
import { vaultService } from "../vault/vaultService";
import { useCalculation } from "./useCalculation";
import { navigationKnowledge } from "./navigationKnowledge";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { Download, GitBranch, Link2, RotateCcw, Save } from "lucide-react";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useKnowledgeNavigationStore } from "../knowledge/knowledgeNavigationStore";
import { useConfiguratorStore, type ConfiguratorPreview } from "./configuratorStore";
import { ComponentEditor, ComponentRuleDialog, ParameterEditor } from "./DefinitionEditors";
import { BomOptions } from "./BomOptions";
import { Bom, download, exportBom, VariantList } from "./ConfiguratorResults";
import { ConfiguratorNavigation, type ConfiguratorSection } from "./ConfiguratorNavigation";
import { configuratorSaveStatus, saveStatusLabel, saveStatusTone } from "../workspace/saveStatus";
import { ConfiguratorDetails } from "./ConfiguratorDetails";
import { emptyGraphSelection, graphInput, type GraphSelection } from "./graphSelection";
import { ConfiguratorGraph } from "./ConfiguratorGraph";
import { domain, evaluate, parameterAffectsRules, parameterNeedsInput, optionAvailability, valueLabel, type Enumeration, type Evaluation } from "./engine";
import { acceptsParameterValue, allowsCustomText, configTitle, type Configurator, type Selection } from "./model";

export default function ConfiguratorView({path}: {path:string}) {
  const session=useConfiguratorStore(s=>s.sessions[path]);
  useVaultStore(s=>s.snapshot?.scannedAt);
  const documents=useKnowledgeStore(s=>s.documents);
  const [error,setError]=useState<string>();
  const [notice,setNotice]=useState<string>();
  const scope = `${vaultService.currentVaultId() ?? "session"}:${path}`;
  const ui = useConfiguratorUiStore(state => state.projects[scope] ?? defaultConfiguratorUi);
  const { section, selection, showVariants, graphSelection } = ui;
  const setSection = (section: ConfiguratorSection) => useConfiguratorUiStore.getState().update(scope, { section });
  const setSelection = (next: Selection | ((current: Selection) => Selection)) => {
    const current = useConfiguratorUiStore.getState().projects[scope]?.selection ?? defaultConfiguratorUi.selection;
    useConfiguratorUiStore.getState().update(scope, { selection: typeof next === "function" ? next(current) : next });
  };
  const setShowVariants = (next: boolean | ((current: boolean) => boolean)) => useConfiguratorUiStore.getState().update(scope, { showVariants: typeof next === "function" ? next(useConfiguratorUiStore.getState().projects[scope]?.showVariants ?? false) : next });
  const [editingComponent,setEditingComponent]=useState<string>();
  const updateGraphSelection=useCallback((next:GraphSelection) => {
    const current = useConfiguratorUiStore.getState().projects[scope]?.graphSelection;
    if (JSON.stringify(current) !== JSON.stringify(next)) useConfiguratorUiStore.getState().update(scope, { graphSelection: next });
  }, [scope]);
  useEffect(() => {
    if (!session) return;
    const parameters = session.data.parameters;
    const valid = Object.fromEntries(Object.entries(selection).filter(([id, value]) => {
      const p = parameters.find(p => p.id === id);
      return p && acceptsParameterValue(p,value);
    }));
    if (JSON.stringify(valid) !== JSON.stringify(selection)) useConfiguratorUiStore.getState().update(scope, { selection: valid });
    const graph = useConfiguratorUiStore.getState().projects[scope]?.graphSelection;
    if (graph) {
      const next = { parameters: graph.parameters.filter(id => parameters.some(p => p.id === id)), conditions: graph.conditions.filter(c => parameters.some(p => p.id === c.parameter && acceptsParameterValue(p,c.value))) };
      if(JSON.stringify(next)!==JSON.stringify(graph)) useConfiguratorUiStore.getState().update(scope,{graphSelection:next});
    }
  }, [scope, session?.data.parameters, selection]);
  const graphConditions=section==="Grafo" ? graphSelection.conditions : emptyGraphSelection.conditions;
  const activeSelection=useMemo(()=>section==="Grafo" ? graphInput(selection,graphSelection) : selection,[selection,graphSelection,section]);
  const needsCalculation=(section==="Esplora" || section==="BOM" || section==="Analisi" || section==="Grafo") && !editingComponent;
  const deferredData=useDeferredValue(needsCalculation ? session?.data : undefined);
  const deferredSelection=useDeferredValue(activeSelection);
  const deferredConditions=useDeferredValue(graphConditions);
  useEffect(()=>{let cancelled=false;void useConfiguratorStore.getState().load(path).catch(e=>{if(!cancelled)setError(e instanceof Error?e.message:"Apertura non riuscita.");});return()=>{cancelled=true;};},[path]);
  const calculation=useCalculation(deferredData,deferredSelection,section==="Analisi",needsCalculation,deferredConditions);
  const preview=useMemo<ConfiguratorPreview|undefined>(()=>{
    const data=session?.data;if(!data)return;
    const value=calculation.data===data && calculation.selection===activeSelection && calculation.conditions===graphConditions ? calculation.value : undefined, enumeration=value?.enumeration;
    const updating=needsCalculation && (data!==deferredData || activeSelection!==deferredSelection || graphConditions!==deferredConditions || calculation.computing);
    const errors=[...(value?.issues.filter(i=>i.severity==="error").map(i=>i.message) ?? []),...(value?.result.errors ?? []),...(calculation.error ? [calculation.error] : [])];
    return {data,selection:activeSelection,conditions:graphConditions,result:value?.result,invalid:!!enumeration?.exhaustive && !enumeration.solutions.length,updating,complete:!!enumeration?.exhaustive && enumeration.solutions.length===1 || data.parameters.every(p=>!parameterNeedsInput(data,p) || activeSelection[p.id]!==undefined) && !value?.result.pending.length,errors,reason:enumeration?.reason};
  },[session?.data,calculation.value,calculation.computing,calculation.error,calculation.data,calculation.selection,calculation.conditions,needsCalculation,deferredData,activeSelection,deferredSelection,graphConditions,deferredConditions]);
  useEffect(()=>{if(preview)useConfiguratorStore.getState().preview(path,preview);},[path,preview]);
  const issues=calculation.value?.issues ?? [];
  const hasErrors=issues.some(i=>i.severity==="error");
  const enumeration:Enumeration=calculation.value?.enumeration ?? {solutions:[],exhaustive:false,examined:0};
  const result:Evaluation=calculation.value?.result ?? {bom:[],possible:[],errors:[],pending:[],matched:[]};
  const analysisEnumeration=calculation.value?.analysisEnumeration;
  const notes=Object.keys(documents);
  const backlinks=navigationKnowledge().documents[path]?.incoming ?? [];
  if(error) return <div className="config-workspace"><h1>Impossibile aprire il configuratore</h1><p className="config-error" role="alert">{error}</p><button className="button" onClick={()=>{setError(undefined);void useConfiguratorStore.getState().load(path,true).catch(e=>setError(String(e)));}}>Riprova</button></div>;
  if(!session) return <div className="editor-loading">Caricamento configuratore…</div>;
  const data=session.data;
  const updating=needsCalculation && (data!==deferredData || activeSelection!==deferredSelection || graphConditions!==deferredConditions || calculation.computing);
  const change=(next:Configurator)=>useConfiguratorStore.getState().edit(path,next);
  const choose=(id:string,value?:Selection[string])=>setSelection(s=>{const parameter=data.parameters.find(p=>p.id===id);if(value!==undefined && parameter && !optionAvailability(data,parameter,value,s).allowed)return s;const next={...s};if(value===undefined)delete next[id];else next[id]=value;return next;});
  const toggle=(id:string,value:Selection[string])=>setSelection(current=>{const parameter=data.parameters.find(p=>p.id===id);if(current[id]!==value && parameter && !optionAvailability(data,parameter,value,current).allowed)return current;const next={...current};if(current[id]===value)delete next[id];else next[id]=value;return next;});
  const invalid=!hasErrors && enumeration.exhaustive && !enumeration.solutions.length;
  const computedResult=invalid?{...result,bom:[],possible:[]}:result;
  const saveStatus = configuratorSaveStatus(session);
  const copyLink=async()=>{try {await navigator.clipboard.writeText(`[[${path}]]`);setNotice("Collegamento copiato: incollalo in una nota.");}catch{setNotice(`Collegamento: [[${path}]]`);}};
  return <div className="config-workspace"><header className="config-heading"><GitBranch size={24}/><div className="config-grow"><h1>{data.title}</h1><p>{path}</p></div><span className={`config-save-state save-status is-${saveStatusTone(saveStatus)}`} role="status" aria-live="polite">{saveStatusLabel(saveStatus)}</span><div className="config-actions"><button className="button" title="Copia collegamento alla nota" onClick={()=>void copyLink()}><Link2 size={16}/><span>Collegamento</span></button><button className="button" onClick={()=>download(`${configTitle(path.split("/").at(-1)!)}.config.json`,JSON.stringify(data,null,2),"application/json")}><Download size={16}/><span>Esporta</span></button><button className="button button-primary" disabled={session.saving} onClick={()=>void useConfiguratorStore.getState().save(path)}><Save size={16}/><span>Salva</span></button></div></header>{notice && <p role="status" className="config-feedback" onClick={()=>setNotice(undefined)}>{notice}</p>}{session.error && <div className="config-error" role="alert"><p>{session.error} Le modifiche restano aperte. Esportale prima di ricaricare se vuoi conservarle.</p><button className="button" onClick={()=>{if(confirm("Ricaricare il file dal Vault e scartare le modifiche aperte?"))void useConfiguratorStore.getState().load(path,true).catch(e=>setError(String(e)));}}>Ricarica dal Vault</button></div>}<ConfiguratorNavigation section={section} issues={issues.length} onChange={next => { if(next === "BOM") useWorkspaceStore.getState().setContextPanelOpen(false); setSection(next); }} />{needsCalculation && <div className="config-calculation-state" role="status" aria-live="polite">{updating ? "Aggiornamento risultati…" : ""}</div>}{calculation.error && <p className="config-error" role="alert">{calculation.error}</p>}{hasErrors && !["Parametri","Componenti","Analisi"].includes(section) && <p className="config-error">Il progetto contiene definizioni incomplete o non valide. Correggi le segnalazioni in Analisi prima di usare i risultati.</p>}
    {section==="Parametri" && <ParameterEditor data={data} change={change} notes={notes}/>}
    {section==="Componenti" && <ComponentEditor data={data} change={change} notes={notes}/>}

    {section==="Grafo" && <><ConfiguratorGraph viewState={ui.graph} onViewChange={patch => useConfiguratorUiStore.getState().update(scope, { graph: { ...(useConfiguratorUiStore.getState().projects[scope]?.graph ?? ui.graph), ...patch } })} data={data} selection={activeSelection} onConfigurationChange={updateGraphSelection} onEditComponent={setEditingComponent} configurationSelected={!!graphSelection.parameters.length}/><ConfiguratorDetails data={data} path={path}/></>}{editingComponent && data.components.some(c=>c.id===editingComponent) && <ComponentRuleDialog key={editingComponent} data={data} component={data.components.find(c=>c.id===editingComponent)!} change={change} onClose={()=>setEditingComponent(undefined)}/>}
    {(section==="Esplora" || section==="BOM") && !hasErrors && <><div className="config-result-status"><strong>{invalid || result.errors.length?"Configurazione non valida":data.parameters.every(p=>!parameterNeedsInput(data,p) || selection[p.id]!==undefined) && !result.pending.length ? "Configurazione completa":"Configurazione parziale"}</strong><span>{enumeration.exhaustive?`${enumeration.solutions.length.toLocaleString("it-IT")} varianti valide`:"Scelte aperte"}</span><button className="config-text-button" onClick={()=>{setSelection({});setShowVariants(false);updateGraphSelection(emptyGraphSelection);useConfiguratorUiStore.getState().update(scope, { graph: { ...ui.graph, selectedNodes: [], focus: undefined } });}}><RotateCcw size={14}/>Azzera scelte</button></div>{[...result.errors,...result.pending].map((message,i)=><p className={i<result.errors.length?"config-error":"config-warning"} key={i}>{message}</p>)}{invalid && <p className="config-error">Nessuna combinazione soddisfa tutte le regole. Modifica le scelte o verifica i vincoli.</p>}<div className={`config-explore-grid ${section==="BOM" ? "config-bom-grid" : ""}`}><div><section className="config-card"><h2>{section==="BOM" ? "Opzioni della BOM" : "Scelte della configurazione"}</h2>{!data.parameters.length && <p className="config-empty">Aggiungi i parametri da Definizione → Parametri.</p>}{section==="BOM" ? <BomOptions data={data} selection={selection} enumeration={updating ? undefined : enumeration} choose={choose} toggle={toggle}/> : data.parameters.map(p=>{const values=domain(p);return <label className="config-selection" key={p.id}>{p.name}{p.unit?` (${p.unit})`:""}{allowsCustomText(p) ? <TextParameterInput parameter={p} value={selection[p.id]===undefined ? "" : String(selection[p.id])} onChange={value=>choose(p.id,value==="" ? undefined : value)}/> : p.type==="number" ? <input aria-label={p.name} type="number" min={p.min} max={p.max} step={p.step ?? "any"} placeholder={[p.min,p.max].filter(v=>v!==undefined).join(" – ") || "Da definire"} value={selection[p.id]===undefined?"":String(selection[p.id])} onChange={e=>choose(p.id,e.target.value===""?undefined:Number(e.target.value))}/> : <select aria-label={p.name} value={selection[p.id]===undefined?"":JSON.stringify(selection[p.id])} onChange={e=>choose(p.id,e.target.value?JSON.parse(e.target.value):undefined)}><option value="">Tutte le possibilità</option>{values?.map((v,i)=>{const availability=optionAvailability(data,p,v,selection);const denied=!availability.allowed || evaluate(data,{...selection,[p.id]:v}).errors.length>0 || (enumeration.exhaustive && (p.type!=="text" || parameterAffectsRules(data,p.id)) && !enumeration.solutions.some(s=>s.selection[p.id]===v) && selection[p.id]===undefined);return <option key={i} value={JSON.stringify(v)} title={availability.reason || undefined} disabled={denied && selection[p.id]!==v}>{valueLabel(v)}{denied?" · non compatibile":""}</option>;})}</select>}</label>;})}<button className="button button-secondary" disabled={updating || !data.rules.length && !data.parameters.some(p=>p.optionRules?.some(r=>r.enabled))} onClick={()=>setShowVariants(v=>!v)}>{showVariants?"Nascondi varianti":"Genera configurazioni"}</button>{enumeration.reason && <p className="config-hint">{enumeration.reason}</p>}</section>{section==="Esplora" && <section className="config-card"><h3>Strade ancora aperte</h3>{data.parameters.filter(p=>parameterNeedsInput(data,p) && selection[p.id]===undefined).map(p=><details className="config-branch" key={p.id}><summary>{p.name}</summary>{domain(p)?.map((v,i)=>{const candidate={...selection,[p.id]:v};const errors=evaluate(data,candidate).errors;const availability=optionAvailability(data,p,v,selection);const compatible=availability.allowed && !errors.length && (!enumeration.exhaustive || enumeration.solutions.some(s=>s.selection[p.id]===v));return <button key={i} disabled={!compatible} title={availability.reason || errors.join("\n")} onClick={()=>choose(p.id,v)}>{valueLabel(v)} · {compatible?(enumeration.exhaustive?`${enumeration.solutions.filter(s=>s.selection[p.id]===v).length} varianti`:"da completare"):"non valido"}</button>;}) ?? <p>{p.type==="text" ? "Inserisci il testo in alto per esplorare questo ramo." : "Inserisci un valore numerico in alto per esplorare questo ramo."}</p>}</details>)}{data.parameters.every(p=>!parameterNeedsInput(data,p) || selection[p.id]!==undefined) && <p className="config-hint">Tutti i parametri sono definiti.</p>}</section>}</div><section className="config-card"><div className="config-section-heading"><h2>Distinta (BOM)</h2><button className="button" disabled={updating || invalid || !!result.errors.length} onClick={()=>exportBom(data,[...computedResult.bom,...computedResult.possible])}><Download size={16}/>CSV</button></div><Bom data={data} result={computedResult} path={path}/></section></div>{showVariants && <VariantList data={data} enumeration={enumeration} select={setSelection}/>}</>}
    {section==="Analisi" && <section className="config-section"><h2>Analisi delle regole</h2>{!issues.length && <p className="config-feedback">Nessun problema nelle definizioni.</p>}{issues.map((issue,i)=><p key={i} className={issue.severity==="error"?"config-error":"config-warning"}>{issue.message}</p>)}{analysisEnumeration && <div className="config-card"><h3>Verifica delle configurazioni</h3><p>{analysisEnumeration.examined.toLocaleString("it-IT")} combinazioni esaminate · {analysisEnumeration.solutions.length.toLocaleString("it-IT")} valide</p>{analysisEnumeration.reason && <p className="config-warning">{analysisEnumeration.reason} Il controllo globale non è completo.</p>}{analysisEnumeration.exhaustive && !analysisEnumeration.solutions.length && <p className="config-error">Le regole non ammettono alcuna configurazione valida.</p>}{analysisEnumeration.exhaustive && data.components.filter(c=>!analysisEnumeration.solutions.some(s=>s.result.bom.some(r=>r.component===c.id))).map(c=><p className="config-warning" key={c.id}>{c.code}: nessun percorso valido include questo componente.</p>)}{analysisEnumeration.exhaustive && data.rules.filter(r=>r.enabled && !analysisEnumeration.solutions.some(s=>s.result.matched.includes(r.id))).map(r=><p className="config-warning" key={r.id}>{r.name}: mai attiva in una configurazione valida.</p>)}{result.errors.map((message,i)=><p className="config-error" key={i}>{message}</p>)}</div>}<p className="config-hint">Le condizioni leggono i parametri e le azioni non attivano altre regole: non si creano dipendenze circolari. La verifica globale è completa solo sui domini finiti entro il limite di 5.000 combinazioni.</p></section>}
    {section!=="Grafo" && backlinks.length>0 && <details className="config-card"><summary>Note collegate ({backlinks.length})</summary>{backlinks.map(n=><button key={n} className="config-text-button" onClick={()=>useKnowledgeNavigationStore.getState().choose(n)}><Link2 size={14}/>{n.replace(/\.md$/i,"")}</button>)}</details>}
  </div>;
}
