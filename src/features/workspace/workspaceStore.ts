import { configTitle, isConfiguratorPath } from "../configurator/model";
import { create } from "zustand";
import { panelArea, readPanelLayouts, savePanelLayouts, type PanelLayouts } from "./panelLayout";
import { basename, isPathInside, withoutMarkdownExtension } from "../../domain/path";
import { findVaultEntry, type VaultEntry, type VaultSnapshot } from "../../domain/vault";
import { useSearchStore } from "../search/searchStore";
import { useDocumentStore } from "../editor/documentStore";
import { loadMarkdownEditor } from "../editor/loadEditor";

export type ActivitySection = "files" | "configurators" | "search" | "recent" | "settings";

export interface WorkspaceTab {
  id: string;
  kind: "home" | "document";
  title: string;
  path?: string;
  extension?: string;
  newlyCreated?: boolean;
}

interface WorkspaceState {
  activity: ActivitySection;
  panelLayouts: PanelLayouts;
  sidebarOpen: boolean;
  contextPanelOpen: boolean;
  tabs: WorkspaceTab[];
  activeTabId: string;
  selectedEntry?: VaultEntry;
  setActivity: (activity: ActivitySection) => void;
  toggleSidebar: () => void;
  toggleContextPanel: () => void;
  setSidebarOpen: (open: boolean) => void;
  setContextPanelOpen: (open: boolean) => void;
  openEntry: (entry: VaultEntry, preserveActivity?: boolean, newlyCreated?: boolean) => void;
  markCreationHandled: (id: string) => void;
  selectEntry: (entry: VaultEntry) => void;
  remapEntryPaths: (oldPath: string, newPath: string, snapshot: VaultSnapshot) => void;
  removeEntryPaths: (path: string) => void;
  activateTab: (id: string) => void;
  closeTab: (id: string) => void;
  resetDocuments: () => void;
}

const homeTab: WorkspaceTab = {
  id: "workspace-home",
  kind: "home",
  title: "Inizio",
};

function readInitialPanelState(): { sidebarOpen: boolean; contextPanelOpen: boolean } {
  if (typeof window === "undefined" || window.innerWidth <= 900) {
    return { sidebarOpen: false, contextPanelOpen: false };
  }

  try {
    const raw = localStorage.getItem("nebula.settings.v1");
    const settings = raw ? JSON.parse(raw)?.state : undefined;
    return {
      sidebarOpen: settings?.showSidebarByDefault !== false,
      contextPanelOpen: settings?.showContextPanelByDefault !== false,
    };
  } catch {
    return { sidebarOpen: true, contextPanelOpen: true };
  }
}

