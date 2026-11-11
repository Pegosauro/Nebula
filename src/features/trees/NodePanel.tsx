import { useEffect, useState } from "react";
import { Link2, Plus, Trash2 } from "lucide-react";
import { codeIssues, effectiveCategory, inheritSource, deleteNodeError, moveCommandReason, principalCategory, readableOn, type Tree, type TreeNode, type TreeObject } from "./model";
import { objectLeafText, objectPresentation } from "./objectIcons";
import type { NodeDraft } from "./TreeOutline";

interface NodePanelProps {
  tree: Tree;
  node?: TreeNode;
  adding: NodeDraft | null;
  detach: { nodeId: string; from: string } | null;
  onCode: (code: string) => string | undefined;
  onName: (name: string) => void;
  onNote: (note: string) => void;
  onCategory: (categoryId: string | null) => void;
  onInherit: () => void;
  onUndoDetach: () => void;
  onAddChild: () => void;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onAddObject: () => void;
  onEditObject: (object: TreeObject) => void;
  onKind: (object: TreeObject, kind: "own" | "acquired") => void;
  onRemoveObject: (object: TreeObject) => void;
  onManageCategories: () => void;
  onDraftChange: (draft: NodeDraft) => void;
  draftError?: string;
}

export function NodePanel({ tree, node, adding, detach, onCode, onName, onNote, onCategory, onInherit, onUndoDetach, onAddChild, onRename, onMove, onDelete, onAddObject, onEditObject, onKind, onRemoveObject, onManageCategories, onDraftChange, draftError }: NodePanelProps) {
  if (adding) return <DraftPanel tree={tree} draft={adding} error={draftError} onChange={onDraftChange} onCategories={onManageCategories} />;
  if (!node) return <aside className="tree-panel"><p className="tree-muted">Seleziona un nodo.</p></aside>;
  return <SelectedPanel tree={tree} node={node} detach={detach?.nodeId === node.id ? detach : null} onCode={onCode} onName={onName} onNote={onNote} onCategory={onCategory} onInherit={onInherit} onUndoDetach={onUndoDetach} onAddChild={onAddChild} onRename={onRename} onMove={onMove} onDelete={onDelete} onAddObject={onAddObject} onEditObject={onEditObject} onKind={onKind} onRemoveObject={onRemoveObject} onManageCategories={onManageCategories} />;
}

function DraftPanel({ tree, draft, error, onChange, onCategories }: { tree: Tree; draft: NodeDraft; error?: string; onChange: (draft: NodeDraft) => void; onCategories: () => void }) {
  const parent = tree.nodes.find(item => item.id === draft.parentId);
  const issues = parent ? codeIssues({ ...tree, nodes: [...tree.nodes, { id: "draft", parentId: draft.parentId, order: 0, code: draft.code, name: draft.name, categoryMode: "inherit", categoryId: null, note: "", objects: [] }] }, "draft", draft.code) : { errors: ["Padre inesistente"], warnings: [] };
  return (
    <aside className="tree-panel" aria-label="Nuovo figlio">
      <p className="tree-kicker">Nuovo figlio di {parent?.code}</p>
      <h2>Aggiungi figlio</h2>
      <p className="tree-muted">Il nodo va in coda. Il codice proposto si può modificare. Nasce con la categoria ereditata dal padre.</p>
      <label>Codice<input aria-label="Codice nel pannello" value={draft.code} onChange={event => onChange({ ...draft, code: event.target.value })} /></label>
      <label>Nome<input aria-label="Nome nel pannello" value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })} /></label>
      {(error || issues.errors[0]) && <p role="alert" className="config-error">{error || issues.errors[0]}</p>}
      {issues.warnings.map(warning => <p key={warning} className="tree-warning">{warning}</p>)}
      <p className="tree-inherit-state"><Link2 size={14} /> Ereditata da {parent?.code}. Se la modifichi, il nodo si stacca dal padre.</p>
      <button type="button" className="button" onClick={onCategories}>Categorie dell'albero…</button>
      <p className="tree-muted">Invio conferma, Esc annulla.</p>
    </aside>
  );
}

