/** Albero libero `nebula-tree` v1. Le categorie effettive non vengono mai scritte nel file.
 *  Lo spostamento (PR2) cambierà solo `parentId` e `order`, poi userà `conformSuffix` e `freeSuffix`. */

export const TREE_FORMAT = "nebula-tree" as const;
export const TREE_VERSION = 1 as const;
export const MAX_DEPTH = 32;
export const MAX_NODES = 5000;
export const DEFAULT_SEPARATOR = "-";
export const DEFAULT_STEP = 2;

export const CATEGORY_PALETTE = [
  { name: "Viola", color: "#8b5cf6" },
  { name: "Ciano", color: "#22d3ee" },
  { name: "Ambra", color: "#e0a33a" },
  { name: "Verde acqua", color: "#2aa99a" },
  { name: "Rosa", color: "#ec6fb0" },
  { name: "Blu", color: "#5b8def" },
  { name: "Arancio", color: "#f2784b" },
  { name: "Verde", color: "#4caf6a" },
  { name: "Rosso", color: "#e5534b" },
  { name: "Grigio", color: "#8b93a7" },
] as const;

export type CategoryMode = "inherit" | "own";
export type CharacteristicKind = "own" | "acquired";

export interface TreeCategory { id: string; name: string; color: string; order: number }
export interface ExternalTableObject { id: string; type: "externalTable"; order: number; tableName: string }
export interface CharacteristicObject { id: string; type: "characteristic"; order: number; kind: CharacteristicKind; code: string; description: string }
export type TreeObject = ExternalTableObject | CharacteristicObject;
export interface TreeNode {
  id: string;
  parentId: string | null;
  order: number;
  code: string;
  name: string;
  categoryMode: CategoryMode;
  categoryIds: string[];
  note: string;
  objects: TreeObject[];
}
export interface Tree {
  format: typeof TREE_FORMAT;
  version: typeof TREE_VERSION;
  title: string;
  rootId: string;
  codeSeparator?: string;
  codeStep?: number;
  categories: TreeCategory[];
  nodes: TreeNode[];
}
export interface TreeIssue { message: string; nodeId?: string }
export type TreeFailure = { ok: false; error: string };
export type TreeSuccess<T extends object = object> = { ok: true; tree: Tree } & T;

export class TreeFormatError extends Error {
  readonly issues: TreeIssue[];
  constructor(issues: TreeIssue[]) {
    super(issues.map(issue => issue.message).join("\n") || "Formato albero non valido.");
    this.name = "TreeFormatError";
    this.issues = issues;
  }
}

export const isTreePath = (path: string) => /\.tree\.json$/i.test(path);
export const treeTitle = (name: string) => name.replace(/\.tree\.json$/i, "");
export const uid = () => crypto.randomUUID();
export const isPaletteColor = (color: string) => CATEGORY_PALETTE.some(entry => entry.color === color);
/** Codici nodo: senza spazi, senza distinzione di maiuscole. */
export const normCode = (code: string) => code.replace(/\s+/g, "").toUpperCase();
/** Sigle: spazi esterni ignorati, senza distinzione di maiuscole. */
export const normSigla = (code: string) => code.trim().toUpperCase();
export const codeSeparator = (tree: Tree) => tree.codeSeparator ?? DEFAULT_SEPARATOR;
export const codeStep = (tree: Tree) => tree.codeStep ?? DEFAULT_STEP;

function indexOf(tree: Tree) {
  const byId = new Map<string, TreeNode>();
  const groups = new Map<string, TreeNode[]>();
  for (const node of tree.nodes) {
    byId.set(node.id, node);
    const key = node.parentId ?? "";
    const list = groups.get(key);
    if (list) list.push(node);
    else groups.set(key, [node]);
  }
  const children = new Map<string, TreeNode[]>();
  for (const [key, list] of groups) children.set(key, [...list].sort((a, b) => a.order - b.order));
  return { byId, children };
}

