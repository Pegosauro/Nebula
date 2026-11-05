import { useId, useRef, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GripVertical } from "lucide-react";
type Section = { id: string; title: string; count: number; collapsed: boolean; controls?: ReactNode; content: ReactNode };
type Target = { id: string; after: boolean };
/** Each level owns its drag scope; dragging a child never moves its family. */
export function SortableSections({items,kind,onReorder,onToggle,disabled=false}:{disabled?:boolean;items:Section[];kind:"Famiglia"|"Gruppo";onReorder:(ids:string[])=>void;onToggle:(id:string)=>void}) {
  const scope=useId(), [dragged,setDragged]=useState<string>(), [target,setTarget]=useState<Target>(), [announcement,setAnnouncement]=useState("");
  const touch=useRef<{id:string;target?:Target} | undefined>(undefined);
  const finish=()=>{setDragged(undefined);setTarget(undefined);touch.current=undefined;};
  const move=(id:string,to:Target)=>{if(disabled || id===to.id)return;const ids=items.map(x=>x.id).filter(x=>x!==id), index=ids.indexOf(to.id);if(index<0)return;ids.splice(index+Number(to.after),0,id);onReorder(ids);setAnnouncement(`${kind} ${items.find(x=>x.id===id)?.title}: posizione ${ids.indexOf(id)+1}.`);};
  return <div className={`config-sortable-sections ${kind==="Famiglia" ? "config-families" : "config-component-groups"}`} data-section-scope={scope}>{items.map((item,i)=>{
    const contentId=`${scope}-${i}`;
    return <section key={item.id} className={`${kind==="Famiglia" ? "config-component-family" : "config-component-group"} ${dragged===item.id ? "is-dragging" : ""}`} aria-label={`${kind} ${item.title}`}>
      <div data-section-id={item.id} className={`config-hierarchy-header ${kind==="Gruppo" ? "config-component-group-heading" : "config-family-heading"} ${target?.id===item.id ? target.after ? "drop-after" : "drop-before" : ""}`}
        onDragOver={e=>{if(dragged===undefined)return;e.preventDefault();e.stopPropagation();e.dataTransfer.dropEffect="move";const rect=e.currentTarget.getBoundingClientRect();setTarget({id:item.id,after:e.clientY>rect.top+rect.height/2});}}
        onDrop={e=>{if(dragged===undefined)return;e.preventDefault();e.stopPropagation();const rect=e.currentTarget.getBoundingClientRect();move(dragged,{id:item.id,after:e.clientY>rect.top+rect.height/2});finish();}}>
        <button type="button" disabled={disabled} draggable={!disabled} className="config-drag-handle" aria-label={`Trascina ${kind.toLowerCase()} ${item.title}`} title="Trascina per riordinare · Alt + frecce" onDragStart={e=>{e.stopPropagation();e.dataTransfer.setData("text/plain",item.id);e.dataTransfer.effectAllowed="move";setDragged(item.id);}} onDragEnd={finish}
          onKeyDown={e=>{if(!e.altKey || !["ArrowUp","ArrowDown"].includes(e.key))return;e.preventDefault();const next=items[i+(e.key==="ArrowUp" ? -1 : 1)];if(next)move(item.id,{id:next.id,after:e.key==="ArrowDown"});}}
          onPointerDown={e=>{if(e.pointerType==="mouse")return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);touch.current={id:item.id};setDragged(item.id);}}
          onPointerMove={e=>{if(!touch.current)return;const header=document.elementFromPoint(e.clientX,e.clientY)?.closest<HTMLElement>("[data-section-id]");if(!header || header.closest("[data-section-scope]")?.getAttribute("data-section-scope")!==scope)return;const rect=header.getBoundingClientRect();const to={id:header.dataset.sectionId!,after:e.clientY>rect.top+rect.height/2};touch.current.target=to;setTarget(to);}}
          onPointerUp={()=>{if(!touch.current)return;if(touch.current.target)move(touch.current.id,touch.current.target);finish();}} onPointerCancel={()=>{if(touch.current)finish();}}><GripVertical size={16}/></button>
        <h3 className="config-hierarchy-title"><button type="button" className="config-hierarchy-toggle" aria-label={`${item.collapsed ? "Espandi" : "Comprimi"} ${kind.toLowerCase()} ${item.title}`} aria-expanded={!item.collapsed} aria-controls={contentId} onClick={()=>onToggle(item.id)}>{item.collapsed ? <ChevronRight size={16}/> : <ChevronDown size={16}/>}<span>{item.title}</span></button></h3><span className="config-hierarchy-count" aria-label={`${item.count} componenti`}>{item.count}</span>
        <div className="config-row-controls">{item.controls}<div className="config-reorder-buttons"><button type="button" className="config-icon" disabled={disabled || i===0} aria-label={`Sposta su ${kind.toLowerCase()} ${item.title}`} onClick={()=>move(item.id,{id:items[i-1]!.id,after:false})}><ArrowUp size={14}/></button><button type="button" className="config-icon" disabled={disabled || i===items.length-1} aria-label={`Sposta giù ${kind.toLowerCase()} ${item.title}`} onClick={()=>move(item.id,{id:items[i+1]!.id,after:true})}><ArrowDown size={14}/></button></div></div>
      </div><div id={contentId} hidden={item.collapsed}>{item.content}</div>
    </section>;
  })}<span className="config-sr-only" role="status">{announcement}</span></div>;
}
