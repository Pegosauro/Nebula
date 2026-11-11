import { lazy, Suspense } from "react";
import { PanelHeader } from "../../components/ui/PanelHeader";
import { ExplorerPanel } from "../explorer/ExplorerPanel";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { RecentVaultList } from "../vault/RecentVaultList";
import { SearchPanel } from "../search/SearchPanel";

const ConfiguratorPanel = lazy(() => import("../configurator/ConfiguratorLibrary").then(module=>({default:module.ConfiguratorPanel})));
const TreePanel = lazy(() => import("../trees/TreeLibrary").then(module => ({ default: module.TreePanel })));

export function ActivityPanel() {
  const activity = useWorkspaceStore((state) => state.activity);
  if (activity === "structures") return <Suspense fallback={<section className="side-panel"><div className="panel-empty">Caricamento strutture…</div></section>}><TreePanel /></Suspense>;
  if (activity === "configurators") return <Suspense fallback={<section className="side-panel"><div className="panel-empty">Caricamento configuratori…</div></section>}><ConfiguratorPanel /></Suspense>;
  if (activity === "files") return <ExplorerPanel />;
  if (activity === "search") return <SearchPanel />;
  if (activity === "settings") return null;
  if (activity === "recent") {
    return (
      <section className="side-panel" aria-label="Vault recenti">
        <PanelHeader title="Vault recenti" />
        <RecentVaultList compact />
      </section>
    );
  }

  return null;
}
