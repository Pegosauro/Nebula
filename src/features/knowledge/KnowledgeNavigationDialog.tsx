import { useEffect, useRef } from "react";
import { FilePlus2, FileText, LoaderCircle, Network, X } from "lucide-react";
import { IconButton } from "../../components/ui/IconButton";
import { basename, withoutMarkdownExtension } from "../../domain/path";
import { useKnowledgeNavigationStore } from "./knowledgeNavigationStore";

export function KnowledgeNavigationDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pending = useKnowledgeNavigationStore((state) => state.pending);
  const busy = useKnowledgeNavigationStore((state) => state.busy);
  const error = useKnowledgeNavigationStore((state) => state.error);
  const choose = useKnowledgeNavigationStore((state) => state.choose);
  const create = useKnowledgeNavigationStore((state) => state.create);
  const cancel = useKnowledgeNavigationStore((state) => state.cancel);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (pending && !dialog.open) dialog.showModal();
    if (!pending && dialog.open) dialog.close();
  }, [pending]);

  if (!pending) return null;
  const ambiguous = pending.reference.status === "ambiguous";
  const nested = pending.target.includes("/");

  return (
    <dialog ref={dialogRef} className="vault-dialog knowledge-dialog" onCancel={(event) => { event.preventDefault(); cancel(); }}>
      <div className="vault-dialog-header">
        <span className="vault-dialog-icon">{ambiguous ? <Network size={18} /> : <FilePlus2 size={18} />}</span>
        <div>
          <h2>{ambiguous ? "Scegli la nota" : "Crea nota dal collegamento"}</h2>
          <span>[[{pending.target}]]</span>
        </div>
        <IconButton label="Chiudi" onClick={cancel}><X size={17} /></IconButton>
      </div>

      <div className="vault-dialog-body">
        {ambiguous ? (
          <>
            <p className="knowledge-dialog-copy">Più note corrispondono a questo collegamento. Nebula non ne sceglie una automaticamente.</p>
            <div className="knowledge-candidate-list">
              {pending.reference.candidates.map((path) => (
                <button type="button" key={path} onClick={() => choose(path)}>
                  <FileText size={17} />
                  <span><strong>{withoutMarkdownExtension(basename(path))}</strong><small>{withoutMarkdownExtension(path)}</small></span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="knowledge-create-copy">
            <FilePlus2 size={22} />
            <div>
              <strong>La destinazione non esiste ancora</strong>
              <p>Verrà creata la nota <code>{withoutMarkdownExtension(pending.target)}</code>{nested ? " insieme alle cartelle mancanti." : " nella radice del Vault."}</p>
            </div>
          </div>
        )}
        {error ? <p className="dialog-error" role="alert">{error}</p> : null}
      </div>

      <div className="vault-dialog-footer">
        <button className="button button-secondary" type="button" disabled={busy} onClick={cancel}>Annulla</button>
        {!ambiguous ? (
          <button className="button button-primary" type="button" disabled={busy} onClick={() => void create()}>
            {busy ? <LoaderCircle className="spin" size={15} /> : <FilePlus2 size={15} />}Crea e apri
          </button>
        ) : null}
      </div>
    </dialog>
  );
}
