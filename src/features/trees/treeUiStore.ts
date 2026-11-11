import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/** Stato della vista: non entra mai nel file `.tree.json`. */
export interface TreeUi { expanded?: string[]; selectedId?: string; categoryId?: string }
interface State { trees: Record<string, TreeUi>; update: (scope: string, patch: Partial<TreeUi>) => void; clear: () => void; forget: (scope: string) => void }
const storage = {
  getItem: (key: string) => { try { return localStorage.getItem(key); } catch { return null; } },
  setItem: (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* La sessione resta usabile. */ } },
  removeItem: (key: string) => { try { localStorage.removeItem(key); } catch { /* Nessun contenuto di Vault qui. */ } },
};
function strings(value: unknown, limit: number): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return value.filter(item => typeof item === "string").slice(0, limit);
}
export const useTreeUiStore = create<State>()(persist((set) => ({
  trees: {},
  update: (scope, patch) => set(state => ({ trees: { ...state.trees, [scope]: { ...state.trees[scope], ...patch } } })),
  clear: () => set({ trees: {} }),
  forget: scope => set(state => ({ trees: Object.fromEntries(Object.entries(state.trees).filter(([key]) => key !== scope)) })),
}), {
  name: "nebula.tree-ui.v1",
  storage: createJSONStorage(() => storage),
  partialize: state => ({ trees: state.trees }),
  merge: (stored, current) => {
    const raw = (stored as { trees?: unknown })?.trees;
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return current;
    const trees: Record<string, TreeUi> = {};
    for (const [key, value] of Object.entries(raw).slice(-100)) {
      if (!value || typeof value !== "object") continue;
      const ui = value as TreeUi;
      trees[key] = {
        expanded: strings(ui.expanded, 5000),
        selectedId: typeof ui.selectedId === "string" ? ui.selectedId : undefined,
        categoryId: typeof ui.categoryId === "string" ? ui.categoryId : undefined,
      };
    }
    return { ...current, trees };
  },
}));
