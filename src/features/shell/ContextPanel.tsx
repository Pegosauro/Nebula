import { findVaultEntry } from "../../domain/vault";
import { useVaultStore } from "../vault/vaultStore";
import { isConfiguratorPath } from "../configurator/model";
import { useMemo } from "react";
import { useSettledValue } from "../../hooks/useSettledValue";
import { useDocumentStore } from "../editor/documentStore";
import { headingEntries } from "../editor/markdownTools";
import { AlertCircle, FileText, Link2, ListTree, LoaderCircle, Network, Unlink, X } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { IconButton } from "../../components/ui/IconButton";
import { basename, withoutMarkdownExtension } from "../../domain/path";
import { useKnowledgeNavigationStore } from "../knowledge/knowledgeNavigationStore";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";

type ContextTab = "outline" | "backlinks" | "outgoing";

const tabs: Array<{ id: ContextTab; label: string; icon: typeof ListTree }> = [
  { id: "outline", label: "Indice", icon: ListTree },
  { id: "backlinks", label: "Backlink", icon: Network },
  { id: "outgoing", label: "In uscita", icon: Link2 },
];

const ConfiguratorInspector = lazy(() => import("../configurator/ConfiguratorInspector"));

function formatBytes(value?: number): string {
  if (value === undefined) return "—";
  return value < 1024 ? `${value} B` : `${(value / 1024).toFixed(1)} KB`;
}

