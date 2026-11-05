import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Component, ComponentDimension, Configurator } from "./model";
import { uid } from "./model";
import { componentDimensions, dimensionPresets, dimensionSymbol, measureConversion, measureProblems } from "./componentMeasure";

function DimensionRow({data,dimension,index,onChange,onRemove}:{data:Configurator;dimension:ComponentDimension;index:number;onChange:(patch:Partial<ComponentDimension>)=>void;onRemove:()=>void}) {
  const [offset,setOffset]=useState(()=>String(dimension.offset));
  const [custom,setCustom]=useState(()=>!dimensionPresets.includes(dimension.name));
  const numeric=data.parameters.filter(p=>p.type==="number");
  const parameter=numeric.find(p=>p.id===dimension.parameter),unit=parameter?.unit ?? "";
  const units=[...new Set([unit,...(["mm","cm","m"].filter(target=>measureConversion(unit,target)!==undefined)),dimension.unit])];
  return <div className="config-dimension-row" role="group" aria-label={`Dimensione ${index+1}`}>
    <div className="config-dimension-name"><select aria-label={`Nome dimensione ${index+1}`} value={custom ? "custom" : dimension.name} onChange={e=>{setCustom(e.target.value==="custom");onChange({name:e.target.value==="custom" ? "" : e.target.value});}}>
      {dimensionPresets.map(name=><option key={name} value={name}>{name} ({dimensionSymbol({...dimension,name},[])})</option>)}<option value="custom">Personalizzata</option>
    </select>{custom && <input aria-label={`Nome personalizzato dimensione ${index+1}`} placeholder="Nome" required value={dimension.name} onChange={e=>onChange({name:e.target.value})}/>}</div>
    <select aria-label={`Parametro dimensione ${index+1}`} value={dimension.parameter} onChange={e=>{const p=numeric.find(p=>p.id===e.target.value);onChange({parameter:e.target.value,unit:p?.unit ?? ""});}}><option value="">Parametro…</option>{!numeric.some(p=>p.id===dimension.parameter) && dimension.parameter && <option value={dimension.parameter}>Parametro mancante</option>}{numeric.map(p=><option key={p.id} value={p.id}>{p.name}{p.unit ? ` (${p.unit})` : ""}</option>)}</select>
    <input aria-label={`Correzione dimensione ${index+1}`} type="number" step="any" required value={offset} placeholder="0" onChange={e=>{setOffset(e.target.value);onChange({offset:e.target.value==="" ? NaN : Number(e.target.value)});}}/>
    <select aria-label={`Unità dimensione ${index+1}`} value={dimension.unit} onChange={e=>onChange({unit:e.target.value})}>{units.map(u=><option key={u} value={u}>{u || "—"}</option>)}</select>
    <button type="button" className="config-icon" aria-label={`Elimina dimensione ${index+1}`} title="Elimina dimensione" onClick={onRemove}><Trash2 size={15}/></button>
  </div>;
}
export function ComponentMeasureEditor({data,component,onChange}:{data:Configurator;component:Component;onChange:(next:Component)=>void}) {
  const dimensions=componentDimensions(component),numeric=data.parameters.filter(p=>p.type==="number");
  const save=(next:ComponentDimension[])=>onChange({...component,measure:undefined,dimensions:next});
  const add=()=>{
    const name=dimensionPresets.find(name=>!dimensions.some(d=>d.name===name)) ?? `Dimensione ${dimensions.length+1}`;
    const parameter=numeric.find(p=>p.name.toLocaleLowerCase()===name.toLocaleLowerCase()) ?? numeric.find(p=>!dimensions.some(d=>d.parameter===p.id)) ?? numeric[0];
    save([...dimensions,{id:uid(),name,parameter:parameter?.id ?? "",offset:0,unit:parameter?.unit ?? ""}]);
  };
  return <section className="config-component-measure" aria-label="Dimensioni del componente"><h3>Dimensioni</h3>
    {!!dimensions.length && <><div className="config-dimension-head" aria-hidden="true"><span>Dimensione</span><span>Parametro</span><span>Correzione ±</span><span>Unità</span><span/></div>{dimensions.map((dimension,index)=><DimensionRow key={dimension.id} data={data} dimension={dimension} index={index} onChange={patch=>save(dimensions.map(d=>d.id===dimension.id ? {...d,...patch} : d))} onRemove={()=>save(dimensions.filter(d=>d.id!==dimension.id))}/>)}</>}
    <button type="button" className="config-text-button" disabled={!numeric.length || dimensions.length>=32} title={!numeric.length ? "Aggiungi prima un parametro numerico" : undefined} onClick={add}><Plus size={14}/>Dimensione</button>
    {measureProblems(data,component).map(message=><p role="alert" key={message} className="config-field-error">{message}</p>)}
  </section>;
}
