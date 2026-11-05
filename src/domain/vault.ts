export type VaultEntryType = "directory" | "file";

export interface VaultEntry {
  id: string;
  name: string;
  path: string;
  type: VaultEntryType;
  extension: string;
  size?: number;
  modifiedAt?: number;
  children?: VaultEntry[];
}

export interface VaultStats {
  directories: number;
  files: number;
  notes: number;
  boards: number;
}

export interface VaultSnapshot {
  name: string;
  root: VaultEntry[];
  stats: VaultStats;
  scannedAt: number;
}

export interface VaultScanProgress {
  phase: "scan";
  current: number;
  path: string;
}

export interface RecentVault {
  id: string;
  name: string;
  lastOpenedAt: number;
}

export type VaultPermission = "granted" | "prompt" | "denied";

export const DEFAULT_IGNORED_DIRECTORIES = new Set([
  ".git",
  ".nebula",
  ".obsidian",
  ".trash",
  "node_modules",
]);

export function findVaultEntry(entries: VaultEntry[], path: string): VaultEntry | undefined {
  for (const entry of entries) {
    if (entry.path === path) return entry;
    if (entry.children) {
      const nested = findVaultEntry(entry.children, path);
      if (nested) return nested;
    }
  }
  return undefined;
}
