import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, GripVertical, Link2 } from "lucide-react";
import { dropDestination, dropZoneAt, isDescendant, nodeById, principalCategory, effectiveCategories, type DropZone, type Tree } from "./model";
import { objectLeafText, objectPresentation } from "./objectIcons";
import { ROW_HEIGHT, virtualWindow, type OutlineRow } from "./outline";

export interface NodeDraft { parentId: string; code: string; name: string }
export interface RenameDraft { id: string; code: string; name: string }

interface TreeOutlineProps {
  tree: Tree;
  rows: OutlineRow[];
  selectedId?: string;
  query: string;
  renaming: RenameDraft | null;
  adding: NodeDraft | null;
  draftError?: string;
  renamedIds: ReadonlySet<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onStartRename: (id: string) => void;
  onSelectObject: (parentId: string, objectId: string) => void;
  onRenameChange: (draft: RenameDraft) => void;
  onAddChange: (draft: NodeDraft) => void;
  onMoveAttempt: (dragId: string, targetId: string, zone: DropZone) => void;
  onRequestMove: (id: string) => void;
  onContextMenu: (id: string, x: number, y: number) => void;
}

interface DragState { id: string; overId?: string; zone?: DropZone; blocked?: boolean; sameParent?: boolean }

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const index = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (index < 0) return <>{text}</>;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + needle.length)}</mark>{text.slice(index + needle.length)}</>;
}

function useFinePointer(): boolean {
  const [fine, setFine] = useState(true);
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(pointer: fine)");
    const apply = () => setFine(media.matches);
    apply();
    media.addEventListener?.("change", apply);
    return () => media.removeEventListener?.("change", apply);
  }, []);
  return fine;
}

