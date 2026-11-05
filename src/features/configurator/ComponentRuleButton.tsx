import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Plus } from "lucide-react";
import type { Action, Component, Configurator } from "./model";
import { expandRule, ruleUsesComponent } from "./componentRules";
import { conditionSummary, ruleConditions } from "./expressions";
import { valueLabel } from "./engine";
const componentAction = (a:Action,id:string) => a.type==="oneOf" ? a.components.includes(id) : ["add","exclude","requireComponent"].includes(a.type) && a.component===id;
export function activeComponentRules(data:Configurator,id:string) {
  return data.rules.filter(r=>ruleUsesComponent(r,id)).flatMap(expandRule).filter(r=>r.enabled).flatMap(r=>{
    const direct=r.actions.filter(a=>componentAction(a,id));
    const actions=direct.length ? r.actions.filter(a=>componentAction(a,id) || ["requireValue","excludeValue"].includes(a.type)) : r.componentIds?.includes(id) && !r.actions.some(a=>["add","exclude","requireComponent","oneOf"].includes(a.type)) ? r.actions : [];
    return actions.length ? [{rule:r,actions}] : [];
  });
}
function actionSummary(a:Action,data:Configurator) {
  if(a.type==="add") { const q=a.quantity, parameter=data.parameters.find(p=>p.id===q.parameter);return `Aggiungi · ${q.amount}${q.parameter ? ` × ${parameter?.name ?? "Parametro mancante"} ÷ ${q.divisor}${q.rounding==="ceil" ? " · per eccesso" : q.rounding==="floor" ? " · per difetto" : ""}` : ""}`; }
  if(a.type==="exclude")return "Escludi componente";
  if(a.type==="requireComponent")return "Richiedi componente";
  if(a.type==="oneOf")return `Uno solo tra ${a.components.map(id=>data.components.find(c=>c.id===id)?.code ?? "Componente mancante").join(", ")}`;
  return `${a.type==="requireValue" ? "Richiedi" : "Escludi"} ${data.parameters.find(p=>p.id===a.parameter)?.name ?? "Parametro mancante"}: ${valueLabel(a.value)}`;
}
export function ComponentRuleButton({component,data,onClick,compact=false}:{component:Component;data:Configurator;onClick:()=>void;compact?:boolean}) {
  const [open,setOpen]=useState(false), [pinned,setPinned]=useState(false), [position,setPosition]=useState({top:0,left:0});
  const root=useRef<HTMLDivElement>(null), button=useRef<HTMLButtonElement>(null), popup=useRef<HTMLDivElement>(null), timer=useRef<ReturnType<typeof setTimeout> | undefined>(undefined), id=useId();
  const active=useMemo(()=>activeComponentRules(data,component.id),[data,component.id]);
  const hasRule=data.rules.some(r=>ruleUsesComponent(r,component.id)), conditioned=active.some(r=>ruleConditions(r.rule).length>0), label=hasRule ? "Modifica regola" : "Aggiungi regola";
  const cancelTimer=()=>{if(timer.current)clearTimeout(timer.current);};
  const close=()=>{cancelTimer();setOpen(false);setPinned(false);};
  useEffect(()=>()=>cancelTimer(),[]);
  useLayoutEffect(()=>{if(!open)return;const b=button.current!.getBoundingClientRect(), p=popup.current!.getBoundingClientRect();setPosition({left:Math.max(8,Math.min(b.left,window.innerWidth-p.width-8)),top:b.bottom+p.height+8<=window.innerHeight ? b.bottom+6 : Math.max(8,b.top-p.height-6)});},[open,active,pinned]);
  useEffect(()=>{if(!open)return;const outside=(e:PointerEvent)=>{if(!root.current?.contains(e.target as Node))close();};const escape=(e:KeyboardEvent)=>{if(e.key==="Escape"){e.preventDefault();e.stopPropagation();close();}};const viewport=(e:Event)=>{if(!popup.current?.contains(e.target as Node))close();};document.addEventListener("pointerdown",outside);document.addEventListener("keydown",escape,true);window.addEventListener("resize",viewport);window.addEventListener("scroll",viewport,true);return()=>{document.removeEventListener("pointerdown",outside);document.removeEventListener("keydown",escape,true);window.removeEventListener("resize",viewport);window.removeEventListener("scroll",viewport,true);};},[open]);
  return <div ref={root} className="config-rule-preview-anchor" onMouseEnter={()=>{cancelTimer();setOpen(true);}} onMouseLeave={()=>{if(!pinned){cancelTimer();timer.current=setTimeout(()=>setOpen(false),180);}}} onBlur={e=>{if(!pinned && !e.currentTarget.contains(e.relatedTarget))setOpen(false);}}>
    <button ref={button} type="button" className={`${compact ? "config-icon" : "config-text-button"} config-component-rule ${conditioned ? "is-conditioned" : ""}`} aria-label={compact ? `${label} per ${component.code || component.name || "componente"}` : undefined} aria-description="Passa il mouse o usa il clic destro per vedere le regole attive." aria-describedby={open ? id : undefined} onFocus={()=>setOpen(true)} onContextMenu={e=>{e.preventDefault();e.stopPropagation();cancelTimer();setPinned(true);setOpen(true);}} onClick={()=>{close();onClick();}}>{compact ? <GitBranch size={16}/> : <>{hasRule ? <GitBranch size={14}/> : <Plus size={14}/>} {label}</>}</button>
    {open && <div id={id} ref={popup} role={pinned ? "dialog" : "tooltip"} aria-label={pinned ? `Regole attive di ${component.code || component.name}` : undefined} className="config-rule-preview" style={position}><strong>{component.code || component.name || "Componente"} · Regole attive</strong>{active.length ? <ol>{active.map(({rule,actions})=><li key={rule.id}><b>{rule.name || "Regola del componente"}</b><code>{conditionSummary(rule,data)}</code><span>{actions.map(a=>actionSummary(a,data)).join(" · ")}</span></li>)}</ol> : <p>Nessuna regola attiva.</p>}{pinned && <button type="button" className="config-text-button" onClick={close}>Chiudi riepilogo</button>}</div>}
  </div>;
}
