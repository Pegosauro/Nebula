import { useId } from "react";
import type { Parameter } from "./model";
export function TextParameterInput({parameter,value,onChange,label=parameter.name}:{parameter:Parameter;value:string;onChange:(value:string)=>void;label?:string}) {
  const id=useId();
  return <span className="config-text-parameter"><input aria-label={label} type="text" list={parameter.values.length ? id : undefined} placeholder={parameter.values.length ? "Testo personalizzato…" : "Testo…"} value={value} onChange={e=>onChange(e.target.value)}/>{parameter.values.length>0 && <datalist id={id}>{parameter.values.map((option,i)=><option key={i} value={option}/>)}</datalist>}</span>;
}
