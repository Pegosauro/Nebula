import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import {
  childrenOf, addSiblingReason, deleteNodeError, moveCommandReason, moveDestinationReason, nodeById, planMove, principalCategory, readableOn,
  type MovePlan, type MoveRename, type Tree,
} from "./model";

export interface MoveNotice {
  kind: "ok" | "info" | "err";
  title: string;
  renames: Array<MoveRename & { name: string }>;
  open: boolean;
  undoLabel?: string;
}

export function MoveBanner({ notice, canUndo, onToggle, onUndo, onClose }: { notice: MoveNotice; canUndo: boolean; onToggle: () => void; onUndo: () => void; onClose: () => void }) {
  return (
    <div className={`tree-banner is-${notice.kind}`} role={notice.kind === "err" ? "alert" : "status"}>
      <div className="tree-banner-copy">
        <p>{notice.title}</p>
        {notice.open && notice.renames.length > 0 && (
          <table className="tree-rename-table">
            <thead><tr><th>Vecchio codice</th><th>Nuovo codice</th><th>Nome</th></tr></thead>
            <tbody>
              {notice.renames.map(rename => (
                <tr key={rename.id}><td className="tree-old-code">{rename.old}</td><td className="tree-new-code">{rename.new}</td><td>{rename.name}</td></tr>
              ))}
            </tbody>
          </table>
        )}
        {notice.open && notice.renames.length === 0 && notice.kind !== "err" && <p className="tree-muted">Nessun codice cambia.</p>}
      </div>
      {notice.renames.length > 0 && <button type="button" className="button" onClick={onToggle}>{notice.open ? "Nascondi" : "Dettagli"}</button>}
      {canUndo && notice.kind !== "err" && <button type="button" className="button" aria-label={notice.undoLabel ?? "Annulla spostamento"} onClick={onUndo}>Annulla</button>}
      <button type="button" className="tree-banner-close" aria-label="Chiudi avviso" onClick={onClose}><X size={16} /></button>
    </div>
  );
}

