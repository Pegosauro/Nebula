import type { Component, ComponentDimension, ComponentMeasure, Configurator, DimensionValue, Selection } from "./model";

const lengthUnits:Record<string,number>={mm:1,cm:10,m:1000};
const normalized=(unit:string)=>unit.trim().toLowerCase();
export function measureConversion(from:string,to:string):number|undefined {
  const source=normalized(from),target=normalized(to);
  if(source===target)return 1;
  if(Object.hasOwn(lengthUnits,source) && Object.hasOwn(lengthUnits,target))return lengthUnits[source]!/lengthUnits[target]!;
}
/** Legacy measurements remain unchanged on disk until the dimensions are edited. */
export function componentDimensions(component:Component):ComponentDimension[] {
  return component.dimensions ?? (component.measure ? [{...component.measure,id:"legacy-measure",name:"Lunghezza"}] : []);
}
export const hasDimensions=(component:Component)=>componentDimensions(component).length>0;
export const dimensionPresets=["Lunghezza","Larghezza","Altezza","Profondità","Spessore"];
const symbols:Record<string,string>={lunghezza:"L",larghezza:"L",altezza:"H",profondità:"P",spessore:"S"};
export function dimensionSymbol(dimension:ComponentDimension,dimensions:ComponentDimension[]):string {
  const symbol=(name:string)=>Object.hasOwn(symbols,name.toLocaleLowerCase()) ? symbols[name.toLocaleLowerCase()]! : name;
  const name=dimension.name.trim(),short=symbol(name);
  return dimensions.filter(d=>symbol(d.name.trim())===short).length>1 ? name : short;
}
export function measureProblems(data:Configurator,component:Component):string[] {
  const dimensions=componentDimensions(component),names=new Set<string>(),problems:string[]=[];
  for(const measure of dimensions){
    const parameter=data.parameters.find(p=>p.id===measure.parameter);
    const prefix=`${component.code || component.name || "Componente"}${dimensions.length>1 ? ` · ${measure.name || "Dimensione"}` : ""}`;
    const name=measure.name.trim().toLocaleLowerCase();
    if(!name)problems.push(`${prefix}: inserisci il nome della dimensione.`);
    else if(names.has(name))problems.push(`${prefix}: nome della dimensione già usato.`);
    names.add(name);
    if(!parameter || parameter.type!=="number")problems.push(`${prefix}: scegli un parametro numerico per la misura.`);
    if(!Number.isFinite(measure.offset))problems.push(`${prefix}: correzione della misura non valida.`);
    if(parameter && measureConversion(parameter.unit,measure.unit)===undefined)problems.push(`${prefix}: unità della misura incompatibile con ${parameter.name} (${parameter.unit || "senza unità"}).`);
  }
  return problems;
}
function calculateMeasure(data:Configurator,component:Component,measure:ComponentDimension,selection:Selection):{value?:number;error?:string} {
  const parameter=data.parameters.find(p=>p.id===measure.parameter);
  if(!parameter || parameter.type!=="number" || !Number.isFinite(measure.offset) || measureConversion(parameter.unit,measure.unit)===undefined)return {};
  const input=selection[parameter.id];
  if(input===undefined)return {};
  const prefix=`${component.code}${componentDimensions(component).length>1 ? ` · ${measure.name}` : ""}`;
  if(typeof input!=="number" || !Number.isFinite(input))return {error:`${prefix}: parametro della misura non valido.`};
  const value=Number((input*measureConversion(parameter.unit,measure.unit)!+measure.offset).toPrecision(12));
  if(!Number.isFinite(value) || value<0)return {error:`${prefix}: la misura calcolata non può essere negativa o non finita.`};
  return {value};
}
export function componentMeasurements(data:Configurator,component:Component,selection:Selection):{values:DimensionValue[];errors:string[]} {
  const errors=measureProblems(data,component);
  const values=componentDimensions(component).map(d=>{
    const result=calculateMeasure(data,component,d,selection);
    if(result.error)errors.push(result.error);
    return {id:d.id,value:result.value};
  });
  return {values,errors};
}
export function componentMeasure(data:Configurator,component:Component,selection:Selection):{value?:number;error?:string} {
  const result=componentMeasurements(data,component,selection);
  return {value:result.values[0]?.value,...(result.errors.length ? {error:result.errors.join(" ")} : {})};
}
export function dimensionFormula(data:Configurator,measure:ComponentMeasure):string {
  const parameter=data.parameters.find(p=>p.id===measure.parameter);
  const converted=parameter && normalized(parameter.unit)!==normalized(measure.unit);
  const unit=measure.unit ? ` ${measure.unit}` : "";
  return `${parameter?.name ?? "Parametro mancante"}${converted ? ` → ${measure.unit || "senza unità"}` : ""}${measure.offset<0 ? ` − ${Math.abs(measure.offset).toLocaleString("it-IT")}${unit}` : measure.offset>0 ? ` + ${measure.offset.toLocaleString("it-IT")}${unit}` : converted ? "" : unit}`;
}
export function measureFormula(data:Configurator,component:Component):string {
  const dimensions=componentDimensions(component);
  return dimensions.map(d=>`${dimensions.length>1 ? `${dimensionSymbol(d,dimensions)}: ` : ""}${dimensionFormula(data,d)}`).join(" · ");
}
export const measureLabel=(value:number|undefined,unit:string)=>value===undefined ? "Da definire" : `${value.toLocaleString("it-IT",{maximumFractionDigits:6})}${unit ? ` ${unit}` : ""}`;
export function measurementValues(component:Component,row:{measure?:number;dimensions?:DimensionValue[]}):DimensionValue[] {
  return componentDimensions(component).map(d=>({id:d.id,value:component.dimensions!==undefined ? row.dimensions?.find(v=>v.id===d.id)?.value : row.measure}));
}
export function dimensionsLabel(component:Component,row:{measure?:number;dimensions?:DimensionValue[]}):string {
  const dimensions=componentDimensions(component),values=measurementValues(component,row);
  if(!dimensions.length)return "—";
  if(dimensions.length===1)return measureLabel(values[0]?.value,dimensions[0]!.unit);
  const sameUnit=dimensions.every(d=>d.unit===dimensions[0]!.unit);
  return dimensions.map((d,i)=>`${dimensionSymbol(d,dimensions)} ${measureLabel(values[i]?.value,sameUnit ? "" : d.unit)}`).join(" × ")+(sameUnit && dimensions[0]!.unit ? ` ${dimensions[0]!.unit}` : "");
}
