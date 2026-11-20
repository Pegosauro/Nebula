import { DEFAULT_IGNORED_DIRECTORIES, VAULT_BACKUP_HISTORY } from "../../domain/vault";

type FileEntry = { kind: "file"; hash: string };
type DirectoryEntry = { kind: "directory"; hash: string; children: Map<string, Entry> };
type Entry = FileEntry | DirectoryEntry;
type Handle = FileSystemDirectoryHandle | FileSystemFileHandle;
type Inventory = { root: DirectoryEntry; files: Map<string, File> };
type Fingerprint = { size: number; modified: number; hash: string };

export interface VaultBackupRecord {
  id: string;
  handle: FileSystemDirectoryHandle;
  baseline: DirectoryEntry;
  syncedAt: number;
  pending: boolean;
}

export interface VaultBackupChange {
  path: string;
  primary?: "file" | "directory";
  backup?: "file" | "directory";
  primaryChanged: boolean;
  backupChanged: boolean;
}

export interface VaultBackupReview {
  revision: string;
  changes: VaultBackupChange[];
}

export type VaultBackupChoice = "primary" | "backup";
export interface VaultBackupFilePreview { text: string; truncated: boolean }
export const canPreviewBackupFile = (path: string) => /\.(?:md|txt|json|csv|tsv|ya?ml|xml|svg|log)$/i.test(path);
type Change = VaultBackupChange & { mainEntry?: Entry; backupEntry?: Entry };
const encoder = new TextEncoder();
const chunkSize = 4 * 1024 * 1024;

async function digest(bytes: ArrayBuffer | Uint8Array<ArrayBuffer>): Promise<string> {
  const hash = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return Array.from(hash, byte => byte.toString(16).padStart(2, "0")).join("");
}

async function fileDigest(file: File) {
  if (file.size <= chunkSize) return digest(await file.arrayBuffer());
  const hashes: string[] = [];
  for (let offset = 0; offset < file.size; offset += chunkSize) {
    hashes.push(await digest(await file.slice(offset, offset + chunkSize).arrayBuffer()));
  }
  return digest(encoder.encode(hashes.join("")));
}

function matches(a?: Entry, b?: Entry): boolean {
  return a?.kind === b?.kind && a?.hash === b?.hash;
}

function ignored(base: string, name: string, kind: Handle["kind"]) {
  return kind === "directory" && DEFAULT_IGNORED_DIRECTORIES.has(name) && !(base === "" && name === ".nebula");
}

const notFound = (error: unknown) => error instanceof DOMException && error.name === "NotFoundError";
const wrongKind = (error: unknown) => error instanceof DOMException && error.name === "TypeMismatchError";

async function findNative(directory: FileSystemDirectoryHandle, name: string): Promise<Handle | undefined> {
  try { return await directory.getFileHandle(name); }
  catch (error) { if (!notFound(error) && !wrongKind(error)) throw error; }
  try { return await directory.getDirectoryHandle(name); }
  catch (error) { if (!notFound(error) && !wrongKind(error)) throw error; }
}

async function parentOf(root: FileSystemDirectoryHandle, path: string) {
  const segments = path.split("/");
  const name = segments.pop()!;
  let parent = root;
  for (const segment of segments) parent = await parent.getDirectoryHandle(segment);
  return { parent, name };
}

async function readTree(
  handle: Handle,
  path: string,
  files: Map<string, File>,
  previous?: Map<string, Fingerprint>,
  cache?: Map<string, Fingerprint>,
): Promise<Entry> {
  if (handle.kind === "file") {
    const file = await handle.getFile();
    const hint = previous?.get(path);
    const hash = hint && hint.size === file.size && hint.modified === file.lastModified ? hint.hash : await fileDigest(file);
    cache?.set(path, { size: file.size, modified: file.lastModified, hash });
    files.set(path, file);
    return { kind: "file", hash };
  }
  const children = new Map<string, Entry>();
  for await (const [name, child] of handle.entries()) {
    if (ignored(path, name, child.kind)) continue;
    children.set(name, await readTree(child, path ? `${path}/${name}` : name, files, previous, cache));
  }
  const parts = [...children.keys()].sort().map(name => {
    const child = children.get(name)!;
    return [name, child.kind, child.hash];
  });
  return { kind: "directory", children, hash: await digest(encoder.encode(JSON.stringify(parts))) };
}

