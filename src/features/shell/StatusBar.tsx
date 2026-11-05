import { configuratorSaveStatus, saveStatusLabel, saveStatusTone } from "../workspace/saveStatus";
import { useConfiguratorStore } from "../configurator/configuratorStore";
import { useEffect, useState } from "react";
import { CloudOff, HardDrive, LoaderCircle, Network } from "lucide-react";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useDocumentStore } from "../editor/documentStore";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useDocumentStats } from "../editor/documentStats";

export function StatusBar() {
  const status = useVaultStore((state) => state.status);
  const snapshot = useVaultStore((state) => state.snapshot);
  const progress = useVaultStore((state) => state.progress);
  const [online, setOnline] = useState(() => navigator.onLine);
  const activeTabId = useWorkspaceStore((state) => state.activeTabId);
  const activePath = useWorkspaceStore((state) => state.tabs.find((tab) => tab.id === activeTabId)?.path);
  const configStatus = useConfiguratorStore(state => { const session = activePath ? state.sessions[activePath] : undefined; return session ? configuratorSaveStatus(session) : undefined; });
  const activeSession = useDocumentStore((state) => activePath ? state.sessions[activePath] : undefined);
  const knowledgeStatus = useKnowledgeStore((state) => state.status);
  const knowledgeProgress = useKnowledgeStore((state) => state.progress);
  const knowledgeTotal = useKnowledgeStore((state) => state.total);
  const linkCount = useKnowledgeStore((state) => state.linkCount);
  const counts = useDocumentStats(activePath, activeSession?.content);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const activity = useWorkspaceStore(state => state.activity);
  const documentVisible = activity === "files" || activity === "search" || activity === "configurators";
  const saveStatus = documentVisible ? configStatus ?? activeSession?.status : undefined;
  const statusLabel =
    saveStatus ? saveStatusLabel(saveStatus) : status === "scanning"
      ? `Scansione ${progress?.current ?? 0}`
      : status === "ready"
        ? "Vault locale"
        : status === "unsupported"
          ? "Browser limitato"
          : "Nessun Vault collegato";

  return (
    <footer className="status-bar">
      <div className={`status-left ${saveStatus ? `save-status is-${saveStatusTone(saveStatus)}` : ""}`} role="status" aria-live="polite">
        {status === "scanning" || saveStatus === "saving" || saveStatus === "loading" ? (
          <LoaderCircle className="spin" size={13} />
        ) : <HardDrive size={13} />}
        <span>{statusLabel}</span>
      </div>
      <div className="status-right">
        {activeSession ? <><span>{counts.words} parole</span><span>{counts.characters} caratteri</span></> : null}
        {knowledgeStatus === "indexing" ? <span className="knowledge-status"><LoaderCircle className="spin" size={11} />Link {knowledgeProgress}/{knowledgeTotal}</span> : knowledgeStatus === "ready" ? <span className="knowledge-status"><Network size={11} />{linkCount} link</span> : null}
        {snapshot ? (
          <>
            <span>{snapshot.stats.files} file</span>
            <span>{snapshot.stats.directories} cartelle</span>
            <span>{snapshot.stats.notes} note</span>
          </>
        ) : null}
        {!online ? <span className="status-connectivity" title="Connessione assente. I file del Vault restano locali."><CloudOff size={13} />Offline</span> : null}
      </div>
    </footer>
  );
}
