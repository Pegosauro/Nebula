import { childrenOf, effectiveCategories, nodeById, type Tree, type TreeNode } from "./model";

export const ROW_HEIGHT = 36;
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

/** Righe visibili. I filtri attenuano i nodi non pertinenti e non li nascondono. La ricerca tiene leggibili gli antenati. */
export function buildOutline(tree: Tree, expanded: ReadonlySet<string>, query: string, categoryId?: string): { rows: OutlineRow[]; matchCount: number } {
  const normalized = query.trim().toLocaleLowerCase();
  const matching = new Set<string>();
  if (normalized || categoryId) {
    for (const node of tree.nodes) {
      const queryOk = !normalized || includesQuery(node, normalized);
      const categoryOk = !categoryId || effectiveCategories(tree, node.id).includes(categoryId);
      if (queryOk && categoryOk) matching.add(node.id);
    }
  }
  const keepBright = new Set<string>(matching);
  if (normalized || categoryId) {
    for (const id of matching) {
      let current = nodeById(tree, id);
      const seen = new Set<string>();
      while (current?.parentId && !seen.has(current.id)) {
        seen.add(current.id);
        keepBright.add(current.parentId);
        current = nodeById(tree, current.parentId);
      }
    }
  }
  const forceOpen = new Set<string>();
  if (normalized) {
    for (const id of matching) {
      let current = nodeById(tree, id);
      const seen = new Set<string>();
      while (current?.parentId && !seen.has(current.id)) {
        seen.add(current.id);
        forceOpen.add(current.parentId);
        current = nodeById(tree, current.parentId);
      }
    }
  }
  const rows: OutlineRow[] = [];
  const visit = (id: string, depth: number) => {
    const node = nodeById(tree, id);
    if (!node) return;
    const children = childrenOf(tree, id);
    const isOpen = expanded.has(id) || forceOpen.has(id);
    const dimmed = (normalized.length > 0 || Boolean(categoryId)) && !keepBright.has(id);
    rows.push({ kind: "node", id, depth, hasChildren: children.length > 0 || node.objects.length > 0, expanded: isOpen, dimmed, matched: matching.has(id) });
    if (!isOpen) return;
    for (const child of children) visit(child.id, depth + 1);
    for (const object of [...node.objects].sort((a, b) => a.order - b.order)) rows.push({ kind: "object", id: object.id, parentId: id, depth: depth + 1, dimmed });
  };
  visit(tree.rootId, 1);
  return { rows, matchCount: normalized || categoryId ? matching.size : tree.nodes.length };
}
