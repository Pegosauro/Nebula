import { useConfiguratorStore } from "../configurator/configuratorStore";
import { isConfiguratorPath } from "../configurator/model";
import { isTreePath } from "../trees/model";
import { serializeTree } from "../trees/serializeTree";
import { useTreeStore } from "../trees/treeStore";
import { FileText, GitBranch, House, ListTree, X } from "lucide-react";
import { useState } from "react";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useDocumentStore } from "../editor/documentStore";
import { CloseNotesDialog } from "./CloseNotesDialog";

function TabDirtyState({ path }: { path: string }) {
  const dirty = useDocumentStore((state) => {
    const session = state.sessions[path];
    return Boolean(session && session.content !== session.savedContent);
  });
  const configDirty = useConfiguratorStore(state=>{const s=state.sessions[path];return Boolean(s && JSON.stringify(s.data)!==s.saved);});
  const treeDirty = useTreeStore(state => { const session = state.sessions[path]; return Boolean(session && (session.conflict || serializeTree(session.data) !== session.saved)); });
  return dirty || configDirty || treeDirty ? <span className="tab-dirty" aria-label="Modifiche non salvate" /> : null;
}

export function TabBar() {
  const tabs = useWorkspaceStore((state) => state.tabs);
  const activeTabId = useWorkspaceStore((state) => state.activeTabId);
  const activateTab = useWorkspaceStore((state) => state.activateTab);
  const closeTab = useWorkspaceStore((state) => state.closeTab);
  const [confirmClose, setConfirmClose] = useState(false);
  const noteCount = tabs.filter(tab => tab.kind === "document").length;

  return (
    <>
    <div className="tab-bar" role="tablist" aria-label="Documenti aperti">
      <div className="tab-scroll">
        {tabs.map((tab) => {
          const active = activeTabId === tab.id;
          return (
            <div className={`document-tab ${active ? "is-active" : ""}`} key={tab.id}>
              <button
                type="button"
                className="tab-main"
                role="tab"
                aria-selected={active}
                onClick={() => activateTab(tab.id)}
              >
                {tab.kind === "home" ? <House size={15} /> : tab.path && isConfiguratorPath(tab.path) ? <GitBranch size={15}/> : tab.path && isTreePath(tab.path) ? <ListTree size={15} /> : <FileText size={15} />}
                <span>{tab.title}</span>
                {tab.path ? <TabDirtyState path={tab.path} /> : null}
              </button>
              {tab.kind !== "home" ? (
                <button
                  type="button"
                  className="tab-close"
                  aria-label={`Chiudi ${tab.title}`}
                  onClick={() => { if(tab.path && isConfiguratorPath(tab.path)) void useConfiguratorStore.getState().flush(tab.path).then(saved=>{if(saved)closeTab(tab.id);}); else if (tab.path && isTreePath(tab.path)) void useTreeStore.getState().flush(tab.path).then(saved => { if (saved) closeTab(tab.id); }); else closeTab(tab.id); }}
                >
                  <X size={14} />
                </button>
              ) : noteCount > 1 ? (
                <button
                  type="button"
                  className="tab-close tab-close-all"
                  aria-label="Chiudi tutte le note"
                  title="Chiudi tutte le note"
                  onClick={() => setConfirmClose(true)}
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
    {confirmClose && <CloseNotesDialog count={noteCount} onClose={() => setConfirmClose(false)} />}
    </>
  );
}