export function TreeOutline({ tree, rows, selectedId, query, renaming, adding, draftError, renamedIds, onSelect, onToggle, onStartRename, onSelectObject, onRenameChange, onAddChange, onMoveAttempt, onRequestMove, onContextMenu }: TreeOutlineProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const selected = useRef<HTMLDivElement>(null);
  const dragIdRef = useRef<string | null>(null);
  const dropped = useRef(false);
  const gesture = useRef<(() => void) | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(640);
  const [drag, setDrag] = useState<DragState | null>(null);
  const fine = useFinePointer();
  useEffect(() => () => gesture.current?.(), []);
  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setViewport(element.clientHeight || 640));
    observer.observe(element);
    setViewport(element.clientHeight || 640);
    return () => observer.disconnect();
  }, []);
  const range = virtualWindow(rows.length, scrollTop, viewport);
  const visible = rows.slice(range.start, range.end);
  const virtual = rows.length > 1000;
  useEffect(() => { selected.current?.scrollIntoView?.({ block: "nearest" }); }, [selectedId, renaming?.id, adding?.parentId]);
  const draftIndex = adding ? draftInsert(rows, adding.parentId) : -1;
  const remember = (next: DragState | null) => setDrag(next);
  const updateHover = (dragId: string, targetId: string, zone: DropZone) => {
    const destination = dropDestination(tree, dragId, targetId, zone);
    const blocked = !destination || isDescendant(tree, destination.parentId, dragId);
    const dragged = nodeById(tree, dragId);
    remember({ id: dragId, overId: targetId, zone, blocked, sameParent: Boolean(destination && dragged?.parentId === destination.parentId) });
  };
  const beginGesture = (event: React.PointerEvent<HTMLElement>, id: string) => {
    if (event.button !== 0) return;
    gesture.current?.();
    const pointerId = event.pointerId;
    const originX = event.clientX;
    const originY = event.clientY;
    const handle = event.currentTarget;
    const coarse = event.pointerType !== "mouse";
    let dragging = false;
    let cancelled = false;
    let armed = !coarse;
    let hoveredOther = false;
    const timer = coarse ? window.setTimeout(() => { armed = true; }, 450) : 0;
    const pointTarget = (clientX: number, clientY: number) => {
      const element = document.elementFromPoint(clientX, clientY)?.closest<HTMLElement>("[data-node-id]");
      const targetId = element?.getAttribute("data-node-id") ?? undefined;
      return { element, targetId };
    };
    const stop = () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      if (gesture.current === stop) gesture.current = null;
      dragIdRef.current = null;
      remember(null);
    };
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const distance = Math.hypot(ev.clientX - originX, ev.clientY - originY);
      if (!armed) {
        if (distance > 10) { cancelled = true; stop(); }
        return;
      }
      if (!dragging) {
        if (distance < 5) return;
        dragging = true;
        dropped.current = true;
        dragIdRef.current = id;
        remember({ id });
        try { handle.setPointerCapture(pointerId); } catch { /* il puntatore può essere già stato rilasciato */ }
      }
      ev.preventDefault();
      const { element, targetId } = pointTarget(ev.clientX, ev.clientY);
      if (!element || !targetId) return;
      if (targetId !== id) hoveredOther = true;
      const rect = element.getBoundingClientRect();
      updateHover(id, targetId, dropZoneAt(rect.height ? (ev.clientY - rect.top) / rect.height : 0.5));
    };
    const up = (ev: PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      window.clearTimeout(timer);
      if (dragging && hoveredOther) {
        const { element, targetId } = pointTarget(ev.clientX, ev.clientY);
        if (element && targetId) {
          const rect = element.getBoundingClientRect();
          onMoveAttempt(id, targetId, dropZoneAt(rect.height ? (ev.clientY - rect.top) / rect.height : 0.5));
        }
      } else if (coarse && !armed && !cancelled) onRequestMove(id);
      stop();
    };
    gesture.current = stop;
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const hint = dragHint(tree, drag);
  return (
    <>
      <div className="tree-outline">
      {hint && <p className="tree-drop-hint" role="status">{hint}</p>}
      <div
        ref={scroller}
        className="tree-scroll"
        tabIndex={0}
        onScroll={event => setScrollTop(event.currentTarget.scrollTop)}
        onMouseDown={event => {
          const target = event.target as HTMLElement;
          if (target.closest("input, textarea, select")) return;
          scroller.current?.focus({ preventScroll: true });
        }}
      >
        {virtual && <div style={{ height: range.start * ROW_HEIGHT }} />}
        <div role="tree" aria-label={tree.title}>
          {visible.map((row, offset) => {
            const index = range.start + offset;
            return (
              <div key={row.kind === "node" ? row.id : `${row.parentId}:${row.id}`}>
                {adding && index === draftIndex && <DraftRow tree={tree} draft={adding} error={draftError} onChange={onAddChange} />}
                {row.kind === "node"
                  ? <NodeRow tree={tree} row={row} index={index} total={rows.length} selected={row.id === selectedId} query={query} renaming={renaming?.id === row.id ? renaming : null} renamed={renamedIds.has(row.id)} drag={drag} fine={fine} dragged={dropped} selectedRef={row.id === selectedId ? selected : undefined} onSelect={onSelect} onToggle={onToggle} onStartRename={onStartRename} onRenameChange={onRenameChange} onPointerDown={beginGesture} onRequestMove={onRequestMove} onContextMenu={onContextMenu} />
                  : <ObjectRow tree={tree} row={row} onSelect={onSelectObject} />}
              </div>
            );
          })}
          {adding && draftIndex >= range.end && <DraftRow tree={tree} draft={adding} error={draftError} onChange={onAddChange} />}
        </div>
        {virtual && <div style={{ height: Math.max(0, rows.length - range.end) * ROW_HEIGHT }} />}
      </div>
      </div>
    </>
  );
}

