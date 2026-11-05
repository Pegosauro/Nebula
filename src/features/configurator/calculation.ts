import type { Condition, Configurator, Selection } from "./model";
import { analyze, enumerate, evaluate, summarize, type Enumeration } from "./engine";
export function calculate(data: Configurator,selection:Selection,analysis:boolean,conditions:Condition[]=[]) {
  const issues=analyze(data);
  const hasErrors=issues.some(i=>i.severity==="error");
  const enumeration:Enumeration=hasErrors?{solutions:[],exhaustive:false,examined:0}:enumerate(data,selection,undefined,conditions);
  const result=hasErrors?evaluate(data,selection,undefined,conditions):summarize(data,selection,enumeration,conditions);
  const analysisEnumeration=analysis && !hasErrors?enumerate(data):undefined;
  return {issues,enumeration,result,analysisEnumeration};
}
export type Calculation = ReturnType<typeof calculate>;
