import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, X } from "lucide-react";
import type { Tree } from "./model";
import { planDuplicate, type DuplicatePlan } from "./duplicateNodes";

export function DuplicateDialog({ tree, nodeId, onClose, onDuplicate }: { tree: Tree; nodeId: string; onClose: () => void; onDuplicate: (plan: DuplicatePlan) => string | undefined }) {
  const ref = useRef<HTMLDialogElement>(null);
  const source = tree.nodes.find(node => node.id === nodeId);
  const hasChildren = tree.nodes.some(node => node.parentId === nodeId);
  const [parentId, setParentId] = useState(source?.parentId ?? tree.rootId);
  const [includeChildren, setIncludeChildren] = useState(hasChildren);
  const [error, setError] = useState<string>();
  const plan = useMemo(() => planDuplicate(tree, nodeId, parentId, includeChildren), [tree, nodeId, parentId, includeChildren]);
  useEffect(() => {
    const dialog = ref.current; dialog?.showModal?.();
    return () => {
      if (!dialog?.open) return;
      dialog.addEventListener("close", event => event.stopImmediatePropagation(), { capture: true, once: true });
      dialog.close();
    };
  }, []);
  if (!source) return null;
  const copyIds = new Set(plan.rows.map(row => row.id));
  const copyNodes = plan.tree?.nodes.filter(node => copyIds.has(node.id)) ?? [];
  return <dialog ref={ref} className="editor-dialog tree-dialog tree-import-dialog" aria-label={`Duplica ${source.code}`} onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}>
    <div className="editor-dialog-inner">
      <header><div><h2>Duplica {source.code} · {source.name}</h2><p>La copia conserva nome, categoria, note, tabelle e caratteristiche. Potrai modificarla indipendentemente dall’originale.</p></div><button type="button" aria-label="Chiudi" onClick={onClose}><X size={16} /></button></header>
      <div className="tree-dialog-body">
        <label>Padre di destinazione<select aria-label="Padre della copia" value={parentId} onChange={event => { setParentId(event.target.value); setError(undefined); }}>{tree.nodes.map(node => <option key={node.id} value={node.id}>{node.code} · {node.name}</option>)}</select></label>
        <label className="tree-check-row"><input type="checkbox" checked={includeChildren} disabled={!hasChildren} onChange={event => { setIncludeChildren(event.target.checked); setError(undefined); }} />Includi tutti i nodi figli</label>
        <p className="tree-muted">{parentId === source.parentId ? `La copia verrà inserita subito dopo ${source.code}.` : "La copia verrà inserita in coda ai figli del padre scelto."}</p>
        {plan.errors.map(message => <p key={message} className="config-error" role="alert">{message}</p>)}
        {plan.tree && <>
          <p role="status">{plan.rows.length} {plan.rows.length === 1 ? "nodo da copiare" : "nodi da copiare"} · {copyNodes.filter(node => node.note.trim()).length} con note · {copyNodes.reduce((count, node) => count + node.objects.length, 0)} oggetti</p>
          <div className="tree-import-preview"><table><caption>Anteprima dei nuovi codici</caption><thead><tr><th>Codice originale</th><th>Codice della copia</th><th>Nome</th></tr></thead><tbody>{plan.rows.map(row => <tr key={row.id}><td>{row.oldCode}</td><td>{row.code}</td><td style={{ paddingLeft: 8 + row.depth * 12 }}>{row.name}</td></tr>)}</tbody></table></div>
          <p className="tree-muted">I codici già presenti restano invariati. Puoi annullare l’intera duplicazione con un solo comando.</p>
        </>}
        {error && <p className="config-error" role="alert">{error}</p>}
      </div>
      <footer><button type="button" className="button" onClick={onClose}>Annulla</button><button type="button" className="button button-primary" disabled={!plan.tree} onClick={() => { const failure = onDuplicate(plan); if (failure) setError(failure); }}><Copy size={15} />Conferma duplicazione</button></footer>
    </div>
  </dialog>;
}
