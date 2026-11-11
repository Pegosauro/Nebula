import { useEffect, useState } from "react";
import { Link2, Plus, Star, Trash2, X } from "lucide-react";
import { codeIssues, effectiveCategories, inheritSource, leafDeleteError, principalCategory, readableOn, type Tree, type TreeNode, type TreeObject } from "./model";
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
  onCategories: (ids: string[]) => void;
  onInherit: () => void;
  onUndoDetach: () => void;
  onAddChild: () => void;
  onRename: () => void;
  onDelete: () => void;
  onAddObject: () => void;
  onEditObject: (object: TreeObject) => void;
  onKind: (object: TreeObject, kind: "own" | "acquired") => void;
  onRemoveObject: (object: TreeObject) => void;
  onManageCategories: () => void;
  onDraftChange: (draft: NodeDraft) => void;
  draftError?: string;
}

export function NodePanel({ tree, node, adding, detach, onCode, onName, onNote, onCategories, onInherit, onUndoDetach, onAddChild, onRename, onDelete, onAddObject, onEditObject, onKind, onRemoveObject, onManageCategories, onDraftChange, draftError }: NodePanelProps) {
  if (adding) return <DraftPanel tree={tree} draft={adding} error={draftError} onChange={onDraftChange} onCategories={onManageCategories} />;
  if (!node) return <aside className="tree-panel"><p className="tree-muted">Seleziona un nodo.</p></aside>;
  return <SelectedPanel tree={tree} node={node} detach={detach?.nodeId === node.id ? detach : null} onCode={onCode} onName={onName} onNote={onNote} onCategories={onCategories} onInherit={onInherit} onUndoDetach={onUndoDetach} onAddChild={onAddChild} onRename={onRename} onDelete={onDelete} onAddObject={onAddObject} onEditObject={onEditObject} onKind={onKind} onRemoveObject={onRemoveObject} onManageCategories={onManageCategories} />;
}

function DraftPanel({ tree, draft, error, onChange, onCategories }: { tree: Tree; draft: NodeDraft; error?: string; onChange: (draft: NodeDraft) => void; onCategories: () => void }) {
  const parent = tree.nodes.find(item => item.id === draft.parentId);
  const issues = parent ? codeIssues({ ...tree, nodes: [...tree.nodes, { id: "draft", parentId: draft.parentId, order: 0, code: draft.code, name: draft.name, categoryMode: "inherit", categoryIds: [], note: "", objects: [] }] }, "draft", draft.code) : { errors: ["Padre inesistente"], warnings: [] };
  return (
    <aside className="tree-panel" aria-label="Nuovo figlio">
      <p className="tree-kicker">Nuovo figlio di {parent?.code}</p>
      <h2>Aggiungi figlio</h2>
      <p className="tree-muted">Il nodo va in coda. Il codice proposto si può modificare. Nasce con le categorie ereditate dal padre.</p>
      <label>Codice<input aria-label="Codice nel pannello" value={draft.code} onChange={event => onChange({ ...draft, code: event.target.value })} /></label>
      <label>Nome<input aria-label="Nome nel pannello" value={draft.name} onChange={event => onChange({ ...draft, name: event.target.value })} /></label>
      {(error || issues.errors[0]) && <p role="alert" className="config-error">{error || issues.errors[0]}</p>}
      {issues.warnings.map(warning => <p key={warning} className="tree-warning">{warning}</p>)}
      <p className="tree-inherit-state"><Link2 size={14} /> Ereditate da {parent?.code}. Se le modifichi, il nodo si stacca dal padre.</p>
      <button type="button" className="button" onClick={onCategories}>Categorie dell'albero…</button>
      <p className="tree-muted">Invio conferma, Esc annulla.</p>
    </aside>
  );
}

function SelectedPanel(props: Omit<NodePanelProps, "adding" | "onDraftChange" | "draftError"> & { node: TreeNode; detach: { nodeId: string; from: string } | null }) {
  const { tree, node, detach, onCode, onName, onNote, onCategories, onInherit, onUndoDetach, onAddChild, onRename, onDelete, onAddObject, onEditObject, onKind, onRemoveObject, onManageCategories } = props;
  const [code, setCode] = useState(node.code);
  const [codeError, setCodeError] = useState<string>();
  useEffect(() => { setCode(node.code); setCodeError(undefined); }, [node.id, node.code]);
  const issues = codeIssues(tree, node.id, code);
  const categories = effectiveCategories(tree, node.id);
  const source = inheritSource(tree, node.id);
  const inherited = node.categoryMode === "inherit" && node.parentId != null;
  const deleteReason = leafDeleteError(tree, node.id);
  const principal = principalCategory(tree, node.id);
  const commitCode = () => {
    if (code.trim() === node.code) { setCodeError(undefined); return; }
    setCodeError(onCode(code));
  };
  const moveCategory = (index: number, delta: number) => {
    const next = [...categories];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onCategories(next);
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
        <span>Categorie</span>
        {principal && <span className="tree-chip" style={{ background: principal.color, color: readableOn(principal.color) }}><Star size={12} aria-hidden="true" /> {principal.name}</span>}
      </div>
      <p className="tree-inherit-state">{inherited ? <><Link2 size={14} /> Ereditate da {source?.code}. Se le modifichi, il nodo si stacca dal padre.</> : "Proprie"}</p>
      {detach && <p className="tree-warning" role="status">Hai modificato le categorie: {node.code} non eredita più da {detach.from}. <button type="button" className="tree-link" onClick={onUndoDetach}>Annulla</button></p>}
      <div className="tree-chips">
        {categories.map((id, index) => {
          const category = tree.categories.find(item => item.id === id);
          if (!category) return null;
          return (
            <span key={id} className="tree-chip" style={{ background: category.color, color: readableOn(category.color) }}>
              {index === 0 && <Star size={12} aria-label="Principale" />}
              {category.name}
              <button type="button" aria-label={`Sposta prima ${category.name}`} disabled={index === 0} onClick={() => moveCategory(index, -1)}>←</button>
              <button type="button" aria-label={`Sposta dopo ${category.name}`} disabled={index === categories.length - 1} onClick={() => moveCategory(index, 1)}>→</button>
              <button type="button" aria-label={`Togli ${category.name}`} onClick={() => onCategories(categories.filter(item => item !== id))}><X size={12} /></button>
            </span>
          );
        })}
        {!categories.length && <span className="tree-muted">Nessuna categoria: nodo neutro.</span>}
      </div>
      <label className="tree-add-category">Aggiungi categoria
        <select aria-label="Aggiungi categoria al nodo" value="" onChange={event => { if (event.target.value) onCategories([...categories, event.target.value]); }}>
          <option value="">Scegli…</option>
          {tree.categories.filter(category => !categories.includes(category.id)).sort((a, b) => a.order - b.order).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
        </select>
      </label>
      <div className="tree-row-actions">
        <button type="button" className="button" disabled={!node.parentId} title={node.parentId ? "Torna a seguire il padre" : "La radice ha sempre categorie proprie"} onClick={onInherit}>Eredita dal padre</button>
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
