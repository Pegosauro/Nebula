import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { panelArea, readPanelLayouts } from "./panelLayout";
import { useWorkspaceStore } from "./workspaceStore";
import type { VaultEntry } from "../../domain/vault";
const home = { id: "workspace-home", kind: "home" as const, title: "Inizio" };
const note: VaultEntry = { id: "A.md", path: "A.md", name: "A.md", type: "file", extension: ".md" };
const config: VaultEntry = { id: "A.config.json", path: "A.config.json", name: "A.config.json", type: "file", extension: ".json" };
const initial = useWorkspaceStore.getState();
beforeEach(() => { localStorage.clear(); useWorkspaceStore.setState({ activity: "files", panelLayouts: {}, sidebarOpen: true, contextPanelOpen: true, tabs: [home], activeTabId: home.id }); });
afterEach(() => { useWorkspaceStore.setState(initial); localStorage.clear(); vi.unstubAllGlobals(); });
describe("workspace layouts", () => {
  it("restores distinct note, search and configurator choices through settings and tab changes", () => {
    const workspace = () => useWorkspaceStore.getState();
    workspace().openEntry(note);
    workspace().setContextPanelOpen(false);
    workspace().setSidebarOpen(false);
    workspace().setActivity("search");
    expect(workspace().contextPanelOpen).toBe(true);
    workspace().setSidebarOpen(false);
    workspace().setActivity("settings");
    workspace().setActivity("files");
    expect(workspace().sidebarOpen).toBe(false);
    expect(workspace().contextPanelOpen).toBe(false);
    workspace().openEntry(config);
    expect(workspace().sidebarOpen).toBe(true);
    expect(workspace().contextPanelOpen).toBe(true);
    workspace().setContextPanelOpen(false);
    workspace().activateTab("document:A.md");
    expect(workspace().sidebarOpen).toBe(false);
    workspace().setActivity("search");
    expect(workspace().sidebarOpen).toBe(false);
    expect(workspace().contextPanelOpen).toBe(true);
    expect(readPanelLayouts()).toMatchObject({ notes: { sidebarOpen: false, contextPanelOpen: false }, search: { sidebarOpen: false, contextPanelOpen: true }, configurator: { sidebarOpen: true, contextPanelOpen: false } });
  });
  it("returns from settings to the selected note when its tab is activated", () => {
    useWorkspaceStore.getState().openEntry(note);
    useWorkspaceStore.getState().setActivity("settings");
    useWorkspaceStore.getState().activateTab("document:A.md");
    expect(useWorkspaceStore.getState().activity).toBe("files");
    expect(panelArea("files", home)).toBe("home");
    expect(panelArea("configurators", { ...home, kind: "document", path: "A.config.json" })).toBe("configurator");
  });
  it("ignores malformed persisted layouts without changing document data", () => {
    localStorage.setItem("nebula.panel-layouts.v1", JSON.stringify({ notes: { sidebarOpen: "false", contextPanelOpen: true }, graph: { sidebarOpen: true, contextPanelOpen: false }, boards: { sidebarOpen: true, contextPanelOpen: true }, search: { sidebarOpen: true, contextPanelOpen: false }, unknown: { sidebarOpen: true, contextPanelOpen: true } }));
    expect(readPanelLayouts()).toEqual({ search: { sidebarOpen: true, contextPanelOpen: false } });
    localStorage.setItem("nebula.panel-layouts.v1", "broken");
    expect(readPanelLayouts()).toEqual({});
  });
  it("keeps overlays closed when navigating to a new area on a narrow screen", () => {
    vi.stubGlobal("innerWidth", 390);
    useWorkspaceStore.getState().setActivity("search");
    expect(useWorkspaceStore.getState().sidebarOpen).toBe(false);
    expect(useWorkspaceStore.getState().contextPanelOpen).toBe(false);
  });
});
