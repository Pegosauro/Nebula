import { dirname, normalizeRelativePath } from "../../domain/path";

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/avif,image/bmp";
const types: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", bmp: "image/bmp" };
export function resolveImagePath(sourcePath: string, reference: string): string {
  const decoded = decodeURIComponent(reference);
  if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(decoded)) throw new Error("Percorso immagine non valido.");
  const segments = decoded.startsWith("/") ? [] : dirname(sourcePath).split("/").filter(Boolean);
  for (const part of decoded.replaceAll("\\", "/").split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") { if (!segments.length) throw new Error("L’immagine deve trovarsi nel Vault."); segments.pop(); }
    else segments.push(part);
  }
  return normalizeRelativePath(segments.join("/"));
}
async function imageDirectory(root: FileSystemDirectoryHandle, path: string) {
  let directory = root;
  for (const part of dirname(path).split("/").filter(Boolean)) directory = await directory.getDirectoryHandle(part);
  return directory;
}
export async function readVaultImage(root: FileSystemDirectoryHandle, path: string): Promise<Blob> {
  const normalized = normalizeRelativePath(path);
  const type = types[normalized.split(".").at(-1)!.toLowerCase()];
  if (!type) throw new Error("Formato immagine non supportato. Usa PNG, JPG, GIF, WebP, AVIF o BMP.");
  const directory = await imageDirectory(root, normalized);
  const file = await (await directory.getFileHandle(normalized.split("/").at(-1)!)).getFile();
  return file.slice(0, file.size, type);
}
export async function saveVaultImage(root: FileSystemDirectoryHandle, sourcePath: string, file: File): Promise<string> {
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  const type = types[extension] ?? file.type;
  if (!Object.values(types).includes(type)) throw new Error("Usa un’immagine PNG, JPG, GIF, WebP, AVIF o BMP.");
  if (file.size > 20 * 1024 * 1024) throw new Error("L’immagine supera 20 MB. Riducila prima di inserirla.");
  const ext = types[extension] ? extension : Object.keys(types).find(key => types[key] === type)!;
  const stem = file.name.replace(/\.[^.]*$/, "").replace(/[^\p{L}\p{N}_-]+/gu, "-").slice(0, 60) || "immagine";
  const name = `${stem}-${crypto.randomUUID()}.${ext}`;
  const folder = await root.getDirectoryHandle("attachments", { create: true });
  const handle = await folder.getFileHandle(name, { create: true });
  const writer = await handle.createWritable();
  try { await writer.write(file); await writer.close(); }
  catch (error) { await writer.abort().catch(() => {}); await folder.removeEntry(name).catch(() => {}); throw error; }
  return `${"../".repeat(dirname(sourcePath).split("/").filter(Boolean).length)}attachments/${name}`;
}
