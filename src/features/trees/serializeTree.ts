import { canonicalTree, type Tree } from "./model";

const snapshots = new WeakMap<Tree, string>();
/** Definizioni immutabili: il confronto di salvataggio riusa la stessa stringa. */
export function serializeTree(tree: Tree): string {
  let serialized = snapshots.get(tree);
  if (serialized === undefined) {
    serialized = JSON.stringify(canonicalTree(tree));
    snapshots.set(tree, serialized);
  }
  return serialized;
}
export function serializeTreeFile(tree: Tree): string {
  return `${JSON.stringify(canonicalTree(tree), null, 2)}\n`;
}
