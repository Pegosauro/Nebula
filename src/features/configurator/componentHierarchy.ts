import type { Component, ComponentFamilyLayout, Configurator } from "./model";
export interface ComponentGroup { name: string; collapsed: boolean; components: Component[] }
export interface ComponentFamily { name: string; collapsed: boolean; groups: ComponentGroup[] }
/** Saved display order, followed by newly introduced sections in insertion order. */
export function componentHierarchy(data: Configurator): ComponentFamily[] {
  const families = new Map<string, Map<string, Component[]>>();
  for (const c of data.components) {
    const family = (c.family ?? "").trim(), group = c.group.trim();
    const groups = families.get(family) ?? new Map<string, Component[]>();
    const items=groups.get(group) ?? []; items.push(c); groups.set(group,items); families.set(family, groups);
  }
  const ordered = (present: string[], saved: string[]) => [...saved.filter(n=>present.includes(n)), ...present.filter(n=>!saved.includes(n))];
  return ordered([...families.keys()], (data.componentLayout ?? []).map(f=>f.name)).map(name=>{
    const saved = data.componentLayout?.find(f=>f.name===name), groups = families.get(name)!;
    return {name, collapsed: saved?.collapsed ?? false, groups: ordered([...groups.keys()], (saved?.groups ?? []).map(g=>g.name)).map(group=>({name:group, collapsed:saved?.groups.find(g=>g.name===group)?.collapsed ?? false, components:groups.get(group)!}))};
  });
}
export function hierarchyLayout(families: ComponentFamily[]): ComponentFamilyLayout[] {
  return families.map(f=>({name:f.name,collapsed:f.collapsed,groups:f.groups.map(g=>({name:g.name,collapsed:g.collapsed}))}));
}
export const orderedComponents = (data: Configurator) => componentHierarchy(data).flatMap(f=>f.groups.flatMap(g=>g.components));
