import { FileText, LockKeyhole } from "lucide-react";
import { useWorkspaceStore } from "./workspaceStore";

function formatBytes(value?: number): string {
  if (value === undefined) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentPlaceholder() {
  const activeTabId = useWorkspaceStore((state) => state.activeTabId);
  const tab = useWorkspaceStore((state) => state.tabs.find((item) => item.id === activeTabId));
  const entry = useWorkspaceStore((state) => state.selectedEntry);
  if (!tab || tab.kind !== "document") return null;

  return (
    <div className="document-placeholder">
      <div className="document-breadcrumb">{tab.path}</div>
      <div className="document-heading">
        <FileText size={24} />
        <div>
          <h1>{tab.title}</h1>
          <span>{tab.extension === ".md" ? "Nota Markdown" : "Allegato"}</span>
        </div>
      </div>
      <div className="safe-placeholder">
        <LockKeyhole size={22} />
        <div>
          <strong>Anteprima non disponibile</strong>
          <p>
            Il file è conservato nel Vault. Per modificarlo, usa un’applicazione compatibile.
          </p>
        </div>
      </div>
      <dl className="file-facts">
        <div><dt>Percorso</dt><dd>{tab.path}</dd></div>
        <div><dt>Dimensione</dt><dd>{formatBytes(entry?.size)}</dd></div>
        <div><dt>Ultima modifica</dt><dd>{entry?.modifiedAt ? new Date(entry.modifiedAt).toLocaleString("it-IT") : "—"}</dd></div>
      </dl>
    </div>
  );
}
