import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { categoryTargetIds, nodeById, type Tree } from "./model";

export interface CategoryChange { ids: string[]; categoryId: string | null }
export function CategoryChangeDialog({ tree, change, onClose, onAccept }: { tree: Tree; change: CategoryChange; onClose: () => void; onAccept: (includeDescendants: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useId();
  const [includeChildren, setIncludeChildren] = useState(false);
  const targets = new Set(change.ids);
  const children = useMemo(() => {
    const selected = new Set(change.ids);
    return new Set([...categoryTargetIds(tree, change.ids)].filter(id => !selected.has(id)));
  }, [tree, change.ids]);
  const category = tree.categories.find(item => item.id === change.categoryId)?.name ?? "Nessuna";
  useEffect(() => { const dialog = ref.current; dialog?.showModal?.(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className="editor-dialog tree-dialog" aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}>
    <div className="editor-dialog-inner">
      <header><h2 id={title}>Conferma cambio categoria</h2><button type="button" aria-label="Chiudi" onClick={onClose}><X size={16} /></button></header>
      <div className="tree-dialog-body">
        <p>Applicare «{category}» {change.ids.length === 1 ? `al nodo ${nodeById(tree, change.ids[0]!)?.code}` : `ai ${change.ids.length} nodi selezionati`}?</p>
        {children.size > 0 && <label className="tree-check-row"><input type="checkbox" checked={includeChildren} onChange={event => setIncludeChildren(event.target.checked)} />Applica anche ai {children.size} nodi discendenti</label>}
        <p className="tree-muted">Verranno modificati {targets.size + (includeChildren ? children.size : 0)} nodi. {children.size > 0 && !includeChildren && "I discendenti conservano la propria categoria."}</p>
      </div>
      <footer><button type="button" className="button" onClick={onClose}>Annulla</button><button type="button" className="button button-primary" onClick={() => onAccept(includeChildren)}>Applica categoria</button></footer>
    </div>
  </dialog>;
}
