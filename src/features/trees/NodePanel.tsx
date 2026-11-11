import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { codeIssues, effectiveCategory, deleteNodeError, moveCommandReason, principalCategory, readableOn, type ObjectDraft, type Tree, type TreeNode, type TreeObject } from "./model";
import { InlineObjects, type ObjectListKind } from "./InlineObjects";
import type { NodeDraft } from "./TreeOutline";
import { NodeCategoryPicker } from "./NodeCategoryPicker";

interface NodePanelProps {
  tree: Tree;
  node?: TreeNode;
  adding: NodeDraft | null;
  onCode: (code: string) => string | undefined;
  onName: (name: string) => void;
  onNote: (note: string) => void;
  onCategory: (categoryId: string | null) => void;
  onAddChild: () => void;
  onAddSibling: () => void;
  siblingReason?: string;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onSaveObject: (draft: ObjectDraft) => string | undefined;
  onRemoveObject: (object: TreeObject) => void;
  onManageCategories: () => void;
  onDraftChange: (draft: NodeDraft) => void;
  onDraftBlur: (event: React.FocusEvent<HTMLInputElement>) => void;
  draftError?: string;
  editingObjectId?: string;
  focusList?: ObjectListKind;
  focusToken?: number;
}

export function NodePanel({ tree, node, adding, onCode, onName, onNote, onCategory, onAddChild, onAddSibling, siblingReason, onRename, onMove, onDelete, onSaveObject, onRemoveObject, onManageCategories, onDraftChange, onDraftBlur, draftError, editingObjectId, focusList, focusToken }: NodePanelProps) {
  if (adding) return <DraftPanel tree={tree} draft={adding} error={draftError} onChange={onDraftChange} onBlur={onDraftBlur} onCategories={onManageCategories} />;
  if (!node) return <aside className="tree-panel"><p className="tree-muted">Seleziona un nodo.</p></aside>;
  return <SelectedPanel tree={tree} node={node} onCode={onCode} onName={onName} onNote={onNote} onCategory={onCategory} onAddChild={onAddChild} onAddSibling={onAddSibling} siblingReason={siblingReason} onRename={onRename} onMove={onMove} onDelete={onDelete} onSaveObject={onSaveObject} onRemoveObject={onRemoveObject} onManageCategories={onManageCategories} editingObjectId={editingObjectId} focusList={focusList} focusToken={focusToken} />;
}

function DraftPanel({ tree, draft, error, onChange, onBlur, onCategories }: { tree: Tree; draft: NodeDraft; error?: string; onChange: (draft: NodeDraft) => void; onBlur: (event: React.FocusEvent<HTMLInputElement>) => void; onCategories: () => void }) {
  const parent = tree.nodes.find(item => item.id === draft.parentId);
  const after = draft.afterId ? tree.nodes.find(item => item.id === draft.afterId) : undefined;
  const issues = parent ? codeIssues({ ...tree, nodes: [...tree.nodes, { id: "draft", parentId: draft.parentId, order: 0, code: draft.code, name: draft.name, categoryMode: "inherit", categoryId: null, note: "", objects: [] }] }, "draft", draft.code) : { errors: ["Padre inesistente"], warnings: [] };
  return (
    <aside className="tree-panel" aria-label={after ? "Nuovo fratello" : "Nuovo figlio"}>
      <p className="tree-kicker">{after ? `Nuovo fratello dopo ${after.code}` : `Nuovo figlio di ${parent?.code}`}</p>
      <h2>{after ? "Aggiungi fratello" : "Aggiungi figlio"}</h2>
      <p className="tree-muted">{after ? "Il nodo va subito dopo quello selezionato. Il codice proposto si può modificare." : "Il nodo va in coda. Il codice proposto si può modificare."}</p>
      <label>Codice<input aria-label="Codice nel pannello" value={draft.code} onChange={event => onChange({ ...draft, code: event.target.value })} onBlur={onBlur} /></label>
      <label>Nome<input aria-label="Nome nel pannello" value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })} onBlur={onBlur} /></label>
      {(error || issues.errors[0]) && <p role="alert" className="config-error">{error || issues.errors[0]}</p>}
      {issues.warnings.map(warning => <p key={warning} className="tree-warning">{warning}</p>)}
      <button type="button" className="button" onMouseDown={event => event.preventDefault()} onClick={onCategories}>Categorie dell'albero…</button>
      <p className="tree-muted">Invio conferma. Esc annulla l'inserimento. Un clic fuori lascia il nodo con nome «Nuovo nodo».</p>
    </aside>
  );
}

function SelectedPanel(props: Omit<NodePanelProps, "adding" | "onDraftChange" | "onDraftBlur" | "draftError"> & { node: TreeNode }) {
  const { tree, node, onCode, onName, onNote, onCategory, onAddChild, onAddSibling, siblingReason, onRename, onMove, onDelete, onSaveObject, onRemoveObject, onManageCategories, editingObjectId, focusList, focusToken } = props;
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
      <NodeCategoryPicker key={node.id} categories={tree.categories} value={categoryId} onChange={onCategory} />
      {!categoryId && <p className="tree-muted">Nessuna categoria: nodo neutro.</p>}
      <div className="tree-row-actions">
        <button type="button" className="button" onMouseDown={event => event.preventDefault()} onClick={onManageCategories}>Gestisci…</button>
      </div>
      <label>Note<textarea aria-label="Note del nodo" className={node.note.trim() ? "tree-node-note-filled" : undefined} rows={4} value={node.note} onChange={event => onNote(event.target.value)} placeholder="Testo libero" /></label>
      <InlineObjects node={node} editingId={editingObjectId} focusList={focusList} focusToken={focusToken} onSave={onSaveObject} onRemove={onRemoveObject} />
      <div className="tree-row-actions tree-node-actions">
        <button type="button" className="button" onMouseDown={event => event.preventDefault()} onClick={onAddChild}><Plus size={15} />Figlio</button>
        <button type="button" className="button" disabled={Boolean(siblingReason)} title={siblingReason ?? "Subito dopo, stesso padre (Invio)"} onMouseDown={event => { if (!siblingReason) event.preventDefault(); }} onClick={onAddSibling}><Plus size={15} />Fratello</button>
        <button type="button" className="button" onMouseDown={event => event.preventDefault()} onClick={onRename}>Rinomina</button>
        <button type="button" className="button" disabled={Boolean(moveReason)} title={moveReason ?? "Scegli il nuovo padre"} onMouseDown={event => { if (!moveReason) event.preventDefault(); }} onClick={onMove}>Sposta in…</button>
        <button type="button" className="button tree-danger" disabled={Boolean(deleteReason)} title={deleteReason} onMouseDown={event => { if (!deleteReason) event.preventDefault(); }} onClick={onDelete}><Trash2 size={15} />Elimina</button>
      </div>
      {deleteReason && <p className="tree-muted">{deleteReason}</p>}
    </aside>
  );
}
