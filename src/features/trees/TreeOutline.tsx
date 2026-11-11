import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Link2 } from "lucide-react";
import { effectiveCategories, nodeById, principalCategory, type Tree } from "./model";
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
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onStartRename: (id: string) => void;
  onSelectObject: (parentId: string, objectId: string) => void;
  onRenameChange: (draft: RenameDraft) => void;
  onAddChange: (draft: NodeDraft) => void;
}

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const index = text.toLocaleLowerCase().indexOf(needle.toLocaleLowerCase());
  if (index < 0) return <>{text}</>;
  return <>{text.slice(0, index)}<mark>{text.slice(index, index + needle.length)}</mark>{text.slice(index + needle.length)}</>;
}

export function TreeOutline({ tree, rows, selectedId, query, renaming, adding, draftError, onSelect, onToggle, onStartRename, onSelectObject, onRenameChange, onAddChange }: TreeOutlineProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const selected = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewport, setViewport] = useState(640);
  useEffect(() => {
    const element = scroller.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setViewport(element.clientHeight || 640));
    observer.observe(element);
    setViewport(element.clientHeight || 640);
    return () => observer.disconnect();
  }, []);
  const window = virtualWindow(rows.length, scrollTop, viewport);
  const visible = rows.slice(window.start, window.end);
  const virtual = rows.length > 1000;
  useEffect(() => { selected.current?.scrollIntoView?.({ block: "nearest" }); }, [selectedId, renaming?.id, adding?.parentId]);
  const draftIndex = adding ? draftInsert(rows, adding.parentId) : -1;
  return (
    <div ref={scroller} className="tree-scroll" tabIndex={0} onScroll={event => setScrollTop(event.currentTarget.scrollTop)}>
      {virtual && <div style={{ height: window.start * ROW_HEIGHT }} />}
      <div role="tree" aria-label={tree.title}>
        {visible.map((row, offset) => {
          const index = window.start + offset;
          return (
            <div key={row.kind === "node" ? row.id : `${row.parentId}:${row.id}`}>
              {adding && index === draftIndex && <DraftRow tree={tree} draft={adding} error={draftError} onChange={onAddChange} />}
              {row.kind === "node"
                ? <NodeRow tree={tree} row={row} index={index} total={rows.length} selected={row.id === selectedId} query={query} renaming={renaming?.id === row.id ? renaming : null} selectedRef={row.id === selectedId ? selected : undefined} onSelect={onSelect} onToggle={onToggle} onStartRename={onStartRename} onRenameChange={onRenameChange} />
                : <ObjectRow tree={tree} row={row} onSelect={onSelectObject} />}
            </div>
          );
        })}
        {adding && draftIndex >= window.end && <DraftRow tree={tree} draft={adding} error={draftError} onChange={onAddChange} />}
      </div>
      {virtual && <div style={{ height: Math.max(0, rows.length - window.end) * ROW_HEIGHT }} />}
    </div>
  );
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

function NodeRow({ tree, row, index, total, selected, query, renaming, selectedRef, onSelect, onToggle, onStartRename, onRenameChange }: { tree: Tree; row: Extract<OutlineRow, { kind: "node" }>; index: number; total: number; selected: boolean; query: string; renaming: RenameDraft | null; selectedRef?: React.Ref<HTMLDivElement>; onSelect: (id: string) => void; onToggle: (id: string) => void; onStartRename: (id: string) => void; onRenameChange: (draft: RenameDraft) => void }) {
  const node = nodeById(tree, row.id);
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (renaming) codeRef.current?.select(); }, [renaming]);
  if (!node) return null;
  const color = principalCategory(tree, node.id)?.color;
  const extra = effectiveCategories(tree, node.id).slice(1);
  const dots = extra.slice(0, 3);
  const source = node.categoryMode === "inherit" ? nodeById(tree, node.parentId ?? "") : undefined;
  return (
    <div
      ref={selectedRef}
      role="treeitem"
      aria-level={row.depth}
      aria-expanded={row.hasChildren ? row.expanded : undefined}
      aria-selected={selected}
      aria-setsize={total}
      aria-posinset={index + 1}
      className={`tree-item ${selected ? "is-selected" : ""} ${row.dimmed ? "is-dimmed" : ""} ${row.matched ? "is-match" : ""}`}
      style={{ paddingLeft: 8 + (row.depth - 1) * 18 }}
      onClick={() => onSelect(node.id)}
      onDoubleClick={() => onStartRename(node.id)}
    >
      <button type="button" className="tree-disclosure" aria-label={row.expanded ? `Comprimi ${node.code}` : `Espandi ${node.code}`} disabled={!row.hasChildren} onClick={event => { event.stopPropagation(); onToggle(node.id); }}>{row.hasChildren ? row.expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} /> : <span className="tree-disclosure-spacer" />}</button>
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
