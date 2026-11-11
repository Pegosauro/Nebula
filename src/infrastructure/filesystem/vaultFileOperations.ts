import {
  basename,
  dirname,
  ensureMarkdownExtension,
  extensionOf,
  isPathInside,
  joinVaultPath,
  normalizeRelativePath,
  validateVaultEntryName,
} from "../../domain/path";
import type { VaultEntry } from "../../domain/vault";

export class VaultCollisionError extends Error {
  constructor(path: string) {
    super(`Esiste già un elemento in “${path}”.`);
    this.name = "VaultCollisionError";
  }
}

export class VaultEntryNotFoundError extends Error {
  constructor(path: string) {
    super(`“${path}” non è più disponibile nel Vault.`);
    this.name = "VaultEntryNotFoundError";
  }
}

export interface TextFileSnapshot {
  path: string;
  content: string;
  size: number;
  lastModified: number;
}

export interface ExpectedFileMetadata {
  size: number;
  lastModified: number;
}

export class ExternalFileConflictError extends Error {
  constructor(readonly current: ExpectedFileMetadata) {
    super("Il file è stato modificato da un'altra applicazione.");
    this.name = "ExternalFileConflictError";
  }
}

function assertMarkdownPath(path: string): void {
  if (extensionOf(basename(path)) !== ".md" && !/\.config\.json$/i.test(path) && !/\.tree\.json$/i.test(path)) throw new Error("Formato di documento non supportato.");
}

async function findChild(
  directory: FileSystemDirectoryHandle,
  name: string,
): Promise<FileSystemDirectoryHandle | FileSystemFileHandle | undefined> {
  for await (const [childName, child] of directory.entries()) {
    if (childName === name) return child;
  }
  return undefined;
}

async function findNameCollision(directory: FileSystemDirectoryHandle, name: string): Promise<string | undefined> {
  for await (const [childName] of directory.entries()) {
    if (childName.localeCompare(name, undefined, { sensitivity: "base" }) === 0) return childName;
  }
  return undefined;
}

async function resolveDirectory(
  root: FileSystemDirectoryHandle,
  path: string,
): Promise<FileSystemDirectoryHandle> {
  const normalized = normalizeRelativePath(path);
  if (!normalized) return root;
  let current = root;
  for (const segment of normalized.split("/")) {
    const child = await findChild(current, segment);
    if (!child || child.kind !== "directory") throw new VaultEntryNotFoundError(normalized);
    current = child;
  }
  return current;
}

async function buffersEqual(left: ArrayBuffer, right: ArrayBuffer): Promise<boolean> {
  if (left.byteLength !== right.byteLength) return false;
  const a = new Uint8Array(left);
  const b = new Uint8Array(right);
  for (let index = 0; index < a.length; index += 1) {
    if (a[index] !== b[index]) return false;
  }
  return true;
}

async function copyFile(
  source: FileSystemFileHandle,
  destination: FileSystemDirectoryHandle,
  name: string,
): Promise<void> {
  const sourceFile = await source.getFile();
  const destinationHandle = await destination.getFileHandle(name, { create: true });
  const writable = await destinationHandle.createWritable({ keepExistingData: false });
  try {
    await writable.write(sourceFile);
    await writable.close();
  } catch (error) {
    await writable.abort(error).catch(() => undefined);
    throw error;
  }

  const copiedFile = await destinationHandle.getFile();
  if (copiedFile.size !== sourceFile.size) throw new Error("La verifica della copia non è riuscita.");
  if (sourceFile.size <= 2 * 1024 * 1024) {
    const matches = await buffersEqual(await sourceFile.arrayBuffer(), await copiedFile.arrayBuffer());
    if (!matches) throw new Error("La copia non corrisponde al file originale.");
  }
}

async function copyDirectory(
  source: FileSystemDirectoryHandle,
  destination: FileSystemDirectoryHandle,
): Promise<void> {
  for await (const [name, child] of source.entries()) {
    if (child.kind === "directory") {
      const childDestination = await destination.getDirectoryHandle(name, { create: true });
      await copyDirectory(child, childDestination);
    } else {
      await copyFile(child, destination, name);
    }
  }
}

export class VaultFileOperations {
  async readText(root: FileSystemDirectoryHandle, path: string): Promise<TextFileSnapshot> {
    const normalized = normalizeRelativePath(path);
    assertMarkdownPath(normalized);
    const parent = await resolveDirectory(root, dirname(normalized));
    const name = basename(normalized);
    const handle = await findChild(parent, name);
    if (!handle || handle.kind !== "file") throw new VaultEntryNotFoundError(normalized);
    const file = await handle.getFile();
    return { path: normalized, content: await file.text(), size: file.size, lastModified: file.lastModified };
  }