function dragHint(tree: Tree, drag: DragState | null): string {
  if (!drag?.overId || !drag.zone) return "";
  if (drag.blocked) return "Non puoi spostare il nodo dentro se stesso o un suo discendente";
  if (drag.sameParent) return "Stesso padre: i codici non cambiano";
  const code = nodeById(tree, drag.overId)?.code ?? "";
  if (drag.zone === "inside") return `Dentro ${code}, in coda`;
  return drag.zone === "before" ? `Prima di ${code}` : `Dopo ${code}`;
}

function draftInsert(rows: OutlineRow[], parentId: string): number {
  const parentIndex = rows.findIndex(row => row.kind === "node" && row.id === parentId);
  if (parentIndex < 0) return rows.length;
  const parent = rows[parentIndex]!;
  if (parent.kind !== "node") return parentIndex + 1;
  let index = parentIndex + 1;
  while (index < rows.length) {
    const row = rows[index]!;
    if (row.kind === "object" && row.parentId === parentId) break;
    if (row.depth <= parent.depth) break;
    index += 1;
  }
  return index;
}

function NodeRow({ tree, row, index, total, selected, query, renaming, renamed, drag, fine, dragged, selectedRef, onSelect, onToggle, onStartRename, onRenameChange, onPointerDown, onRequestMove, onContextMenu }: { tree: Tree; row: Extract<OutlineRow, { kind: "node" }>; index: number; total: number; selected: boolean; query: string; renaming: RenameDraft | null; renamed: boolean; drag: DragState | null; fine: boolean; dragged: React.RefObject<boolean>; selectedRef?: React.Ref<HTMLDivElement>; onSelect: (id: string) => void; onToggle: (id: string) => void; onStartRename: (id: string) => void; onRenameChange: (draft: RenameDraft) => void; onPointerDown: (event: React.PointerEvent<HTMLElement>, id: string) => void; onRequestMove: (id: string) => void; onContextMenu: (id: string, x: number, y: number) => void }) {
  const node = nodeById(tree, row.id);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (renaming) codeRef.current?.select(); }, [renaming]);
  if (!node) return null;
  const color = principalCategory(tree, node.id)?.color;
  const extra = effectiveCategories(tree, node.id).slice(1);
  const dots = extra.slice(0, 3);
  const source = node.categoryMode === "inherit" ? nodeById(tree, node.parentId ?? "") : undefined;
  const dropClass = drag?.overId === node.id ? drag.blocked ? "is-drop-no" : drag.zone === "inside" ? "is-drop-inside" : drag.zone === "before" ? "is-drop-before" : "is-drop-after" : "";
  return (
    <div
      ref={selectedRef}
      role="treeitem"
      data-node-id={node.id}
      aria-level={row.depth}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      aria-selected={selected}
      aria-setsize={total}
      aria-posinset={index + 1}
      aria-grabbed={drag?.id === node.id || undefined}
      className={`tree-item ${selected ? "is-selected" : ""} ${row.dimmed ? "is-dimmed" : ""} ${row.matched ? "is-match" : ""} ${renamed ? "is-renamed" : ""} ${drag?.id === node.id ? "is-dragging" : ""} ${dropClass}`}
      style={{ paddingLeft: 8 + (row.depth - 1) * 18 }}
      onClick={() => onSelect(node.id)}
      onDoubleClick={() => onStartRename(node.id)}
      onContextMenu={event => { event.preventDefault(); onSelect(node.id); onContextMenu(node.id, event.clientX, event.clientY); }}
    >
      <button type="button" className="tree-disclosure" aria-label={row.expanded ? `Comprimi ${node.code}` : `Espandi ${node.code}`} disabled={!row.hasChildren} onClick={event => { event.stopPropagation(); onToggle(node.id); }}>{row.hasChildren ? row.expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : <span className="tree-disclosure-spacer" />}</button>
      {node.parentId != null && (
        <span
          role="button"
          tabIndex={-1}
          className="tree-grip"
          aria-label={fine ? `Trascina ${node.code}` : `Sposta ${node.code}`}
          title={fine ? "Trascina: linea prima o dopo, riquadro dentro. Tra fratelli i codici non cambiano." : "Tieni premuto per trascinare. Un tocco breve apre Sposta in…"}
          onPointerDown={event => onPointerDown(event, node.id)}
          onClick={event => { if (dragged.current) { event.preventDefault(); event.stopPropagation(); dragged.current = false; } }}
          onKeyDown={event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); event.stopPropagation(); onRequestMove(node.id); } }}
        >
          <GripVertical size={14} aria-hidden="true" />
        </span>
      )}
      <span className="tree-swatch" style={{ background: color ?? "transparent" }} />
      {renaming ? (
        <span className="tree-rename">
          <input ref={codeRef} aria-label={`Codice di ${node.code}`} value={renaming.code} onChange={event => onRenameChange({ ...renaming, code: event.target.value })} onClick={event => event.stopPropagation()} />
          <input aria-label={`Nome di ${node.code}`} value={renaming.name} onChange={event => onRenameChange({ ...renaming, name: event.target.value })} onClick={event => event.stopPropagation()} />
        </span>
      ) : (
        <span className="tree-label">
          <strong><Highlight text={node.code} query={query} /></strong>
          <span><Highlight text={node.name} query={query} /></span>
        </span>
      )}
      {node.categoryMode === "inherit" && source && <Link2 size={13} className="tree-inherit" aria-label={`Eredita le categorie da ${source.code}`} />}
      {dots.map(id => {
        const category = tree.categories.find(item => item.id === id);
        return category ? <span key={id} className="tree-dot" style={{ background: category.color }} title={category.name} /> : null;
      })}
      {extra.length > dots.length && <span className="tree-more-cats">+{extra.length - dots.length}</span>}
    </div>
  );
}

