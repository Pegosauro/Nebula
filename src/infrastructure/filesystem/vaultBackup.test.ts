// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { VAULT_BACKUP_HISTORY } from "../../domain/vault";
import { VaultService } from "../../features/vault/vaultService";
import { VaultHandleRepository } from "../storage/vaultHandleRepository";
import { BrowserVaultAdapter } from "./browserVaultAdapter";
import { VaultBackupFiles, type VaultBackupRecord } from "./vaultBackup";
import { imageTrashDirectory } from "./imageTrash";

class FileHandle {
  readonly kind = "file" as const;
  private content: Blob = new Blob();
  private modified = 0;
  constructor(readonly name: string) {}
  async getFile() { return new File([this.content], this.name, { lastModified: this.modified }); }
  async createWritable() {
    let draft = this.content;
    return {
      write: async (value: Blob | string) => { draft = new Blob([value]); },
      close: async () => { this.content = draft; this.modified++; },
      abort: async () => {},
    };
  }
}

class Directory {
  readonly kind = "directory" as const;
  readonly children = new Map<string, Directory | FileHandle>();
  accessible = true;
  constructor(readonly name: string) {}
  get handle() { return this as unknown as FileSystemDirectoryHandle; }
  async isSameEntry(other: unknown) { return other === this; }
  async queryPermission() { return this.accessible ? "granted" : "denied"; }
  async requestPermission() { return this.queryPermission(); }
  async resolve(other: unknown): Promise<string[] | null> {
    if (other === this) return [];
    for (const [name, child] of this.children) {
      if (child instanceof Directory) {
        const path = await child.resolve(other);
        if (path) return [name, ...path];
      }
    }
    return null;
  }
  async *entries() {
    this.requireAccess();
    yield* this.children;
  }
  private requireAccess() {
    if (!this.accessible) throw new DOMException("Inaccessibile", "NotAllowedError");
  }
  async getDirectoryHandle(name: string, { create = false } = {}) {
    this.requireAccess();
    const child = this.children.get(name);
    if (child instanceof Directory) return child;
    if (child) throw new DOMException("Tipo errato", "TypeMismatchError");
    if (!create) throw new DOMException("Assente", "NotFoundError");
    const directory = new Directory(name);
    this.children.set(name, directory);
    return directory;
  }
  async getFileHandle(name: string, { create = false } = {}) {
    this.requireAccess();
    const child = this.children.get(name);
    if (child instanceof FileHandle) return child;
    if (child) throw new DOMException("Tipo errato", "TypeMismatchError");
    if (!create) throw new DOMException("Assente", "NotFoundError");
    const file = new FileHandle(name);
    this.children.set(name, file);
    return file;
  }
  async removeEntry(name: string, { recursive = false } = {}) {
    this.requireAccess();
    const child = this.children.get(name);
    if (!child) throw new DOMException("Assente", "NotFoundError");
    if (child instanceof Directory && child.children.size && !recursive) throw new DOMException("Cartella non vuota", "InvalidModificationError");
    this.children.delete(name);
  }
}

async function write(directory: Directory, name: string, content: Blob | string) {
  const file = await directory.getFileHandle(name, { create: true });
  const writer = await file.createWritable();
  await writer.write(content);
  await writer.close();
}

