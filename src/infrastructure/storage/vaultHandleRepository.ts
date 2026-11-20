import { runHandleTransaction } from "./nebulaDb";
import type { VaultBackupRecord } from "../filesystem/vaultBackup";

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
  async get(): Promise<FileSystemDirectoryHandle | undefined> {
    return (await this.getConnection())?.handle;
  }

  async getConnection(): Promise<{ handle: FileSystemDirectoryHandle; id?: string } | undefined> {
    const current = await runHandleTransaction<FileSystemDirectoryHandle | { handle: FileSystemDirectoryHandle; id?: string } | undefined>("readonly", store => store.get(CURRENT_VAULT_KEY));
    return current && ("handle" in current ? current : { handle: current });
  }

  async set(handle: FileSystemDirectoryHandle): Promise<StoredRecentVault> {
    const recent = await this.remember(handle);
    const current = recent[0];
    if (!current) throw new Error("Impossibile memorizzare il Vault.");
    await this.setCurrent(handle, current.id);
    return current;
  }

  async setCurrent(handle: FileSystemDirectoryHandle, id?: string): Promise<void> {
    await runHandleTransaction("readwrite", (store) => store.put({ handle, id }, CURRENT_VAULT_KEY));
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

  async remember(handle: FileSystemDirectoryHandle, knownId?: string): Promise<StoredRecentVault[]> {
    const recent = await this.getRecent();
    let matchingIndex = -1;
    for (let index = 0; index < recent.length; index += 1) {
      const stored = recent[index];
      if (!stored) continue;
      try {
        if (knownId ? stored.id === knownId : typeof handle.isSameEntry === "function" && await handle.isSameEntry(stored.handle)) {
          matchingIndex = index;
          break;
        }
      } catch {
        // Un handle non più valido resta comunque selezionabile dall'elenco recenti.
      }
    }

    const existing = matchingIndex >= 0 ? recent[matchingIndex] : undefined;
    const item: StoredRecentVault = {
      id: knownId ?? existing?.id ?? crypto.randomUUID(),
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

  getBackup(id: string): Promise<VaultBackupRecord | undefined> {
    return runHandleTransaction("readonly", store => store.get(`backup:${id}`));
  }

  async setBackup(id: string, record: VaultBackupRecord): Promise<void> {
    await runHandleTransaction("readwrite", store => store.put(record, `backup:${id}`));
  }

  async removeBackup(id: string): Promise<void> {
    await runHandleTransaction("readwrite", store => store.delete(`backup:${id}`));
  }
}
