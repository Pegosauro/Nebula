import { runHandleTransaction } from "./nebulaDb";

const CURRENT_VAULT_KEY = "current";
const RECENT_VAULTS_KEY = "recent-vaults";
const MAX_RECENT_VAULTS = 8;

export interface StoredRecentVault {
  id: string;
  name: string;
  handle: FileSystemDirectoryHandle;
  lastOpenedAt: number;
}

export class VaultHandleRepository {
  get(): Promise<FileSystemDirectoryHandle | undefined> {
    return runHandleTransaction("readonly", (store) => store.get(CURRENT_VAULT_KEY));
  }

  async set(handle: FileSystemDirectoryHandle): Promise<StoredRecentVault> {
    await this.setCurrent(handle);
    const recent = await this.remember(handle);
    const current = recent[0];
    if (!current) throw new Error("Impossibile memorizzare il Vault.");
    return current;
  }

  async setCurrent(handle: FileSystemDirectoryHandle): Promise<void> {
    await runHandleTransaction("readwrite", (store) => store.put(handle, CURRENT_VAULT_KEY));
  }

  async clear(): Promise<void> {
    await runHandleTransaction("readwrite", (store) => store.delete(CURRENT_VAULT_KEY));
  }

  async getRecent(): Promise<StoredRecentVault[]> {
    return (await runHandleTransaction<StoredRecentVault[] | undefined>(
      "readonly",
      (store) => store.get(RECENT_VAULTS_KEY),
    )) ?? [];
  }

  async remember(handle: FileSystemDirectoryHandle): Promise<StoredRecentVault[]> {
    const recent = await this.getRecent();
    let matchingIndex = -1;
    for (let index = 0; index < recent.length; index += 1) {
      const stored = recent[index];
      if (!stored) continue;
      try {
        if (typeof handle.isSameEntry === "function" && await handle.isSameEntry(stored.handle)) {
          matchingIndex = index;
          break;
        }
      } catch {
        // Un handle non più valido resta comunque selezionabile dall'elenco recenti.
      }
    }

    const existing = matchingIndex >= 0 ? recent[matchingIndex] : undefined;
    const item: StoredRecentVault = {
      id: existing?.id ?? crypto.randomUUID(),
      name: handle.name,
      handle,
      lastOpenedAt: Date.now(),
    };
    const next = [item, ...recent.filter((_, index) => index !== matchingIndex)]
      .slice(0, MAX_RECENT_VAULTS);
    await runHandleTransaction("readwrite", (store) => store.put(next, RECENT_VAULTS_KEY));
    return next;
  }

  async getRecentById(id: string): Promise<StoredRecentVault | undefined> {
    return (await this.getRecent()).find((item) => item.id === id);
  }
}
