import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { codeIssues, effectiveCategory, deleteNodeError, moveCommandReason, principalCategory, readableOn, type ObjectDraft, type Tree, type TreeNode, type TreeObject } from "./model";
import { InlineObjects, type ObjectListKind } from "./InlineObjects";
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
  onSaveObject: (draft: ObjectDraft) => string | undefined;
  onRemoveObject: (object: TreeObject) => void;
  onManageCategories: () => void;
  onDraftChange: (draft: NodeDraft) => void;
  draftError?: string;
  editingObjectId?: string;
  focusList?: ObjectListKind;
  focusToken?: number;
}

export function NodePanel({ tree, node, adding, detach, onCode, onName, onNote, onCategory, onInherit, onUndoDetach, onAddChild, onRename, onMove, onDelete, onSaveObject, onRemoveObject, onManageCategories, onDraftChange, draftError, editingObjectId, focusList, focusToken }: NodePanelProps) {
  if (adding) return <DraftPanel tree={tree} draft={adding} error={draftError} onChange={onDraftChange} onCategories={onManageCategories} />;
  if (!node) return <aside className="tree-panel"><p className="tree-muted">Seleziona un nodo.</p></aside>;
  return <SelectedPanel tree={tree} node={node} detach={detach?.nodeId === node.id ? detach : null} onCode={onCode} onName={onName} onNote={onNote} onCategory={onCategory} onInherit={onInherit} onUndoDetach={onUndoDetach} onAddChild={onAddChild} onRename={onRename} onMove={onMove} onDelete={onDelete} onSaveObject={onSaveObject} onRemoveObject={onRemoveObject} onManageCategories={onManageCategories} editingObjectId={editingObjectId} focusList={focusList} focusToken={focusToken} />;
}

function DraftPanel({ tree, draft, error, onChange, onCategories }: { tree: Tree; draft: NodeDraft; error?: string; onChange: (draft: NodeDraft) => void; onCategories: () => void }) {
  const parent = tree.nodes.find(item => item.id === draft.parentId);
  const issues = parent ? codeIssues({ ...tree, nodes: [...tree.nodes, { id: "draft", parentId: draft.parentId, order: 0, code: draft.code, name: draft.name, categoryMode: "inherit", categoryId: null, note: "", objects: [] }] }, "draft", draft.code) : { errors: ["Padre inesistente"], warnings: [] };
  return (
    <aside className="tree-panel" aria-label="Nuovo figlio">
      <p className="tree-kicker">Nuovo figlio di {parent?.code}</p>
      <h2>Aggiungi figlio</h2>
      <p className="tree-muted">Il nodo va in coda. Il codice proposto si può modificare.</p>
      <label>Codice<input aria-label="Codice nel pannello" value={draft.code} onChange={event => onChange({ ...draft, code: event.target.value })} /></label>
      <label>Nome<input aria-label="Nome nel pannello" value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })} /></label>
      {(error || issues.errors[0]) && <p role="alert" className="config-error">{error || issues.errors[0]}</p>}
      {issues.warnings.map(warning => <p key={warning} className="tree-warning">{warning}</p>)}
      <button type="button" className="button" onClick={onCategories}>Categorie dell'albero…</button>
      <p className="tree-muted">Invio conferma, Esc annulla.</p>
    </aside>
  );
}

function SelectedPanel(props: Omit<NodePanelProps, "adding" | "onDraftChange" | "draftError"> & { node: TreeNode; detach: { nodeId: string; from: string } | null }) {
  const { tree, node, detach, onCode, onName, onNote, onCategory, onInherit, onUndoDetach, onAddChild, onRename, onMove, onDelete, onSaveObject, onRemoveObject, onManageCategories, editingObjectId, focusList, focusToken } = props;
  const [code, setCode] = useState(node.code);
  const [codeError, setCodeError] = useState<string>();
  useEffect(() => { setCode(node.code); setCodeError(undefined); }, [node.id, node.code]);
  const issues = codeIssues(tree, node.id, code);
  const categoryId = effectiveCategory(tree, node.id);
  const deleteReason = deleteNodeError(tree, node.id);
  const moveReason = moveCommandReason(tree, node.id);
  const principal = principalCategory(tree, node.id);
  const commitCode = () => {
    if (code.trim() === node.code) { setCodeError(undefined); return; }
    setCodeError(onCode(code));
  };
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
      <InlineObjects node={node} editingId={editingObjectId} focusList={focusList} focusToken={focusToken} onSave={onSaveObject} onRemove={onRemoveObject} />
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
