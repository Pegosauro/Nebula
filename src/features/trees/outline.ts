import { effectiveCategoryMap, type Tree, type TreeNode } from "./model";

export const ROW_HEIGHT = 32;
export const VIRTUALIZE_AFTER = 1000;

export interface OutlineNodeRow { kind: "node"; id: string; depth: number; hasChildren: boolean; expanded: boolean; dimmed: boolean; matched: boolean }
export interface OutlineObjectRow { kind: "object"; id: string; parentId: string; depth: number; dimmed: boolean }
export type OutlineRow = OutlineNodeRow | OutlineObjectRow;

export function virtualWindow(count: number, scrollTop: number, viewport: number, rowHeight = ROW_HEIGHT, overscan = 8): { start: number; end: number } {
  if (count <= VIRTUALIZE_AFTER) return { start: 0, end: count };
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const end = Math.min(count, Math.ceil((scrollTop + viewport) / rowHeight) + overscan);
  return { start, end };
}

function includesQuery(node: TreeNode, query: string): boolean {
  return node.code.toLocaleLowerCase().includes(query) || node.name.toLocaleLowerCase().includes(query);
}

/** Il filtro categorie nasconde i nodi esclusi; gli antenati nascosti non interrompono i rami. */
export function buildOutline(tree: Tree, expanded: ReadonlySet<string>, query: string, categoryFilter?: string | readonly string[], showUnmatched = false): { rows: OutlineRow[]; matchCount: number } {
  const normalized = query.trim().toLocaleLowerCase();
  const filters = new Set(typeof categoryFilter === "string" ? [categoryFilter] : categoryFilter ?? []);
  const filtered = filters.size > 0;
  const hide = filtered && !showUnmatched;
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const children = new Map<string, TreeNode[]>();
  for (const node of tree.nodes) if (node.parentId) {
    const list = children.get(node.parentId) ?? [];
    list.push(node); children.set(node.parentId, list);
  }
  for (const list of children.values()) list.sort((a, b) => a.order - b.order);
  const categories = effectiveCategoryMap(tree);
  const matching = new Set<string>();
  if (normalized || filtered) for (const node of tree.nodes) {
    if ((!normalized || includesQuery(node, normalized)) && (!filtered || filters.has(categories.get(node.id) ?? ""))) matching.add(node.id);
  }
  const keepBright = new Set(matching);
  const forceOpen = new Set<string>();
  for (const id of matching) {
    let current = byId.get(id);
    const seen = new Set<string>();
    while (current?.parentId && !seen.has(current.id)) {
      seen.add(current.id);
      keepBright.add(current.parentId);
      forceOpen.add(current.parentId);
      current = byId.get(current.parentId);
    }
  }
  const rows: OutlineRow[] = [];
  const visit = (id: string, depth: number) => {
    const node = byId.get(id);
    if (!node) return;
    const list = children.get(id) ?? [];
    const visible = !hide || matching.has(id);
    const isOpen = id === tree.rootId || expanded.has(id) || forceOpen.has(id);
    const dimmed = (normalized.length > 0 || filtered) && !keepBright.has(id);
    if (visible) rows.push({ kind: "node", id, depth, hasChildren: (hide ? list.some(child => keepBright.has(child.id)) : list.length > 0) || node.objects.length > 0, expanded: isOpen, dimmed, matched: matching.has(id) });
    if (!isOpen) return;
    for (const child of list) visit(child.id, depth + (visible ? 1 : 0));
    if (visible) for (const object of [...node.objects].sort((a, b) => a.order - b.order)) rows.push({ kind: "object", id: object.id, parentId: id, depth: depth + 1, dimmed });
  };
  visit(tree.rootId, 1);
  return { rows, matchCount: normalized || filtered ? matching.size : tree.nodes.length };
}
