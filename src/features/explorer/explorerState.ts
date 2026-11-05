export interface ExplorerState { expanded: string[]; scrollTop: number }

const storageKey = (vaultId: string) => `nebula.explorer.v1:${vaultId}`;

export function readExplorerState(vaultId?: string): ExplorerState | undefined {
  if (!vaultId) return;
  try {
    const value = JSON.parse(localStorage.getItem(storageKey(vaultId)) ?? "null");
    if (!value || !Array.isArray(value.expanded) || !value.expanded.every((path: unknown) => typeof path === "string")) return;
    return { expanded: value.expanded, scrollTop: typeof value.scrollTop === "number" && Number.isFinite(value.scrollTop) ? Math.max(0, value.scrollTop) : 0 };
  } catch { return; }
}

export function saveExplorerState(vaultId: string | undefined, state: ExplorerState): void {
  if (!vaultId) return;
  try { localStorage.setItem(storageKey(vaultId), JSON.stringify(state)); }
  catch { /* The tree remains usable when browser storage is unavailable. */ }
}
