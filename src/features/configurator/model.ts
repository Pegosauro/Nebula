export type Value = string | number | boolean;
export type Selection = Record<string, Value>;
export interface Parameter { id: string; name: string; type: "choice" | "boolean" | "number" | "text"; values: string[]; allowCustom?: boolean; min?: number; max?: number; step?: number; unit: string; optionRules?: OptionRule[] }
export interface ComponentMeasure { parameter: string; offset: number; unit: string }
export interface ComponentDimension extends ComponentMeasure { id: string; name: string }
export interface DimensionValue { id: string; value?: number }
export interface ComponentProperty { id: string; name: string; parameter: string; value?: string }
export interface PropertyValue { id: string; value?: string }
export interface Component { id: string; code: string; name: string; group: string; family?: string; unit: string; note: string; measure?: ComponentMeasure; dimensions?: ComponentDimension[]; properties?: ComponentProperty[] }
export interface ComponentFamilyLayout { name: string; collapsed: boolean; groups: { name: string; collapsed: boolean }[] }
export interface Condition { parameter: string; operator: "eq" | "ne" | "gt" | "gte" | "lt" | "lte"; value: Value }
export interface Quantity { amount: number; parameter?: string; divisor: number; rounding: "none" | "ceil" | "floor" }
export interface Action { type: "add" | "exclude" | "requireComponent" | "oneOf" | "requireValue" | "excludeValue"; component: string; components: string[]; parameter: string; value: Value; quantity: Quantity }
export type ConditionNode = { id: string; type: "condition"; condition: Condition } | { id: string; type: "all" | "any"; children: ConditionNode[] } | { id: string; type: "not"; child: ConditionNode };
export interface OptionRule { value: Value; enabled: boolean; expression: ConditionNode }
export interface RuleCase { id: string; name: string; enabled: boolean; match: "all" | "any"; conditions: Condition[]; expression?: ConditionNode; actions: Action[] }
export interface Rule extends RuleCase { parameterIds?: string[]; componentIds?: string[]; cases?: RuleCase[] }
export interface Configurator { format: "nebula-configurator"; version: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8; title: string; parameters: Parameter[]; components: Component[]; rules: Rule[]; componentLayout?: ComponentFamilyLayout[] }
export const allowsCustomText=(p:Parameter)=>p.type==="text" && p.allowCustom!==false;
/** Keep out-of-range numbers editable; domain constraints are checked by the engine. */
export function acceptsParameterValue(p:Parameter,v:unknown):v is Value {
  return p.type==="text" ? typeof v==="string" && (allowsCustomText(p) || p.values.includes(v)) : p.type==="choice" ? typeof v==="string" && p.values.includes(v) : p.type==="boolean" ? typeof v==="boolean" : typeof v==="number" && Number.isFinite(v);
}
export const isConfiguratorPath = (path: string) => /\.config\.json$/i.test(path);
export const configTitle = (name: string) => name.replace(/\.config\.json$/i, "");
export const configVersion = (current:Configurator["version"],minimum:Configurator["version"]):Configurator["version"] => Math.max(current,minimum) as Configurator["version"];
export const uid = () => crypto.randomUUID();
export const newQuantity = (): Quantity => ({ amount: 1, divisor: 1, rounding: "none" });
export const newAction = (): Action => ({ type: "add", component: "", components: [], parameter: "", value: "", quantity: newQuantity() });
export const emptyConfigurator = (title: string): Configurator => ({ format: "nebula-configurator", version: 1, title, parameters: [], components: [], rules: [] });
export function exampleConfigurator(title: string): Configurator {
  const data = emptyConfigurator(title);
  data.parameters = [
    { id: "model", name: "Modello", type: "choice", values: ["A", "B"], unit: "" },
    { id: "led", name: "LED", type: "boolean", values: [], unit: "" },
    { id: "width", name: "Larghezza", type: "number", values: [], min: 2000, max: 6000, unit: "mm" },
  ];
  data.components = [
    { id: "profile", code: "PR001", name: "Profilo laterale", group: "Profili", unit: "pz", note: "" },
    { id: "led-strip", code: "LED001", name: "Strip LED", group: "Illuminazione", unit: "pz", note: "" },
    { id: "power", code: "AL001", name: "Alimentatore", group: "Illuminazione", unit: "pz", note: "" },
    { id: "bracket", code: "ST001", name: "Staffa", group: "Fissaggi", unit: "pz", note: "" },
  ];
  const add = (component: string, quantity = newQuantity()): Action => ({ ...newAction(), component, quantity });
  data.rules = [
    { id: "R1", name: "Profilo del modello A", enabled: true, match: "all", conditions: [{ parameter: "model", operator: "eq", value: "A" }], actions: [add("profile", { ...newQuantity(), amount: 2 })] },
    { id: "R2", name: "Kit illuminazione", enabled: true, match: "all", conditions: [{ parameter: "led", operator: "eq", value: true }], actions: [add("led-strip"), add("power")] },
    { id: "R3", name: "LED non disponibile sul modello B", enabled: true, match: "all", conditions: [{ parameter: "model", operator: "eq", value: "B" }], actions: [{ ...newAction(), type: "excludeValue", parameter: "led", value: true }] },
    { id: "R4", name: "Una staffa ogni metro", enabled: true, match: "all", conditions: [], actions: [add("bracket", { amount: 1, parameter: "width", divisor: 1000, rounding: "ceil" })] },
  ];
  return data;
}

