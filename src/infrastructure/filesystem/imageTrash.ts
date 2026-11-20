import { basename, dirname, normalizeRelativePath } from "../../domain/path";
import { DEFAULT_IGNORED_DIRECTORIES } from "../../domain/vault";
import { isVaultAttachment } from "./vaultImages";
import { buffersEqual, copyFile } from "./vaultFileOperations";

export const imageTrashDirectory = ".nebula/image-trash";

export function referencesImageFile(content: string, path: string): boolean {
  // A filename mention is enough to keep a file. This also covers HTML,
  // Markdown reference links, and links created outside Nebula.
  const filename = basename(path).normalize("NFC").toLowerCase();
  const decoded = content.replace(/(?:%[0-9a-f]{2})+/gi, value => {
    try { return decodeURIComponent(value); } catch { return value; }
  }).replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (entity, value: string) => {
    const code = /^x/i.test(value) ? parseInt(value.slice(1), 16) : Number(value);
    return code <= 0x10ffff ? String.fromCodePoint(code) : entity;
  }).replace(/&amp;/gi, "&").replace(/\\([!"#$%&'()*+,\-.\/:;<=>?@[\]^`{|}~])/g, "$1");
  return decoded.normalize("NFC").toLowerCase().includes(filename);
}

async function fileMentioned(directory: FileSystemDirectoryHandle, path: string): Promise<boolean> {
  for await (const [name, entry] of directory.entries()) {
    if (entry.kind === "directory") {
      if (!DEFAULT_IGNORED_DIRECTORIES.has(name) && await fileMentioned(entry, path)) return true;
    } else if (/\.(?:md|markdown|config\.json|tree\.json)$/i.test(name)) {
      if (referencesImageFile(await (await entry.getFile()).text(), path)) return true;
    }
  }
  return false;
}

async function ifPresent<T>(operation: () => Promise<T>): Promise<T | undefined> {
  try { return await operation(); }
  catch (error) {
    if (!(error instanceof DOMException) || error.name !== "NotFoundError") throw error;
  }
}

function assertAttachment(path: string) {
  if (normalizeRelativePath(path) !== path || !isVaultAttachment(path)) throw new Error("Percorso allegato non valido.");
}

async function parent(root: FileSystemDirectoryHandle, path: string, create = false) {
  let directory = root;
  for (const name of dirname(path).split("/")) directory = await directory.getDirectoryHandle(name, { create });
  return directory;
}

export async function trashImageIfUnused(
  root: FileSystemDirectoryHandle, path: string, referencedInDraft: () => boolean, assertActive: () => void,
): Promise<void> {
  assertAttachment(path);
  if (referencedInDraft() || await fileMentioned(root, path)) return;
  const name = basename(path);
  const original = await ifPresent(() => parent(root, path));
  const source = original && await ifPresent(() => original.getFileHandle(name));
  if (!source || !original) return;
  const snapshot = await source.getFile();
  const trash = await parent(root, `${imageTrashDirectory}/${path}`, true);
  if (await ifPresent(() => trash.getFileHandle(name))) throw new Error("Esiste già una copia di questo allegato nel cestino.");
  assertActive();
  try {
    await copyFile(source, trash, name);
    const current = await (await original.getFileHandle(name)).getFile();
    assertActive();
    if (referencedInDraft() || current.size !== snapshot.size || current.lastModified !== snapshot.lastModified) {
      await trash.removeEntry(name);
      return;
    }
    await original.removeEntry(name);
  } catch (error) {
    // If the original disappeared independently, the verified copy may be all
    // that remains. Cleanup is safe only while the original is still present.
    if (await ifPresent(() => original.getFileHandle(name)).catch(() => undefined)) await trash.removeEntry(name).catch(() => {});
    throw error;
  }
}

export async function restoreTrashedImage(root: FileSystemDirectoryHandle, path: string, assertActive: () => void): Promise<void> {
  assertAttachment(path);
  const name = basename(path);
  const trash = await ifPresent(() => parent(root, `${imageTrashDirectory}/${path}`));
  const source = trash && await ifPresent(() => trash.getFileHandle(name));
  if (!source || !trash) return;
  assertActive();
  const original = await parent(root, path, true);
  const existing = await ifPresent(() => original.getFileHandle(name));
  if (existing) {
    const [current, archived] = await Promise.all([existing.getFile(), source.getFile()]);
    if (current.size !== archived.size || !await buffersEqual(await current.arrayBuffer(), await archived.arrayBuffer())) {
      throw new Error(`Esiste già un altro file chiamato “${name}”. L’allegato originale è ancora nel cestino.`);
    }
    assertActive();
    await trash.removeEntry(name);
    return;
  }
  assertActive();
  try { await copyFile(source, original, name); }
  catch (error) { await original.removeEntry(name).catch(() => {}); throw error; }
  assertActive();
  await trash.removeEntry(name);
}
