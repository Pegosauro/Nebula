import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Download, ListTree, Plus, Save, Search, X } from "lucide-react";
import { vaultService } from "../vault/vaultService";
import { saveStatusLabel, saveStatusTone, treeSaveStatus } from "../workspace/saveStatus";
import { CategoryDialog } from "./CategoryDialog";
import { ObjectDialog } from "./ObjectDialog";
import { NodePanel } from "./NodePanel";
import { TreeOutline, type NodeDraft, type RenameDraft } from "./TreeOutline";
import { buildOutline } from "./outline";
import {
  addCategory, addChild, childrenOf, deleteCategory, deleteLeaf, descendants, inheritFromParent, inheritSource,
  inspectTree, leafDeleteError, moveCategory, nodeById, proposeChildCode, readableOn, removeObject, setNodeCategories,
  updateCategory, updateNode, upsertObject, type ObjectDraft, type Tree, type TreeObject,
} from "./model";
import { serializeTreeFile } from "./serializeTree";
import { useTreeStore } from "./treeStore";
import { useTreeUiStore } from "./treeUiStore";

type Confirm = { kind: "node"; id: string } | { kind: "object"; nodeId: string; object: TreeObject } | { kind: "reload" };

export default function TreeView({ path }: { path: string }) {
  const session = useTreeStore(state => state.sessions[path]);
  const scope = `${vaultService.currentVaultId() ?? "session"}:${path}`;
  const ui = useTreeUiStore(state => state.trees[scope]);
  const [loadError, setLoadError] = useState<string>();
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState<NodeDraft | null>(null);
  const [renaming, setRenaming] = useState<RenameDraft | null>(null);
  const [draftError, setDraftError] = useState<string>();
  const [detach, setDetach] = useState<{ nodeId: string; from: string } | null>(null);
  const [objectDraft, setObjectDraft] = useState<{ nodeId: string; draft: ObjectDraft } | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [sheet, setSheet] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    let cancelled = false;
    void useTreeStore.getState().load(path).catch(error => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Apertura non riuscita."); });
    return () => { cancelled = true; };
  }, [path]);
  const tree = session?.data;
  const expanded = useMemo(() => new Set(ui?.expanded ?? (tree ? [tree.rootId] : [])), [ui?.expanded, tree]);
  const outline = useMemo(() => tree ? buildOutline(tree, expanded, query, ui?.categoryId) : { rows: [], matchCount: 0 }, [tree, expanded, query, ui?.categoryId]);
  const selectedId = tree && nodeById(tree, ui?.selectedId ?? "") ? ui?.selectedId ?? tree.rootId : tree?.rootId;
  const selected = tree && selectedId ? nodeById(tree, selectedId) : undefined;
  const persist = (patch: { expanded?: string[]; selectedId?: string; categoryId?: string }) => useTreeUiStore.getState().update(scope, patch);
  const commit = (next: Tree, notice?: { nodeId: string; from: string } | null) => {
    useTreeStore.getState().edit(path, next);
    setDetach(notice ?? null);
    setDraftError(undefined);
  };
  const userExpanded = () => new Set(ui?.expanded ?? (tree ? [tree.rootId] : []));

  const startAdd = (parentId = selectedId) => {
    if (!tree || !parentId) return;
    const code = proposeChildCode(tree, parentId);
    if (!code) { setDraftError(`Nessun codice libero sotto ${nodeById(tree, parentId)?.code ?? "questo nodo"}`); return; }
    const open = userExpanded();
    open.add(parentId);
    persist({ expanded: [...open], selectedId: parentId });
    setRenaming(null);
    setAdding({ parentId, code, name: "" });
    setDraftError(undefined);
  };
  const startRename = (id = selectedId) => {
    if (!tree || !id) return;
    const node = nodeById(tree, id);
    if (!node) return;
    setAdding(null);
    setRenaming({ id, code: node.code, name: node.name });
    setDraftError(undefined);
    persist({ selectedId: id });
  };
  const cancelDraft = () => { setAdding(null); setRenaming(null); setDraftError(undefined); };
  const commitAdd = () => {
    if (!tree || !adding) return;
    const result = addChild(tree, adding.parentId, { code: adding.code, name: adding.name.trim() || "Nuovo nodo" });
    if (!result.ok) { setDraftError(result.error); return; }
    setAdding(null);
    commit(result.tree);
    persist({ selectedId: result.node.id });
  };
  const commitRename = () => {
    if (!tree || !renaming) return;
    const result = updateNode(tree, renaming.id, { code: renaming.code, name: renaming.name });
    if (!result.ok) { setDraftError(result.error); return; }
    setRenaming(null);
    commit(result.tree);
  };
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!tree) return;
    const target = event.target as HTMLElement;
    if (target.closest("dialog")) return;
    const typing = target.matches("input, textarea, select");
    if (event.key === "Escape") { cancelDraft(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") { event.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return; }
    if (typing) {
      if (event.key === "Enter" && !event.shiftKey && (adding || renaming)) { event.preventDefault(); if (adding) commitAdd(); else commitRename(); }
      return;
    }
    const nodeRows = outline.rows.filter(row => row.kind === "node");
    const index = nodeRows.findIndex(row => row.kind === "node" && row.id === selectedId);
    const current = selectedId ? nodeById(tree, selectedId) : undefined;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = nodeRows[index + (event.key === "ArrowDown" ? 1 : -1)];
      if (next?.kind === "node") persist({ selectedId: next.id });
    } else if (event.key === "ArrowRight" && current) {
      event.preventDefault();
      const row = outline.rows.find(item => item.kind === "node" && item.id === current.id);
      if (row?.kind === "node" && row.hasChildren && !row.expanded) {
        const open = userExpanded(); open.add(current.id); persist({ expanded: [...open] });
      } else {
        const child = childrenOf(tree, current.id)[0];
        if (child) persist({ selectedId: child.id });
      }
    } else if (event.key === "ArrowLeft" && current) {
      event.preventDefault();
      const row = outline.rows.find(item => item.kind === "node" && item.id === current.id);
      if (row?.kind === "node" && row.expanded && row.hasChildren) {
        const open = userExpanded(); open.delete(current.id); persist({ expanded: [...open] });
      } else if (current.parentId) persist({ selectedId: current.parentId });
    } else if (event.key === "*" && current) {
      event.preventDefault();
      const open = userExpanded();
      [current, ...descendants(tree, current.id)].forEach(node => open.add(node.id));
      persist({ expanded: [...open] });
    } else if (event.key === "Insert") { event.preventDefault(); startAdd(); }
    else if (event.key === "F2") { event.preventDefault(); startRename(); }
    else if (event.key === "Delete" && selectedId && !leafDeleteError(tree, selectedId)) { event.preventDefault(); setConfirm({ kind: "node", id: selectedId }); }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o" && selected) { event.preventDefault(); setObjectDraft({ nodeId: selected.id, draft: { type: "characteristic", kind: "own", code: "", description: "" } }); }
  };

  if (loadError && !session) return <div className="config-workspace"><h1>Impossibile aprire la struttura</h1><p className="config-error" role="alert">{loadError}</p><button className="button" onClick={() => { setLoadError(undefined); void useTreeStore.getState().load(path, true).catch(error => setLoadError(error instanceof Error ? error.message : "Apertura non riuscita.")); }}>Riprova</button></div>;
  if (!session || !tree || !selected) return <div className="editor-loading">Caricamento struttura…</div>;
  const saveStatus = treeSaveStatus(session);
  const report = inspectTree(tree);
  const levelCount = childrenOf(tree, tree.rootId).length;
  const applyCategories = (ids: string[]) => {
    const source = selected.categoryMode === "inherit" ? inheritSource(tree, selected.id) : undefined;
    const result = setNodeCategories(tree, selected.id, ids);
    if (!result.ok) return;
    commit(result.tree, result.detached && source && source.id !== selected.id ? { nodeId: selected.id, from: source.code } : null);
  };
  const download = () => {
    const blob = new Blob([serializeTreeFile(tree)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${tree.title || "struttura"}.tree.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="tree-workspace" onKeyDown={onKeyDown}>
      <section className="tree-main" aria-label="Albero">
        <header className="tree-heading">
          <ListTree size={22} />
          <div className="tree-heading-text"><h1>{tree.title}</h1><p>{path} · {levelCount} nodi di primo livello</p></div>
          <span className={`config-save-state save-status is-${saveStatusTone(saveStatus)}`} role="status">{saveStatusLabel(saveStatus)}</span>
          <div className="tree-heading-actions">
            <button type="button" className="button" onClick={download}><Download size={15} />Esporta</button>
            <button type="button" className="button button-primary" disabled={session.saving || session.conflict} onClick={() => void useTreeStore.getState().save(path)}><Save size={15} />Salva</button>
          </div>
        </header>
        {session.conflict && <p role="alert" className="config-error">Conflitto sul file. {session.error} <button type="button" className="tree-link" onClick={() => setConfirm({ kind: "reload" })}>Ricarica dal Vault</button></p>}
        {!session.conflict && session.error && <p role="alert" className="config-error">{session.error}</p>}
        {report.errors.length > 0 && !session.error && <p role="alert" className="config-error">{report.errors.map(issue => issue.message).join(" ")}</p>}
        <div className="tree-toolbar">
          <label className="tree-search"><Search size={15} aria-hidden="true" /><input ref={searchRef} aria-label="Cerca codice o nome" placeholder="Cerca codice o nome" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <span className="tree-count" aria-live="polite">{query.trim() || ui?.categoryId ? `${outline.matchCount} ${outline.matchCount === 1 ? "risultato" : "risultati"}` : `${tree.nodes.length} nodi`}</span>
          <label className="tree-filter">Categoria
            <select aria-label="Filtra per categoria" value={ui?.categoryId ?? ""} onChange={event => persist({ categoryId: event.target.value || undefined })}>
              <option value="">Tutte le categorie</option>
              {[...tree.categories].sort((a, b) => a.order - b.order).map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
          <button type="button" className="button" onClick={() => persist({ expanded: tree.nodes.filter(node => childrenOf(tree, node.id).length || node.objects.length).map(node => node.id) })}><ChevronsUpDown size={15} />Espandi</button>
          <button type="button" className="button" onClick={() => persist({ expanded: [] })}><ChevronsDownUp size={15} />Comprimi</button>
          <button type="button" className="button button-primary" onClick={() => startAdd()}><Plus size={15} />Aggiungi figlio</button>
          <button type="button" className="button tree-sheet-toggle" onClick={() => setSheet(value => !value)}>{sheet ? "Chiudi scheda" : "Scheda nodo"}</button>
        </div>
        {draftError && !adding && !renaming && <p role="alert" className="config-error">{draftError}</p>}
        <TreeOutline tree={tree} rows={outline.rows} selectedId={selected.id} query={query} renaming={renaming} adding={adding} draftError={draftError} onSelect={id => persist({ selectedId: id })} onToggle={id => { const open = userExpanded(); if (open.has(id)) open.delete(id); else open.add(id); persist({ expanded: [...open], selectedId: id }); }} onStartRename={startRename} onSelectObject={(nodeId, objectId) => { const object = nodeById(tree, nodeId)?.objects.find(item => item.id === objectId); if (object) setObjectDraft({ nodeId, draft: object }); persist({ selectedId: nodeId }); }} onRenameChange={setRenaming} onAddChange={draft => { setAdding(draft); setDraftError(undefined); }} />
        <div className="tree-legend" aria-label="Legenda categorie">
          {[...tree.categories].sort((a, b) => a.order - b.order).map(category => <button type="button" key={category.id} className={ui?.categoryId === category.id ? "is-active" : ""} style={{ background: category.color, color: readableOn(category.color) }} onClick={() => persist({ categoryId: ui?.categoryId === category.id ? undefined : category.id })}>{category.name}</button>)}
          <button type="button" onClick={() => setCategoriesOpen(true)}>Gestisci…</button>
        </div>
        {report.warnings.length > 0 && <details className="tree-warnings"><summary>{report.warnings.length} {report.warnings.length === 1 ? "avviso" : "avvisi"}, il salvataggio non è bloccato</summary><ul>{report.warnings.map(issue => <li key={`${issue.nodeId}:${issue.message}`}><button type="button" className="tree-link" onClick={() => issue.nodeId && persist({ selectedId: issue.nodeId })}>{issue.message}</button></li>)}</ul></details>}
        <p className="tree-keys">↑↓ muovi · ←→ espandi · * ramo · Ins figlio · F2 rinomina · Canc elimina · Ctrl F cerca · Ctrl O oggetto</p>
      </section>
      <div className={`tree-sheet ${sheet ? "is-open" : ""}`}>
        <button type="button" className="tree-sheet-close" aria-label="Chiudi scheda" onClick={() => setSheet(false)}><X size={16} /></button>
        <NodePanel
          tree={tree}
          node={selected}
          adding={adding}
          detach={detach}
          draftError={draftError}
          onDraftChange={draft => { setAdding(draft); setDraftError(undefined); }}
          onCode={code => { const result = updateNode(tree, selected.id, { code }); if (!result.ok) return result.error; commit(result.tree); return undefined; }}
          onName={name => { const result = updateNode(tree, selected.id, { name }); if (result.ok) commit(result.tree); }}
          onNote={note => { const result = updateNode(tree, selected.id, { note }); if (result.ok) commit(result.tree); }}
          onCategories={applyCategories}
          onInherit={() => { const result = inheritFromParent(tree, selected.id); if (result.ok) commit(result.tree); }}
          onUndoDetach={() => { const result = inheritFromParent(tree, selected.id); if (result.ok) commit(result.tree); }}
          onAddChild={() => startAdd(selected.id)}
          onRename={() => startRename(selected.id)}
          onDelete={() => setConfirm({ kind: "node", id: selected.id })}
          onAddObject={() => setObjectDraft({ nodeId: selected.id, draft: { type: "externalTable", tableName: "" } })}
          onEditObject={object => setObjectDraft({ nodeId: selected.id, draft: object })}
          onKind={(object, kind) => { if (object.type !== "characteristic") return; const result = upsertObject(tree, selected.id, { ...object, kind }); if (result.ok) commit(result.tree); }}
          onRemoveObject={object => setConfirm({ kind: "object", nodeId: selected.id, object })}
          onManageCategories={() => setCategoriesOpen(true)}
        />
      </div>
      {objectDraft && <ObjectDialog node={nodeById(tree, objectDraft.nodeId) ?? selected} draft={objectDraft.draft} onClose={() => setObjectDraft(null)} onSubmit={draft => { const result = upsertObject(tree, objectDraft.nodeId, draft); if (!result.ok) return; setObjectDraft(null); commit(result.tree); const open = userExpanded(); open.add(objectDraft.nodeId); persist({ expanded: [...open], selectedId: objectDraft.nodeId }); }} />}
      {categoriesOpen && (
        <CategoryDialog
          tree={tree}
          onClose={() => setCategoriesOpen(false)}
          rename={(id, name) => { const result = updateCategory(tree, id, { name }); if (result.ok) commit(result.tree); }}
          recolor={(id, color) => { const result = updateCategory(tree, id, { color }); if (result.ok) commit(result.tree); }}
          move={(id, delta) => { const result = moveCategory(tree, id, delta); if (result.ok) commit(result.tree); }}
          remove={(id, replacementId) => { const result = deleteCategory(tree, id, replacementId); if (!result.ok) return result.error; commit(result.tree); return undefined; }}
          add={(name, color) => { const result = addCategory(tree, name, color); if (!result.ok) return result.error; commit(result.tree); return undefined; }}
        />
      )}
      {confirm && <ConfirmDialog confirm={confirm} tree={tree} onClose={() => setConfirm(null)} onAccept={() => {
        if (confirm.kind === "reload") { setConfirm(null); void useTreeStore.getState().load(path, true).then(() => { setLoadError(undefined); cancelDraft(); }); return; }
        if (confirm.kind === "node") {
          const parentId = nodeById(tree, confirm.id)?.parentId ?? tree.rootId;
          const result = deleteLeaf(tree, confirm.id);
          if (result.ok) { commit(result.tree); persist({ selectedId: parentId }); }
        } else {
          const result = removeObject(tree, confirm.nodeId, confirm.object.id);
          if (result.ok) commit(result.tree);
        }
        setConfirm(null);
      }} />}
    </div>
  );
}

function ConfirmDialog({ confirm, tree, onClose, onAccept }: { confirm: Confirm; tree: Tree; onClose: () => void; onAccept: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const dialog = ref.current; if (typeof dialog?.showModal === "function") dialog.showModal(); return () => { if (dialog?.open) dialog.close(); }; }, []);
  const node = confirm.kind === "node" ? nodeById(tree, confirm.id) : undefined;
  const title = confirm.kind === "reload" ? "Ricaricare dal Vault?" : confirm.kind === "node" ? `Eliminare ${node?.code ?? "il nodo"}?` : `Rimuovere ${confirm.object.type === "externalTable" ? confirm.object.tableName : confirm.object.code}?`;
  const copy = confirm.kind === "reload" ? "Le modifiche di questa sessione andranno perse. Il file sul disco resta com'è." : confirm.kind === "node" ? `Il nodo «${node?.name ?? ""}» e i suoi oggetti verranno eliminati. I nodi con figli non si possono eliminare.` : "L'oggetto viene tolto solo da questo nodo.";
  return (
    <dialog ref={ref} className="editor-dialog tree-dialog" onCancel={event => { event.preventDefault(); onClose(); }} onClose={onClose}>
      <div className="editor-dialog-inner">
        <header><h2>{title}</h2><button type="button" aria-label="Chiudi" onClick={onClose}><X size={16} /></button></header>
        <div className="tree-dialog-body"><p>{copy}</p></div>
        <footer>
          <button type="button" className="button" onClick={onClose}>Annulla</button>
          <button type="button" className={`button ${confirm.kind === "reload" ? "button-primary" : "tree-danger"}`} onClick={onAccept}>{confirm.kind === "reload" ? "Ricarica" : "Elimina"}</button>
        </footer>
      </div>
    </dialog>
  );
}
