import { describe, expect, it } from "vitest";
import type { VaultEntry } from "../../domain/vault";
import { VaultCollisionError, VaultFileOperations } from "./vaultFileOperations";

class MemoryFile {
  readonly kind = "file" as const;
  data: Blob;
  constructor(readonly name: string, content = "", private readonly failWrite = false) { this.data = new Blob([content]); }
  async getFile() { return new File([this.data], this.name, { lastModified: 1 }); }
  async createWritable() {
    const target = this;
    return {
      async write(value: FileSystemWriteChunkType) {
        if (target.failWrite) throw new DOMException("Scrittura fallita", "NoModificationAllowedError");
        if (typeof value === "string") target.data = new Blob([value]);
        else if (value instanceof Blob) target.data = value;
        else if (value instanceof ArrayBuffer) target.data = new Blob([value]);
        else if (ArrayBuffer.isView(value)) target.data = new Blob([new Uint8Array(value.buffer as ArrayBuffer, value.byteOffset, value.byteLength)]);
      },
      async close() {},
      async abort() {},
    } as FileSystemWritableFileStream;
  }
}

class MemoryDirectory {
  readonly kind = "directory" as const;
  readonly children = new Map<string, MemoryDirectory | MemoryFile>();
  readonly failWritesFor = new Set<string>();
  constructor(readonly name: string) {}
  async *entries() {
    for (const item of this.children) yield item as unknown as [string, FileSystemDirectoryHandle | FileSystemFileHandle];
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    const child = this.children.get(name);
    if (child instanceof MemoryDirectory) return child as unknown as FileSystemDirectoryHandle;
    if (child) throw new DOMException("Tipo errato", "TypeMismatchError");
    if (!options?.create) throw new DOMException("Non trovato", "NotFoundError");
    const created = new MemoryDirectory(name);
    this.children.set(name, created);
    return created as unknown as FileSystemDirectoryHandle;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    const child = this.children.get(name);
    if (child instanceof MemoryFile) return child as unknown as FileSystemFileHandle;
    if (child) throw new DOMException("Tipo errato", "TypeMismatchError");
    if (!options?.create) throw new DOMException("Non trovato", "NotFoundError");
    const created = new MemoryFile(name, "", this.failWritesFor.has(name));
    this.children.set(name, created);
    return created as unknown as FileSystemFileHandle;
  }
  async removeEntry(name: string, options?: { recursive?: boolean }) {
    const child = this.children.get(name);
    if (!child) throw new DOMException("Non trovato", "NotFoundError");
    if (child instanceof MemoryDirectory && child.children.size && !options?.recursive) throw new DOMException("Cartella non vuota", "InvalidModificationError");
    this.children.delete(name);
  }
}

function entry(path: string, type: "file" | "directory", extension = ""): VaultEntry {
  return { id: path, name: path.split("/").at(-1) ?? path, path, type, extension };
}

async function fileText(directory: MemoryDirectory, name: string): Promise<string> {
  const handle = directory.children.get(name);
  if (!(handle instanceof MemoryFile)) throw new Error("File mancante");
  return (await handle.getFile()).text();
}

