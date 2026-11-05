import { Plus, Trash2 } from "lucide-react";
import type { Component, ComponentProperty, Configurator } from "./model";
import { uid } from "./model";
import { TextParameterInput } from "./TextParameterInput";
import { propertyProblems } from "./componentProperties";
export function ComponentPropertiesEditor({data,component,onChange}:{data:Configurator;component:Component;onChange:(next:Component)=>void}) {
  const properties=component.properties ?? [],parameters=data.parameters.filter(p=>p.type==="text");
  const save=(next:ComponentProperty[])=>onChange({...component,properties:next});
  const add=()=>{
    const parameter=parameters.find(p=>!properties.some(v=>v.parameter===p.id)) ?? parameters[0];
    let name=parameter?.name ?? "Proprietà",suffix=2;
    while(properties.some(p=>p.name.trim().toLocaleLowerCase()===name.trim().toLocaleLowerCase()))name=`${parameter?.name ?? "Proprietà"} ${suffix++}`;
    save([...properties,{id:uid(),name,parameter:parameter?.id ?? ""}]);
  };
  return <section className="config-component-properties" aria-label="Proprietà del componente"><h3>Proprietà</h3>
    {!!properties.length && <div className="config-property-head" aria-hidden="true"><span>Nome</span><span>Parametro di testo</span><span>Valore</span><span/></div>}
    {properties.map((p,i)=>{
      const parameter=parameters.find(v=>v.id===p.parameter);
      const patch=(next:Partial<ComponentProperty>)=>save(properties.map(v=>v.id===p.id ? {...v,...next} : v));
      return <div className="config-property-row" role="group" aria-label={`Proprietà ${i+1}`} key={p.id}>
        <input aria-label={`Nome proprietà ${i+1}`} required placeholder="Nome" value={p.name} onChange={e=>patch({name:e.target.value})}/>
        <select aria-label={`Parametro proprietà ${i+1}`} value={p.parameter} onChange={e=>patch({parameter:e.target.value})}><option value="">Parametro…</option>{!parameter && p.parameter && <option value={p.parameter}>Parametro non disponibile</option>}{parameters.map(v=><option value={v.id} key={v.id}>{v.name}</option>)}</select>
        <div className="config-property-source"><select aria-label={`Origine proprietà ${i+1}`} value={p.value===undefined ? "bom" : "component"} onChange={e=>patch({value:e.target.value==="bom" ? undefined : parameter?.values[0] ?? ""})}><option value="bom">Dalla BOM</option><option value="component">Valore del componente</option></select>
          {p.value!==undefined && (parameter ? <TextParameterInput parameter={parameter} label={`Valore proprietà ${i+1}`} value={p.value} onChange={value=>patch({value})}/> : <input aria-label={`Valore proprietà ${i+1}`} type="text" value={p.value} onChange={e=>patch({value:e.target.value})}/>)}</div>
        <button className="config-icon" type="button" aria-label={`Elimina proprietà ${i+1}`} title="Elimina proprietà" onClick={()=>save(properties.filter(v=>v.id!==p.id))}><Trash2 size={15}/></button>
      </div>;
    })}
    <button className="config-text-button" type="button" disabled={!parameters.length || properties.length>=32} title={!parameters.length ? "Aggiungi prima un parametro di tipo Testo" : undefined} onClick={add}><Plus size={14}/>Proprietà</button>
    {propertyProblems(data,component).map(message=><p className="config-field-error" role="alert" key={message}>{message}</p>)}
  </section>;
}