export const nodeById = (tree: Tree, id: string) => indexOf(tree).byId.get(id);
export const childrenOf = (tree: Tree, parentId: string) => indexOf(tree).children.get(parentId) ?? [];
export function depthOf(tree: Tree, id: string): number {
  const byId = indexOf(tree).byId;
  let depth = 0;
  let current = byId.get(id);
  const seen = new Set<string>();
  while (current?.parentId != null && depth <= MAX_DEPTH + 1 && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = byId.get(current.parentId);
  }
  return depth;
}
/** Vero se `id` è `ancestorId` oppure un suo discendente. Serve a vietare i cicli nello spostamento (PR2). */
export function isDescendant(tree: Tree, id: string, ancestorId: string): boolean {
  const byId = indexOf(tree).byId;
  let current = byId.get(id);
  let guard = 0;
  while (current && guard++ <= MAX_NODES) {
    if (current.id === ancestorId) return true;
    current = current.parentId == null ? undefined : byId.get(current.parentId);
  }
  return false;
}
export function descendants(tree: Tree, id: string): TreeNode[] {
  const out: TreeNode[] = [];
  const queue = [id];
  while (queue.length) {
    const parent = queue.shift()!;
    for (const child of childrenOf(tree, parent)) { out.push(child); queue.push(child.id); }
  }
  return out;
}

export function joinCode(tree: Tree, parentCode: string, suffix: string): string {
  const parent = parentCode.trim();
  const separator = codeSeparator(tree);
  return /[0-9]$/.test(parent) || (separator.length > 0 && parent.endsWith(separator)) ? parent + suffix : parent + separator + suffix;
}
/** Cifre finali se il codice è `padre + separatore? + N cifre`, altrimenti null. */
export function conformSuffix(tree: Tree, code: string, parentCode: string): string | null {
  const normalized = normCode(code);
  const parent = normCode(parentCode);
  const separator = normCode(codeSeparator(tree));
  if (!parent || !normalized.startsWith(parent)) return null;
  let rest = normalized.slice(parent.length);
  if (separator && rest.startsWith(separator)) rest = rest.slice(separator.length);
  return new RegExp(`^\\d{${codeStep(tree)}}$`).test(rest) ? rest : null;
}
export function codeRangeLabel(step = DEFAULT_STEP): string {
  return `${"1".padStart(step, "0")} e ${"9".repeat(step)}`;
}
/** Prima coppia libera fra i fratelli. Con `globalCheck` salta anche i codici già presenti nel file. */
export function freeSuffix(tree: Tree, parentId: string, parentCode: string, exclude: ReadonlySet<string> = new Set(), globalCheck = false): string | null {
  const width = codeStep(tree);
  const used = new Set<string>();
  for (const child of childrenOf(tree, parentId)) {
    if (exclude.has(child.id)) continue;
    const suffix = conformSuffix(tree, child.code, parentCode);
    if (suffix) used.add(suffix);
  }
  const taken = globalCheck ? new Set(tree.nodes.filter(node => !exclude.has(node.id)).map(node => normCode(node.code))) : undefined;
  const limit = 10 ** width;
  for (let value = 1; value < limit; value += 1) {
    const suffix = String(value).padStart(width, "0");
    if (used.has(suffix)) continue;
    if (taken?.has(normCode(joinCode(tree, parentCode, suffix)))) continue;
    return suffix;
  }
  return null;
}
export function proposeChildCode(tree: Tree, parentId: string): string | null {
  const parent = nodeById(tree, parentId);
  if (!parent) return null;
  const suffix = freeSuffix(tree, parentId, parent.code, new Set(), true);
  return suffix ? joinCode(tree, parent.code, suffix) : null;
}