describe("VaultFileOperations", () => {
  it("duplicates all Markdown in the same folder and chooses free names without changing the source", async () => {
    const root = new MemoryDirectory("Vault"), operations = new VaultFileOperations();
    const handle = root as unknown as FileSystemDirectoryHandle;
    await operations.createFolder(handle, "", "Progetti");
    const content = "---\ntags: [prova]\n---\n# Idea\n\n**Testo**\n- [x] Fatto\n![Immagine](foto.png)\n";
    await operations.createNote(handle, "Progetti", "Idea", content);
    await operations.createNote(handle, "Progetti", "IDEA (COPIA)", "Copia esistente");
    const source = entry("Progetti/Idea.md", "file", ".md");
    expect(await operations.duplicateNote(handle, source)).toBe("Progetti/Idea (copia 2).md");
    expect(await operations.duplicateNote(handle, source, "Bozza appena scritta")).toBe("Progetti/Idea (copia 3).md");
    expect((await operations.readText(handle, "Progetti/Idea (copia 2).md")).content).toBe(content);
    expect((await operations.readText(handle, "Progetti/Idea (copia 3).md")).content).toBe("Bozza appena scritta");
    expect((await operations.readText(handle, source.path)).content).toBe(content);
    expect((await operations.readText(handle, "Progetti/IDEA (COPIA).md")).content).toBe("Copia esistente");
  });
  it("does not leave a partial duplicate on write failure and rejects missing or unsupported sources", async () => {
    const root = new MemoryDirectory("Vault"), operations = new VaultFileOperations();
    const handle = root as unknown as FileSystemDirectoryHandle;
    await operations.createNote(handle, "", "Idea", "Originale");
    root.failWritesFor.add("Idea (copia).md");
    await expect(operations.duplicateNote(handle, entry("Idea.md", "file", ".md"))).rejects.toThrow();
    expect(root.children.has("Idea (copia).md")).toBe(false);
    expect(await fileText(root, "Idea.md")).toBe("Originale");
    await expect(operations.duplicateNote(handle, entry("Manca.md", "file", ".md"), "Bozza")).rejects.toThrow("non è più disponibile");
    await expect(operations.duplicateNote(handle, entry("Foto.png", "file", ".png"))).rejects.toThrow("Markdown");
  });
  it("creates configurators in the Vault, prevents collisions and preserves format on rename", async () => {
    const root = new MemoryDirectory("Vault");
    const operations = new VaultFileOperations(); const handle=root as unknown as FileSystemDirectoryHandle;
    const path=await operations.createConfigurator(handle,"Pergola",'{"project":"A"}');
    expect(path).toBe("Configurators/Pergola.config.json");
    expect((await operations.readText(handle,path)).content).toBe('{"project":"A"}');
    await expect(operations.createConfigurator(handle,"pergola","overwrite")).rejects.toBeInstanceOf(VaultCollisionError);
    const renamed=await operations.rename(handle,entry(path,"file",".json"),"Pergola nuova");
    expect(renamed).toBe("Configurators/Pergola nuova.config.json");
    const snapshot=await operations.readText(handle,renamed);
    await operations.writeText(handle,renamed,"saved",snapshot);
    expect((await operations.readText(handle,renamed)).content).toBe("saved");
    const folder=root.children.get("Configurators") as MemoryDirectory;
    folder.failWritesFor.add("Failed.config.json");
    await expect(operations.createConfigurator(handle,"Failed","test")).rejects.toThrow();
    expect(folder.children.has("Failed.config.json")).toBe(false);
    await expect(operations.createConfigurator(handle,"../Escape","test")).rejects.toThrow();
  });
  it("writes the whole template during note creation and never overwrites an existing file", async () => {
    const root = new MemoryDirectory("Vault");
    const handle = root as unknown as FileSystemDirectoryHandle;
    const operations = new VaultFileOperations();
    const content = "# Procedura\n\n## Controlli\n\n- [ ] Verifica\n";
    await operations.createNote(handle, "", "Procedura", content);
    expect(await fileText(root, "Procedura.md")).toBe(content);
    await expect(operations.createNote(handle, "", "procedura", "altro")).rejects.toBeInstanceOf(VaultCollisionError);
    expect(await fileText(root, "Procedura.md")).toBe(content);
  });
  it("stores personal models as files and keeps the original intact on collision or write failure", async () => {
    const root = new MemoryDirectory("Vault");
    const handle = root as unknown as FileSystemDirectoryHandle;
    const operations = new VaultFileOperations();
    await operations.createNote(handle, "", "Originale", "Testo originale");
    await operations.createTemplate(handle, "Modelli", "Mio", "# {{titolo}}\n");
    const models = root.children.get("Modelli") as MemoryDirectory;
    expect(await fileText(models, "Mio.md")).toBe("# {{titolo}}\n");
    await expect(operations.createTemplate(handle, "Modelli", "Mio", "Sovrascrittura")).rejects.toBeInstanceOf(VaultCollisionError);
    models.failWritesFor.add("Fallisce.md");
    await expect(operations.createTemplate(handle, "Modelli", "Fallisce", "Testo")).rejects.toThrow();
    expect(models.children.has("Fallisce.md")).toBe(false);
    expect(await fileText(root, "Originale.md")).toBe("Testo originale");
    expect(await fileText(models, "Mio.md")).toBe("# {{titolo}}\n");
  });
  it("creates, renames, moves and deletes notes while preserving content", async () => {
    const root = new MemoryDirectory("Vault");
    const operations = new VaultFileOperations();
    const rootHandle = root as unknown as FileSystemDirectoryHandle;

    expect(await operations.createFolder(rootHandle, "", "Progetti")).toBe("Progetti");
    expect(await operations.createNote(rootHandle, "", "Idea")).toBe("Idea.md");
    expect(await fileText(root, "Idea.md")).toBe("# Idea\n");

    expect(await operations.rename(rootHandle, entry("Idea.md", "file", ".md"), "Nebula")).toBe("Nebula.md");
    expect(root.children.has("Idea.md")).toBe(false);
    expect(await fileText(root, "Nebula.md")).toBe("# Idea\n");

    expect(await operations.move(rootHandle, entry("Nebula.md", "file", ".md"), "Progetti")).toBe("Progetti/Nebula.md");
    const projects = root.children.get("Progetti") as MemoryDirectory;
    expect(await fileText(projects, "Nebula.md")).toBe("# Idea\n");

    await operations.delete(rootHandle, entry("Progetti/Nebula.md", "file", ".md"));
    expect(projects.children.has("Nebula.md")).toBe(false);
  });

  it("blocks collisions without touching the original", async () => {
    const root = new MemoryDirectory("Vault");
    root.children.set("A.md", new MemoryFile("A.md", "originale"));
    root.children.set("B.md", new MemoryFile("B.md", "esistente"));
    const operations = new VaultFileOperations();
    await expect(operations.rename(root as unknown as FileSystemDirectoryHandle, entry("A.md", "file", ".md"), "B.md")).rejects.toBeInstanceOf(VaultCollisionError);
    expect(await fileText(root, "A.md")).toBe("originale");
    expect(await fileText(root, "B.md")).toBe("esistente");
  });

  it("prevents moving a folder inside itself", async () => {
    const root = new MemoryDirectory("Vault");
    const folder = new MemoryDirectory("A");
    folder.children.set("B", new MemoryDirectory("B"));
    root.children.set("A", folder);
    const operations = new VaultFileOperations();
    await expect(operations.move(root as unknown as FileSystemDirectoryHandle, entry("A", "directory"), "A/B")).rejects.toThrow("dentro sé stessa");
    expect(root.children.get("A")).toBe(folder);
  });

  it("keeps the original when a copy fails midway", async () => {
    const root = new MemoryDirectory("Vault");
    const destination = new MemoryDirectory("Destinazione");
    destination.failWritesFor.add("Nota.md");
    root.children.set("Destinazione", destination);
    root.children.set("Nota.md", new MemoryFile("Nota.md", "contenuto importante"));
    const operations = new VaultFileOperations();

    await expect(operations.move(
      root as unknown as FileSystemDirectoryHandle,
      entry("Nota.md", "file", ".md"),
      "Destinazione",
    )).rejects.toThrow();
    expect(await fileText(root, "Nota.md")).toBe("contenuto importante");
    expect(destination.children.has("Nota.md")).toBe(false);
  });

  it("reads, writes and detects external text conflicts", async () => {
    const root = new MemoryDirectory("Vault");
    const note = new MemoryFile("Nota.md", "testo iniziale");
    root.children.set("Nota.md", note);
    const operations = new VaultFileOperations();
    const rootHandle = root as unknown as FileSystemDirectoryHandle;
    const snapshot = await operations.readText(rootHandle, "Nota.md");

    expect(snapshot.content).toBe("testo iniziale");
    await operations.writeText(rootHandle, "Nota.md", "testo salvato", snapshot);
    expect(await fileText(root, "Nota.md")).toBe("testo salvato");

    note.data = new Blob(["modifica esterna più lunga"]);
    await expect(operations.writeText(rootHandle, "Nota.md", "sovrascrittura", {
      size: "testo salvato".length,
      lastModified: 1,
    })).rejects.toThrow("modificato da un'altra applicazione");
    expect(await fileText(root, "Nota.md")).toBe("modifica esterna più lunga");
  });
});
