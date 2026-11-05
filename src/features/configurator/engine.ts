import { acceptsParameterValue, allowsCustomText } from "./model";
import type { Action, Condition, ConditionNode, Configurator, DimensionValue, PropertyValue, Parameter, Rule, Selection, Value } from "./model";
import { conditionsOf, conjunctions, expressionKey, expressionLabel, expressionProblems, ruleConditions, ruleExpression } from "./expressions";
import { expandRule, expandedRules, type EffectiveRule } from "./componentRules";
import { componentDimensions, componentMeasurements, hasDimensions, measureProblems } from "./componentMeasure";
import { componentProperties, propertyProblems } from "./componentProperties";
export interface Issue { severity: "error" | "warning"; message: string }
export interface BomRow { component: string; quantity?: number; measure?: number; dimensions?: DimensionValue[]; properties?: PropertyValue[]; reasons: string[]; certain: boolean }
export interface Evaluation { bom: BomRow[]; possible: BomRow[]; errors: string[]; pending: string[]; matched: string[] }
export interface Enumeration { solutions: Array<{ selection: Selection; result: Evaluation }>; exhaustive: boolean; examined: number; reason?: string }
const MAX_ENUMERATION = 5000;
export const valueLabel = (v: Value | undefined) => v===undefined ? "Da definire" : typeof v === "boolean" ? v ? "Sì" : "No" : String(v);
export function domain(p: Parameter): Value[] | undefined {
  if (p.type === "boolean") return [true,false];
  if (p.type === "choice" || p.type==="text" && !allowsCustomText(p)) return [...new Set(p.values.filter(Boolean))];
  if (p.type !== "number") return;
  if (p.min === undefined || p.max === undefined || !p.step || p.step <= 0 || p.max < p.min) return;
  const count = Math.floor((p.max - p.min) / p.step + 1e-9) + 1;
  if (count > MAX_ENUMERATION) return;
  return Array.from({length: count}, (_,i) => Number((p.min! + i * p.step!).toPrecision(12)));
}
function validValue(p: Parameter, v: Value): boolean {
  if (p.type === "text") return acceptsParameterValue(p,v);
  if (p.type === "boolean") return typeof v === "boolean";
  if (p.type === "choice") return typeof v === "string" && p.values.includes(v);
  return typeof v === "number" && Number.isFinite(v) && (p.min === undefined || v >= p.min) && (p.max === undefined || v <= p.max) && (!p.step || p.min === undefined || Math.abs((v - p.min)/p.step - Math.round((v-p.min)/p.step)) < 1e-7);
}
export function parameterAffectsRules(data:Configurator,id:string):boolean {
  return data.parameters.some(p=>(p.id===id && p.optionRules?.some(r=>r.enabled)) || p.optionRules?.some(r=>r.enabled && conditionsOf(r.expression).some(c=>c.parameter===id))) || expandedRules(data).some(r=>r.enabled && (ruleConditions(r).some(c=>c.parameter===id) || r.actions.some(a=>a.parameter===id || a.quantity.parameter===id)));
}
export const parameterNeedsInput=(data:Configurator,p:Parameter)=>p.type!=="text" || parameterAffectsRules(data,p.id);
/** An unresolved condition keeps choices open; only a false condition disables a value. */
export function optionAvailability(data:Configurator,parameter:Parameter,value:Value,selection:Selection,assumptions:Condition[]=[]) {
  const rule=parameter.optionRules?.find(r=>r.enabled && r.value===value);
  if(!rule)return {allowed:true,pending:false,reason:""};
  const match=expressionMatches(rule.expression,selection,true,assumptions);
  return {allowed:match!==false,pending:match===undefined,reason:match===true ? "" : `${parameter.name}: ${valueLabel(value)} selezionabile solo se ${expressionLabel(rule.expression,data)}.${match===undefined ? " Condizione ancora da completare." : ""}`};
}
export function optionRuleProblems(data:Configurator,parameter:Parameter):string[] {
  return (parameter.optionRules ?? []).flatMap(rule=>{
    const prefix=`${parameter.name} · ${valueLabel(rule.value)}`;
    const problems:string[]=[];
    if(!validValue(parameter,rule.value))problems.push(`${prefix}: valore non più presente nel parametro.`);
    if(!rule.enabled)return problems;
    problems.push(...expressionProblems(rule.expression).map(message=>`${prefix}: ${message}`));
    if(!conditionsOf(rule.expression).length)problems.push(`${prefix}: aggiungi una condizione oppure rimuovi il vincolo sul valore.`);
    for(const condition of conditionsOf(rule.expression)){
      const other=data.parameters.find(p=>p.id===condition.parameter);
      if(condition.parameter===parameter.id)problems.push(`${prefix}: la selezionabilità deve dipendere da un altro parametro.`);
      else if(!other)problems.push(`${prefix}: parametro della condizione mancante.`);
      else if(["eq","ne"].includes(condition.operator) ? !validValue(other,condition.value) : other.type!=="number" || typeof condition.value!=="number")problems.push(`${prefix}: condizione non valida per ${other.name}.`);
    }
    return [...new Set(problems)];
  });
}
const opposite:Record<Condition["operator"],Condition["operator"]>={eq:"ne",ne:"eq",gt:"lte",gte:"lt",lt:"gte",lte:"gt"};
function numericConstraintsPossible(conditions:Condition[],lower=-Infinity,upper=Infinity):boolean {
  const equal=conditions.find(c=>c.operator==="eq");
  if(equal)return typeof equal.value==="number" && equal.value>=lower && equal.value<=upper && conditions.every(c=>conditionMatches(c,{[c.parameter]:equal.value})===true);
  let lowerOpen=false, upperOpen=false;
  for(const c of conditions){
    if(typeof c.value!=="number")continue;
    if(c.operator==="gt" || c.operator==="gte"){if(c.value>lower){lower=c.value;lowerOpen=c.operator==="gt";}else if(c.value===lower)lowerOpen ||= c.operator==="gt";}
    if(c.operator==="lt" || c.operator==="lte"){if(c.value<upper){upper=c.value;upperOpen=c.operator==="lt";}else if(c.value===upper)upperOpen ||= c.operator==="lt";}
  }
  return lower<upper || lower===upper && !lowerOpen && !upperOpen && !conditions.some(c=>c.operator==="ne" && c.value===lower);
}
function conditionMatches(c: Condition, selection: Selection, assumptions:Condition[]=[]): boolean | undefined {
  const v = selection[c.parameter];
  if (v === undefined) {
    const known=assumptions.filter(a=>a.parameter===c.parameter);
    const equal=known.find(a=>a.operator==="eq");
    if(equal)return conditionMatches(c,{[c.parameter]:equal.value});
    if(known.some(a=>a.operator===c.operator && a.value===c.value))return true;
    if(known.some(a=>a.operator===opposite[c.operator] && a.value===c.value))return false;
    if(known.length && typeof c.value==="number" && known.every(a=>typeof a.value==="number")){
      if(!numericConstraintsPossible([...known,c]))return false;
      if(!numericConstraintsPossible([...known,{...c,operator:opposite[c.operator]}]))return true;
    }
    return undefined;
  }
  if (c.operator === "eq") return v === c.value;
  if (c.operator === "ne") return v !== c.value;
  if (typeof v !== "number" || typeof c.value !== "number") return false;
  if (c.operator === "gt") return v > c.value;
  if (c.operator === "gte") return v >= c.value;
  if (c.operator === "lt") return v < c.value;
  return v <= c.value;
}
export function expressionMatches(n: ConditionNode, selection: Selection, root=true, assumptions:Condition[]=[]): boolean | undefined {
  if (n.type === "condition") return conditionMatches(n.condition,selection,assumptions);
  if (n.type === "not") {
    const result = expressionMatches(n.child,selection,false,assumptions);
    return result === undefined ? undefined : !result;
  }
  if (!n.children.length) return root && n.type === "all" ? true : undefined;
  let pending=false;
  for (const child of n.children) {
    const result=expressionMatches(child,selection,false,assumptions);
    if (n.type === "all" && result === false) return false;
    if (n.type === "any" && result === true) return true;
    pending ||= result === undefined;
  }
  return pending ? undefined : n.type === "all";
}
export function matches(rule: Rule, selection: Selection, assumptions:Condition[]=[]): boolean | undefined {
  if(rule.cases){const checks=expandRule(rule).filter(r=>r.enabled).map(r=>matches(r,selection,assumptions));return checks.includes(true) ? true : checks.includes(undefined) ? undefined : false;}
  if (rule.expression) return expressionMatches(rule.expression,selection,true,assumptions);
  if (!rule.conditions.length) return true;
  const checks=rule.conditions.map(c=>conditionMatches(c,selection,assumptions));
  return rule.match === "all" ? checks.includes(false) ? false : checks.includes(undefined) ? undefined : true : checks.includes(true) ? true : checks.includes(undefined) ? undefined : false;
}
function quantity(a: Action, selection: Selection): number | undefined {
  let q = a.quantity.amount;
  if (a.quantity.parameter) {
    const v = selection[a.quantity.parameter];
    if (typeof v !== "number") return;
    q *= v / a.quantity.divisor;
  }
  if (a.quantity.rounding === "ceil") q = Math.ceil(q);
  if (a.quantity.rounding === "floor") q = Math.floor(q);
  return Number.isFinite(q) && q >= 0 ? q : undefined;
}
function impliedValues(d: Configurator, input: Selection, rules:EffectiveRule[]=expandedRules(d), assumptions:Condition[]=[]): { selection: Selection; errors: string[] } {
  const selection={...input};
  const errors: string[]=[];
  // Monotonic propagation: only fill unset values, never override user choices.
  for(let pass=0;pass<=d.parameters.length;pass++) {
    const active=rules.filter(r=>r.enabled && matches(r,selection,assumptions)===true).flatMap(r=>r.actions);
    let changed=false;
    for(const p of d.parameters) {
      if(selection[p.id]!==undefined) continue;
      const required=active.filter(a=>a.type==="requireValue" && a.parameter===p.id).map(a=>a.value);
      const forbidden=active.filter(a=>a.type==="excludeValue" && a.parameter===p.id).map(a=>a.value);
      if(new Set(required).size>1 || required.some(v=>forbidden.includes(v))) { errors.push(`${p.name}: valori obbligatori incompatibili o esclusi.`);continue; }
      const restrictions=assumptions.filter(c=>c.parameter===p.id);
      const equality=restrictions.find(c=>c.operator==="eq");
      const values=required.length ? [required[0]!] : domain(p) ?? (p.type==="text" && equality ? [equality.value] : undefined);
      const allowed=values?.filter(v=>!forbidden.includes(v) && restrictions.every(c=>conditionMatches(c,{[p.id]:v})===true));
      if(allowed?.length===0) errors.push(`${p.name}: nessun valore ammesso dai vincoli attivi.`);
      if(allowed?.length===1) {selection[p.id]=allowed[0]!;changed=true;}
    }
    if(!changed) break;
  }
  return {selection,errors:[...new Set(errors)]};
}
export function evaluate(d: Configurator, input: Selection, rules:EffectiveRule[]=expandedRules(d), assumptions:Condition[]=[]): Evaluation {
  const implied=impliedValues(d,input,rules,assumptions);
  const selection=implied.selection;
  const errors: string[] = [], pending: string[] = [], matched: string[] = [];
  errors.push(...implied.errors);
  if(assumptions.some(c=>conditionMatches(c,selection)===false))errors.push("Le scelte del grafo sono incompatibili con i vincoli della configurazione.");
  const rows = new Map<string,BomRow>(), possible = new Map<string,BomRow>();
  const excluded = new Map<string,string[]>(), maybeExcluded = new Set<string>();
  const constraints: Array<{rule: Rule; action: Action}> = [];
  for (const p of d.parameters) if (selection[p.id] !== undefined && !validValue(p,selection[p.id]!)) errors.push(`${p.name}: valore fuori dal dominio consentito.`);
  for (const p of d.parameters) if(selection[p.id]!==undefined){
    const availability=optionAvailability(d,p,selection[p.id]!,selection,assumptions);
    if(availability.pending)pending.push(availability.reason);
    else if(!availability.allowed)errors.push(availability.reason);
  }
  for (const rule of rules.filter(r => r.enabled)) {
    const match = matches(rule, selection,assumptions);
    if (match === false) continue;
    if (match) matched.push(rule.ownerId);
    for (const a of rule.actions) {
      if (a.type === "add") {
        const map = match ? rows : possible;
        const old = map.get(a.component), q = quantity(a,selection);
        map.set(a.component,{component:a.component, quantity: old ? old.quantity === undefined || q === undefined ? undefined : old.quantity + q : q, reasons:[...new Set([...(old?.reasons ?? []),rule.ownerId])],certain:!!match});
      } else if (a.type === "exclude") {
        if (match) excluded.set(a.component,[...(excluded.get(a.component) ?? []),rule.ownerId]);
        else maybeExcluded.add(a.component);
      } else if (match) constraints.push({rule,action:a});
    }
  }
  for (const [id, names] of excluded) if (rows.has(id)) errors.push(`${d.components.find(c=>c.id===id)?.code ?? id}: richiesto ed escluso (${[...rows.get(id)!.reasons,...names].map(id=>d.rules.find(r=>r.id===id)?.name ?? id).join("; ")}).`);
  for (const {rule,action:a} of constraints) {
    if (a.type === "requireValue" || a.type === "excludeValue") {
      const p = d.parameters.find(p=>p.id===a.parameter), v = selection[a.parameter];
      const message = `${rule.name}: ${p?.name ?? a.parameter} ${a.type === "requireValue" ? "deve essere" : "non può essere"} ${valueLabel(a.value)}.`;
      if (v === undefined) pending.push(message);
      else if (a.type === "requireValue" ? v !== a.value : v === a.value) errors.push(message);
    } else if (a.type === "requireComponent") {
      if (!rows.has(a.component)) {
        const message = `${rule.name}: componente obbligatorio ${d.components.find(c=>c.id===a.component)?.code ?? a.component}.`;
        if (possible.has(a.component)) pending.push(message); else errors.push(message);
      }
    } else if (a.type === "oneOf") {
      const selected = a.components.filter(id=>rows.has(id));
      if (selected.length > 1 || (!selected.length && !a.components.some(id=>possible.has(id)))) errors.push(`${rule.name}: deve essere presente uno solo dei componenti alternativi.`);
      else if (!selected.length || a.components.some(id=>possible.has(id) && !rows.has(id))) pending.push(`${rule.name}: alternativa ancora da definire.`);
    }
  }
  const requiredValues = new Map<string,Value>();
  for (const {rule,action:a} of constraints.filter(c=>c.action.type==="requireValue")) {
    if (requiredValues.has(a.parameter) && requiredValues.get(a.parameter)!==a.value) errors.push(`${rule.name}: valori obbligatori incompatibili per ${d.parameters.find(p=>p.id===a.parameter)?.name ?? a.parameter}.`);
    requiredValues.set(a.parameter,a.value);
    if (constraints.some(c=>c.action.type==="excludeValue" && c.action.parameter===a.parameter && c.action.value===a.value)) errors.push(`${rule.name}: un valore è richiesto ed escluso contemporaneamente.`);
  }
  const bom: BomRow[] = [];
  for (const row of rows.values()) {
    row.certain = !maybeExcluded.has(row.component);
    if (possible.has(row.component)) row.quantity = undefined;
    if (row.certain) bom.push(row); else possible.set(row.component,{...row,certain:false});
  }
  const possibleRows=[...possible.values()].filter(r=>!rows.get(r.component)?.certain && !excluded.has(r.component));
  for(const row of [...bom,...possibleRows]){
    const component=d.components.find(c=>c.id===row.component);
    if(!component)continue;
    if(component.properties?.length)row.properties=componentProperties(component,selection);
    if(!hasDimensions(component))continue;
    const measured=componentMeasurements(d,component,selection);
    if(component.dimensions!==undefined)row.dimensions=measured.values;
    else row.measure=measured.values[0]?.value;
    if(row.certain)errors.push(...measured.errors);
  }
  return {bom,possible:possibleRows,errors:[...new Set(errors)],pending:[...new Set(pending)],matched:[...new Set(matched)]};
}
function compatibleAssumptions(d:Configurator,selection:Selection,conditions:Condition[]):boolean {
  if(conditions.some(c=>conditionMatches(c,selection)===false))return false;
  for(const p of d.parameters){
    const list=conditions.filter(c=>c.parameter===p.id);if(!list.length)continue;
    const values=selection[p.id]!==undefined ? [selection[p.id]!] : domain(p);
    if(values){if(!values.some(v=>list.every(c=>conditionMatches(c,{[p.id]:v})===true)))return false;continue;}
    if(p.type==="text"){
      const equality=list.find(c=>c.operator==="eq");
      if(equality && list.some(c=>conditionMatches(c,{[p.id]:equality.value})===false))return false;
      continue;
    }
    if(p.type!=="number")continue;
    if(!numericConstraintsPossible(list,p.min,p.max))return false;
  }
  return true;
}
export function enumerate(d: Configurator, selection: Selection = {}, limit = MAX_ENUMERATION, assumptions:Condition[]=[]): Enumeration {
  // Keep bounded memory even for very large component catalogs.
  limit=Math.min(limit,Math.max(1,Math.floor(100000/Math.max(1,d.components.length))));
  const rules=expandedRules(d);
  const implied=impliedValues(d,selection,rules,assumptions);
  if(implied.errors.length) return {solutions:[],exhaustive:true,examined:0};
  selection=implied.selection;
  if(!compatibleAssumptions(d,selection,assumptions))return {solutions:[],exhaustive:true,examined:0};
  const open = d.parameters.filter(p=>selection[p.id] === undefined && (parameterNeedsInput(d,p) || assumptions.some(c=>c.parameter===p.id)));
  const domains = open.map(p=>domain(p)?.filter(v=>assumptions.filter(c=>c.parameter===p.id).every(c=>conditionMatches(c,{[p.id]:v})!==false)));
  if (domains.some(x=>!x)) return {solutions:[],exhaustive:false,examined:0,reason:open.some(p=>p.type==="text") ? "Compila i parametri di testo usati nelle regole per enumerare le varianti." : "Definisci i numeri liberi oppure un intervallo con passo per enumerare le varianti."};
  const total = domains.reduce((n,values)=>n * values!.length,1);
  const solutions: Enumeration["solutions"] = [];
  let examined = 0;
  function visit(index: number, values: Selection) {
    if (examined >= limit) return;
    if (index === open.length) {
      examined++;
      if(assumptions.some(c=>conditionMatches(c,values)!==true))return;
      const result = evaluate(d,values,rules);
      if (!result.errors.length && !result.pending.length) solutions.push({selection:{...values},result});
      return;
    }
    for (const v of domains[index]!) {
      visit(index+1,{...values,[open[index]!.id]:v});
      if (examined >= limit) break;
    }
  }
  visit(0,{...selection});
  return {solutions,exhaustive:examined >= total,examined,reason:examined < total ? `Limite di ${limit.toLocaleString("it-IT")} combinazioni esaminate raggiunto. Restringi i parametri.` : undefined};
}
export function summarize(d: Configurator, selection: Selection, enumeration: Enumeration, assumptions:Condition[]=[]): Evaluation {
  const result = evaluate(d,selection,undefined,assumptions);
  if (!enumeration.exhaustive || !enumeration.solutions.length) return result;
  const rows = new Map<string,BomRow>();
  for (const s of enumeration.solutions) for (const r of s.result.bom) {
    const old = rows.get(r.component);
    rows.set(r.component,{...r,reasons:[...new Set([...(old?.reasons ?? []),...r.reasons])],quantity:old && old.quantity !== r.quantity ? undefined : r.quantity,...("measure" in r ? {measure:old && old.measure!==r.measure ? undefined : r.measure} : {}),...(r.dimensions ? {dimensions:r.dimensions.map(v=>({id:v.id,value:old && old.dimensions?.find(x=>x.id===v.id)?.value!==v.value ? undefined : v.value}))} : {}),...(r.properties ? {properties:r.properties.map(v=>({id:v.id,value:old && old.properties?.find(x=>x.id===v.id)?.value!==v.value ? undefined : v.value}))} : {})});
  }
  const bom: BomRow[] = [], possible: BomRow[] = [];
  for (const r of rows.values()) {
    r.certain = enumeration.solutions.every(s=>s.result.bom.some(row=>row.component===r.component));
    (r.certain ? bom : possible).push(r);
  }
  return {...result,bom,possible};
}
export function analyze(d: Configurator): Issue[] {
  const rules=expandedRules(d);
  const issues: Issue[] = [], seen = new Set<string>();
  const error = (message: string) => issues.push({severity:"error",message});
  const warning = (message: string) => issues.push({severity:"warning",message});
  for (const r of d.rules) for(const id of r.parameterIds ?? [])if(!d.parameters.some(p=>p.id===id))error(`${r.name}: parametro associato mancante.`);
  for (const r of d.rules) for(const id of r.componentIds ?? [])if(!d.components.some(c=>c.id===id))error(`${r.name}: componente associato mancante.`);
  for (const p of d.parameters) {
    optionRuleProblems(d,p).forEach(error);
    if (!p.name.trim()) error("Parametro senza nome.");
    if ((p.type === "choice" || p.type === "text") && (((p.type === "choice" || !allowsCustomText(p)) && !p.values.length) || p.values.some(v=>!v.trim()) || new Set(p.values.map(v=>v.trim())).size!==p.values.length)) error(`${p.name}: inserisci scelte uniche e non vuote.`);
    if (p.type === "number" && ((p.min !== undefined && p.max !== undefined && p.min > p.max) || (p.step !== undefined && p.step <= 0))) error(`${p.name}: intervallo o passo non valido.`);
    if (!d.components.some(c=>componentDimensions(c).some(m=>m.parameter===p.id) || c.properties?.some(v=>v.parameter===p.id)) && !p.optionRules?.some(r=>r.enabled) && !d.parameters.some(other=>other.optionRules?.some(r=>r.enabled && conditionsOf(r.expression).some(c=>c.parameter===p.id))) && !rules.some(r=>r.enabled && (ruleConditions(r).some(c=>c.parameter===p.id) || r.actions.some(a=>a.parameter===p.id || a.quantity.parameter===p.id)))) warning(`${p.name}: parametro senza effetto sulle regole.`);
  }
  const codes = new Set<string>();
  for (const c of d.components) {
    measureProblems(d,c).forEach(error);
    propertyProblems(d,c).forEach(error);
    if (!c.code.trim() || !c.name.trim()) error("Componente senza codice o descrizione.");
    if (codes.has(c.code.trim().toLowerCase())) error(`Codice duplicato: ${c.code}.`);
    codes.add(c.code.trim().toLowerCase());
    if (!rules.some(r=>r.enabled && r.actions.some(a=>a.type==="add" && a.component===c.id))) warning(`${c.code}: componente mai aggiunto da una regola attiva.`);
  }
  for (const r of rules) {
    if (!r.enabled) continue;
    if (!r.actions.length) error(`${r.name}: regola senza azioni.`);
    const key = JSON.stringify({expression:expressionKey(ruleExpression(r)),actions:r.actions});
    if (seen.has(key)) warning(`${r.name}: regola duplicata; le quantità di inclusione si sommano.`);
    seen.add(key);
    for (const c of ruleConditions(r)) {
      const p = d.parameters.find(p=>p.id===c.parameter);
      if (!p) error(`${r.name}: parametro della condizione mancante.`);
      else if (["eq","ne"].includes(c.operator) ? !validValue(p,c.value) : p.type!=="number" || typeof c.value!=="number") error(`${r.name}: condizione non valida per ${p.name}.`);
    }
    for (const a of r.actions) {
      if (["add","exclude","requireComponent"].includes(a.type) && !d.components.some(c=>c.id===a.component)) error(`${r.name}: componente dell'azione mancante.`);
      if (a.type === "oneOf" && (a.components.length < 2 || new Set(a.components).size!==a.components.length || a.components.some(id=>!d.components.some(c=>c.id===id)))) error(`${r.name}: seleziona almeno due componenti alternativi distinti.`);
      if (["requireValue","excludeValue"].includes(a.type)) { const p = d.parameters.find(p=>p.id===a.parameter); if (!p || !validValue(p,a.value)) error(`${r.name}: vincolo su parametro non valido.`); }
      if (a.type === "add" && (!Number.isFinite(a.quantity.amount) || a.quantity.amount < 0 || !Number.isFinite(a.quantity.divisor) || a.quantity.divisor <= 0 || (a.quantity.parameter && !d.parameters.some(p=>p.id===a.quantity.parameter && p.type==="number")))) error(`${r.name}: quantità o parametro numerico non valido.`);
    }
    for (const problem of expressionProblems(ruleExpression(r))) error(`${r.name}: ${problem}`);
    for (const scope of conjunctions(ruleExpression(r))) if (scope.some(c=>c.operator==="eq" && scope.some(other=>other.parameter===c.parameter && ((other.operator==="eq" && other.value!==c.value) || (other.operator==="ne" && other.value===c.value))))) warning(`${r.name}: condizioni incompatibili in un gruppo E; questo gruppo non può essere vero.`);
  }
  return issues;
}
