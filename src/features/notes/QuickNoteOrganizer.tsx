import { useMemo, useState } from "react";
import { FilePlus2, ListChecks } from "lucide-react";
import { useVaultStore } from "../vault/vaultStore";
import { VaultOperationDialog, type VaultOperationRequest } from "../explorer/VaultOperationDialog";
import { quickNoteCaptures } from "./quickNoteConversion";
import { useSettledValue } from "../../hooks/useSettledValue";

export function QuickNoteOrganizer({ content, disabled, onCompleted }: { content: string; disabled?: boolean; onCompleted: (message: string) => void }) {
  const snapshot = useVaultStore(state => state.snapshot);
  const settled = useSettledValue(content, "quick-notes");
  const captures = useMemo(() => quickNoteCaptures(settled), [settled]);
  const [expanded, setExpanded] = useState(false);
  const [request, setRequest] = useState<VaultOperationRequest>();
  return <details className="quick-note-organizer" onToggle={event => setExpanded(event.currentTarget.open)}>
    <summary>Organizza appunti <span>{captures.length}</span></summary>
    {expanded && <div className="quick-note-captures">
      <p className="template-hint">Crea una nota autonoma o una procedura. L’appunto originale resta nel foglio.</p>
      {!captures.length && <p className="template-hint">Gli appunti con data e ora compariranno qui.</p>}
      {captures.map(capture => <article className="quick-note-capture" key={capture.id}>
        <time>{capture.timestamp}</time><pre>{capture.text}</pre>
        <div className="quick-note-capture-actions">
          <button type="button" className="button button-secondary" disabled={disabled || !snapshot || content !== settled} onClick={() => setRequest({ type: "create-note", parentPath: "", quickNote: capture })}><FilePlus2 size={16} />Crea nota</button>
          <button type="button" className="button button-secondary" disabled={disabled || !snapshot || content !== settled} onClick={() => setRequest({ type: "create-note", parentPath: "", quickNote: capture, initialTemplateId: "procedure" })}><ListChecks size={16} />Crea procedura</button>
        </div>
      </article>)}
    </div>}
    {request && snapshot && <VaultOperationDialog request={request} snapshot={snapshot} onClose={() => setRequest(undefined)} onCompleted={onCompleted} />}
  </details>;
}
