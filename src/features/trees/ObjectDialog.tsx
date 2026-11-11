import { useEffect, useId, useRef, useState } from "react";
import { Diamond, Table2, X } from "lucide-react";
import { objectIssues, type CharacteristicKind, type ObjectDraft, type TreeNode } from "./model";

interface ObjectDialogProps {
  node: TreeNode;
  draft: ObjectDraft;
  onClose: () => void;
  onSubmit: (draft: ObjectDraft) => void;
}

export function ObjectDialog({ node, draft, onClose, onSubmit }: ObjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const editing = Boolean(draft.id);
  const [current, setCurrent] = useState<ObjectDraft>(draft);
  const [tried, setTried] = useState(false);
  const errors = objectIssues(node, current, current.id);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (typeof dialog?.showModal === "function") dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, []);
  const chooseType = (type: ObjectDraft["type"]) => {
    if (editing) return;
    setCurrent(type === "externalTable"
      ? { type, tableName: current.type === "externalTable" ? current.tableName : "" }
      : { type, kind: current.type === "characteristic" ? current.kind : "own", code: current.type === "characteristic" ? current.code : "", description: current.type === "characteristic" ? current.description : "" });
  };
  return (
    <dialog ref={dialogRef} className="editor-dialog tree-dialog" aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}>
      <div className="editor-dialog-inner">
        <header>
          <h2 id={titleId}>{editing ? "Modifica oggetto" : "Aggiungi oggetto"}</h2>
          <button type="button" aria-label="Chiudi" onClick={onClose}><X size={16} /></button>
        </header>
        <form className="tree-dialog-body" onSubmit={event => { event.preventDefault(); setTried(true); if (!errors.length) onSubmit(current); }}>
          <p className="tree-muted">Nodo {node.code}. La sigla è unica fra tutte le caratteristiche del nodo.</p>
          <div className="tree-tabs" role="tablist" aria-label="Tipo di oggetto">
            <button type="button" role="tab" aria-selected={current.type === "externalTable"} disabled={editing && current.type !== "externalTable"} onClick={() => chooseType("externalTable")}><Table2 size={16} />Tabella esterna</button>
            <button type="button" role="tab" aria-selected={current.type === "characteristic"} disabled={editing && current.type !== "characteristic"} onClick={() => chooseType("characteristic")}><Diamond size={16} />Caratteristica</button>
          </div>
          {current.type === "externalTable" ? (
            <label>Nome tabella
              <input aria-label="Nome tabella" autoFocus required value={current.tableName} onChange={event => setCurrent({ type: "externalTable", id: current.id, tableName: event.target.value })} placeholder="Es. TE_LIMITI_CHIUSURE" />
            </label>
          ) : (
            <>
              <div className="tree-kind" role="radiogroup" aria-label="Tipo di caratteristica">
                {(["own", "acquired"] as CharacteristicKind[]).map(kind => (
                  <label key={kind} className={current.kind === kind ? "is-selected" : ""}>
                    <input type="radio" name="kind" value={kind} checked={current.kind === kind} onChange={() => setCurrent({ ...current, kind })} />
                    <Diamond size={15} className={kind === "own" ? "tree-obj-icon is-own" : "tree-obj-icon is-acquired"} fill={kind === "own" ? "currentColor" : "none"} />
                    {kind === "own" ? "Propria" : "Acquisita"}
                  </label>
                ))}
              </div>
              <label>Sigla
                <input aria-label="Sigla" autoFocus required value={current.code} onChange={event => setCurrent({ ...current, code: event.target.value })} placeholder="Es. P" maxLength={40} />
              </label>
              <label>Descrizione
                <input aria-label="Descrizione" required value={current.description} onChange={event => setCurrent({ ...current, description: event.target.value })} placeholder="Es. Profondità" />
              </label>
            </>
          )}
          <p className="tree-muted">Testo libero: nessun suggerimento e nessun contenuto collegato.</p>
          {tried && errors.map(error => <p role="alert" className="config-error" key={error}>{error}</p>)}
          <footer>
            <button type="button" className="button" onClick={onClose}>Annulla</button>
            <button type="submit" className="button button-primary">{editing ? "Salva oggetto" : current.type === "externalTable" ? "Aggiungi tabella" : "Aggiungi caratteristica"}</button>
          </footer>
        </form>
      </div>
    </dialog>
  );
}
