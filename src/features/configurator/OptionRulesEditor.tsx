import { RulePreview } from "./RulePreview";
import { useMemo, useState } from "react";
import { GitBranch, Plus, Trash2 } from "lucide-react";
import type { ConditionNode, Configurator, Parameter, Value } from "./model";
import { allowsCustomText, uid } from "./model";
import { ConditionTreeEditor } from "./ConditionTreeEditor";
import { initialValue } from "./ConditionControls";
import { expressionLabel } from "./expressions";
import { domain, valueLabel } from "./engine";

export function OptionRulesSummary({parameter,data}:{parameter:Parameter;data:Configurator}) {
  if(!parameter.optionRules?.length)return <p className="config-hint">Nessuna condizione specifica sui valori. Puoi impostarne una per ciascuna opzione.</p>;
  return <ol className="config-parameter-rule-summary">{parameter.optionRules.map(rule=><li key={JSON.stringify(rule.value)}><strong>{valueLabel(rule.value)}{!rule.enabled ? " · Condizione disattivata" : ""}</strong><code>Selezionabile solo se {expressionLabel(rule.expression,data)}</code></li>)}</ol>;
}

export function OptionRulesEditor({parameter,data,onChange}:{parameter:Parameter;data:Configurator;onChange:(next:Parameter)=>void}) {
  const [editing,setEditing]=useState<Value>();
  const [limit,setLimit]=useState(24);
  const [numeric,setNumeric]=useState("");
  const values=useMemo(()=>parameter.type==="text" ? [...new Set(parameter.values.filter(Boolean))] : domain(parameter),[parameter]);
  const visible=useMemo(()=>{
    const next=values?.slice(0,limit) ?? [];
    for(const rule of parameter.optionRules ?? [])if(!next.includes(rule.value))next.push(rule.value);
    return next;
  },[values,limit,parameter.optionRules]);
  const others=data.parameters.filter(p=>p.id!==parameter.id);
  const conditionData={...data,parameters:others};
  const rule=parameter.optionRules?.find(r=>r.value===editing);
  const put=(value:Value,expression:ConditionNode,enabled=true)=>{
    const rules=parameter.optionRules ?? [];
    const next={value,expression,enabled};
    onChange({...parameter,optionRules:rules.some(r=>r.value===value) ? rules.map(r=>r.value===value ? next : r) : [...rules,next]});
  };
  const start=(value:Value)=>{
    setEditing(value);
    if(!parameter.optionRules?.some(r=>r.value===value)){
      const other=others[0];
      put(value,{id:uid(),type:"all",children:other ? [{id:uid(),type:"condition",condition:{parameter:other.id,operator:"eq",value:initialValue(other)}}] : []});
    }
  };
  const remove=(value:Value)=>{
    const next=(parameter.optionRules ?? []).filter(r=>r.value!==value);
    onChange({...parameter,optionRules:next.length ? next : undefined});
    if(editing===value)setEditing(undefined);
  };
  return <section className="config-option-rules" aria-label="Selezionabilità dei valori">
    <h3>Selezionabilità dei valori</h3>
    <p className="config-hint">Scegli un valore e imposta «Selezionabile solo se». Il valore resta selezionabile se mancano le scelte richieste; si disabilita solo quando la condizione risulta falsa. Gli altri valori restano indipendenti.</p>
    {!others.length && <p className="config-hint">Aggiungi un altro parametro per definire le condizioni di selezionabilità.</p>}
    <div className="config-option-rule-list">{visible.map(value=>{
      const current=parameter.optionRules?.find(r=>r.value===value);
      return <div className="config-option-rule-row" key={JSON.stringify(value)}>
        <button type="button" className={`config-option-rule-choice ${current?.enabled ? "is-conditioned" : ""}`} aria-label={`Selezionabilità ${parameter.name}: ${valueLabel(value)}`} aria-expanded={editing===value} disabled={!others.length && !current} onClick={()=>start(value)}>
          <strong>{valueLabel(value)}</strong><span>{current ? `${current.enabled ? "Solo se" : "Condizione disattivata"}: ${expressionLabel(current.expression,data)}` : "Sempre selezionabile"}</span><GitBranch size={15}/>
        </button>
        {current && <button type="button" className="config-icon danger" aria-label={`Rimuovi condizione per ${parameter.name}: ${valueLabel(value)}`} title="Rendi il valore sempre selezionabile" onClick={()=>remove(value)}><Trash2 size={15}/></button>}
      </div>;
    })}</div>
    {values && limit<values.length && <button type="button" className="config-text-button" onClick={()=>setLimit(n=>n+24)}>Mostra altri valori</button>}
    {(parameter.type==="number" || allowsCustomText(parameter)) && <div className="config-fields"><label>{parameter.type==="text" ? "Testo da vincolare" : "Valore numerico da vincolare"}<input aria-label={parameter.type==="text" ? "Testo da vincolare" : "Valore numerico da vincolare"} type={parameter.type==="text" ? "text" : "number"} min={parameter.min} max={parameter.max} step={parameter.step ?? "any"} value={numeric} onChange={e=>setNumeric(e.target.value)}/></label><button type="button" className="config-text-button" disabled={!others.length || numeric==="" || parameter.type==="number" && !Number.isFinite(Number(numeric))} onClick={()=>start(parameter.type==="text" ? numeric : Number(numeric))}><Plus size={14}/>Imposta condizione</button></div>}
    {editing!==undefined && rule && <section className="config-option-rule-editor" aria-label={`Condizione per ${parameter.name}: ${valueLabel(editing)}`}>
      <div className="config-section-heading"><h3>{parameter.name} · {valueLabel(editing)}</h3><label className="config-checkbox"><input aria-label="Condizione di selezionabilità attiva" type="checkbox" checked={rule.enabled} onChange={e=>put(editing,rule.expression,e.target.checked)}/>Condizione attiva</label></div>
      <div className="config-rule-caption"><strong>SELEZIONABILE SOLO SE</strong></div>
      <ConditionTreeEditor key={JSON.stringify(editing)} data={conditionData} node={rule.expression} onChange={expression=>put(editing,expression,rule.enabled)}/>
      <RulePreview data={data} rule={{id:`option:${parameter.id}`,name:"Selezionabilità",enabled:rule.enabled,match:"all",conditions:[],expression:rule.expression,actions:[]}}/><div className="config-expression-preview"><strong>CONDIZIONE COMPLETA</strong><code>{expressionLabel(rule.expression,data)}</code></div>
      <button type="button" className="config-text-button" onClick={()=>setEditing(undefined)}>Comprimi condizione</button>
    </section>}
  </section>;
}
