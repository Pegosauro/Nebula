import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { Selection } from "./model";
import { emptyGraphSelection, type GraphSelection } from "./graphSelection";
import type { GraphFocus } from "./graphPaths";
import type { ConfiguratorSection } from "./ConfiguratorNavigation";
export interface GraphViewState { focus?: GraphFocus; selectedNodes: string[]; showUnconstrained: boolean; zoom: number; multiSelect: boolean; query: string }
export interface ConfiguratorUi { section: ConfiguratorSection; selection: Selection; showVariants: boolean; graphSelection: GraphSelection; graph: GraphViewState }
export const defaultGraphView: GraphViewState = { selectedNodes: [], showUnconstrained: false, zoom: 1, multiSelect: false, query: "" };
export const defaultConfiguratorUi: ConfiguratorUi = { section: "Esplora", selection: {}, showVariants: false, graphSelection: emptyGraphSelection, graph: defaultGraphView };
interface State { projects: Record<string, ConfiguratorUi>; update: (scope: string, patch: Partial<ConfiguratorUi>) => void; clear: () => void; forget: (scope: string) => void }
export const useConfiguratorUiStore = create<State>()(persist((set) => ({
  projects: {},
  update: (scope, patch) => set(state => ({ projects: { ...state.projects, [scope]: { ...(state.projects[scope] ?? defaultConfiguratorUi), ...patch } } })),
  clear: () => set({ projects: {} }),
  forget: scope => set(state => ({ projects: Object.fromEntries(Object.entries(state.projects).filter(([key]) => key !== scope)) })),
}), { name: "nebula.configurator-ui.v1", storage: createJSONStorage(() => ({
  getItem: key => { try { return localStorage.getItem(key); } catch { return null; } },
  setItem: (key,value) => { try { localStorage.setItem(key,value); } catch { /* Keep the current session usable when storage is unavailable. */ } },
  removeItem: key => { try { localStorage.removeItem(key); } catch { /* No disk content is stored here. */ } },
})), partialize: state => ({ projects: state.projects }),
  merge: (stored, current) => {
    const raw = (stored as { projects?: unknown })?.projects;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return current;
    const projects: Record<string, ConfiguratorUi> = {};
    for (const [key, value] of Object.entries(raw).slice(-100)) {
      if (!value || typeof value !== "object") continue;
      const ui = value as ConfiguratorUi;
      const selection = Object.fromEntries(Object.entries(ui.selection ?? {}).filter(([, v]) => typeof v === "string" || typeof v === "boolean" || typeof v === "number" && Number.isFinite(v)));
      const conditions = ui.graphSelection?.conditions;
      projects[key] = { ...defaultConfiguratorUi, section: ["Esplora", "BOM", "Grafo", "Parametri", "Componenti", "Analisi"].includes(ui.section) ? ui.section : "Esplora", selection, showVariants: ui.showVariants === true,
        graphSelection: Array.isArray(conditions) && Array.isArray(ui.graphSelection?.parameters) ? { parameters: ui.graphSelection.parameters.filter(id => typeof id === "string"), conditions: conditions.filter(c => c && typeof c.parameter === "string" && ["eq", "ne", "gt", "gte", "lt", "lte"].includes(c.operator) && ["string", "number", "boolean"].includes(typeof c.value)) } : emptyGraphSelection,
        graph: { ...defaultGraphView, selectedNodes: Array.isArray(ui.graph?.selectedNodes) ? ui.graph.selectedNodes.filter(id => typeof id === "string") : [], showUnconstrained: ui.graph?.showUnconstrained === true, multiSelect: ui.graph?.multiSelect === true, zoom: Number.isFinite(ui.graph?.zoom) ? Math.max(.1, Math.min(2, ui.graph.zoom)) : 1, query: typeof ui.graph?.query === "string" ? ui.graph.query : "", focus: ui.graph?.focus && ["node", "route", "component"].includes(ui.graph.focus.kind) && typeof ui.graph.focus.id === "string" ? ui.graph.focus : undefined } };
    }
    return { ...current, projects };
  },
}));
