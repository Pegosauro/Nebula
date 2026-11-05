import { ContextPanelOpener } from "./ContextPanelOpener";
import { useShellPanels } from "./useShellPanels";
import { useSettingsStore } from "../settings/settingsStore";
import { ActivityPanel } from "./ActivityPanel";
import { ActivityRail } from "./ActivityRail";
import { AppHeader } from "./AppHeader";
import { ContextPanel } from "./ContextPanel";
import { StatusBar } from "./StatusBar";
import { UpdateBanner } from "./UpdateBanner";
import { WorkspaceContent } from "../workspace/WorkspaceContent";
import { KnowledgeNavigationDialog } from "../knowledge/KnowledgeNavigationDialog";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { QuickSwitcher } from "../search/QuickSwitcher";

export function AppShell() {
  const { showSidebar, showContext } = useShellPanels();
  const navigationExpanded = useSettingsStore(state => state.navigationExpanded);
  const setSidebarOpen = useWorkspaceStore((state) => state.setSidebarOpen);
  const setContextPanelOpen = useWorkspaceStore((state) => state.setContextPanelOpen);


  return (
    <div className={`app-shell ${navigationExpanded ? "has-expanded-navigation" : ""} ${showSidebar ? "has-sidebar" : ""} ${showContext ? "has-context" : ""}`}>
      <AppHeader />
      <div className="shell-main">
        <ActivityRail />
        {showSidebar ? <ActivityPanel /> : null}
        <main className="workspace" aria-label="Area di lavoro">
          <WorkspaceContent />
        </main>
        {showContext ? <ContextPanel /> : <ContextPanelOpener />}
        {showSidebar ? (
          <button className="panel-scrim sidebar-scrim" type="button" aria-label="Chiudi pannello sinistro" onClick={() => setSidebarOpen(false)} />
        ) : null}
        {showContext ? (
          <button className="panel-scrim context-scrim" type="button" aria-label="Chiudi pannello destro" onClick={() => setContextPanelOpen(false)} />
        ) : null}
      </div>
      <StatusBar />
      <UpdateBanner />
      <KnowledgeNavigationDialog />
      <QuickSwitcher />
    </div>
  );
}
