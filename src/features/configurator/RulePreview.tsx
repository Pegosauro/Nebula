import { conditionsOf, ruleExpression } from "./expressions";
import { matches, valueLabel } from "./engine";
import type { ConditionNode, Configurator, Rule } from "./model";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useConfiguratorStore } from "./configuratorStore";
export function readableCondition(node: ConditionNode, data: Configurator): string {
  if (node.type === "condition") {
    const c = node.condition, p = data.parameters.find(p => p.id === c.parameter);
    const operator = {eq:"è",ne:"è diverso da",gt:"è maggiore di",gte:"è almeno",lt:"è minore di",lte:"è al massimo"}[c.operator];
    return `${p?.name ?? "Parametro mancante"} ${operator} ${valueLabel(c.value)}${p?.unit ? ` ${p.unit}` : ""}`;
  }
  if (node.type === "not") return `NON (${readableCondition(node.child,data)})`;
  if (!node.children.length) return node.type === "all" ? "Sempre" : "Nessuna condizione";
  return node.children.map(child => `(${readableCondition(child,data)})`).join(node.type === "all" ? " e " : " oppure ");
}
export function RulePreview({data,rule}: {data: Configurator; rule: Rule}) {
  const path = useWorkspaceStore(state => state.tabs.find(tab => tab.id === state.activeTabId)?.path);
  const selection = useConfiguratorStore(state => path ? state.sessions[path]?.preview?.selection : undefined);
  const expression = ruleExpression(rule);
  const result = matches(rule,selection ?? {});
  const missing = [...new Set(conditionsOf(expression).filter(c => selection?.[c.parameter] === undefined).map(c => data.parameters.find(p => p.id === c.parameter)?.name ?? c.parameter))];
  return <section className="config-rule-test" aria-label="Prova della regola"><strong>{readableCondition(expression,data)}</strong><div><span>Con le scelte correnti:</span><b className={result === undefined ? "is-pending" : result ? "is-true" : "is-false"}>{!rule.enabled ? "Disattivata" : result === undefined ? "In attesa" : result ? "Vera" : "Falsa"}</b></div>{result === undefined && missing.length > 0 && <small>Da scegliere: {missing.join(", ")}</small>}</section>;
}