async function read(directory: Directory, name: string) {
  return (await (await directory.getFileHandle(name)).getFile()).text();
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("moves an attachment after saving its last removal and restores the original bytes on undo", async () => {
  const primary = new Directory("Vault"), repository = new VaultHandleRepository();
  const connection = { id: "vault-id", handle: primary.handle };
  vi.stubGlobal("navigator", {});
  vi.spyOn(repository, "getConnection").mockResolvedValue(connection);
  vi.spyOn(repository, "remember").mockResolvedValue([{ ...connection, name: primary.name, lastOpenedAt: 1 }]);
  vi.spyOn(repository, "getBackup").mockResolvedValue(undefined);
  const attachments = await primary.getDirectoryHandle("attachments", { create: true });
  await write(attachments, "Schema è.png", "image bytes");
  const path = "attachments/Schema è.png", content = "![Schema](attachments/Schema%20%C3%A8.png)";
  await write(primary, "Nota.md", content);
  await write(primary, "Altra.md", '[schema]: <attachments/schema%20%C3%A8.png>');
  const service = new VaultService(new BrowserVaultAdapter(), repository);
  await service.probeSaved();
  await service.resumeSaved();
  const current = await service.statText("Nota.md");
  await service.writeTextWithImages("Nota.md", "", current, new Map([[path, false]]), () => false);
  expect(await read(attachments, "Schema è.png")).toBe("image bytes");
  await write(primary, "Altra.md", "testo senza immagine");
  await service.writeTextWithImages("Nota.md", "", await service.statText("Nota.md"), new Map([[path, false]]), () => true);
  expect(await read(attachments, "Schema è.png")).toBe("image bytes");
  await expect(service.writeTextWithImages("Nota.md", "", current, new Map([[path, false]]), () => false)).rejects.toThrow("modificato");
  expect(await read(attachments, "Schema è.png")).toBe("image bytes");
  await service.writeTextWithImages("Nota.md", "", await service.statText("Nota.md"), new Map([[path, false]]), () => false);
  expect(attachments.children.has("Schema è.png")).toBe(false);
  expect(await (await service.readImage(path)).text()).toBe("image bytes");
  const trash = await imageTrashDirectory.split("/").reduce(async (parent, name) => (await parent).getDirectoryHandle(name), Promise.resolve(primary));
  const trashed = await trash.getDirectoryHandle("attachments");
  expect(await read(trashed, "Schema è.png")).toBe("image bytes");
  await write(attachments, "Schema è.png", "new file");
  const restore = () => service.statText("Nota.md").then(metadata =>
    service.writeTextWithImages("Nota.md", content, metadata, new Map([[path, true]]), () => true));
  await expect(restore()).rejects.toThrow("ancora nel cestino");
  expect(await read(attachments, "Schema è.png")).toBe("new file");
  expect(await read(trashed, "Schema è.png")).toBe("image bytes");
  await attachments.removeEntry("Schema è.png");
  await restore();
  expect(await read(attachments, "Schema è.png")).toBe("image bytes");
  expect(trashed.children.has("Schema è.png")).toBe(false);
  expect(await read(primary, "Nota.md")).toBe(content);
});

describe("optional Vault backup", () => {
  it("copies attachments, hidden task data and empty folders, rejects overlapping or occupied targets", async () => {
    const files = new VaultBackupFiles(), primary = new Directory("Vault"), backup = new Directory("Backup");
    const nested = await primary.getDirectoryHandle("Folder", { create: true });
    const tasks = await primary.getDirectoryHandle(".nebula", { create: true });
    const git = await primary.getDirectoryHandle(".git", { create: true });
    await write(primary, "image.png", new Blob([new Uint8Array([0, 255, 12])]));
    await write(tasks, "tasks.json", "[]");
    await write(git, "config", "excluded");
    await expect(files.create(primary.handle, primary.handle)).rejects.toThrow("separata");
    await expect(files.create(primary.handle, nested.handle)).rejects.toThrow("separata");
    const record = await files.create(primary.handle, backup.handle);
    expect(record.pending).toBe(false);
    expect(backup.children.has(".git")).toBe(false);
    expect(backup.children.get("Folder")).toBeInstanceOf(Directory);
    expect(await read(await backup.getDirectoryHandle(".nebula"), "tasks.json")).toBe("[]");
    expect(new Uint8Array(await (await (await backup.getFileHandle("image.png")).getFile()).arrayBuffer())).toEqual(new Uint8Array([0, 255, 12]));
    await expect(files.create(primary.handle, backup.handle)).rejects.toThrow("vuota");
  });

  it("refreshes the working copy and suspends mirroring when an independent backup edit is found", async () => {
    const files = new VaultBackupFiles(), primary = new Directory("Vault"), backup = new Directory("Backup");
    await write(primary, "Remove.md", "ancienne");
    await write(primary, "Stable.md", "originale");
    let record = await files.create(primary.handle, backup.handle);
    await primary.removeEntry("Remove.md");
    await write(primary, "Nuova.md", "creata");
    record = await files.sync(primary.handle, record, true);
    expect(backup.children.has("Remove.md")).toBe(false);
    expect(await read(backup, "Nuova.md")).toBe("creata");
    await write(backup, "Stable.md", "modifica backup");
    await write(primary, "Stable.md", "modifica principale");
    record = await files.sync(primary.handle, record, true);
    expect(record.pending).toBe(true);
    expect(await read(backup, "Stable.md")).toBe("modifica backup");
    expect((await files.review(primary.handle, record)).changes).toEqual([
      { path: "Stable.md", primary: "file", backup: "file", primaryChanged: true, backupChanged: true },
    ]);
  });

  it("rejects stale reviews, then recovers selected changes and archives replaced primary files", async () => {
    const files = new VaultBackupFiles(), main = new Directory("Vault"), backup = new Directory("Backup");
    await write(main, "Conflitto.md", "comune");
    await write(main, "Da togliere.md", "conserva nello storico");
    await write(main, "Da tenere.md", "inizio");
    const record = await files.create(main.handle, backup.handle);
    await write(main, "Conflitto.md", "versione principale");
    await write(backup, "Conflitto.md", "versione backup");
    await write(main, "Da tenere.md", "solo principale");
    await backup.removeEntry("Da togliere.md");
    await write(backup, "Nuova.md", "solo backup");
    const preview = await files.review(main.handle, record);
    const keep = new Map([["Conflitto.md", "backup"], ["Da tenere.md", "primary"], ["Da togliere.md", "backup"], ["Nuova.md", "backup"]] as const);
    await write(main, "Conflitto.md", "principale più recente");
    await expect(files.apply(main.handle, record, preview.revision, keep)).rejects.toThrow("Aggiorna il confronto");
    expect(await read(main, "Conflitto.md")).toBe("principale più recente");
    const revised = await files.review(main.handle, record);
    await expect(files.apply(main.handle, record, revised.revision, new Map())).rejects.toThrow("ogni modifica");
    const result = await files.apply(main.handle, record, revised.revision, keep);
    expect(result.pending).toBe(false);
    expect(await read(main, "Conflitto.md")).toBe("versione backup");
    expect(await read(backup, "Da tenere.md")).toBe("solo principale");
    expect(await read(main, "Nuova.md")).toBe("solo backup");
    expect(main.children.has("Da togliere.md")).toBe(false);
    const history = await backup.getDirectoryHandle(VAULT_BACKUP_HISTORY);
    const saved = await (await history.getDirectoryHandle([...history.children.keys()][0]!)).getDirectoryHandle("Principale");
    expect(await read(saved, "Conflitto.md")).toBe("principale più recente");
    expect(await read(saved, "Da togliere.md")).toBe("conserva nello storico");
    expect((await files.review(main.handle, result)).changes).toEqual([]);
  });

  it("keeps the primary identity across fallback writes and a later recovery", async () => {
    const primary = new Directory("Vault"), backup = new Directory("Backup"), repository = new VaultHandleRepository();
    await write(primary, "Nota.md", "originale");
    let record: VaultBackupRecord | undefined;
    const connection = { id: "vault-id", handle: primary.handle };
    vi.spyOn(repository, "getConnection").mockResolvedValue(connection);
    vi.spyOn(repository, "remember").mockResolvedValue([{ ...connection, name: primary.name, lastOpenedAt: 1 }]);
    vi.spyOn(repository, "getBackup").mockImplementation(async () => record);
    vi.spyOn(repository, "setBackup").mockImplementation(async (_id, next) => { record = next; });
    vi.spyOn(repository, "clear").mockResolvedValue();
    vi.stubGlobal("navigator", {});
    vi.stubGlobal("window", { showDirectoryPicker: async () => backup.handle });
    const service = new VaultService(new BrowserVaultAdapter(), repository);
    await service.probeSaved();
    await service.resumeSaved();
    await service.configureBackup();
    primary.accessible = false;
    const restored = new VaultService(new BrowserVaultAdapter(), repository);
    expect(await restored.probeSaved()).toMatchObject({ name: "Vault", permission: "denied" });
    await expect(restored.resumeSaved()).rejects.toThrow("autorizzazione");
    expect((await restored.openBackup()).name).toBe("Backup");
    expect(restored.currentVaultId()).toBe("vault-id:backup");
    await restored.writeText("Nota.md", "modifica offline");
    await restored.taskFile("vault-id:backup").write("[]", null);
    expect(await read(backup, "Nota.md")).toBe("modifica offline");
    primary.accessible = true;
    expect(await read(primary, "Nota.md")).toBe("originale");
    const review = await restored.reviewBackup();
    expect(review.changes.map(change => change.path)).toEqual([".nebula", "Nota.md"]);
    await restored.applyBackup(review, new Map(review.changes.map(change => [change.path, "backup"] as const)));
    expect(restored.currentVaultId()).toBe("vault-id");
    expect(await read(primary, "Nota.md")).toBe("modifica offline");
    expect(await restored.taskFile("vault-id").read()).toBe("[]");
    expect(record?.pending).toBe(false);
  });
});