function compare(baseline: DirectoryEntry, primary: DirectoryEntry, backup: DirectoryEntry): Change[] {
  const changes: Change[] = [];
  function visit(path: string, before?: Entry, mainEntry?: Entry, backupEntry?: Entry): void {
    if (matches(mainEntry, backupEntry)) return;
    if (mainEntry?.kind === "directory" && backupEntry?.kind === "directory") {
      const paths = [...new Set([...mainEntry.children.keys(), ...backupEntry.children.keys()])].sort();
      for (const name of paths) {
        visit(path ? `${path}/${name}` : name, before?.kind === "directory" ? before.children.get(name) : undefined,
          mainEntry.children.get(name), backupEntry.children.get(name));
      }
      return;
    }
    changes.push({ path, mainEntry, backupEntry, primary: mainEntry?.kind, backup: backupEntry?.kind,
      primaryChanged: !matches(before, mainEntry), backupChanged: !matches(before, backupEntry) });
  }
  visit("", baseline, primary, backup);
  return changes;
}

async function writeFile(parent: FileSystemDirectoryHandle, name: string, file: File, existing?: FileSystemFileHandle) {
  const handle = existing ?? await parent.getFileHandle(name, { create: true });
  try {
    const stream = await handle.createWritable({ keepExistingData: false });
    try { await stream.write(file); await stream.close(); }
    catch (error) { await stream.abort(error).catch(() => undefined); throw error; }
  } catch (error) {
    if (!existing) await parent.removeEntry(name).catch(() => undefined);
    throw error;
  }
}

async function copyTree(parent: FileSystemDirectoryHandle, name: string, path: string, source: Entry, files: Inventory["files"]) {
  if (await findNative(parent, name)) throw new Error(`È già presente un elemento in “${path}”.`);
  if (source.kind === "file") await writeFile(parent, name, files.get(path)!);
  else {
    const directory = await parent.getDirectoryHandle(name, { create: true });
    for (const [child, entry] of source.children) await copyTree(directory, child, `${path}/${child}`, entry, files);
  }
}

async function transfer(
  destination: FileSystemDirectoryHandle, path: string, source: Entry | undefined, files: Inventory["files"], expected?: Entry,
) {
  const { parent, name } = await parentOf(destination, path);
  const current = await findNative(parent, name);
  const actual = current && await readTree(current, path, new Map());
  if (!matches(actual, expected)) throw new Error(`“${path}” è cambiato. Aggiorna il confronto e riprova.`);
  if (source?.kind === "file" && current?.kind === "file") {
    await writeFile(parent, name, files.get(path)!, current);
    return;
  }
  if (current) {
    if (current.kind === "directory" && expected?.kind === "directory") {
      await assertRemovable(current, expected, path);
      await removeKnownChildren(current, expected);
    }
    await parent.removeEntry(name);
  }
  if (source) await copyTree(parent, name, path, source, files);
}

// A directory can contain excluded data such as a Git or Obsidian workspace.
async function assertRemovable(directory: FileSystemDirectoryHandle, expected: DirectoryEntry, path: string) {
  for await (const [name, handle] of directory.entries()) {
    const entry = expected.children.get(name);
    if (!entry || entry.kind !== handle.kind) throw new Error(`“${path}” contiene elementi non inclusi nel backup. Controlla la cartella prima di rimuoverla.`);
    if (handle.kind === "directory" && entry.kind === "directory") await assertRemovable(handle, entry, `${path}/${name}`);
  }
}

async function removeKnownChildren(directory: FileSystemDirectoryHandle, expected: DirectoryEntry) {
  for (const [name, entry] of expected.children) {
    if (entry.kind === "directory") await removeKnownChildren(await directory.getDirectoryHandle(name), entry);
    await directory.removeEntry(name);
  }
}

function revision(record: VaultBackupRecord, primary: Inventory, backup: Inventory) {
  return [record.id, record.baseline.hash, primary.root.hash, backup.root.hash].join(":");
}

export class VaultBackupFiles {
  private readonly cache = new WeakMap<FileSystemDirectoryHandle, Map<string, Fingerprint>>();

  private async inventory(handle: FileSystemDirectoryHandle, strong: boolean): Promise<Inventory> {
    const files = new Map<string, File>();
    const fresh = new Map<string, Fingerprint>();
    const root = await readTree(handle, "", files, strong ? undefined : this.cache.get(handle), fresh) as DirectoryEntry;
    this.cache.set(handle, fresh);
    return { root, files };
  }

  private async both(primary: FileSystemDirectoryHandle, record: VaultBackupRecord, strong: boolean) {
    return Promise.all([this.inventory(primary, strong), this.inventory(record.handle, strong)]);
  }

