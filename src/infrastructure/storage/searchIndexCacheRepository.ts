import { isPathInside } from "../../domain/path";
import type { KnowledgeSourceDocument } from "../../domain/knowledge";
import { openNebulaDatabase, SEARCH_CACHE_STORE } from "./nebulaDb";

interface CachedSearchDocument extends KnowledgeSourceDocument {
  key: string;
  vaultId: string;
  size: number;
  lastModified: number;
}

function cacheKey(vaultId: string, path: string): string {
  return `${vaultId}:${path}`;
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Cache indice non disponibile."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Aggiornamento cache interrotto."));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Lettura cache non riuscita."));
  });
}

export class SearchIndexCacheRepository {
  async getVault(vaultId: string): Promise<Map<string, CachedSearchDocument>> {
    const database = await openNebulaDatabase();
    const transaction = database.transaction(SEARCH_CACHE_STORE, "readonly");
    const records = await requestResult(transaction.objectStore(SEARCH_CACHE_STORE).index("vaultId").getAll(vaultId) as IDBRequest<CachedSearchDocument[]>);
    return new Map(records.map((record) => [record.path, record]));
  }

  async synchronize(vaultId: string, changed: KnowledgeSourceDocument[], validPaths: Set<string>): Promise<void> {
    const database = await openNebulaDatabase();
    const existing = await this.getVault(vaultId);
    const transaction = database.transaction(SEARCH_CACHE_STORE, "readwrite");
    const store = transaction.objectStore(SEARCH_CACHE_STORE);
    for (const document of changed) {
      if (document.size === undefined || document.lastModified === undefined) continue;
      const record: CachedSearchDocument = {
        ...document,
        key: cacheKey(vaultId, document.path),
        vaultId,
        size: document.size,
        lastModified: document.lastModified,
      };
      store.put(record);
    }
    for (const record of existing.values()) {
      if (!validPaths.has(record.path)) store.delete(record.key);
    }
    await transactionDone(transaction);
  }

  async put(vaultId: string, document: KnowledgeSourceDocument): Promise<void> {
    if (document.size === undefined || document.lastModified === undefined) return;
    const database = await openNebulaDatabase();
    const transaction = database.transaction(SEARCH_CACHE_STORE, "readwrite");
    transaction.objectStore(SEARCH_CACHE_STORE).put({
      ...document,
      key: cacheKey(vaultId, document.path),
      vaultId,
      size: document.size,
      lastModified: document.lastModified,
    } satisfies CachedSearchDocument);
    await transactionDone(transaction);
  }

  async remove(vaultId: string, basePath: string): Promise<void> {
    const records = await this.getVault(vaultId);
    const database = await openNebulaDatabase();
    const transaction = database.transaction(SEARCH_CACHE_STORE, "readwrite");
    const store = transaction.objectStore(SEARCH_CACHE_STORE);
    for (const record of records.values()) {
      if (isPathInside(record.path, basePath)) store.delete(record.key);
    }
    await transactionDone(transaction);
  }

  async remap(vaultId: string, oldPath: string, newPath: string): Promise<void> {
    const records = await this.getVault(vaultId);
    const database = await openNebulaDatabase();
    const transaction = database.transaction(SEARCH_CACHE_STORE, "readwrite");
    const store = transaction.objectStore(SEARCH_CACHE_STORE);
    for (const record of records.values()) {
      if (!isPathInside(record.path, oldPath)) continue;
      const path = `${newPath}${record.path.slice(oldPath.length)}`;
      store.delete(record.key);
      store.put({ ...record, path, key: cacheKey(vaultId, path) });
    }
    await transactionDone(transaction);
  }
}
