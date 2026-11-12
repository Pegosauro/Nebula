import { MAX_DEPTH, MAX_NODES, codeStep, conformSuffix, depthOf, effectiveCategoryMap, joinCode, normCode, uid, type Tree, type TreeNode } from "./model";

export interface DuplicateRow { sourceId: string; id: string; oldCode: string; code: string; name: string; depth: number }
export interface DuplicatePlan { rows: DuplicateRow[]; errors: string[]; tree?: Tree; copyId?: string }

/** Plans an independent copy against a snapshot: originals and preview codes stay unchanged. */
export function planDuplicate(tree: Tree, sourceId: string, parentId: string, includeChildren: boolean): DuplicatePlan {
  const byId = new Map(tree.nodes.map(node => [node.id, node]));
  const source = byId.get(sourceId), parent = byId.get(parentId);
  const fail = (error: string): DuplicatePlan => ({ rows: [], errors: [error] });
  if (!source) return fail("Il nodo da duplicare non esiste più.");
  if (!parent) return fail("Scegli un padre di destinazione valido.");
  const children = new Map<string, TreeNode[]>();
  for (const node of tree.nodes) if (node.parentId) {
    const group = children.get(node.parentId) ?? [];
    group.push(node); children.set(node.parentId, group);
  }
  for (const group of children.values()) group.sort((a, b) => a.order - b.order);
  const entries: Array<{ node: TreeNode; depth: number }> = [];
  const stack = [{ node: source, depth: 0 }];
  const seen = new Set<string>();
  while (stack.length) {
    const entry = stack.pop()!;
    if (seen.has(entry.node.id)) return fail("Il ramo contiene un ciclo e non può essere duplicato.");
    seen.add(entry.node.id); entries.push(entry);
    if (includeChildren) for (const child of [...(children.get(entry.node.id) ?? [])].reverse()) stack.push({ node: child, depth: entry.depth + 1 });
  }
  if (tree.nodes.length + entries.length > MAX_NODES) return fail(`La copia supera il limite di ${MAX_NODES} nodi della struttura.`);
  if (depthOf(tree, parentId) + 1 + Math.max(...entries.map(entry => entry.depth)) > MAX_DEPTH) return fail(`La copia supera la profondità massima di ${MAX_DEPTH} livelli.`);
  const next = structuredClone(tree);
  const categories = effectiveCategoryMap(tree);
  const usedCodes = new Set(tree.nodes.map(node => normCode(node.code)));
  const copies = new Map<string, TreeNode>();
  const rows: DuplicateRow[] = [];
  const allocate = (parentCode: string, suffix?: string | null) => {
    if (suffix) {
      const candidate = joinCode(tree, parentCode, suffix);
      if (!usedCodes.has(normCode(candidate))) { usedCodes.add(normCode(candidate)); return candidate; }
    }
    for (let value = 1; value < 10 ** codeStep(tree); value += 1) {
      const candidate = joinCode(tree, parentCode, String(value).padStart(codeStep(tree), "0"));
      if (!usedCodes.has(normCode(candidate))) { usedCodes.add(normCode(candidate)); return candidate; }
    }
    return undefined;
  };
  for (const { node, depth } of entries) {
    const copiedParent = node.id === sourceId ? parent : copies.get(node.parentId!)!;
    const oldParent = node.parentId ? byId.get(node.parentId) : undefined;
    const suffix = node.id !== sourceId && oldParent ? conformSuffix(tree, node.code, oldParent.code) : undefined;
    const code = allocate(copiedParent.code, suffix);
    if (!code) return fail(`Nessun codice libero sotto ${copiedParent.code}. Scegli un altro padre di destinazione.`);
    const copy: TreeNode = {
      ...structuredClone(node), id: uid(), parentId: copiedParent.id, code,
      categoryMode: "own", categoryId: categories.get(node.id) ?? null,
      objects: node.objects.map(object => ({ ...structuredClone(object), id: uid() })),
    };
    next.nodes.push(copy); copies.set(node.id, copy);
    rows.push({ sourceId: node.id, id: copy.id, oldCode: node.code, code, name: copy.name, depth });
  }
  const copy = copies.get(sourceId)!;
  const siblings = next.nodes.filter(node => node.parentId === parentId && node.id !== copy.id).sort((a, b) => a.order - b.order);
  const sourceIndex = siblings.findIndex(node => node.id === sourceId);
  siblings.splice(sourceIndex < 0 ? siblings.length : sourceIndex + 1, 0, copy);
  siblings.forEach((node, order) => { node.order = order; });
  return { rows, errors: [], tree: next, copyId: copy.id };
}
