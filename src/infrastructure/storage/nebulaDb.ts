const DATABASE_NAME = "nebula-local";
const DATABASE_VERSION = 3;
const HANDLE_STORE = "vault-handles";
export const SEARCH_CACHE_STORE = "search-index-cache";

let databasePromise: Promise<IDBDatabase> | undefined;

export function openNebulaDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(HANDLE_STORE)) {
        database.createObjectStore(HANDLE_STORE);
      }
      if (!database.objectStoreNames.contains(SEARCH_CACHE_STORE)) {
        const cache = database.createObjectStore(SEARCH_CACHE_STORE, { keyPath: "key" });
        cache.createIndex("vaultId", "vaultId", { unique: false });
      }

    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Impossibile aprire l'archivio locale."));
  });

  return databasePromise;
}

export async function runHandleTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openNebulaDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = database.transaction(HANDLE_STORE, mode);
    const request = operation(transaction.objectStore(HANDLE_STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Operazione locale non riuscita."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Operazione locale interrotta."));
  });
}

export function resetDatabaseConnectionForTests(): void {
  databasePromise = undefined;
}
