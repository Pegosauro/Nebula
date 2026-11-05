import type { ActivitySection, WorkspaceTab } from "./workspaceStore";
import { isConfiguratorPath } from "../configurator/model";

export interface PanelLayout { sidebarOpen: boolean; contextPanelOpen: boolean }
export type PanelArea = "home" | "notes" | "configurator" | "library" | "search" | "recent" | "settings";
export type PanelLayouts = Partial<Record<PanelArea, PanelLayout>>;
export function panelArea(activity: ActivitySection, tab?: WorkspaceTab): PanelArea {
  if (activity === "settings" || activity === "search" || activity === "recent") return activity;
  if (tab?.path && isConfiguratorPath(tab.path)) return "configurator";
  if (activity === "configurators") return "library";
  return tab?.kind === "document" ? "notes" : "home";
}
const areas: PanelArea[] = ["home", "notes", "configurator", "library", "search", "recent", "settings"];
export function readPanelLayouts(): PanelLayouts {
  try {
    const stored = JSON.parse(localStorage.getItem("nebula.panel-layouts.v1") ?? "{}");
    return Object.fromEntries(areas.flatMap(area => {
      const layout = stored?.[area];
      return typeof layout?.sidebarOpen === "boolean" && typeof layout?.contextPanelOpen === "boolean" ? [[area, { sidebarOpen: layout.sidebarOpen, contextPanelOpen: layout.contextPanelOpen }]] : [];
    }));
  } catch { return {}; }
}
export function savePanelLayouts(layouts: PanelLayouts): void {
  try { localStorage.setItem("nebula.panel-layouts.v1", JSON.stringify(layouts)); } catch { /* UI preferences remain usable in memory. */ }
}