function ObjectRow({ tree, row, onSelect }: { tree: Tree; row: Extract<OutlineRow, { kind: "object" }>; onSelect: (parentId: string, objectId: string) => void }) {
  const parent = nodeById(tree, row.parentId);
  const object = parent?.objects.find(item => item.id === row.id);
  if (!object) return null;
  const presentation = objectPresentation(object);
  const Icon = presentation.Icon;
  return (
    <button type="button" className={`tree-object ${row.dimmed ? "is-dimmed" : ""} ${presentation.className}`} style={{ paddingLeft: 28 + row.depth * 18 }} onClick={() => onSelect(row.parentId, row.id)}>
      <Icon size={14} aria-hidden="true" fill={presentation.filled ? "currentColor" : "none"} />
      <span>{objectLeafText(object)}</span>
      <small>{presentation.label}</small>
    </button>
  );
}

function DraftRow({ tree, draft, error, onChange }: { tree: Tree; draft: NodeDraft; error?: string; onChange: (draft: NodeDraft) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.select(); }, [draft.parentId]);
  const level = Math.max(2, depthOfParent(tree, draft.parentId) + 1);
  return (
    <div role="treeitem" aria-selected="true" aria-level={level} className="tree-item is-selected is-draft" style={{ paddingLeft: 8 + (level - 1) * 18 }}>
      <span className="tree-disclosure-spacer" />
      <span className="tree-swatch" />
      <span className="tree-rename">
        <input ref={ref} aria-label="Codice del nuovo nodo" value={draft.code} onChange={event => onChange({ ...draft, code: event.target.value })} />
        <input aria-label="Nome del nuovo nodo" value={draft.name} placeholder="Nome del nodo" onChange={event => onChange({ ...draft, name: event.target.value })} />
      </span>
      {error && <span role="alert" className="tree-inline-error">{error}</span>}
    </div>
  );
}

function depthOfParent(tree: Tree, id: string): number {
  let depth = 1;
  let current = nodeById(tree, id);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) { seen.add(current.id); depth += 1; current = nodeById(tree, current.parentId); }
  return depth;
}