const effectiveCache = new WeakMap<Tree, Map<string, readonly string[]>>();
/** Categorie effettive, calcolate in una visita e memorizzate per l'oggetto immutabile. */
export function effectiveCategoryMap(tree: Tree): Map<string, readonly string[]> {
  const cached = effectiveCache.get(tree);
  if (cached) return cached;
  const known = new Set(tree.categories.map(category => category.id));
  const byId = indexOf(tree).byId;
  const map = new Map<string, readonly string[]>();
  const visit = (id: string, guard = 0): readonly string[] => {
    const found = map.get(id);
    if (found) return found;
    const node = byId.get(id);
    let result: readonly string[];
    if (!node || guard > MAX_DEPTH + 2) result = [];
    else if (node.parentId == null || node.categoryMode !== "inherit") result = node.categoryIds.filter(categoryId => known.has(categoryId));
    else result = visit(node.parentId, guard + 1);
    map.set(id, result);
    return result;
  };
  for (const node of tree.nodes) visit(node.id);
  effectiveCache.set(tree, map);
  return map;
}
export const effectiveCategories = (tree: Tree, id: string) => effectiveCategoryMap(tree).get(id) ?? [];
/** Nodo `own` da cui un nodo `inherit` prende le categorie. */
export function inheritSource(tree: Tree, id: string): TreeNode | undefined {
  let current = nodeById(tree, id);
  const seen = new Set<string>();
  while (current && current.parentId != null && current.categoryMode === "inherit" && !seen.has(current.id)) {
    seen.add(current.id);
    current = nodeById(tree, current.parentId);
  }
  return current;
}
/** Il colore del nodo è quello della prima categoria effettiva. Isolato qui: è solo presentazione. */
export function principalCategory(tree: Tree, id: string): TreeCategory | undefined {
  const categoryId = effectiveCategories(tree, id)[0];
  return categoryId ? tree.categories.find(category => category.id === categoryId) : undefined;
}
export function readableOn(color: string): string {
  const hex = /^#([\da-f]{6})$/i.exec(color);
  if (!hex) return "#1a1d27";
  const value = hex[1]!;
  const channel = (start: number) => Number.parseInt(value.slice(start, start + 2), 16);
  const luminance = (0.2126 * channel(0) + 0.7152 * channel(2) + 0.0722 * channel(4)) / 255;
  return luminance > 0.62 ? "#1a1d27" : "#ffffff";
}

export interface CodeIssues { errors: string[]; warnings: string[] }
export function codeIssues(tree: Tree, id: string, code: string): CodeIssues {
  const errors: string[] = [];
  const warnings: string[] = [];
  const node = nodeById(tree, id);
  if (!normCode(code)) errors.push("Il codice è obbligatorio");
  else {
    const duplicate = tree.nodes.find(item => item.id !== id && normCode(item.code) === normCode(code));
    if (duplicate) errors.push(`Codice già usato da ${duplicate.code} ${duplicate.name}`.trim());
  }
  if (node?.parentId != null && normCode(code)) {
    const parent = nodeById(tree, node.parentId);
    if (parent && !conformSuffix(tree, code, parent.code)) warnings.push(`Fuori prefisso: non è ${parent.code} + ${codeStep(tree)} cifre (solo avviso)`);
  }
  return { errors, warnings };
}

