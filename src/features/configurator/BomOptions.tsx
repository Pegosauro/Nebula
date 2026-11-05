import { allowsCustomText } from "./model";
import { TextParameterInput } from "./TextParameterInput";
import { useMemo, useState } from "react";
import { Ban, Check, X } from "lucide-react";
import { domain, evaluate, optionAvailability, parameterAffectsRules, valueLabel, type Enumeration } from "./engine";
import type { Configurator, Parameter, Selection, Value } from "./model";
const pageSize=24;
type Props={data:Configurator;selection:Selection;enumeration?:Enumeration;choose:(id:string,value?:Value)=>void;toggle:(id:string,value:Value)=>void};
export function BomOptions(props:Props) {
  return <><p className="config-hint config-bom-options-hint">Clicca un’opzione per selezionarla, clicca di nuovo per deselezionarla. Le opzioni grigie non sono compatibili con le scelte correnti.</p><div className="config-bom-options" aria-label="Opzioni della distinta">{props.data.parameters.map(parameter=><ParameterOptions key={parameter.id} {...props} parameter={parameter}/>)}</div></>;
}
function ParameterOptions({data,selection,enumeration,choose,toggle,parameter:p}:Props & {parameter:Parameter}) {
  const [limit,setLimit]=useState(pageSize);
  const values=useMemo(()=>p.type==="text" ? [...new Set(p.values.filter(Boolean))] : domain(p),[p]);
  const selected=selection[p.id];
  const [pinned,setPinned]=useState<Value|undefined>(selected);
  const visible=useMemo(()=>{
    const list=values?.slice(0,limit) ?? [];
    // A choice made in Esplora or typed in the numeric field stays visible when its page is collapsed.
    for(const value of [selected,pinned])if(value!==undefined && values?.includes(value) && !list.includes(value))list.push(value);
    return list;
  },[values,limit,selected,pinned]);
  const options=useMemo(()=>visible.map(value=>{
    const candidate={...selection,[p.id]:value};
    const availability=optionAvailability(data,p,value,selection);
    const errors=evaluate(data,candidate).errors;
    // Enumeration belongs to the current choices. It proves an option impossible
    // only while this parameter is open (or for the already selected value).
    const impossible=(p.type!=="text" || parameterAffectsRules(data,p.id)) && enumeration?.exhaustive && (selected===undefined || selected===value) && !enumeration.solutions.some(s=>s.selection[p.id]===value);
    return {value,denied:!availability.allowed || errors.length>0 || !!impossible,reason:!availability.allowed ? availability.reason : errors.join("\n") || (impossible ? "Nessuna configurazione valida con questa opzione e le altre scelte correnti." : "")};
  }),[data,selection,enumeration,visible,p.id,selected]);
  return <fieldset className="config-bom-parameter"><legend>{p.name}{p.unit ? ` (${p.unit})` : ""}</legend>
    {!!options.length && <div className="config-option-buttons">{options.map(({value,denied,reason})=>{const active=selected===value, label=`${p.name}: ${valueLabel(value)}`;return <button key={JSON.stringify(value)} type="button" className={`config-option-button ${active ? "is-selected" : ""} ${denied ? "is-incompatible" : ""}`} aria-label={label} aria-pressed={active} aria-description={denied ? reason : active ? "Clicca per deselezionare questa opzione." : undefined} disabled={denied && !active} title={denied ? reason : `${active ? "Deseleziona" : "Seleziona"} ${label}`} onClick={()=>{setPinned(value);toggle(p.id,value);}}><span className="config-option-mark" aria-hidden="true">{active ? <Check size={14}/> : denied ? <Ban size={13}/> : null}</span><span>{valueLabel(value)}</span></button>;})}</div>}
    {values && values.length>pageSize && <div className="config-option-pagination">{limit<values.length && <button type="button" className="config-text-button" onClick={()=>setLimit(n=>n+pageSize)}>Mostra altre opzioni di {p.name}</button>}{limit>pageSize && <button type="button" className="config-text-button" onClick={()=>setLimit(pageSize)}>Comprimi opzioni di {p.name}</button>}</div>}
    {p.type==="number" && <div className="config-option-number"><label className="config-selection">Valore di {p.name}<input aria-label={p.name} type="number" min={p.min} max={p.max} step={p.step ?? "any"} placeholder={[p.min,p.max].filter(v=>v!==undefined).join(" – ") || "Da definire"} value={selected===undefined ? "" : String(selected)} onChange={e=>choose(p.id,e.target.value==="" ? undefined : Number(e.target.value))}/></label>{selected!==undefined && <button type="button" className="config-icon" aria-label={`Cancella ${p.name}`} title="Deseleziona il valore" onClick={()=>choose(p.id,undefined)}><X size={15}/></button>}</div>}
    {allowsCustomText(p) && <div className="config-option-number"><TextParameterInput parameter={p} value={selected===undefined ? "" : String(selected)} onChange={value=>choose(p.id,value==="" ? undefined : value)}/>{selected!==undefined && <button type="button" className="config-icon" aria-label={`Cancella ${p.name}`} title="Cancella testo" onClick={()=>choose(p.id,undefined)}><X size={15}/></button>}</div>}
    {!options.length && p.type!=="number" && p.type!=="text" && <p className="config-hint">Nessuna opzione disponibile.</p>}
  </fieldset>;
}
