import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseConnectionForTests } from "./nebulaDb";
import { SearchIndexCacheRepository } from "./searchIndexCacheRepository";

async function deleteTestDatabase(): Promise<void> {
  resetDatabaseConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("nebula-local");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

describe("SearchIndexCacheRepository", () => {
  beforeEach(deleteTestDatabase);

  it("stores, remaps and removes cached Vault documents", async () => {
    const repository = new SearchIndexCacheRepository();
    await repository.put("vault-1", { path: "Area/Nota.md", content: "test", size: 4, lastModified: 1 });
    expect((await repository.getVault("vault-1")).get("Area/Nota.md")?.content).toBe("test");
    await repository.remap("vault-1", "Area", "Archivio");
    expect((await repository.getVault("vault-1")).has("Archivio/Nota.md")).toBe(true);
    await repository.remove("vault-1", "Archivio");
    expect((await repository.getVault("vault-1")).size).toBe(0);
  });
});