  async statText(root: FileSystemDirectoryHandle, path: string): Promise<ExpectedFileMetadata> {
    const normalized = normalizeRelativePath(path);
    assertMarkdownPath(normalized);
    const parent = await resolveDirectory(root, dirname(normalized));
    const handle = await findChild(parent, basename(normalized));
    if (!handle || handle.kind !== "file") throw new VaultEntryNotFoundError(normalized);
    const file = await handle.getFile();
    return { size: file.size, lastModified: file.lastModified };
  }

  async writeText(root: FileSystemDirectoryHandle, path: string, content: string, expected?: ExpectedFileMetadata): Promise<ExpectedFileMetadata> {
    const normalized = normalizeRelativePath(path);
    assertMarkdownPath(normalized);
    const parent = await resolveDirectory(root, dirname(normalized));
    const handle = await findChild(parent, basename(normalized));
    if (!handle || handle.kind !== "file") throw new VaultEntryNotFoundError(normalized);
    const current = await handle.getFile();
    const currentMetadata = { size: current.size, lastModified: current.lastModified };
    if (expected && (currentMetadata.size !== expected.size || currentMetadata.lastModified !== expected.lastModified)) {
      throw new ExternalFileConflictError(currentMetadata);
    }

    const writable = await handle.createWritable({ keepExistingData: false });
    try {
      await writable.write(content);
      await writable.close();
    } catch (error) {
      await writable.abort(error).catch(() => undefined);
      throw error;
    }
    const saved = await handle.getFile();
    return { size: saved.size, lastModified: saved.lastModified };
  }

  async createConfigurator(root: FileSystemDirectoryHandle, requestedName: string, content: string): Promise<string> {
    const title = validateVaultEntryName(requestedName.replace(/\.config\.json$/i, ""));
    const folderName = await findNameCollision(root, "Configurators") ?? "Configurators";
    const folder = await root.getDirectoryHandle(folderName, { create: true });
    const name = `${title}.config.json`;
    if (await findNameCollision(folder, name)) throw new VaultCollisionError(`${folderName}/${name}`);
    const handle = await folder.getFileHandle(name, { create: true });
    const writable = await handle.createWritable({ keepExistingData: false });
    try { await writable.write(content); await writable.close(); }
    catch (error) { await writable.abort(error).catch(() => undefined); await folder.removeEntry(name).catch(() => undefined); throw error; }
    return `${folderName}/${name}`;
  }

  async createTree(root: FileSystemDirectoryHandle, requestedName: string, content: string): Promise<string> {
    const title = validateVaultEntryName(requestedName.replace(/\.tree\.json$/i, ""));
    const folderName = await findNameCollision(root, "Strutture") ?? "Strutture";
    const folder = await root.getDirectoryHandle(folderName, { create: true });
    const name = `${title}.tree.json`;
    if (await findNameCollision(folder, name)) throw new VaultCollisionError(`${folderName}/${name}`);
    const handle = await folder.getFileHandle(name, { create: true });
    const writable = await handle.createWritable({ keepExistingData: false });
    try { await writable.write(content); await writable.close(); }
    catch (error) { await writable.abort(error).catch(() => undefined); await folder.removeEntry(name).catch(() => undefined); throw error; }
    return `${folderName}/${name}`;
  }

  async createNote(root: FileSystemDirectoryHandle, parentPath: string, requestedName: string, content?: string): Promise<string> {
    const parent = await resolveDirectory(root, parentPath);
    const name = ensureMarkdownExtension(requestedName);
    const path = joinVaultPath(parentPath, name);
    if (await findNameCollision(parent, name)) throw new VaultCollisionError(path);

    const handle = await parent.getFileHandle(name, { create: true });
    const writable = await handle.createWritable({ keepExistingData: false });
    const title = name.slice(0, -3);
    try {
      await writable.write(content ?? `# ${title}\n`);
      await writable.close();
    } catch (error) {
      await writable.abort(error).catch(() => undefined);
      await parent.removeEntry(name).catch(() => undefined);
      throw error;
    }
    return path;
  }

  async createTemplate(root: FileSystemDirectoryHandle, directoryName: string, name: string, content: string): Promise<string> {
    ensureMarkdownExtension(name); // Validate before creating a directory on disk.
    const folderName = await findNameCollision(root, directoryName) ?? directoryName;
    const existing = await findChild(root, folderName);
    if (existing && existing.kind !== "directory") throw new Error(`“${folderName}” è un file. Rinominalo per poter salvare i modelli.`);
    await root.getDirectoryHandle(folderName, { create: true });
    return this.createNote(root, folderName, name, content);
  }

