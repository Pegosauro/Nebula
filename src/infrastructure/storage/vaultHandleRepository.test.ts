import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabaseConnectionForTests } from "./nebulaDb";
import { VaultHandleRepository } from "./vaultHandleRepository";

async function deleteTestDatabase(): Promise<void> {
  resetDatabaseConnectionForTests();
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase("nebula-local");
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

describe("VaultHandleRepository", () => {
  beforeEach(deleteTestDatabase);

  it("stores and removes the current handle identity", async () => {
    const repository = new VaultHandleRepository();
    const handle = { kind: "directory", name: "Vault test" } as FileSystemDirectoryHandle;

    await repository.set(handle);
    expect(await repository.get()).toMatchObject({ kind: "directory", name: "Vault test" });

    await repository.clear();
    expect(await repository.get()).toBeUndefined();
    expect(await repository.getRecent()).toHaveLength(1);
    expect((await repository.getRecent())[0]).toMatchObject({ name: "Vault test" });
  });
});