export function MoveDialog({ tree, nodeId, onClose, onConfirm }: { tree: Tree; nodeId: string; onClose: () => void; onConfirm: (parentId: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<string>();
  const node = nodeById(tree, nodeId);
  const rows = useMemo(() => destinationRows(tree, query), [tree, query]);
  const plan = useMemo(() => target ? planMove(tree, nodeId, target, null) : null, [tree, nodeId, target]);
  const enabled = rows.filter(row => !moveDestinationReason(tree, nodeId, row.id));
  useEffect(() => {
    const element = dialog.current;
    if (typeof element?.showModal === "function" && !element.open) element.showModal();
    return () => {
      if (!element?.open) return;
      element.addEventListener("close", event => event.stopImmediatePropagation(), { capture: true, once: true });
      element.close();
    };
  }, []);
  if (!node) return null;
  const choose = (delta: number) => {
    const index = enabled.findIndex(row => row.id === target);
    const next = enabled[index + delta] ?? enabled[delta > 0 ? 0 : enabled.length - 1];
    if (next) setTarget(next.id);
  };
  const parent = target ? nodeById(tree, target) : undefined;
  return (
    <dialog
      ref={dialog}
      className="editor-dialog is-wide tree-dialog"
      aria-label={`Sposta ${node.code} in`}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClose={onClose}
      onClick={event => { if (event.target === dialog.current) onClose(); }}
      onKeyDown={event => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); event.stopPropagation(); choose(event.key === "ArrowDown" ? 1 : -1); }
        else if (event.key === "Enter" && plan?.ok && target) { event.preventDefault(); onConfirm(target); }
      }}
    >
      <div className="editor-dialog-inner">
        <header>
          <div><h2>Sposta {node.code} · {node.name} in…</h2><p>Cambia solo padre e ordine: l'id resta, il sottoalbero segue. I codici conformi vengono rinumerati, quelli liberi restano.</p></div>
          <button type="button" aria-label="Chiudi" onClick={onClose}><X size={16} /></button>
        </header>
        <div className="tree-dialog-body">
          <label className="tree-search"><Search size={15} aria-hidden="true" /><input aria-label="Cerca il nuovo padre" placeholder="Cerca il nuovo padre" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <div className="tree-move-grid">
            <div className="tree-dest-list" role="listbox" aria-label="Nuovo padre">
              {rows.map(row => {
                const reason = moveDestinationReason(tree, nodeId, row.id);
                const item = nodeById(tree, row.id);
                if (!item) return null;
                return (
                  <button type="button" role="option" key={row.id} className="tree-dest" style={{ paddingLeft: 8 + row.depth * 14 }} aria-selected={target === row.id} disabled={Boolean(reason)} title={reason ?? "Scegli come nuovo padre, in coda"} onClick={() => setTarget(row.id)}>
                    <strong>{item.code}</strong>
                    <span>{item.name}</span>
                    {reason && <small>{reason}</small>}
                  </button>
                );
              })}
              {rows.length === 0 && <p className="tree-muted">Nessun padre corrisponde alla ricerca.</p>}
            </div>
            <div className="tree-move-preview" aria-live="polite">
              <h3>Anteprima vecchio → nuovo</h3>
              {!plan && <p className="tree-muted">Scegli il nuovo padre: il nodo andrà in coda ai suoi figli.</p>}
              {plan && <MovePreview tree={tree} nodeId={nodeId} plan={plan} />}
            </div>
          </div>
        </div>
        <footer>
          <span>Invio conferma · Esc annulla</span>
          <button type="button" className="button" onClick={onClose}>Annulla</button>
          <button type="button" className="button button-primary" disabled={!plan?.ok || !target} onClick={() => target && plan?.ok && onConfirm(target)}>{parent ? `Sposta in ${parent.code}` : "Sposta"}</button>
        </footer>
      </div>
    </dialog>
  );
}

function MovePreview({ tree, nodeId, plan }: { tree: Tree; nodeId: string; plan: MovePlan }) {
  const node = nodeById(tree, nodeId);
  const before = principalCategory(tree, nodeId);
  const after = plan.tree ? principalCategory(plan.tree, nodeId) : undefined;
  return (
    <>
      {plan.errors.map(error => <p key={error} role="alert" className="config-error">{error}</p>)}
      {plan.warnings.map(warning => <p key={warning} className="tree-warning">{warning}</p>)}
      {plan.ok && (
        <p className="tree-move-badges">
          <span>{plan.renames.length === 1 ? "1 codice rinumerato" : `${plan.renames.length} codici rinumerati`}</span>
          <span>{plan.catChanged.length === 1 ? "1 nodo cambia categoria" : `${plan.catChanged.length} nodi cambiano categoria`}</span>
        </p>
      )}
      {plan.ok && plan.renames.length === 0 && <p className="tree-muted">Nessun codice cambia.</p>}
      {plan.ok && plan.renames.length > 0 && (
        <table className="tree-rename-table">
          <thead><tr><th>Vecchio codice</th><th>Nuovo codice</th><th>Nome</th></tr></thead>
          <tbody>
            {plan.renames.map(rename => <tr key={rename.id}><td className="tree-old-code">{rename.old}</td><td className="tree-new-code">{rename.new}</td><td>{nodeById(tree, rename.id)?.name}</td></tr>)}
          </tbody>
        </table>
      )}
      {plan.ok && before?.id !== after?.id && (
        <p className="tree-color-change">Colore: <CategoryChip tree={tree} categoryId={before?.id} /> → <CategoryChip tree={tree} categoryId={after?.id} /></p>
      )}
      {plan.ok && <p className="tree-muted">{node?.objects.length ? "Gli oggetti del nodo seguono lo spostamento. " : ""}{plan.renames.length > 1 ? "I discendenti conformi tengono le stesse due cifre." : "I codici liberi restano e interrompono la catena."}</p>}
    </>
  );
}