  async duplicateNote(root: FileSystemDirectoryHandle, entry: VaultEntry, draft?: string): Promise<string> {
    if (entry.type !== "file" || extensionOf(basename(entry.path)) !== ".md") throw new Error("Puoi duplicare solo una nota Markdown.");
    // Verify the source still exists, including when copying an editor draft.
    let content = draft;
    if (content === undefined) content = (await this.readText(root, entry.path)).content;
    else await this.statText(root, entry.path);
    const stem = basename(entry.path).slice(0, -3);
    for (let copy = 1; copy <= 10000; copy++) {
      const suffix = ` (copia${copy === 1 ? "" : ` ${copy}`})`;
      const name = `${stem.slice(0, 252 - suffix.length)}${suffix}`;
      try { return await this.createNote(root, dirname(entry.path), name, content); }
      catch (error) { if (!(error instanceof VaultCollisionError)) throw error; }
    }
    throw new Error("Troppe copie con lo stesso nome. Rinomina la nota e riprova.");
  }

  async createFolder(root: FileSystemDirectoryHandle, parentPath: string, requestedName: string): Promise<string> {
    const parent = await resolveDirectory(root, parentPath);
    const name = validateVaultEntryName(requestedName);
    const path = joinVaultPath(parentPath, name);
    if (await findNameCollision(parent, name)) throw new VaultCollisionError(path);
    await parent.getDirectoryHandle(name, { create: true });
    return path;
  }

  async rename(root: FileSystemDirectoryHandle, entry: VaultEntry, requestedName: string): Promise<string> {
    const name = /\.config\.json$/i.test(entry.path)
      ? `${validateVaultEntryName(requestedName.replace(/\.config\.json$/i, ""))}.config.json`
      : /\.tree\.json$/i.test(entry.path)
      ? `${validateVaultEntryName(requestedName.replace(/\.tree\.json$/i, ""))}.tree.json`
      : entry.extension === ".md"
      ? ensureMarkdownExtension(requestedName)
      : validateVaultEntryName(requestedName);
    return this.move(root, entry, dirname(entry.path), name);
  }

  async move(
    root: FileSystemDirectoryHandle,
    entry: VaultEntry,
    targetDirectoryPath: string,
    overrideName?: string,
  ): Promise<string> {
    const sourcePath = normalizeRelativePath(entry.path);
    const sourceParentPath = dirname(sourcePath);
    const sourceName = basename(sourcePath);
    const targetParentPath = normalizeRelativePath(targetDirectoryPath);
    const targetName = validateVaultEntryName(overrideName ?? sourceName);
    const targetPath = joinVaultPath(targetParentPath, targetName);
    if (targetPath === sourcePath) return sourcePath;
    if (entry.type === "directory" && isPathInside(targetParentPath, sourcePath)) {
      throw new Error("Una cartella non può essere spostata dentro sé stessa.");
    }

    const sourceParent = await resolveDirectory(root, sourceParentPath);
    const targetParent = await resolveDirectory(root, targetParentPath);
    const source = await findChild(sourceParent, sourceName);
    if (!source || source.kind !== entry.type) throw new VaultEntryNotFoundError(sourcePath);
    if (await findNameCollision(targetParent, targetName)) throw new VaultCollisionError(targetPath);

    try {
      if (source.kind === "directory") {
        const destination = await targetParent.getDirectoryHandle(targetName, { create: true });
        await copyDirectory(source, destination);
      } else {
        await copyFile(source, targetParent, targetName);
      }
    } catch (error) {
      await targetParent.removeEntry(targetName, { recursive: true }).catch(() => undefined);
      throw error;
    }

    try {
      await sourceParent.removeEntry(sourceName, { recursive: source.kind === "directory" });
    } catch {
      throw new Error("La copia è riuscita, ma l'originale non è stato rimosso. Entrambe le versioni sono state mantenute.");
    }
    return targetPath;
  }

  async delete(root: FileSystemDirectoryHandle, entry: VaultEntry): Promise<void> {
    const parentPath = dirname(entry.path);
    const parent = await resolveDirectory(root, parentPath);
    const name = basename(entry.path);
    const existing = await findChild(parent, name);
    if (!existing || existing.kind !== entry.type) throw new VaultEntryNotFoundError(entry.path);
    await parent.removeEntry(name, { recursive: existing.kind === "directory" });
  }
}
