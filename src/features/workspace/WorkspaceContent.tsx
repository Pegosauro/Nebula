import { isConfiguratorPath } from "../configurator/model";
import { isTreePath } from "../trees/model";
import { lazy, Suspense } from "react";
import { Clock3 } from "lucide-react";
import { EditorErrorBoundary } from "../editor/EditorErrorBoundary";
import { loadMarkdownEditor } from "../editor/loadEditor";
import { useVaultStore } from "../vault/vaultStore";
import { WelcomeView } from "../vault/WelcomeView";
import { DocumentPlaceholder } from "./DocumentPlaceholder";
import { VaultHome } from "./VaultHome";
import { useWorkspaceStore } from "./workspaceStore";

const ConfiguratorView = lazy(() => import("../configurator/ConfiguratorView"));
const ConfiguratorLibrary = lazy(() => import("../configurator/ConfiguratorLibrary"));
const TreeView = lazy(() => import("../trees/TreeView"));
const TreeLibrary = lazy(() => import("../trees/TreeLibrary"));
const SettingsView = lazy(() => import("../settings/SettingsView").then(module => ({ default: module.SettingsView })));

const MarkdownEditorView = lazy(loadMarkdownEditor);

const futureViews = {
  recent: { icon: Clock3, title: "Vault recenti", copy: "Seleziona dal pannello laterale una cartella già collegata per riaprirla senza usare nuovamente il selettore." },
} as const;

export function WorkspaceContent() {
  const status = useVaultStore((state) => state.status);
  const activity = useWorkspaceStore((state) => state.activity);
  const activeTabId = useWorkspaceStore((state) => state.activeTabId);
  const activeTab = useWorkspaceStore((state) => state.tabs.find((tab) => tab.id === activeTabId));

  if (activity === "settings") return <Suspense fallback={<div className="editor-loading">Caricamento impostazioni…</div>}><SettingsView /></Suspense>;
  if (status !== "ready") return <WelcomeView />;
  if ((activity === "files" || activity === "search" || activity === "structures") && activeTab?.path && isTreePath(activeTab.path)) return <Suspense fallback={<div className="editor-loading">Caricamento struttura…</div>}><TreeView key={activeTab.path} path={activeTab.path} /></Suspense>;
  if ((activity === "files" || activity === "search" || activity === "configurators") && activeTab?.path && isConfiguratorPath(activeTab.path)) return <Suspense fallback={<div className="editor-loading">Caricamento configuratore…</div>}><ConfiguratorView key={activeTab.path} path={activeTab.path}/></Suspense>;
  if (activity === "structures") return <Suspense fallback={<div className="editor-loading">Caricamento…</div>}><TreeLibrary /></Suspense>;
  if (activity === "configurators") return <Suspense fallback={<div className="editor-loading">Caricamento…</div>}><ConfiguratorLibrary/></Suspense>;
  if (activity !== "files" && activity !== "search") {
    const view = futureViews[activity];
    const Icon = view.icon;
    return (
      <div className="feature-placeholder">
        <Icon size={32} />
        <h1>{view.title}</h1>
        <p>{view.copy}</p>
        <span>Modulo predisposto · roadmap successiva</span>
      </div>
    );
  }

  if (activeTab?.kind === "document" && activeTab.extension === ".md") {
    return (
      <EditorErrorBoundary key={activeTab.id}>
        <Suspense fallback={<div className="editor-loading"><span>Caricamento editor…</span></div>}>
          <MarkdownEditorView />
        </Suspense>
      </EditorErrorBoundary>
    );
  }
  if (activeTab?.kind === "document") return <DocumentPlaceholder />;
  return <VaultHome />;
}
