import { useEffect,useState } from "react";
import { calculate,type Calculation } from "./calculation";
import type { Condition,Configurator,Selection } from "./model";
const noConditions:Condition[]=[];
export function useCalculation(data:Configurator|undefined,selection:Selection,analysis:boolean,enabled=true,conditions:Condition[]=noConditions) {
  const [state,setState]=useState<{data:Configurator;selection:Selection;analysis:boolean;conditions:Condition[];value?:Calculation;error?:string}>();
  useEffect(()=>{
    if(!data || !enabled) return;
    if(typeof Worker==="undefined") {setState({data,selection,analysis,conditions,value:calculate(data,selection,analysis,conditions)});return;}
    const worker=new Worker(new URL("../../workers/configurator.worker.ts",import.meta.url),{type:"module"});
    worker.onmessage=(event:MessageEvent<Calculation>)=>setState({data,selection,analysis,conditions,value:event.data});
    worker.onerror=()=>setState({data,selection,analysis,conditions,error:"Calcolo non disponibile. Chiudi e riapri il configuratore per riprovare."});
    worker.postMessage({data,selection,analysis,conditions});
    return()=>worker.terminate();
  },[data,selection,analysis,enabled,conditions]);
  const current=state?.data===data && state?.selection===selection && state?.analysis===analysis && state?.conditions===conditions;
  // Keep the last analysis badge stable while editing. Recompute from the
  // current definitions when a result view is opened again.
  return {data:state?.data,selection:state?.selection,conditions:state?.conditions,value:!enabled || current?state?.value:undefined,error:enabled && current?state?.error:undefined,computing:enabled && !!data && (!current || !state?.value) && !(current && state?.error)};
}
