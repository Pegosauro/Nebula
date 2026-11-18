const folderName = ".nebula";
const fileName = "tasks.json";

export class TaskFileConflict extends Error {
  constructor() { super("Il file delle task è cambiato in un’altra scheda o fuori da Nebula."); }
}

export function openTaskFile(root: FileSystemDirectoryHandle, vaultId: string) {
  async function find() {
    try {
      return await (await root.getDirectoryHandle(folderName)).getFileHandle(fileName);
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotFoundError") return null;
      throw error;
    }
  }

  async function read() {
    const handle = await find();
    return handle ? (await handle.getFile()).text() : null;
  }

  async function write(content: string, expected: string | null) {
    const save = async () => {
      const current = await find();
      if ((current ? await (await current.getFile()).text() : null) !== expected) throw new TaskFileConflict();
      const folder = await root.getDirectoryHandle(folderName, { create: true });
      const handle = current ?? await folder.getFileHandle(fileName, { create: true });
      try {
        const stream = await handle.createWritable();
        try {
          await stream.write(content);
          await stream.close();
        } catch (error) {
          await stream.abort(error).catch(() => undefined);
          throw error;
        }
      } catch (error) {
        if (!current) await folder.removeEntry(fileName).catch(() => undefined);
        throw error;
      }
    };
    if (navigator.locks) await navigator.locks.request(`nebula:tasks:${vaultId}`, save);
    else await save();
  }

  return { read, write };
}
