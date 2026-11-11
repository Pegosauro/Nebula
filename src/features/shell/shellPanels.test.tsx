import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { useShellPanels } from "./useShellPanels";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useVaultStore } from "../vault/vaultStore";
import { ActivityRail } from "./ActivityRail";
import { AppHeader } from "./AppHeader";
import { ContextPanelOpener } from "./ContextPanelOpener";
let cleanup: (() => Promise<void>) | undefined;
const original = useWorkspaceStore.getState();
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { await cleanup?.(); cleanup = undefined; useWorkspaceStore.setState(original); useVaultStore.setState({ status: "idle", snapshot: undefined }); });
async function mount(element: React.ReactNode) {
  const host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  cleanup = async () => { await act(async () => root.unmount()); host.remove(); };
  await act(async () => root.render(element)); return host;
}
function Probe() { const panels = useShellPanels(); return <output>{JSON.stringify(panels)}</output>; }
describe("contextual shell", () => {
  it("suppresses empty panels on the welcome page and restores note details only for an active document", async () => {
    useWorkspaceStore.setState({ activity: "files", sidebarOpen: true, contextPanelOpen: true, activeTabId: "workspace-home", tabs: [{ id: "workspace-home", kind: "home", title: "Inizio" }] });
    const host = await mount(<Probe />);
    expect(JSON.parse(host.textContent!)).toMatchObject({ showSidebar: false, showContext: false });
    await act(async () => useVaultStore.setState({ status: "ready" }));
    expect(JSON.parse(host.textContent!)).toMatchObject({ showSidebar: true, showContext: false });
    await act(async () => useWorkspaceStore.getState().openEntry({ id: "A.md", name: "A.md", path: "A.md", type: "file", extension: ".md" }));
    expect(JSON.parse(host.textContent!)).toMatchObject({ showContext: true });
    await act(async () => useWorkspaceStore.getState().activateTab("workspace-home"));
    expect(JSON.parse(host.textContent!)).toMatchObject({ showContext: false });
  });
  it("never renders document panels over settings or the configurator library", async () => {
    useVaultStore.setState({ status: "ready" });
    useWorkspaceStore.setState({ activity: "settings", sidebarOpen: true, contextPanelOpen: true });
    const host = await mount(<Probe />);
    expect(JSON.parse(host.textContent!)).toMatchObject({ showSidebar: false, showContext: false });
    await act(async () => useWorkspaceStore.setState({ activity: "configurators", activeTabId: "workspace-home", tabs: [{ id: "workspace-home", kind: "home", title: "Inizio" }] }));
    expect(JSON.parse(host.textContent!)).toMatchObject({ showSidebar: true, showContext: false });
  });
  it("exposes all navigation destinations and an expansion control", async () => {
    const host = await mount(<ActivityRail />);
    for (const label of ["File", "Cerca", "Strutture", "Configuratori", "Recenti", "Impostazioni"]) expect(host.querySelector(`button[aria-label="${label}"]`)).not.toBeNull();
    for (const label of ["Grafo", "Lavagne"]) expect(host.querySelector(`button[aria-label="${label}"]`)).toBeNull();
    expect(host.querySelector('.rail-expand')).not.toBeNull();
  });
  it("reopens document details from the edge and keeps the header free of panel toggles", async () => {
    useVaultStore.setState({ status: "ready" });
    useWorkspaceStore.setState({ activity: "files", sidebarOpen: false, contextPanelOpen: false, activeTabId: "A.md", tabs: [{ id: "A.md", kind: "document", title: "A", path: "A.md" }] });
    const host = await mount(<><AppHeader /><ContextPanelOpener /><ActivityRail /></>);
    expect(host.querySelectorAll(".header-actions button")).toHaveLength(3);
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Apri pannello destro"]')!.click());
    expect(useWorkspaceStore.getState().contextPanelOpen).toBe(true);
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="File"]')!.click());
    expect(useWorkspaceStore.getState().sidebarOpen).toBe(true);
    await act(async () => useWorkspaceStore.setState({ activity: "settings" }));
    expect(host.querySelector(".context-edge-opener")).toBeNull();
  });
});
