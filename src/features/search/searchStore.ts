import { create } from "zustand";
import type { SearchResult } from "../../domain/search";
import { quickSearchClient } from "./quickSearchClient";
import { indexWorkerClient } from "../knowledge/indexWorkerClient";

const RECENT_PATHS_KEY = "nebula.search.recents.v1";
const MAX_RECENT_PATHS = 20;

function loadRecentPaths(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_PATHS_KEY) ?? "[]");
    return Array.isArray(value) ? value.filter((path): path is string => typeof path === "string").slice(0, MAX_RECENT_PATHS) : [];
  } catch {
    return [];
  }
}

function saveRecentPaths(paths: string[]): void {
  try {
    localStorage.setItem(RECENT_PATHS_KEY, JSON.stringify(paths));
  } catch {
    // Recency improves ranking but is never required to search the Vault.
  }
}

interface SearchState {
  query: string;
  results: SearchResult[];
  searching: boolean;
  error?: string;
  quickOpen: boolean;
  quickQuery: string;
  quickResults: SearchResult[];
  quickSearching: boolean;
  quickSelectedIndex: number;
  recentPaths: string[];
  search: (query: string) => Promise<void>;
  openQuickSwitcher: () => void;
  closeQuickSwitcher: () => void;
  searchQuick: (query: string) => Promise<void>;
  setQuickSelectedIndex: (index: number) => void;
  moveQuickSelection: (direction: 1 | -1) => void;
  recordOpen: (path: string) => void;
  reset: () => void;
}

let searchGeneration = 0;
let quickGeneration = 0;

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  results: [],
  searching: false,
  quickOpen: false,
  quickQuery: "",
  quickResults: [],
  quickSearching: false,
  quickSelectedIndex: 0,
  recentPaths: loadRecentPaths(),
  search: async (query) => {
    const current = ++searchGeneration;
    const normalized = query.trim();
    set({ query, searching: Boolean(normalized), error: undefined, ...(normalized ? {} : { results: [] }) });
    if (!normalized) return;
    try {
      const results = await indexWorkerClient.search(normalized, "full", get().recentPaths, 100);
      if (current === searchGeneration) set({ results, searching: false });
    } catch (error) {
      if (current === searchGeneration) set({ results: [], searching: false, error: error instanceof Error ? error.message : "Ricerca non riuscita." });
    }
  },
  openQuickSwitcher: () => {
    set({ quickOpen: true, quickQuery: "", quickResults: [], quickSelectedIndex: 0 });
    void get().searchQuick("");
  },
  closeQuickSwitcher: () => {
    quickGeneration += 1;
    quickSearchClient.cancelQueued();
    set({ quickOpen: false, quickSearching: false });
  },
  searchQuick: async (query) => {
    const current = ++quickGeneration;
    set({ quickQuery: query, quickSearching: true, quickSelectedIndex: 0, error: undefined });
    try {
      const quickResults = await quickSearchClient.search(query.trim(), get().recentPaths, 30);
      if (current === quickGeneration) set({ quickResults, quickSearching: false });
    } catch (error) {
      if (current === quickGeneration) set({ quickResults: [], quickSearching: false, error: error instanceof Error ? error.message : "Quick Switcher non disponibile." });
    }
  },
  setQuickSelectedIndex: (quickSelectedIndex) => { if (get().quickSelectedIndex !== quickSelectedIndex) set({ quickSelectedIndex }); },
  moveQuickSelection: (direction) => set((state) => {
    if (!state.quickResults.length) return state;
    return { quickSelectedIndex: (state.quickSelectedIndex + direction + state.quickResults.length) % state.quickResults.length };
  }),
  recordOpen: (path) => set((state) => {
    const recentPaths = [path, ...state.recentPaths.filter((recent) => recent !== path)].slice(0, MAX_RECENT_PATHS);
    saveRecentPaths(recentPaths);
    return { recentPaths };
  }),
  reset: () => {
    searchGeneration += 1;
    quickGeneration += 1;
    quickSearchClient.replace([]);
    set({ query: "", results: [], searching: false, error: undefined, quickOpen: false, quickQuery: "", quickResults: [], quickSearching: false, quickSelectedIndex: 0 });
  },
}));
