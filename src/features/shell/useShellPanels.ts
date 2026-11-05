import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { isConfiguratorPath } from "../configurator/model";
export function useShellPanels() {
  const ready = useVaultStore(state => state.status === "ready");
  const activity = useWorkspaceStore(state => state.activity);
  const tab = useWorkspaceStore(state => state.tabs.find(tab => tab.id === state.activeTabId));
  const sidebarOpen = useWorkspaceStore(state => state.sidebarOpen);
  const contextOpen = useWorkspaceStore(state => state.contextPanelOpen);
  const canShowSidebar = activity !== "settings" && (ready || activity === "recent");
  const documentVisible = activity === "files" || activity === "search" || activity === "configurators" && !!tab?.path && isConfiguratorPath(tab.path);
  const canShowContext = ready && (documentVisible && tab?.kind === "document");
  return { canShowSidebar, canShowContext, showSidebar: canShowSidebar && sidebarOpen, showContext: canShowContext && contextOpen };
}
