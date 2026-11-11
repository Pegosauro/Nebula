import type { VaultEntry } from "../../domain/vault";
import { isTreePath } from "./model";

export function treeEntries(entries: VaultEntry[]): VaultEntry[] {
  return entries.flatMap(entry => entry.type === "directory" ? treeEntries(entry.children ?? []) : isTreePath(entry.path) ? [entry] : []);
}
