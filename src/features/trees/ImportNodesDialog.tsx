import { useEffect, useId, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Tree } from "./model";
import { hasImportHeader, planNodeImport, type ImportOptions } from "./importNodes";

export function ImportNodesDialog({ tree, parentId, onClose, onImport }: { tree: Tree; parentId: string; onClose: () => void; onImport: (parentId: string, text: string, options: ImportOptions) => string | undefined }) {
  const ref = useRef<HTMLDialogElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const title = useId();
  const [text, setText] = useState("");
  const [parent, setParent] = useState(parentId);
  const [header, setHeader] = useState(false);
  const [createCategories, setCreateCategories] = useState(false);
  const [error, setError] = useState<string>();
  const plan = useMemo(() => planNodeImport(tree, parent, text, { header, createCategories }), [tree, parent, text, header, createCategories]);
  const failures = plan.rows.flatMap(row => row.errors.map(message => `Riga ${row.row}: ${message}`));
  useEffect(() => { const dialog = ref.current; dialog?.showModal?.(); input.current?.focus(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  return <dialog ref={ref} className="editor-dialog tree-dialog tree-import-dialog" aria-labelledby={title} onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}>
    <div className="editor-dialog-inner">
      <header><div><h2 id={title}>Incolla da Excel</h2><p>Colonne: Nome, Categoria, Note. Solo il nome è obbligatorio. I codici sono automatici.</p></div><button type="button" aria-label="Chiudi" onClick={onClose}><X size={16} /></button></header>
      <div className="tree-dialog-body">
        <label>Nodo padre<select aria-label="Nodo padre dell'importazione" value={parent} onChange={event => { setParent(event.target.value); setError(undefined); }}>{tree.nodes.map(node => <option key={node.id} value={node.id}>{node.code} · {node.name}</option>)}</select></label>
        <label>Celle copiate da Excel<textarea ref={input} aria-label="Celle copiate da Excel" rows={5} placeholder="Copia le celle da Excel e incollale qui. Puoi incollare anche una sola colonna di nomi." value={text} onChange={event => { const value = event.target.value; if (!text.trim()) setHeader(hasImportHeader(value)); setText(value); setError(undefined); }} /></label>
        <div className="tree-import-options">
          <label className="tree-check-row"><input type="checkbox" checked={header} onChange={event => setHeader(event.target.checked)} />La prima riga contiene intestazioni</label>
          <label className="tree-check-row"><input type="checkbox" checked={createCategories} onChange={event => setCreateCategories(event.target.checked)} />Crea le categorie mancanti</label>
        </div>
        {text.trim() && <>
          <p role="status">{plan.rows.length} {plan.rows.length === 1 ? "nodo" : "nodi"} · {plan.newCategories.length} nuove categorie</p>
          {(plan.errors.length > 0 || failures.length > 0) && <div className="config-error" role="alert"><strong>Correggi i dati prima di importare.</strong><ul>{[...plan.errors, ...failures].slice(0, 10).map((message, index) => <li key={index}>{message}</li>)}</ul>{plan.errors.length + failures.length > 10 && <p>Ci sono altri {plan.errors.length + failures.length - 10} errori.</p>}</div>}
          <div className="tree-import-preview"><table><caption>Anteprima dei nodi</caption><thead><tr><th>Riga</th><th>Codice automatico</th><th>Nome</th><th>Categoria</th><th>Note</th></tr></thead><tbody>{plan.rows.slice(0, 100).map(row => <tr key={row.row} className={row.errors.length ? "has-error" : ""}><td>{row.row}</td><td>{row.code || "—"}</td><td>{row.name || "Nome mancante"}</td><td>{row.category || "Nessuna"}</td><td>{row.note}</td></tr>)}</tbody></table></div>
          {plan.rows.length > 100 && <p className="tree-muted">Anteprima delle prime 100 righe. L'importazione comprende tutte le {plan.rows.length} righe.</p>}
          <p className="tree-muted">I nodi saranno aggiunti in coda ai figli del padre scelto. L'intera importazione si può annullare con un solo comando.</p>
        </>}
        {error && <p className="config-error" role="alert">{error}</p>}
      </div>
      <footer><button type="button" className="button" onClick={onClose}>Annulla</button><button type="button" className="button button-primary" disabled={!plan.tree} onClick={() => { const failure = onImport(parent, text, { header, createCategories }); if (failure) setError(failure); }}>Importa {plan.rows.length || ""} {plan.rows.length === 1 ? "nodo" : "nodi"}</button></footer>
    </div>
  </dialog>;
}