const initialPanels = readInitialPanelState();
const initialLayouts = readPanelLayouts();
const isNarrow = () => typeof window === "undefined" || window.innerWidth <= 900;
function movePanels(state: WorkspaceState, next: Partial<WorkspaceState>) {
  const area = panelArea(next.activity ?? state.activity, (next.tabs ?? state.tabs).find(tab => tab.id === (next.activeTabId ?? state.activeTabId)));
  const current = panelArea(state.activity, state.tabs.find(tab => tab.id === state.activeTabId));
  if (area === current) return next;
  const layout = state.panelLayouts[area] ?? readInitialPanelState();
  return { ...next, ...(isNarrow() ? { sidebarOpen: false, contextPanelOpen: false } : layout) };
}
function changePanels(state: WorkspaceState, next: Partial<{ sidebarOpen: boolean; contextPanelOpen: boolean }>) {
  const area = panelArea(state.activity, state.tabs.find(tab => tab.id === state.activeTabId));
  const panelLayouts = { ...state.panelLayouts, [area]: { sidebarOpen: state.sidebarOpen, contextPanelOpen: state.contextPanelOpen, ...next } };
  savePanelLayouts(panelLayouts);
  return { ...next, panelLayouts };
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  activity: "files",
  panelLayouts: initialLayouts,
  sidebarOpen: isNarrow() ? false : initialLayouts.home?.sidebarOpen ?? initialPanels.sidebarOpen,
  contextPanelOpen: isNarrow() ? false : initialLayouts.home?.contextPanelOpen ?? initialPanels.contextPanelOpen,
  tabs: [homeTab],
  activeTabId: homeTab.id,
  setActivity: (activity) => set(state => movePanels(state, { activity })),
  toggleSidebar: () => set(state => changePanels(state, { sidebarOpen: !state.sidebarOpen })),
  toggleContextPanel: () => set(state => changePanels(state, { contextPanelOpen: !state.contextPanelOpen })),
  setSidebarOpen: sidebarOpen => set(state => changePanels(state, { sidebarOpen })),
  setContextPanelOpen: contextPanelOpen => set(state => changePanels(state, { contextPanelOpen })),
  openEntry: (entry, preserveActivity = false, newlyCreated = false) => {
    if (entry.type !== "file") return;
    if (entry.extension === ".md") {
      // Start disk I/O and the editor import together, before the first render.
      void useDocumentStore.getState().open(entry.path);
      void loadMarkdownEditor().catch(() => undefined);
    }
    useSearchStore.getState().recordOpen(entry.path);
    const id = `document:${entry.path}`;
    set((state) => {
      const exists = state.tabs.some((tab) => tab.id === id);
      return movePanels(state, {
        activity: preserveActivity ? state.activity : "files",
        tabs: exists
          ? state.tabs
          : [
              ...state.tabs,
              {
                id,
                kind: "document",
                title: isConfiguratorPath(entry.path) ? configTitle(entry.name) : entry.extension === ".md" ? withoutMarkdownExtension(entry.name) : entry.name,
                path: entry.path,
                extension: entry.extension,
                newlyCreated,
              },
            ],
        activeTabId: id,
        selectedEntry: entry,
      });
    });
  },
  markCreationHandled: (id) => set((state) => ({
    tabs: state.tabs.map((tab) => tab.id === id && tab.newlyCreated ? { ...tab, newlyCreated: false } : tab),
  })),
  selectEntry: (selectedEntry) => set({ selectedEntry }),
  remapEntryPaths: (oldPath, newPath, snapshot) =>
    set((state) => {
      const remap = (path?: string) => {
        if (!path || !isPathInside(path, oldPath)) return path;
        return `${newPath}${path.slice(oldPath.length)}`;
      };
      const tabs = state.tabs.map((tab) => {
        const path = remap(tab.path);
        if (!path || path === tab.path) return tab;
        return { ...tab, id: `document:${path}`, path, title: isConfiguratorPath(path) ? configTitle(basename(path)) : tab.extension === ".md" ? withoutMarkdownExtension(basename(path)) : basename(path) };
      });
      const activeTab = state.tabs.find((tab) => tab.id === state.activeTabId);
      const activePath = remap(activeTab?.path);
      const selectedPath = remap(state.selectedEntry?.path);
      return {
        tabs,
        activeTabId: activePath ? `document:${activePath}` : state.activeTabId,
        selectedEntry: selectedPath ? findVaultEntry(snapshot.root, selectedPath) : state.selectedEntry,
      };
    }),
  removeEntryPaths: (path) =>
    set((state) => {
      const removedIds = new Set(
        state.tabs.filter((tab) => tab.path && isPathInside(tab.path, path)).map((tab) => tab.id),
      );
      const tabs = state.tabs.filter((tab) => !removedIds.has(tab.id));
      const activeWasRemoved = removedIds.has(state.activeTabId);
      return {
        tabs,
        activeTabId: activeWasRemoved ? homeTab.id : state.activeTabId,
        selectedEntry: state.selectedEntry && isPathInside(state.selectedEntry.path, path)
          ? undefined
          : state.selectedEntry,
      };
    }),
  activateTab: activeTabId => set(state => movePanels(state, { activeTabId, activity: state.activity === "settings" || state.activity === "configurators" && state.tabs.find(t => t.id === activeTabId)?.extension === ".md" ? "files" : state.activity })),
  closeTab: (id) =>
    set((state) => {
      const index = state.tabs.findIndex((tab) => tab.id === id);
      if (index === -1 || state.tabs[index]?.kind === "home") return state;
      const tabs = state.tabs.filter((tab) => tab.id !== id);
      const fallback = tabs[Math.max(0, index - 1)] ?? homeTab;
      const isActive = state.activeTabId === id;
      return movePanels(state, {
        tabs,
        activeTabId: isActive ? fallback.id : state.activeTabId,
        selectedEntry: isActive ? undefined : state.selectedEntry,
      });
    }),
  resetDocuments: () => set(state => movePanels(state, { tabs: [homeTab], activeTabId: homeTab.id, selectedEntry: undefined })),
}));