function clone(tree: Tree): Tree {
  return structuredClone(tree);
}
function replaceNode(tree: Tree, id: string, update: (node: TreeNode) => void): Tree {
  const next = clone(tree);
  const node = next.nodes.find(item => item.id === id);
  if (!node) return next;
  update(node);
  return next;
}
function knownCategories(tree: Tree): Set<string> {
  return new Set(tree.categories.map(category => category.id));
}
function uniqueCategoryIds(ids: readonly string[], valid: Set<string>): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const id of ids) {
    if (!valid.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}
function renumberSiblings(tree: Tree, parentId: string) {
  childrenOf(tree, parentId).forEach((child, index) => { child.order = index; });
}

export function addChild(tree: Tree, parentId: string, patch: { code?: string; name?: string } = {}): TreeSuccess<{ node: TreeNode }> | TreeFailure {
  const parent = nodeById(tree, parentId);
  if (!parent) return { ok: false, error: "Padre inesistente" };
  if (tree.nodes.length >= MAX_NODES) return { ok: false, error: `Limite di ${MAX_NODES} nodi raggiunto` };
  if (depthOf(tree, parentId) + 1 > MAX_DEPTH) return { ok: false, error: `Profondità massima di ${MAX_DEPTH} livelli` };
  const proposed = patch.code ?? proposeChildCode(tree, parentId);
  if (!proposed) return { ok: false, error: `Nessun codice libero tra ${codeRangeLabel(codeStep(tree))} sotto ${parent.code}` };
  const order = childrenOf(tree, parentId).reduce((max, child) => Math.max(max, child.order), -1) + 1;
  const draft: TreeNode = { id: uid(), parentId, order, code: proposed.trim(), name: patch.name ?? "Nuovo nodo", categoryMode: "inherit", categoryIds: [], note: "", objects: [] };
  const next = clone(tree);
  next.nodes.push(draft);
  const issues = codeIssues(next, draft.id, draft.code);
  if (issues.errors.length) return { ok: false, error: issues.errors[0]! };
  return { ok: true, tree: next, node: draft };
}
export function updateNode(tree: Tree, id: string, patch: { code?: string; name?: string; note?: string }): TreeSuccess | TreeFailure {
  if (!nodeById(tree, id)) return { ok: false, error: "Nodo inesistente" };
  const next = clone(tree);
  const node = next.nodes.find(item => item.id === id)!;
  if (patch.code !== undefined) {
    const issues = codeIssues(next, id, patch.code);
    if (issues.errors.length) return { ok: false, error: issues.errors[0]! };
    node.code = String(patch.code).trim();
  }
  if (patch.name !== undefined) node.name = String(patch.name);
  if (patch.note !== undefined) node.note = String(patch.note);
  return { ok: true, tree: next };
}
export function leafDeleteError(tree: Tree, id: string): string | undefined {
  const node = nodeById(tree, id);
  if (!node) return "Nodo inesistente";
  if (node.parentId == null) return "La radice non si può eliminare";
  const count = childrenOf(tree, id).length;
  if (count) return `Ha ${count} ${count === 1 ? "figlio" : "figli"}: si possono eliminare solo le foglie`;
  return undefined;
}
export function deleteLeaf(tree: Tree, id: string): TreeSuccess | TreeFailure {
  const reason = leafDeleteError(tree, id);
  if (reason) return { ok: false, error: reason };
  const node = nodeById(tree, id)!;
  const next = clone(tree);
  next.nodes = next.nodes.filter(item => item.id !== id);
  renumberSiblings(next, node.parentId!);
  return { ok: true, tree: next };
}
export function setNodeCategories(tree: Tree, id: string, categoryIds: readonly string[]): TreeSuccess<{ detached: boolean }> | TreeFailure {
  const node = nodeById(tree, id);
  if (!node) return { ok: false, error: "Nodo inesistente" };
  const nextIds = uniqueCategoryIds(categoryIds, knownCategories(tree));
  const current = effectiveCategories(tree, id);
  const same = current.length === nextIds.length && current.every((categoryId, index) => categoryId === nextIds[index]);
  const wasInherit = node.parentId != null && node.categoryMode === "inherit";
  if (wasInherit && same) return { ok: true, tree, detached: false };
  return { ok: true, tree: replaceNode(tree, id, item => { item.categoryMode = "own"; item.categoryIds = nextIds; }), detached: wasInherit };
}
export function inheritFromParent(tree: Tree, id: string): TreeSuccess | TreeFailure {
  const node = nodeById(tree, id);
  if (!node || node.parentId == null) return { ok: false, error: "La radice ha sempre categorie proprie" };
  return { ok: true, tree: replaceNode(tree, id, item => { item.categoryMode = "inherit"; item.categoryIds = []; }) };
}
export function addCategory(tree: Tree, name: string, color?: string): TreeSuccess<{ category: TreeCategory }> | TreeFailure {
  if (color && !isPaletteColor(color)) return { ok: false, error: "Colore fuori tavolozza" };
  const next = clone(tree);
  const category: TreeCategory = { id: uid(), name: name.trim() || "Nuova categoria", color: color || CATEGORY_PALETTE[0].color, order: next.categories.reduce((max, item) => Math.max(max, item.order), -1) + 1 };
  next.categories.push(category);
  return { ok: true, tree: next, category };
}
export function updateCategory(tree: Tree, id: string, patch: { name?: string; color?: string }): TreeSuccess | TreeFailure {
  if (patch.color && !isPaletteColor(patch.color)) return { ok: false, error: "Colore fuori tavolozza" };
  const next = clone(tree);
  const category = next.categories.find(item => item.id === id);
  if (!category) return { ok: false, error: "Categoria inesistente" };
  if (patch.name !== undefined) category.name = patch.name;
  if (patch.color !== undefined) category.color = patch.color;
  return { ok: true, tree: next };
}
export function moveCategory(tree: Tree, id: string, delta: number): TreeSuccess | TreeFailure {
  const next = clone(tree);
  const ordered = [...next.categories].sort((a, b) => a.order - b.order);
  const index = ordered.findIndex(category => category.id === id);
  const target = index + delta;
  if (index < 0 || target < 0 || target >= ordered.length) return { ok: false, error: "Spostamento non disponibile" };
  const swapped = ordered[target]!;
  ordered[target] = ordered[index]!;
  ordered[index] = swapped;
  ordered.forEach((category, order) => { category.order = order; });
  next.categories = ordered;
  return { ok: true, tree: next };
}
export function categoryUsage(tree: Tree, categoryId: string): TreeNode[] {
  return tree.nodes.filter(node => (node.parentId == null || node.categoryMode === "own") && node.categoryIds.includes(categoryId));
}
/** `replacementId` omesso blocca l'eliminazione se la categoria è usata. `null` la toglie dai nodi. */
export function deleteCategory(tree: Tree, categoryId: string, replacementId?: string | null): TreeSuccess | TreeFailure {
  const used = categoryUsage(tree, categoryId);
  if (used.length && replacementId === undefined) {
    return { ok: false, error: `Categoria usata da ${used.length} ${used.length === 1 ? "nodo" : "nodi"} con categorie proprie: scegli con cosa sostituirla o se toglierla` };
  }
  if (replacementId && (replacementId === categoryId || !tree.categories.some(category => category.id === replacementId))) return { ok: false, error: "Categoria di sostituzione non valida" };
  const next = clone(tree);
  for (const node of next.nodes) {
    if (!node.categoryIds.includes(categoryId)) continue;
    node.categoryIds = uniqueCategoryIds(node.categoryIds.map(id => id === categoryId ? replacementId ?? "" : id), knownCategories(next));
  }
  next.categories = next.categories.filter(category => category.id !== categoryId).sort((a, b) => a.order - b.order);
  next.categories.forEach((category, order) => { category.order = order; });
  return { ok: true, tree: next };
}

export type ObjectDraft =
  | { id?: string; type: "externalTable"; tableName: string }
  | { id?: string; type: "characteristic"; kind: CharacteristicKind | string; code: string; description: string };

export function objectIssues(node: TreeNode, draft: ObjectDraft, ignoreId?: string): string[] {
  const errors: string[] = [];
  if (draft.type === "externalTable") {
    if (!draft.tableName.trim()) errors.push("Il nome della tabella è obbligatorio");
  } else if (draft.type === "characteristic") {
    if (!normSigla(draft.code)) errors.push("La sigla è obbligatoria");
    if (!draft.description.trim()) errors.push("La descrizione è obbligatoria");
    if (draft.kind !== "own" && draft.kind !== "acquired") errors.push("Tipo non valido");
    const duplicate = node.objects.find(object => object.type === "characteristic" && object.id !== ignoreId && normSigla(object.code) === normSigla(draft.code));
    if (normSigla(draft.code) && duplicate && duplicate.type === "characteristic") errors.push(`Sigla «${duplicate.code}» già usata in questo nodo (${duplicate.kind === "own" ? "propria" : "acquisita"})`);
  } else errors.push("Tipo di oggetto sconosciuto");
  return errors;
}
export function upsertObject(tree: Tree, nodeId: string, draft: ObjectDraft): TreeSuccess<{ object: TreeObject }> | TreeFailure {
  const node = nodeById(tree, nodeId);
  if (!node) return { ok: false, error: "Nodo inesistente" };
  const errors = objectIssues(node, draft, draft.id);
  if (errors.length) return { ok: false, error: errors[0]!, };
  const next = clone(tree);
  const target = next.nodes.find(item => item.id === nodeId)!;
  const object: TreeObject = draft.type === "externalTable"
    ? { id: draft.id || uid(), type: "externalTable", order: 0, tableName: draft.tableName.trim() }
    : { id: draft.id || uid(), type: "characteristic", order: 0, kind: draft.kind as CharacteristicKind, code: draft.code.trim(), description: draft.description.trim() };
  const index = target.objects.findIndex(item => item.id === object.id);
  if (index >= 0) { object.order = target.objects[index]!.order; target.objects[index] = object; }
  else { object.order = target.objects.length; target.objects.push(object); }
  return { ok: true, tree: next, object };
}
export function removeObject(tree: Tree, nodeId: string, objectId: string): TreeSuccess | TreeFailure {
  if (!nodeById(tree, nodeId)) return { ok: false, error: "Nodo inesistente" };
  const next = clone(tree);
  const node = next.nodes.find(item => item.id === nodeId)!;
  if (!node.objects.some(object => object.id === objectId)) return { ok: false, error: "Oggetto inesistente" };
  node.objects = node.objects.filter(object => object.id !== objectId);
  node.objects.forEach((object, order) => { object.order = order; });
  return { ok: true, tree: next };
}

function issue(errors: TreeIssue[], message: string, nodeId?: string) {
  errors.push(nodeId ? { message, nodeId } : { message });
}
export function inspectTree(tree: Tree): { errors: TreeIssue[]; warnings: TreeIssue[] } {
  const errors: TreeIssue[] = [];
  const warnings: TreeIssue[] = [];
  if (tree.format !== TREE_FORMAT) issue(errors, "format deve essere \"nebula-tree\"");
  if (tree.version !== TREE_VERSION) issue(errors, "version deve essere 1");
  if (!Array.isArray(tree.nodes) || !Array.isArray(tree.categories)) {
    issue(errors, "nodes e categories devono essere liste");
    return { errors, warnings };
  }
  if (tree.codeSeparator !== undefined && (typeof tree.codeSeparator !== "string" || tree.codeSeparator.length > 8)) issue(errors, "codeSeparator non valido");
  if (tree.codeStep !== undefined && (!Number.isInteger(tree.codeStep) || tree.codeStep < 1 || tree.codeStep > 6)) issue(errors, "codeStep non valido");
  if (tree.nodes.length > MAX_NODES) issue(errors, `Più di ${MAX_NODES} nodi`);
  const ids = new Set<string>();
  for (const node of tree.nodes) {
    if (!node?.id || ids.has(node.id)) issue(errors, `id duplicato ${node?.id ?? ""}`, node?.id);
    if (node?.id) ids.add(node.id);
  }
  const byId = new Map(tree.nodes.filter(node => node?.id).map(node => [node.id, node]));
  const roots = tree.nodes.filter(node => node?.parentId == null);
  if (roots.length !== 1) issue(errors, `Serve esattamente una radice (trovate ${roots.length})`);
  const root = byId.get(tree.rootId);
  if (!root || root.parentId != null) issue(errors, "rootId non punta alla radice");
  const categoryIds = new Set<string>();
  for (const category of tree.categories) {
    if (!category?.id || categoryIds.has(category.id)) issue(errors, `id categoria duplicato ${category?.id ?? ""}`);
    if (category?.id) categoryIds.add(category.id);
    if (category && !isPaletteColor(category.color)) warnings.push({ message: `Colore di «${category.name}» fuori tavolozza` });
  }
  const codes = new Map<string, TreeNode>();
  for (const node of tree.nodes) {
    if (!node?.id) continue;
    if (node.parentId != null && !byId.get(node.parentId)) issue(errors, `Nodo orfano ${node.code}`, node.id);
    let current: TreeNode | undefined = node;
    let depth = 0;
    const seen = new Set<string>();
    while (current?.parentId != null) {
      if (seen.has(current.id)) { issue(errors, `Ciclo che coinvolge ${node.code}`, node.id); break; }
      seen.add(current.id);
      current = byId.get(current.parentId);
      depth += 1;
    }
    if (depth > MAX_DEPTH) issue(errors, `Profondità oltre ${MAX_DEPTH} livelli: ${node.code}`, node.id);
    if (node.categoryMode !== "inherit" && node.categoryMode !== "own") issue(errors, `categoryMode non valido su ${node.code}`, node.id);
    if (node.parentId == null && node.categoryMode !== "own") issue(errors, "La radice deve avere categoryMode \"own\"", node.id);
    for (const categoryId of node.categoryIds ?? []) if (!categoryIds.has(categoryId)) issue(errors, `Categoria inesistente su ${node.code}`, node.id);
    const normalized = normCode(node.code ?? "");
    if (!normalized) issue(errors, `Codice mancante (nodo «${node.name}»)`, node.id);
    else if (codes.has(normalized)) issue(errors, `Codice duplicato ${node.code} (anche «${codes.get(normalized)!.name}»)`, node.id);
    else codes.set(normalized, node);
    const parent = node.parentId == null ? undefined : byId.get(node.parentId);
    if (parent && normalized && !conformSuffix(tree, node.code, parent.code)) warnings.push({ message: `${node.code} è fuori prefisso rispetto a ${parent.code}`, nodeId: node.id });
    const sigle = new Map<string, CharacteristicObject>();
    for (const object of node.objects ?? []) {
      if (object?.type === "externalTable") {
        if (!String(object.tableName ?? "").trim()) issue(errors, `Tabella esterna senza nome in ${node.code}`, node.id);
      } else if (object?.type === "characteristic") {
        if (!normSigla(object.code ?? "") || !String(object.description ?? "").trim()) issue(errors, `Caratteristica senza sigla o descrizione in ${node.code}`, node.id);
        if (object.kind !== "own" && object.kind !== "acquired") issue(errors, `Tipo caratteristica non valido in ${node.code}`, node.id);
        const key = normSigla(object.code ?? "");
        if (key && sigle.has(key)) issue(errors, `Sigla «${object.code}» duplicata in ${node.code} (${sigle.get(key)!.kind === "own" ? "propria" : "acquisita"} e ${object.kind === "own" ? "propria" : "acquisita"})`, node.id);
        else if (key) sigle.set(key, object);
      } else issue(errors, `Oggetto di tipo sconosciuto in ${node.code}`, node.id);
    }
  }
  return { errors, warnings };
}

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined;
}
function integer(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) ? value : fallback;
}
export function parseTree(text: string): Tree {
  let raw: unknown;
  try { raw = JSON.parse(text); }
  catch (error) { throw new TreeFormatError([{ message: `JSON non valido: ${error instanceof Error ? error.message : "contenuto illeggibile"}` }]); }
  const body = record(raw);
  if (!body) throw new TreeFormatError([{ message: "Il file non contiene un oggetto" }]);
  const categories = Array.isArray(body.categories) ? body.categories.map((item, index) => {
    const category = record(item);
    return {
      id: String(category?.id ?? ""),
      name: typeof category?.name === "string" ? category.name : "",
      color: typeof category?.color === "string" ? category.color : "",
      order: integer(category?.order, index),
    };
  }) : body.categories as TreeCategory[];
  const nodes = Array.isArray(body.nodes) ? body.nodes.map((item, index) => {
    const node = record(item);
    const mode = node?.categoryMode;
    const parentId = node?.parentId == null ? null : String(node.parentId);
    const objects = Array.isArray(node?.objects) ? node.objects.flatMap((entry, objectIndex): TreeObject[] => {
      const object = record(entry);
      if (!object) return [];
      const id = String(object.id ?? "");
      const order = integer(object.order, objectIndex);
      if (object.type === "externalTable") return [{ id, type: "externalTable", order, tableName: typeof object.tableName === "string" ? object.tableName : "" }];
      if (object.type === "characteristic") return [{ id, type: "characteristic", order, kind: object.kind as CharacteristicKind, code: typeof object.code === "string" ? object.code : "", description: typeof object.description === "string" ? object.description : "" }];
      return [{ id, type: String(object.type ?? ""), order, tableName: "" } as TreeObject];
    }) : [];
    return {
      id: String(node?.id ?? ""),
      parentId,
      order: integer(node?.order, index),
      code: typeof node?.code === "string" ? node.code : "",
      name: typeof node?.name === "string" ? node.name : "",
      categoryMode: mode === "inherit" || mode === "own" ? mode : mode as CategoryMode,
      categoryIds: parentId != null && mode === "inherit" ? [] : Array.isArray(node?.categoryIds) ? node.categoryIds.map(id => String(id)) : [],
      note: typeof node?.note === "string" ? node.note : "",
      objects,
    };
  }) : body.nodes as TreeNode[];
  const tree: Tree = {
    format: body.format as Tree["format"],
    version: body.version as Tree["version"],
    title: typeof body.title === "string" ? body.title : "",
    rootId: typeof body.rootId === "string" ? body.rootId : "",
    categories: categories as TreeCategory[],
    nodes: nodes as TreeNode[],
  };
  if (typeof body.codeSeparator === "string") tree.codeSeparator = body.codeSeparator;
  if (typeof body.codeStep === "number") tree.codeStep = body.codeStep;
  if (typeof tree.title !== "string" || !tree.title) {
    const report = inspectTree({ ...tree, title: tree.title || " " });
    if (!tree.title) report.errors.unshift({ message: "Titolo mancante" });
    throw new TreeFormatError(report.errors);
  }
  const report = inspectTree(tree);
  if (report.errors.length) throw new TreeFormatError(report.errors);
  return tree;
}
/** Forma scritta nel file: eredità senza categorie copiate, default di codice omessi. */
export function canonicalTree(tree: Tree): Tree {
  const canonical: Tree = {
    format: "nebula-tree",
    version: 1,
    title: tree.title,
    rootId: tree.rootId,
    categories: [...tree.categories].sort((a, b) => a.order - b.order).map(category => ({ id: category.id, name: category.name, color: category.color, order: category.order })),
    nodes: tree.nodes.map(node => ({
      id: node.id,
      parentId: node.parentId,
      order: node.order,
      code: node.code,
      name: node.name,
      categoryMode: node.parentId == null ? "own" : node.categoryMode,
      categoryIds: node.parentId != null && node.categoryMode === "inherit" ? [] : [...node.categoryIds],
      note: node.note || "",
      objects: [...node.objects].sort((a, b) => a.order - b.order).map(object => object.type === "externalTable"
        ? { id: object.id, type: "externalTable" as const, order: object.order, tableName: object.tableName }
        : { id: object.id, type: "characteristic" as const, order: object.order, kind: object.kind, code: object.code, description: object.description }),
    })),
  };
  if (tree.codeSeparator != null && tree.codeSeparator !== "-") canonical.codeSeparator = tree.codeSeparator;
  if (tree.codeStep != null && tree.codeStep !== 2) canonical.codeStep = tree.codeStep;
  return canonical;
}
export function newTree(title: string, rootCode: string, rootName: string): Tree {
  const root: TreeNode = { id: uid(), parentId: null, order: 0, code: rootCode.trim(), name: rootName, categoryMode: "own", categoryIds: [], note: "", objects: [] };
  return { format: TREE_FORMAT, version: TREE_VERSION, title: title.trim(), rootId: root.id, categories: [], nodes: [root] };
}
