import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Download, ListTree, Plus, Save, Search, X } from "lucide-react";
import { vaultService } from "../vault/vaultService";
import { saveStatusLabel, saveStatusTone, treeSaveStatus } from "../workspace/saveStatus";
import { CategoryDialog } from "./CategoryDialog";
import { MoveBanner, MoveDialog, NodeContextMenu, type MoveNotice } from "./MoveDialog";
import { NodePanel } from "./NodePanel";
import type { ObjectListKind } from "./InlineObjects";
import { TreeOutline, type NodeDraft, type RenameDraft } from "./TreeOutline";
import { buildOutline } from "./outline";
import {
  addCategory, addChild, childrenOf, deleteCategory, deleteConfirmText, deleteNode, deleteNodeError, descendantCount, descendants, dropDestination, inheritFromParent, inheritSource,
  inspectTree, moveCategory, moveCommandReason, nodeById, planMove, proposeChildCode, readableOn, removeObject,
  reorderSibling, setNodeCategory, updateCategory, updateNode, upsertObject, type DropZone, type MovePlan, type Tree, type TreeObject,
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
  const [objectFocus, setObjectFocus] = useState<{ nodeId: string; objectId?: string; list?: ObjectListKind; token: number } | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [sheet, setSheet] = useState(false);
  const [movingId, setMovingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<MoveNotice | null>(null);
  const [renamedIds, setRenamedIds] = useState<string[]>([]);
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const renamed = useMemo(() => new Set(renamedIds), [renamedIds]);
  useEffect(() => {
    let cancelled = false;
    void useTreeStore.getState().load(path).catch(error => { if (!cancelled) setLoadError(error instanceof Error ? error.message : "Apertura non riuscita."); });
    return () => { cancelled = true; };
  }, [path]);
  const tree = session?.data;
  const expanded = useMemo(() => {
    const open = new Set(ui?.expanded ?? (tree ? [tree.rootId] : []));
    if (tree) open.add(tree.rootId);
    return open;
  }, [ui?.expanded, tree]);
  useEffect(() => {
    if (!tree?.rootId || !ui?.expanded || ui.expanded.includes(tree.rootId)) return;
    useTreeUiStore.getState().update(scope, { expanded: [tree.rootId, ...ui.expanded] });
  }, [tree?.rootId, ui?.expanded, scope]);
  const outline = useMemo(() => tree ? buildOutline(tree, expanded, query, ui?.categoryId) : { rows: [], matchCount: 0 }, [tree, expanded, query, ui?.categoryId]);
  const selectedId = tree && nodeById(tree, ui?.selectedId ?? "") ? ui?.selectedId ?? tree.rootId : tree?.rootId;
  const selected = tree && selectedId ? nodeById(tree, selectedId) : undefined;
  const persist = (patch: { expanded?: string[]; selectedId?: string; categoryId?: string }) => useTreeUiStore.getState().update(scope, patch);
  const commit = (next: Tree, detached?: { nodeId: string; from: string } | null) => {
    useTreeStore.getState().edit(path, next);
    setDetach(detached ?? null);
    setDraftError(undefined);
    setRenamedIds([]);
    setNotice(current => current?.kind === "err" ? current : null);
  };
  const userExpanded = () => {
    const open = new Set(ui?.expanded ?? (tree ? [tree.rootId] : []));
    if (tree) open.add(tree.rootId);
    return open;
  };
  const finishMove = (plan: MovePlan, nodeId: string) => {
    if (!tree) return;
    if (!plan.ok || !plan.tree) {
      setNotice({ kind: "err", title: `Spostamento bloccato · ${plan.errors.join(" · ")}`, renames: [], open: false });
      return;
    }
    const previous = nodeById(tree, nodeId);
    const moved = nodeById(plan.tree, nodeId);
    const samePlace = Boolean(previous?.parentId && moved?.parentId === previous.parentId && plan.renames.length === 0
      && childrenOf(tree, previous.parentId).map(child => child.id).join() === childrenOf(plan.tree, previous.parentId).map(child => child.id).join());
    if (samePlace) return;
    useTreeStore.getState().applyMove(path, plan.tree);
    const open = userExpanded();
    let cursor = moved;
    const seen = new Set<string>();
    while (cursor && !seen.has(cursor.id)) {
      seen.add(cursor.id);
      open.add(cursor.id);
      cursor = cursor.parentId ? nodeById(plan.tree, cursor.parentId) : undefined;
    }
    persist({ expanded: [...open], selectedId: nodeId });
    setDetach(null);
    setDraftError(undefined);
    setMovingId(null);
    setMenu(null);
    setRenamedIds(plan.renames.map(item => item.id));
    const renames = plan.renames.map(item => ({ ...item, name: nodeById(plan.tree!, item.id)?.name ?? "" }));
    const title = plan.sameParent
      ? `Riordinato · ${moved?.code ?? previous?.code ?? ""} · stesso padre: i codici non cambiano`
      : `Spostato · ${plan.renames.length === 1 ? "1 codice rinumerato" : `${plan.renames.length} codici rinumerati`} · ${plan.catChanged.length === 1 ? "1 nodo cambia categoria" : `${plan.catChanged.length} nodi cambiano categoria`}${plan.warnings.length ? ` · ${plan.warnings.join(" · ")}` : ""}`;
    setNotice({ kind: plan.sameParent ? "info" : "ok", title, renames, open: false });
  };
  const undoLastMove = () => {
    const current = useTreeStore.getState().sessions[path];
    if (!current?.moveUndo) {
      setNotice({ kind: "info", title: "Niente da annullare: si annulla solo l'ultimo spostamento o l'ultima eliminazione, finché non fai altre modifiche.", renames: [], open: false });
      return;
    }
    const kind = current.moveUndo.kind;
    useTreeStore.getState().undoMove(path);
    setRenamedIds([]);
    setDetach(null);
    setNotice({
      kind: "info",
      title: kind === "delete"
        ? "Eliminazione annullata: nodi, ordine, codici, categorie e note ripristinati."
        : "Spostamento annullato: posizione, codici e categorie ripristinati.",
      renames: [],
      open: false,
    });
  };
  const attemptDrop = (dragId: string, targetId: string, zone: DropZone) => {
    if (!tree) return;
    const destination = dropDestination(tree, dragId, targetId, zone);
    if (!destination) return;
    finishMove(planMove(tree, dragId, destination.parentId, destination.index), dragId);
  };
  const openMove = (id = selectedId) => {
    if (!tree || !id) return;
    const reason = moveCommandReason(tree, id);
    if (reason) { setNotice({ kind: "info", title: reason, renames: [], open: false }); return; }
    setAdding(null);
    setRenaming(null);
    setMenu(null);
    setMovingId(id);
    persist({ selectedId: id });
  };

  const focusObjects = (nodeId: string, target: { objectId?: string; list?: ObjectListKind }) => {
    setObjectFocus({ nodeId, objectId: target.objectId, list: target.list, token: Date.now() });
    setSheet(true);
    const open = userExpanded();
    open.add(nodeId);
    persist({ expanded: [...open], selectedId: nodeId });
  };
  const startAdd = (parentId = selectedId) => {
    if (!tree || !parentId) return;
    const code = proposeChildCode(tree, parentId);
    if (!code) { setDraftError(`Nessun codice libero sotto ${nodeById(tree, parentId)?.code ?? "questo nodo"}`); return; }
    const open = userExpanded();
    open.add(parentId);
    persist({ expanded: [...open], selectedId: parentId });
    setRenaming(null);
    setAdding({ parentId, code, name: "Nuovo nodo" });
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
    if (event.key === "Escape") { if (menu) { setMenu(null); return; } cancelDraft(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z" && !event.shiftKey && !typing) { event.preventDefault(); undoLastMove(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "m" && !typing) { event.preventDefault(); openMove(); return; }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "f") { event.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return; }
    if (typing) {
      if (event.key === "Enter" && !event.shiftKey && (adding || renaming)) { event.preventDefault(); if (adding) commitAdd(); else commitRename(); }
      return;
    }
    const nodeRows = outline.rows.filter(row => row.kind === "node");
    const index = nodeRows.findIndex(row => row.kind === "node" && row.id === selectedId);
    const current = selectedId ? nodeById(tree, selectedId) : undefined;
    if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown") && selectedId) {
      event.preventDefault();
      const plan = reorderSibling(tree, selectedId, event.key === "ArrowUp" ? -1 : 1);
      if (plan) finishMove(plan, selectedId);
      return;
    }
    if ((event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) && selectedId) {
      event.preventDefault();
      setMenu({ id: selectedId, x: 96, y: 180 });
      return;
    }
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
      if (current.id === tree.rootId) return;
      const row = outline.rows.find(item => item.kind === "node" && item.id === current.id);
      if (row?.kind === "node" && row.expanded && row.hasChildren) {
        const open = userExpanded(); open.delete(current.id); open.add(tree.rootId); persist({ expanded: [...open] });
      } else if (current.parentId) persist({ selectedId: current.parentId });
    } else if (event.key === "*" && current) {
      event.preventDefault();
      const open = userExpanded();
      [current, ...descendants(tree, current.id)].forEach(node => open.add(node.id));
      persist({ expanded: [...open] });
    } else if (event.key === "Insert") { event.preventDefault(); startAdd(); }
    else if (event.key === "F2") { event.preventDefault(); startRename(); }
    else if (event.key === "Delete" && selectedId) {
      event.preventDefault();
      const reason = deleteNodeError(tree, selectedId);
      if (reason) { setNotice({ kind: "info", title: reason, renames: [], open: false }); return; }
      setConfirm({ kind: "node", id: selectedId });
    }
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "o" && selected) { event.preventDefault(); focusObjects(selected.id, { list: "own" }); }
  };

  if (loadError && !session) return <div className="config-workspace"><h1>Impossibile aprire la struttura</h1><p className="config-error" role="alert">{loadError}</p><button className="button" onClick={() => { setLoadError(undefined); void useTreeStore.getState().load(path, true).catch(error => setLoadError(error instanceof Error ? error.message : "Apertura non riuscita.")); }}>Riprova</button></div>;
  if (!session || !tree || !selected) return <div className="editor-loading">Caricamento struttura…</div>;
  const saveStatus = treeSaveStatus(session);
  const report = inspectTree(tree);
  const levelCount = childrenOf(tree, tree.rootId).length;
  const applyCategory = (categoryId: string | null) => {
    const source = selected.categoryMode === "inherit" ? inheritSource(tree, selected.id) : undefined;
    const result = setNodeCategory(tree, selected.id, categoryId);
    if (!result.ok) return;
    commit(result.tree, result.detached && source && source.id !== selected.id ? { nodeId: selected.id, from: source.code } : null);
  };
  const finishDelete = (id: string) => {
    const target = nodeById(tree, id);
    const result = deleteNode(tree, id);
    if (!result.ok || !target) return;
    const parentId = target.parentId ?? tree.rootId;
    const descendantsTotal = descendantCount(tree, id);
    useTreeStore.getState().applyDelete(path, result.tree);
    setDetach(null);
    setDraftError(undefined);
    setRenamedIds([]);
    setAdding(null);
    setRenaming(null);
    persist({ selectedId: parentId });
    const title = descendantsTotal > 0
      ? `Eliminato ${target.code} e ${descendantsTotal === 1 ? "1 nodo discendente" : `${descendantsTotal} nodi discendenti`}. Annulla ripristina nodi, ordine, codici, categorie e note.`
      : `Eliminato ${target.code}. Annulla ripristina il nodo, il codice, la categoria e la nota.`;
    setNotice({ kind: "ok", title, renames: [], open: false, undoLabel: "Annulla eliminazione" });
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
          <button type="button" className="button" onClick={() => persist({ expanded: [tree.rootId] })}><ChevronsDownUp size={15} />Comprimi</button>
          <button type="button" className="button button-primary" onClick={() => startAdd()}><Plus size={15} />Aggiungi figlio</button>
          <button type="button" className="button" disabled={Boolean(moveCommandReason(tree, selected.id))} title={moveCommandReason(tree, selected.id) ?? "Scegli il nuovo padre (Ctrl M)"} onClick={() => openMove(selected.id)}>Sposta in…</button>
          <button type="button" className="button tree-sheet-toggle" onClick={() => setSheet(value => !value)}>{sheet ? "Chiudi scheda" : "Scheda nodo"}</button>
        </div>
        {draftError && !adding && !renaming && <p role="alert" className="config-error">{draftError}</p>}
        {notice && <MoveBanner notice={notice} canUndo={Boolean(session.moveUndo)} onToggle={() => setNotice({ ...notice, open: !notice.open })} onUndo={undoLastMove} onClose={() => setNotice(null)} />}
        <TreeOutline tree={tree} rows={outline.rows} selectedId={selected.id} query={query} renaming={renaming} adding={adding} draftError={draftError} renamedIds={renamed} onSelect={id => { setMenu(null); persist({ selectedId: id }); }} onToggle={id => { if (id === tree.rootId) return; const open = userExpanded(); if (open.has(id)) open.delete(id); else open.add(id); open.add(tree.rootId); persist({ expanded: [...open], selectedId: id }); }} onStartRename={startRename} onSelectObject={(nodeId, objectId) => focusObjects(nodeId, { objectId })} onRenameChange={setRenaming} onAddChange={draft => { setAdding(draft); setDraftError(undefined); }} onMoveAttempt={attemptDrop} onRequestMove={openMove} onContextMenu={(id, x, y) => setMenu({ id, x, y })} />
        <div className="tree-legend" aria-label="Legenda categorie">
          {[...tree.categories].sort((a, b) => a.order - b.order).map(category => <button type="button" key={category.id} className={ui?.categoryId === category.id ? "is-active" : ""} style={{ background: category.color, color: readableOn(category.color) }} onClick={() => persist({ categoryId: ui?.categoryId === category.id ? undefined : category.id })}>{category.name}</button>)}
          <button type="button" onClick={() => setCategoriesOpen(true)}>Gestisci…</button>
        </div>
        {report.warnings.length > 0 && <details className="tree-warnings"><summary>{report.warnings.length} {report.warnings.length === 1 ? "avviso" : "avvisi"}, il salvataggio non è bloccato</summary><ul>{report.warnings.map(issue => <li key={`${issue.nodeId}:${issue.message}`}><button type="button" className="tree-link" onClick={() => issue.nodeId && persist({ selectedId: issue.nodeId })}>{issue.message}</button></li>)}</ul></details>}
        <p className="tree-keys">↑↓ muovi · ←→ espandi · * ramo · Ins figlio · F2 rinomina · Canc elimina · Alt ↑↓ riordina (i codici non cambiano) · Ctrl M sposta · Ctrl Z annulla spostamento o eliminazione · Ctrl F cerca · Ctrl O nuova caratteristica</p>
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
          onCategory={applyCategory}
          onInherit={() => { const result = inheritFromParent(tree, selected.id); if (result.ok) commit(result.tree); }}
          onUndoDetach={() => { const result = inheritFromParent(tree, selected.id); if (result.ok) commit(result.tree); }}
          onAddChild={() => startAdd(selected.id)}
          onRename={() => startRename(selected.id)}
          onMove={() => openMove(selected.id)}
          onDelete={() => { if (deleteNodeError(tree, selected.id)) return; setConfirm({ kind: "node", id: selected.id }); }}
          onSaveObject={draft => { const result = upsertObject(tree, selected.id, draft); if (!result.ok) return result.error; commit(result.tree); const open = userExpanded(); open.add(selected.id); persist({ expanded: [...open], selectedId: selected.id }); return undefined; }}
          onRemoveObject={object => setConfirm({ kind: "object", nodeId: selected.id, object })}
          onManageCategories={() => setCategoriesOpen(true)}
          editingObjectId={objectFocus?.nodeId === selected.id ? objectFocus.objectId : undefined}
          focusList={objectFocus?.nodeId === selected.id ? objectFocus.list : undefined}
          focusToken={objectFocus?.nodeId === selected.id ? objectFocus.token : undefined}
        />
      </div>
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
      {movingId && <MoveDialog tree={tree} nodeId={movingId} onClose={() => setMovingId(null)} onConfirm={parentId => { const id = movingId; finishMove(planMove(tree, id, parentId, null), id); }} />}
      {menu && <NodeContextMenu tree={tree} nodeId={menu.id} x={menu.x} y={menu.y} onClose={() => setMenu(null)} onAdd={() => startAdd(menu.id)} onObject={() => focusObjects(menu.id, { list: "own" })} onRename={() => startRename(menu.id)} onMove={() => openMove(menu.id)} onDelete={() => { if (deleteNodeError(tree, menu.id)) return; setConfirm({ kind: "node", id: menu.id }); }} />}
      {confirm && <ConfirmDialog confirm={confirm} tree={tree} onClose={() => setConfirm(null)} onAccept={() => {
        if (confirm.kind === "reload") { setConfirm(null); void useTreeStore.getState().load(path, true).then(() => { setLoadError(undefined); cancelDraft(); }); return; }
        if (confirm.kind === "node") finishDelete(confirm.id);
        else {
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
  const removal = confirm.kind === "node" && node ? deleteConfirmText(node.code, descendantCount(tree, node.id)) : "";
  const title = confirm.kind === "reload" ? "Ricaricare dal Vault?" : confirm.kind === "node" ? removal.split("?")[0] + "?" : `Rimuovere ${confirm.object.type === "externalTable" ? confirm.object.tableName : confirm.object.code}?`;
  const copy = confirm.kind === "reload" ? "Le modifiche di questa sessione andranno perse. Il file sul disco resta com'è." : confirm.kind === "node" ? removal.slice(removal.indexOf("?") + 1).trim() : "L'oggetto viene tolto solo da questo nodo.";
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
