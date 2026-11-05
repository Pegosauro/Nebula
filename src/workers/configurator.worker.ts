import { calculate } from "../features/configurator/calculation";
import type { Condition, Configurator, Selection } from "../features/configurator/model";
self.onmessage=(event:MessageEvent<{data:Configurator;selection:Selection;analysis:boolean;conditions?:Condition[]}>)=>{
  const {data,selection,analysis,conditions}=event.data;
  self.postMessage(calculate(data,selection,analysis,conditions));
};