  async create(primary: FileSystemDirectoryHandle, destination: FileSystemDirectoryHandle): Promise<VaultBackupRecord> {
    if (await primary.resolve(destination) !== null || await destination.resolve(primary) !== null) {
      throw new Error("Scegli una cartella separata dal Vault principale.");
    }
    for await (const _ of destination.entries()) throw new Error("Scegli una cartella di backup vuota.");
    const source = await this.inventory(primary, true);
    for (const [name, entry] of source.root.children) await copyTree(destination, name, name, entry, source.files);
    const copied = await this.inventory(destination, true);
    if (!matches(source.root, copied.root)) throw new Error("La copia iniziale è incompleta. Riprova con una cartella vuota.");
    return { id: crypto.randomUUID(), handle: destination, baseline: copied.root, syncedAt: Date.now(), pending: false };
  }

  async sync(primary: FileSystemDirectoryHandle, record: VaultBackupRecord, strong: boolean): Promise<VaultBackupRecord> {
    if (record.pending) return record;
    const [main, backup] = await this.both(primary, record, strong);
    const changes = compare(record.baseline, main.root, backup.root);
    if (changes.some(change => change.backupChanged)) return { ...record, pending: true };
    for (const change of changes.sort((a, b) => Number(!!a.mainEntry) - Number(!!b.mainEntry))) {
      await transfer(record.handle, change.path, change.mainEntry, main.files, change.backupEntry);
    }
    return { ...record, baseline: main.root, syncedAt: Date.now() };
  }

  async review(primary: FileSystemDirectoryHandle, record: VaultBackupRecord): Promise<VaultBackupReview> {
    const [main, backup] = await this.both(primary, record, true);
    const changes = compare(record.baseline, main.root, backup.root)
      .map(({ mainEntry: _main, backupEntry: _backup, ...change }) => change);
    return { revision: revision(record, main, backup), changes };
  }

  async preview(root: FileSystemDirectoryHandle, path: string): Promise<VaultBackupFilePreview | null> {
    try {
      const { parent, name } = await parentOf(root, path);
      const file = await (await parent.getFileHandle(name)).getFile();
      const limit = 32 * 1024;
      return { text: await file.slice(0, limit).text(), truncated: file.size > limit };
    } catch (error) {
      if (notFound(error) || wrongKind(error)) return null;
      throw error;
    }
  }

  async apply(
    primary: FileSystemDirectoryHandle,
    record: VaultBackupRecord,
    reviewedRevision: string,
    choices: ReadonlyMap<string, VaultBackupChoice>,
  ): Promise<VaultBackupRecord> {
    const [main, backup] = await this.both(primary, record, true);
    if (revision(record, main, backup) !== reviewedRevision) throw new Error("Il Vault o il backup è cambiato. Aggiorna il confronto prima di applicarlo.");
    const changes = compare(record.baseline, main.root, backup.root);
    if (changes.some(change => !choices.has(change.path))) throw new Error("Scegli quale versione tenere per ogni modifica.");
    let history: FileSystemDirectoryHandle | undefined;
    const operations = changes.map(change => {
      const takeBackup = choices.get(change.path) === "backup";
      return { change, destination: takeBackup ? primary : record.handle,
        source: takeBackup ? change.backupEntry : change.mainEntry, target: takeBackup ? change.mainEntry : change.backupEntry,
        sourceFiles: takeBackup ? backup.files : main.files, targetFiles: takeBackup ? main.files : backup.files };
    });
    for (const { change, destination, source, target, sourceFiles, targetFiles } of operations.sort((a, b) => Number(!!a.source) - Number(!!b.source))) {
      if (target && (destination === primary || !source || source.kind !== target.kind || change.backupChanged)) {
        history ??= await (await record.handle.getDirectoryHandle(VAULT_BACKUP_HISTORY, { create: true }))
          .getDirectoryHandle(`${new Date().toISOString().replaceAll(":", "-")}-${crypto.randomUUID()}`, { create: true });
        const archived = change.path.split("/");
        const name = archived.pop()!;
        let folder = await history.getDirectoryHandle(destination === primary ? "Principale" : "Backup", { create: true });
        for (const segment of archived) folder = await folder.getDirectoryHandle(segment, { create: true });
        await copyTree(folder, name, change.path, target, targetFiles);
      }
      await transfer(destination, change.path, source, sourceFiles, target);
    }
    const [latest, copied] = await this.both(primary, record, true);
    if (!matches(latest.root, copied.root)) throw new Error("Sono emerse altre modifiche. Aggiorna il confronto per completare il ripristino.");
    return { ...record, baseline: latest.root, syncedAt: Date.now(), pending: false };
  }
}
