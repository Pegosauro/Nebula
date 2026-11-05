import type { Component, PropertyValue } from "./model";
import { propertyEntries } from "./componentProperties";
export function ComponentPropertyValues({component,values}:{component:Component;values?:PropertyValue[]}) {
  if(!component.properties?.length)return null;
  return <dl className="config-property-values">{propertyEntries(component,values).map(p=><div key={p.id}><dt>{p.name}:</dt><dd>{p.value===undefined || p.value==="" ? "Da definire" : p.value}</dd></div>)}</dl>;
}