function CategoryChip({ tree, categoryId }: { tree: Tree; categoryId?: string }) {
  const category = tree.categories.find(item => item.id === categoryId);
  if (!category) return <span className="tree-chip">Neutro</span>;
  return <span className="tree-chip" style={{ background: category.color, color: readableOn(category.color) }}>{category.name}</span>;
}

function destinationRows(tree: Tree, query: string): Array<{ id: string; depth: number }> {
  const needle = query.trim().toLocaleLowerCase();
  const visible = new Set<string>();
  if (needle) {
    for (const node of tree.nodes) {
      if (!node.code.toLocaleLowerCase().includes(needle) && !node.name.toLocaleLowerCase().includes(needle)) continue;
      visible.add(node.id);
      let current = node;
      const seen = new Set<string>();
      while (current.parentId && !seen.has(current.id)) {
        seen.add(current.id);
        visible.add(current.parentId);
        const parent = nodeById(tree, current.parentId);
        if (!parent) break;
        current = parent;
      }
    }
  }
  const rows: Array<{ id: string; depth: number }> = [];
  const walk = (id: string, depth: number) => {
    if (needle && !visible.has(id)) return;
    rows.push({ id, depth });
    for (const child of childrenOf(tree, id)) walk(child.id, depth + 1);
  };
  walk(tree.rootId, 0);
  return rows;
}

export function NodeContextMenu({ tree, nodeId, x, y, onClose, onAdd, onSibling, onObject, onRename, onMove, onDelete }: { tree: Tree; nodeId: string; x: number; y: number; onClose: () => void; onAdd: () => void; onSibling: () => void; onObject: () => void; onRename: () => void; onMove: () => void; onDelete: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState({ x, y });
  const node = nodeById(tree, nodeId);
  const moveReason = moveCommandReason(tree, nodeId);
  const deleteReason = deleteNodeError(tree, nodeId);
  const siblingReason = addSiblingReason(tree, nodeId);
  useEffect(() => {
    const menu = ref.current;
    if (!menu) return;
    const rect = menu.getBoundingClientRect();
    setPoint({ x: Math.max(8, Math.min(x, window.innerWidth - rect.width - 8)), y: Math.max(8, Math.min(y, window.innerHeight - rect.height - 8)) });
  }, [x, y]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) onClose(); };
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", close); window.removeEventListener("keydown", onKey); };
  }, [onClose]);
  if (!node) return null;
  return (
    <div ref={ref} className="tree-context" role="menu" aria-label={`Azioni su ${node.code}`} style={{ left: point.x, top: point.y }}>
      <button type="button" role="menuitem" onClick={() => { onAdd(); onClose(); }}>Aggiungi figlio</button>
      <button type="button" role="menuitem" disabled={Boolean(siblingReason)} title={siblingReason} onClick={() => { onSibling(); onClose(); }}>Aggiungi fratello{siblingReason && <small>{siblingReason}</small>}</button>
      <button type="button" role="menuitem" onClick={() => { onObject(); onClose(); }}>Nuova caratteristica</button>
      <button type="button" role="menuitem" onClick={() => { onRename(); onClose(); }}>Rinomina</button>
      <button type="button" role="menuitem" disabled={Boolean(moveReason)} title={moveReason} onClick={() => { onMove(); onClose(); }}>Sposta in…{moveReason && <small>{moveReason}</small>}</button>
      <button type="button" role="menuitem" disabled={Boolean(deleteReason)} title={deleteReason} onClick={() => { onDelete(); onClose(); }}>Elimina{deleteReason && <small>{deleteReason}</small>}</button>
      <p>Invio aggiunge un fratello subito dopo. Alt ↑↓ riordina tra fratelli: i codici non cambiano. Per cambiare padre usa Sposta in… o il trascinamento.</p>
    </div>
  );
}
