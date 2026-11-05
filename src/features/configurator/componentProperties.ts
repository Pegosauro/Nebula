import type { Component, Configurator, PropertyValue, Selection } from "./model";

export function propertyProblems(data:Configurator,component:Component):string[] {
  const problems:string[]=[],names=new Set<string>();
  for(const property of component.properties ?? []){
    const name=property.name.trim(),key=name.toLocaleLowerCase();
    const prefix=`${component.code || "Componente"} · ${name || "Proprietà"}`;
    if(!name)problems.push(`${prefix}: inserisci il nome della proprietà.`);
    else if(names.has(key))problems.push(`${prefix}: nome della proprietà già usato.`);
    names.add(key);
    if(property.value!==undefined && !property.value.trim())problems.push(`${prefix}: inserisci il valore del componente.`);
    if(!data.parameters.some(p=>p.id===property.parameter && p.type==="text"))problems.push(`${prefix}: scegli un parametro di testo.`);
  }
  return problems;
}
export function componentProperties(component:Component,selection:Selection):PropertyValue[] {
  return (component.properties ?? []).map(p=>({id:p.id,value:p.value!==undefined ? p.value : typeof selection[p.parameter]==="string" ? selection[p.parameter] as string : undefined}));
}
export function propertyEntries(component:Component,values:PropertyValue[]=[]){
  return (component.properties ?? []).map(p=>({...p,value:p.value!==undefined ? p.value : values.find(v=>v.id===p.id)?.value}));
}
