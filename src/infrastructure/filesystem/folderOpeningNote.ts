import { extensionOf, validateVaultEntryName } from "../../domain/path";

export const folderOpeningNoteFile = ".nebula-opening-note.json";

export async function readOpeningNoteName(handle: FileSystemFileHandle): Promise<string | undefined> {
  const file = await handle.getFile();
  if (file.size > 4096) return;
  const text = await file.text();
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== "object" || !("version" in value) || value.version !== 1 || !("note" in value)) return;
    const { note } = value;
    if (typeof note === "string" && extensionOf(note) === ".md" && validateVaultEntryName(note) === note) return note;
  } catch { /* Invalid metadata has no opening note. */ }
}

export async function findOpeningNoteFile(folder: FileSystemDirectoryHandle): Promise<FileSystemFileHandle | undefined> {
  try { return await folder.getFileHandle(folderOpeningNoteFile); }
  catch (error) {
    if (!(error instanceof DOMException) || error.name !== "NotFoundError") throw error;
  }
}

export async function writeOpeningNoteName(folder: FileSystemDirectoryHandle, note: string, existing?: FileSystemFileHandle) {
  const handle = existing ?? await folder.getFileHandle(folderOpeningNoteFile, { create: true });
  try {
    const stream = await handle.createWritable();
    try {
      await stream.write(JSON.stringify({ version: 1, note }) + "\n");
      await stream.close();
    } catch (error) {
      await stream.abort(error).catch(() => undefined);
      throw error;
    }
  } catch (error) {
    if (!existing) await folder.removeEntry(folderOpeningNoteFile).catch(() => undefined);
    throw error;
  }
}