export function ContextPanel() {
  const [activeTab, setActiveTab] = useState<ContextTab>("outline");
  const activePath = useWorkspaceStore(state => state.tabs.find(tab => tab.id === state.activeTabId)?.path);
  const selectedEntry = useVaultStore(state => activePath && state.snapshot ? findVaultEntry(state.snapshot.root, activePath) : undefined);
  const setContextPanelOpen = useWorkspaceStore((state) => state.setContextPanelOpen);
  const knowledgeStatus = useKnowledgeStore((state) => state.status);
  const progress = useKnowledgeStore((state) => state.progress);
  const total = useKnowledgeStore((state) => state.total);
  const error = useKnowledgeStore((state) => state.error);
  const knowledgeDocument = useKnowledgeStore((state) => selectedEntry ? state.documents[selectedEntry.path] : undefined);
  const content = useDocumentStore(state => activeTab === "outline" && selectedEntry ? state.sessions[selectedEntry.path]?.content ?? "" : "");
  const deferredContent = useSettledValue(content, selectedEntry?.path);
  const headings = useMemo(() => headingEntries(deferredContent), [deferredContent]);
  const activate = useKnowledgeNavigationStore((state) => state.activate);
  const choose = useKnowledgeNavigationStore((state) => state.choose);


  if (selectedEntry && isConfiguratorPath(selectedEntry.path)) return <Suspense fallback={<aside className="context-panel"/>}><ConfiguratorInspector path={selectedEntry.path}/></Suspense>;

  const renderKnowledge = () => {
    if (!selectedEntry || selectedEntry.extension !== ".md") {
      return <div className="context-empty"><Link2 size={24} /><strong>Nessun collegamento disponibile</strong><span>Apri una nota Markdown per vedere le sue relazioni.</span></div>;
    }
    if (knowledgeStatus === "indexing") {
      return <div className="context-empty"><LoaderCircle className="spin" size={24} /><strong>Indicizzazione collegamenti</strong><span>{progress} di {total} note analizzate</span></div>;
    }
    if (knowledgeStatus === "error") {
      return <div className="context-empty is-error"><AlertCircle size={24} /><strong>Indice non disponibile</strong><span>{error}</span></div>;
    }
    if (!knowledgeDocument) {
      return <div className="context-empty"><Link2 size={24} /><strong>Nessun collegamento indicizzato</strong><span>Salva la nota per aggiornare il modello della conoscenza.</span></div>;
    }

    if (activeTab === "backlinks") {
      return knowledgeDocument.incoming.length ? (
        <div className="knowledge-link-list" aria-label="Backlink">
          {knowledgeDocument.incoming.map((path) => (
            <button type="button" key={path} onClick={() => choose(path)}>
              <Network size={15} />
              <span><strong>{withoutMarkdownExtension(basename(path))}</strong><small>{withoutMarkdownExtension(path)}</small></span>
            </button>
          ))}
        </div>
      ) : <div className="context-empty"><Network size={24} /><strong>Nessun backlink</strong><span>Nessun’altra nota collega questo documento.</span></div>;
    }

    return knowledgeDocument.outgoing.length ? (
      <div className="knowledge-link-list" aria-label="Collegamenti in uscita">
        {knowledgeDocument.outgoing.map((link, index) => (
          <button type="button" key={`${link.start}:${link.target}:${index}`} className={`is-${link.status}`} onClick={() => activate(selectedEntry.path, link.target)}>
            {link.status === "resolved" ? <Link2 size={15} /> : <Unlink size={15} />}
            <span>
              <strong>{link.display}</strong>
              <small>{link.resolvedPath ? withoutMarkdownExtension(link.resolvedPath) : link.status === "ambiguous" ? `${link.candidates.length} destinazioni possibili` : "Nota non ancora creata"}</small>
            </span>
          </button>
        ))}
      </div>
    ) : <div className="context-empty"><Link2 size={24} /><strong>Nessun link in uscita</strong><span>Scrivi <code>[[Nome nota]]</code> per creare una relazione.</span></div>;
  };

  return (
    <aside className="context-panel" aria-label="Pannello contestuale">
      <div className="context-tabs" role="tablist" aria-label="Dettagli documento">
        {tabs.map(({ id, label, icon: Icon }) => {
          const count = id === "backlinks" ? knowledgeDocument?.incoming.length : id === "outgoing" ? knowledgeDocument?.outgoing.length : undefined;
          return (
            <button type="button" key={id} role="tab" aria-selected={activeTab === id} className={activeTab === id ? "is-active" : ""} onClick={() => setActiveTab(id)}>
              <Icon size={15} /><span>{label}</span>{count ? <small>{count}</small> : null}
            </button>
          );
        })}
        <IconButton label="Chiudi pannello contestuale" onClick={() => setContextPanelOpen(false)}><X size={16} /></IconButton>
      </div>

      {selectedEntry ? (
        <div className="context-content">
          <div className="context-file-heading">
            <FileText size={20} />
            <div><strong>{selectedEntry.extension === ".md" ? withoutMarkdownExtension(selectedEntry.name) : selectedEntry.name}</strong><span>{selectedEntry.extension === ".md" ? withoutMarkdownExtension(selectedEntry.path) : selectedEntry.path}</span></div>
          </div>
          {activeTab === "outline" ? (
            <div className="context-section">
              <h3>Indice della nota</h3>
              <div className="note-outline">{headings.length ? headings.map(heading => <button type="button" key={heading.from} style={{ paddingLeft: 8 + (heading.level - 1) * 12 }} onClick={() => window.dispatchEvent(new CustomEvent("nebula:heading", { detail: { path: selectedEntry.path, from: heading.from } }))}>{heading.text}</button>) : <span>Aggiungi dei titoli per navigare nella nota.</span>}</div>
              <h3>Proprietà file</h3>
              <dl>
                <div><dt>Tipo</dt><dd>{selectedEntry.extension === ".md" ? "Markdown" : selectedEntry.extension || "File"}</dd></div>
                <div><dt>Dimensione</dt><dd>{formatBytes(selectedEntry.size)}</dd></div>
                <div><dt>Modificato</dt><dd>{selectedEntry.modifiedAt ? new Date(selectedEntry.modifiedAt).toLocaleDateString("it-IT") : "—"}</dd></div>
                {knowledgeDocument ? <><div><dt>Backlink</dt><dd>{knowledgeDocument.incoming.length}</dd></div><div><dt>In uscita</dt><dd>{knowledgeDocument.outgoing.length}</dd></div></> : null}
              </dl>
            </div>
          ) : renderKnowledge()}
        </div>
      ) : (
        <div className="context-empty"><ListTree size={26} /><strong>Nessun documento selezionato</strong><span>Seleziona un file nell’Explorer per vedere i dettagli.</span></div>
      )}
    </aside>
  );
}
