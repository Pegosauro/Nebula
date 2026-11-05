import files from "./testVaultFiles.json";
/** Only creates missing demo files in a dedicated OPFS directory. Never receives a user Vault handle. */
export async function createTestVault(): Promise<FileSystemDirectoryHandle> {
  if (!navigator.storage?.getDirectory) throw new Error("Il browser non supporta il Vault di prova locale. Scarica ed estrai la copia ZIP.");
  const root = await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-Vault-Test", { create: true });
  for (const [path, content] of Object.entries(files)) {
    const segments = path.split("/"); let directory = root;
    for (const segment of segments.slice(0, -1)) directory = await directory.getDirectoryHandle(segment, { create: true });
    const name = segments.at(-1)!;
    try { await directory.getFileHandle(name); continue; } catch (error) { if (!(error instanceof DOMException) || error.name !== "NotFoundError") throw error; }
    const handle = await directory.getFileHandle(name, { create: true });
    const writer = await handle.createWritable();
    try { await writer.write(content); await writer.close(); } catch (error) { await writer.abort().catch(() => {}); throw error; }
  }
  return root;
}
