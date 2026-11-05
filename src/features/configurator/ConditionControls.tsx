import { TextParameterInput } from "./TextParameterInput";
import { allowsCustomText } from "./model";
import type { Parameter, Value } from "./model";
export function ValueInput({ parameter, value, onChange }: { parameter?: Parameter; value: Value; onChange: (value: Value) => void }) {
  if (parameter?.type==="boolean") return <select aria-label="Valore" value={String(value)} onChange={e=>onChange(e.target.value==="true")}><option value="">Scegli…</option><option value="true">Sì</option><option value="false">No</option></select>;
  if (parameter?.type==="choice" || parameter?.type==="text" && !allowsCustomText(parameter)) return <select aria-label="Valore" value={String(value)} onChange={e=>onChange(e.target.value)}><option value="">Scegli…</option>{parameter.values.filter(Boolean).map((v,i)=><option key={i} value={v}>{v}</option>)}</select>;
  if(parameter?.type==="text")return <TextParameterInput parameter={parameter} value={String(value)} label="Valore" onChange={onChange}/>;
  return <input aria-label="Valore" type={parameter?.type==="number" ? "number" : "text"} value={String(value)} onChange={e=>onChange(parameter?.type==="number" ? Number(e.target.value) : e.target.value)}/>;
}
export function initialValue(p?: Parameter): Value { return p?.type==="text" ? p.values[0] ?? "" : p?.type==="boolean" ? true : p?.type==="number" ? p.min ?? 0 : p?.values[0] ?? ""; }