function SelectedPanel(props: Omit<NodePanelProps, "adding" | "onDraftChange" | "draftError"> & { node: TreeNode; detach: { nodeId: string; from: string } | null }) {
  const { tree, node, detach, onCode, onName, onNote, onCategory, onInherit, onUndoDetach, onAddChild, onRename, onMove, onDelete, onAddObject, onEditObject, onKind, onRemoveObject, onManageCategories } = props;
  const [code, setCode] = useState(node.code);
  const [codeError, setCodeError] = useState<string>();
  useEffect(() => { setCode(node.code); setCodeError(undefined); }, [node.id, node.code]);
  const issues = codeIssues(tree, node.id, code);
  const categoryId = effectiveCategory(tree, node.id);
  const source = inheritSource(tree, node.id);
  const inherited = node.categoryMode === "inherit" && node.parentId != null;
  const deleteReason = deleteNodeError(tree, node.id);
  const moveReason = moveCommandReason(tree, node.id);
  const principal = principalCategory(tree, node.id);
  const commitCode = () => {
    if (code.trim() === node.code) { setCodeError(undefined); return; }
    setCodeError(onCode(code));
  };
  const tables = node.objects.filter(object => object.type === "externalTable");
  const characteristics = node.objects.filter(object => object.type === "characteristic");
  return (
    <aside className="tree-panel" aria-label="Nodo selezionato">
      <p className="tree-kicker">{node.parentId ? `Figlio di ${tree.nodes.find(item => item.id === node.parentId)?.code}` : "Radice"}</p>
      <label>Codice<input aria-label="Codice del nodo" value={code} onChange={event => { setCode(event.target.value); setCodeError(undefined); }} onBlur={commitCode} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commitCode(); } }} /></label>
      {codeError && <p role="alert" className="config-error">{codeError}</p>}
      {!codeError && code !== node.code && issues.warnings.map(warning => <p key={warning} className="tree-warning">{warning}</p>)}
      <label>Nome<input aria-label="Nome del nodo" value={node.name} onChange={event => onName(event.target.value)} /></label>
      <div className="tree-category-head">
        <span>Categoria</span>
        {principal && <span className="tree-chip" style={{ background: principal.color, color: readableOn(principal.color) }}>{principal.name}</span>}
      </div>
      <p className="tree-inherit-state">{inherited ? <><Link2 size={14} /> Ereditata da {source?.code}. Se la modifichi, il nodo si stacca dal padre.</> : "Propria"}</p>
      {detach && <p className="tree-warning" role="status">Hai modificato la categoria: {node.code} non eredita più da {detach.from}. <button type="button" className="tree-link" onClick={onUndoDetach}>Annulla</button></p>}
      <label className="tree-add-category">Categoria del nodo
        <select aria-label="Categoria del nodo" value={categoryId ?? ""} onChange={event => onCategory(event.target.value || null)}>
          <option value="">Nessuna</option>
          {[...tree.categories].sort((a, b) => a.order - b.order).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      {!categoryId && <p className="tree-muted">Nessuna categoria: nodo neutro.</p>}
      <div className="tree-row-actions">
        <button type="button" className="button" disabled={!node.parentId} title={node.parentId ? "Torna a seguire il padre" : "La radice ha sempre una categoria propria"} onClick={onInherit}>Eredita dal padre</button>
        <button type="button" className="button" onClick={onManageCategories}>Gestisci…</button>
      </div>
      <label>Note<textarea aria-label="Note del nodo" rows={4} value={node.note} onChange={event => onNote(event.target.value)} placeholder="Testo libero" /></label>
      <section aria-label="Oggetti del nodo">
        <div className="tree-category-head"><h3>Tabelle esterne</h3><button type="button" className="button" onClick={onAddObject}><Plus size={14} />Oggetto</button></div>
        <ObjectList objects={tables} empty="Nessuna tabella." onEdit={onEditObject} onKind={onKind} onRemove={onRemoveObject} />
        <h3>Caratteristiche</h3>
        <ObjectList objects={characteristics} empty="Nessuna caratteristica." onEdit={onEditObject} onKind={onKind} onRemove={onRemoveObject} />
      </section>
      <div className="tree-row-actions tree-node-actions">
        <button type="button" className="button" onClick={onAddChild}><Plus size={15} />Figlio</button>
        <button type="button" className="button" onClick={onRename}>Rinomina</button>
        <button type="button" className="button" disabled={Boolean(moveReason)} title={moveReason ?? "Scegli il nuovo padre"} onClick={onMove}>Sposta in…</button>
        <button type="button" className="button tree-danger" disabled={Boolean(deleteReason)} title={deleteReason} onClick={onDelete}><Trash2 size={15} />Elimina</button>
      </div>
      {deleteReason && <p className="tree-muted">{deleteReason}</p>}
    </aside>
  );
}

function ObjectList({ objects, empty, onEdit, onKind, onRemove }: { objects: TreeObject[]; empty: string; onEdit: (object: TreeObject) => void; onKind: (object: TreeObject, kind: "own" | "acquired") => void; onRemove: (object: TreeObject) => void }) {
  if (!objects.length) return <p className="tree-muted">{empty}</p>;
  return (
    <ul className="tree-object-list">
      {objects.map(object => {
        const presentation = objectPresentation(object);
        const Icon = presentation.Icon;
        return (
          <li key={object.id}>
            <button type="button" className="tree-object-main" onClick={() => onEdit(object)}>
              <Icon size={15} className={`tree-obj-icon ${presentation.className}`} fill={presentation.filled ? "currentColor" : "none"} aria-hidden="true" />
              <span>{objectLeafText(object)}</span>
              {object.type === "externalTable" && <small>{presentation.label}</small>}
            </button>
            {object.type === "characteristic" && (
              <select aria-label={`Tipo di ${object.code}`} value={object.kind} onChange={event => onKind(object, event.target.value === "acquired" ? "acquired" : "own")}>
                <option value="own">Propria</option>
                <option value="acquired">Acquisita</option>
              </select>
            )}
            <button type="button" className="tree-danger-text" aria-label={`Rimuovi ${objectLeafText(object)}`} onClick={() => onRemove(object)}><Trash2 size={14} /></button>
          </li>
        );
      })}
    </ul>
  );
}
