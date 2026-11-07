import { useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronRight, GitBranch, GripVertical, Plus, Trash2 } from "lucide-react";
import type { ConditionNode, Configurator } from "./model";
import { uid } from "./model";
import { initialValue, ValueInput } from "./ConditionControls";
import { conditionsOf, expressionLabel, logicLabels, operatorLabels } from "./expressions";

type Props = { data: Configurator; node: ConditionNode; onChange: (node: ConditionNode) => void; depth?: number; explicitConditions?: boolean; emptyRootLabel?: string };
export function ConditionTreeEditor({data,node,onChange,depth=0,explicitConditions=false,emptyRootLabel}: Props) {
  const [collapsed,setCollapsed]=useState(false);
  const [dragged,setDragged]=useState<string>();
  const leaf = (): ConditionNode => explicitConditions
    ? {id:uid(),type:"condition",condition:{parameter:"",operator:"eq",value:""}}
    : {id:uid(),type:"condition",condition:{parameter:data.parameters[0]?.id ?? "",operator:"eq",value:initialValue(data.parameters[0])}};
  if (node.type === "condition") {
    const c=node.condition, p=data.parameters.find(p=>p.id===c.parameter);
    const edit=(patch:Partial<typeof c>)=>onChange({...node,condition:{...c,...patch}});
    return <div className="config-condition-leaf"><div className="config-rule-row">
      <select aria-label="Parametro della condizione" value={c.parameter} onChange={e=>edit({parameter:e.target.value,operator:"eq",value:initialValue(data.parameters.find(p=>p.id===e.target.value))})}><option value="">Parametro…</option>{data.parameters.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select>
      <select aria-label="Operatore" value={c.operator} onChange={e=>edit({operator:e.target.value as typeof c.operator})}>{Object.entries(operatorLabels).filter(([op])=>p?.type==="number" || ["eq","ne"].includes(op)).map(([op,label])=><option key={op} value={op}>{label}</option>)}</select>
      <ValueInput parameter={p} value={c.value} onChange={value=>edit({value})}/>
      <button type="button" className="config-icon" aria-label="Nega condizione" title="Nega condizione (NON)" onClick={()=>onChange({id:uid(),type:"not",child:node})}>NON</button>
    </div></div>;
  }
  const children=node.type === "not" ? [node.child] : node.children;
  const editChild=(i:number,next:ConditionNode)=>onChange(node.type === "not" ? {...node,child:next} : {...node,children:children.map((n,j)=>j===i ? next : n)});
  const move=(from:number,to:number)=>{if (node.type==="not" || from<0 || to<0 || to>=children.length || from===to) return; const next=[...children];next.splice(to,0,next.splice(from,1)[0]!);onChange({...node,children:next});};
  const setLogic=(type:"all"|"any"|"not")=>{
    if (type === node.type) return;
    if (type === "not") onChange({id:node.id,type,child:children.length===1 ? children[0]! : {...node,id:uid()}});
    else onChange({id:node.id,type,children:node.type==="not" && node.child.type!=="condition" && node.child.type!=="not" ? node.child.children : children});
  };
  const maxDepth=depth>=28;
  return <section className={`config-condition-group logic-${node.type}`} aria-label={`Gruppo ${logicLabels[node.type]}`}>
    <div className="config-group-heading">
      <button type="button" className="config-icon" aria-label={collapsed ? "Espandi gruppo" : "Comprimi gruppo"} aria-expanded={!collapsed} onClick={()=>setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={16}/> : <ChevronDown size={16}/>}</button>
      <span className="config-logic-badge">{logicLabels[node.type]}</span>
      <select aria-label={depth===0 ? "Combinazione condizioni" : "Combinazione del gruppo"} value={node.type} onChange={e=>setLogic(e.target.value as "all"|"any"|"not")}><option value="all">Tutte vere (E)</option><option value="any">Almeno una vera (O)</option><option value="not" disabled={maxDepth}>Nega il risultato (NON)</option></select>
      <span className="config-group-count">{conditionsOf(node).length} condizioni</span>
    </div>
    {collapsed ? <p className="config-group-collapsed" title={expressionLabel(node,data)}>{expressionLabel(node,data)}</p> : <div className="config-group-content">
      {node.type==="not" && <p className="config-hint">È vero quando l’elemento racchiuso è falso. Un valore non scelto resta in attesa.</p>}
      {children.map((child,i)=><div key={child.id} className={`config-tree-child ${dragged===child.id ? "is-dragging" : ""}`} onDragOver={e=>{if(dragged){e.preventDefault();e.stopPropagation();}}} onDrop={e=>{if(!dragged)return;e.preventDefault();e.stopPropagation();move(children.findIndex(n=>n.id===dragged),i);setDragged(undefined);}}>
        <div className="config-tree-child-body"><ConditionTreeEditor data={data} node={child} depth={depth+1} explicitConditions={explicitConditions} onChange={next=>editChild(i,next)}/></div>
        <div className="config-tree-controls">
          {node.type!=="not" && <><button type="button" className="config-icon config-drag-handle" draggable aria-label={`Trascina elemento ${i+1}`} onDragStart={e=>{e.stopPropagation();e.dataTransfer.setData("text/plain",child.id);e.dataTransfer.effectAllowed="move";setDragged(child.id);}} onDragEnd={()=>setDragged(undefined)}><GripVertical size={14}/></button><button type="button" className="config-icon" aria-label={`Sposta su elemento ${i+1}`} disabled={i===0} onClick={()=>move(i,i-1)}><ArrowUp size={12}/></button><button type="button" className="config-icon" aria-label={`Sposta giù elemento ${i+1}`} disabled={i===children.length-1} onClick={()=>move(i,i+1)}><ArrowDown size={12}/></button><button type="button" className="config-icon danger" aria-label={child.type==="condition" ? "Elimina condizione" : "Elimina gruppo"} onClick={()=>onChange({...node,children:children.filter((_,j)=>i!==j)})}><Trash2 size={14}/></button></>}
          {node.type==="not" && <button type="button" className="config-text-button" onClick={()=>onChange(node.child)}>Rimuovi NON</button>}
        </div>
      </div>)}
      {node.type!=="not" && <><div className="config-group-add"><button type="button" className="config-text-button" disabled={!data.parameters.length || maxDepth} onClick={()=>onChange({...node,children:[...children,leaf()]})}><Plus size={14}/>Condizione</button><button type="button" className="config-text-button" disabled={maxDepth} onClick={()=>onChange({...node,children:[...children,{id:uid(),type:"all",children:data.parameters.length ? [leaf()] : []}]})}><GitBranch size={14}/>Gruppo</button></div>{!children.length && <p className="config-hint">{depth===0 && node.type==="all" ? (emptyRootLabel ?? "Sempre: questa regola non ha condizioni.") : "Gruppo incompleto: aggiungi una condizione o elimina il gruppo."}</p>}</>}
    </div>}
  </section>;
}
