import { normSigla, type TreeNode } from "./model";

/** Descriptions shared by own and acquired characteristics throughout a structure. */
export function characteristicCatalog(nodes: readonly TreeNode[]): ReadonlyMap<string, readonly string[]> {
  const catalog = new Map<string, string[]>();
  for (const node of nodes) {
    for (const object of node.objects) {
      if (object.type !== "characteristic") continue;
      const code = normSigla(object.code);
      const description = object.description.trim();
      if (!code || !description) continue;
      const descriptions = catalog.get(code) ?? [];
      if (!descriptions.includes(description)) descriptions.push(description);
      catalog.set(code, descriptions);
    }
  }
  return catalog;
}