// Reject unsupported or malformed files before they can be edited and overwritten.
export function parseConfigurator(text: string): Configurator {
  const d = JSON.parse(text) as Configurator;
  if (!d || d.format !== "nebula-configurator" || ![1,2,3,4,5,6,7,8].includes(d.version) || typeof d.title !== "string" || !Array.isArray(d.parameters) || !Array.isArray(d.components) || !Array.isArray(d.rules)) throw new Error("Formato configuratore non valido o versione non supportata.");
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every(x => typeof x === "string");
  const value = (v: unknown) => typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));
  if (d.parameters.some(p => !p || typeof p.id !== "string" || typeof p.name !== "string" || !["choice", "boolean", "number", "text"].includes(p.type) || !strings(p.values) || typeof p.unit !== "string" || [p.min,p.max,p.step].some(v => v !== undefined && (typeof v !== "number" || !Number.isFinite(v))))) throw new Error("Parametri non validi.");
  if(d.version<7 && d.parameters.some(p=>p.type==="text"))throw new Error("I parametri di testo richiedono la versione 7.");
  for(const p of d.parameters)if(p.allowCustom!==undefined){
    if(d.version<8)throw new Error("Le opzioni di testo richiedono la versione 8.");
    if(p.type!=="text" || typeof p.allowCustom!=="boolean")throw new Error("Impostazione del testo personalizzato non valida.");
  }
  if (d.components.some(c => !c || [c.id,c.code,c.name,c.group,c.unit,c.note].some(v => typeof v !== "string") || (c.family !== undefined && typeof c.family !== "string"))) throw new Error("Componenti non validi.");
  for (const c of d.components) if(c.measure!==undefined) {
    if(d.version<5) throw new Error("La misura del componente richiede la versione 5.");
    if(!c.measure || typeof c.measure.parameter!=="string" || !Number.isFinite(c.measure.offset) || typeof c.measure.unit!=="string") throw new Error("Misura del componente non valida.");
  }
  for (const c of d.components) if(c.dimensions!==undefined) {
    if(d.version<6) throw new Error("Le dimensioni del componente richiedono la versione 6.");
    if(c.measure!==undefined || !Array.isArray(c.dimensions) || c.dimensions.length>32 || c.dimensions.some(m=>!m || typeof m.id!=="string" || !m.id || typeof m.name!=="string" || typeof m.parameter!=="string" || typeof m.offset!=="number" || !Number.isFinite(m.offset) || typeof m.unit!=="string") || new Set(c.dimensions.map(m=>m.id)).size!==c.dimensions.length) throw new Error("Dimensioni del componente non valide.");
  }
  for (const c of d.components) if(c.properties!==undefined) {
    if(d.version<7)throw new Error("Le proprietà del componente richiedono la versione 7.");
    if(!Array.isArray(c.properties) || c.properties.length>32 || c.properties.some(p=>!p || typeof p.id!=="string" || !p.id || typeof p.name!=="string" || typeof p.parameter!=="string" || p.value!==undefined && typeof p.value!=="string") || new Set(c.properties.map(p=>p.id)).size!==c.properties.length)throw new Error("Proprietà del componente non valide.");
  }
  if(d.version<8 && d.components.some(c=>c.properties?.some(p=>p.value!==undefined)))throw new Error("Il valore della proprietà del componente richiede la versione 8.");
  if (d.componentLayout !== undefined && (!Array.isArray(d.componentLayout) || d.componentLayout.some(f => !f || typeof f.name !== "string" || typeof f.collapsed !== "boolean" || !Array.isArray(f.groups) || f.groups.some(g => !g || typeof g.name !== "string" || typeof g.collapsed !== "boolean") || new Set(f.groups.map(g=>g.name)).size !== f.groups.length) || new Set(d.componentLayout.map(f=>f.name)).size !== d.componentLayout.length)) throw new Error("Organizzazione dei componenti non valida.");
  const invalidRule = (r:RuleCase) => !r || typeof r.id !== "string" || typeof r.name !== "string" || typeof r.enabled !== "boolean" || !["all","any"].includes(r.match) || !Array.isArray(r.conditions) || !Array.isArray(r.actions) || r.conditions.some(c => !c || typeof c.parameter !== "string" || !["eq","ne","gt","gte","lt","lte"].includes(c.operator) || !value(c.value)) || r.actions.some(a => !a || !["add","exclude","requireComponent","oneOf","requireValue","excludeValue"].includes(a.type) || typeof a.component !== "string" || !strings(a.components) || typeof a.parameter !== "string" || !value(a.value) || !a.quantity || !Number.isFinite(a.quantity.amount) || !Number.isFinite(a.quantity.divisor) || !["none","ceil","floor"].includes(a.quantity.rounding) || (a.quantity.parameter !== undefined && typeof a.quantity.parameter !== "string"));
  if (d.rules.some(invalidRule)) throw new Error("Regole non valide.");
  for (const list of [d.parameters,d.components,d.rules]) if (new Set(list.map(x=>x.id)).size !== list.length || list.some(x=>!x.id)) throw new Error("Identificativi vuoti o duplicati.");
  const validateExpression = (r:{expression?:ConditionNode}) => { if (r.expression === undefined) return;
    if (d.version < 2) throw new Error("Le espressioni annidate richiedono la versione 2.");
    const ids = new Set<string>();
    const visit = (n: ConditionNode, depth: number): void => {
      if (!n || depth > 32 || ids.size >= 1000 || typeof n.id !== "string" || !n.id || ids.has(n.id)) throw new Error("Albero delle condizioni non valido o troppo complesso.");
      ids.add(n.id);
      if (n.type === "condition") {
        const c = n.condition;
        if (!c || typeof c.parameter !== "string" || !["eq","ne","gt","gte","lt","lte"].includes(c.operator) || !value(c.value)) throw new Error("Condizione non valida.");
      } else if (n.type === "not") {
        if ("children" in n) throw new Error("NON richiede un solo elemento.");
        visit(n.child, depth + 1);
      } else if ((n.type === "all" || n.type === "any") && Array.isArray(n.children)) n.children.forEach(c => visit(c, depth + 1));
      else throw new Error("Operatore logico non valido.");
    };
    visit(r.expression, 0);
  }
  for (const p of d.parameters) if (p.optionRules !== undefined) {
    if (d.version < 4) throw new Error("La selezionabilità dei valori richiede la versione 4.");
    if (!Array.isArray(p.optionRules) || p.optionRules.length>5000 || p.optionRules.some(r=>!r || !value(r.value) || typeof r.enabled!=="boolean" || !r.expression) || new Set(p.optionRules.map(r=>JSON.stringify(r.value))).size!==p.optionRules.length) throw new Error("Regole di selezionabilità non valide.");
    p.optionRules.forEach(validateExpression);
  }
  for (const r of d.rules) {
    validateExpression(r);
    if (r.parameterIds !== undefined) {
      if (d.version < 3) throw new Error("I vincoli associati ai parametri richiedono la versione 3.");
      if (!strings(r.parameterIds) || !r.parameterIds.length || r.parameterIds.some(id=>!id) || new Set(r.parameterIds).size!==r.parameterIds.length) throw new Error("Associazioni dei parametri non valide.");
    }
    if (r.componentIds !== undefined || r.cases !== undefined) {
      if (d.version < 3) throw new Error("La regola unica del componente richiede la versione 3.");
      if (r.componentIds !== undefined && (!strings(r.componentIds) || r.componentIds.some(id=>!id) || new Set(r.componentIds).size!==r.componentIds.length)) throw new Error("Associazioni dei componenti non valide.");
      if (r.cases !== undefined) {
        if (!Array.isArray(r.cases) || !r.cases.length || r.cases.length>1000 || r.cases.some(c=>invalidRule(c) || !c.id || "cases" in c || "componentIds" in c || "parameterIds" in c) || new Set(r.cases.map(c=>c.id)).size!==r.cases.length) throw new Error("Alternative della regola non valide.");
        r.cases.forEach(validateExpression);
      }
    }
  }
  return d;
}
