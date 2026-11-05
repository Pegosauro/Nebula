import type { VaultEntry } from "../../domain/vault";
import { isConfiguratorPath } from "./model";
export function configuratorEntries(entries: VaultEntry[]): VaultEntry[] {
  return entries.flatMap(e=>e.type==="directory" ? configuratorEntries(e.children ?? []) : isConfiguratorPath(e.path) ? [e] : []);
}
