import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { vaultService } from "../vault/vaultService";
import { useDocumentStore } from "./documentStore";

describe("documentStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDocumentStore.getState().reset();
  });

  afterEach(() => {
    useDocumentStore.getState().reset();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("autosaves the current buffer after the debounce", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Nota.md", content: "iniziale", size: 8, lastModified: 1 });
    const write = vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 12, lastModified: 2 });
    await useDocumentStore.getState().open("Nota.md");
    useDocumentStore.getState().updateContent("Nota.md", "testo nuovo");

    expect(useDocumentStore.getState().sessions["Nota.md"]?.status).toBe("dirty");
    await vi.advanceTimersByTimeAsync(900);

    expect(write).toHaveBeenCalledWith("Nota.md", "testo nuovo", { size: 8, lastModified: 1 });
    expect(useDocumentStore.getState().sessions["Nota.md"]).toMatchObject({
      content: "testo nuovo",
      savedContent: "testo nuovo",
      status: "saved",
    });
  });

  it("keeps the edited buffer dirty when a write fails", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Nota.md", content: "originale", size: 9, lastModified: 1 });
    vi.spyOn(vaultService, "writeText").mockRejectedValue(new DOMException("sola lettura", "NoModificationAllowedError"));
    await useDocumentStore.getState().open("Nota.md");
    useDocumentStore.getState().updateContent("Nota.md", "modifica importante");
    await vi.advanceTimersByTimeAsync(900);

    expect(useDocumentStore.getState().sessions["Nota.md"]).toMatchObject({
      content: "modifica importante",
      savedContent: "originale",
      status: "error",
    });
    await useDocumentStore.getState().open("Nota.md");
    expect(useDocumentStore.getState().sessions["Nota.md"]?.content).toBe("modifica importante");
  });

  it("preserves buffers while switching between document sessions", async () => {
    vi.spyOn(vaultService, "readText").mockImplementation(async (path) => ({ path, content: path, size: path.length, lastModified: 1 }));
    await useDocumentStore.getState().open("A.md");
    useDocumentStore.getState().updateContent("A.md", "bozza A");
    await useDocumentStore.getState().open("B.md");

    expect(useDocumentStore.getState().sessions["A.md"]?.content).toBe("bozza A");
    expect(useDocumentStore.getState().sessions["B.md"]?.content).toBe("B.md");
  });

  it("continues saving after a rename using the new file metadata and preserves subsequent typing", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Idea.md", content: "originale", size: 9, lastModified: 1 });
    const write = vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 12, lastModified: 3 });
    await useDocumentStore.getState().open("Idea.md");
    useDocumentStore.getState().updateContent("Idea.md", "bozza durante la rinomina");
    useDocumentStore.getState().remapPaths("Idea.md", "Nuova.md", { name: "Test", root: [{ id: "Nuova.md", path: "Nuova.md", name: "Nuova.md", type: "file", extension: ".md", size: 9, modifiedAt: 2 }], scannedAt: 2, stats: { files: 1, notes: 1, directories: 0, boards: 0 } });
    expect(useDocumentStore.getState().sessions["Idea.md"]).toBeUndefined();
    await vi.advanceTimersByTimeAsync(900);
    expect(write).toHaveBeenCalledExactlyOnceWith("Nuova.md", "bozza durante la rinomina", { size: 9, lastModified: 2 });
    expect(useDocumentStore.getState().sessions["Nuova.md"]?.status).toBe("saved");
  });

  it("detects external changes without overwriting a dirty buffer", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Nota.md", content: "originale", size: 9, lastModified: 1 });
    vi.spyOn(vaultService, "statText").mockResolvedValue({ size: 20, lastModified: 2 });
    await useDocumentStore.getState().open("Nota.md");
    useDocumentStore.getState().updateContent("Nota.md", "bozza locale");
    await useDocumentStore.getState().checkExternalChanges();

    expect(useDocumentStore.getState().sessions["Nota.md"]).toMatchObject({
      content: "bozza locale",
      savedContent: "originale",
      status: "conflict",
    });
  });

  it("keeps newer keystrokes dirty when typing continues during a save", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Nota.md", content: "iniziale", size: 8, lastModified: 1 });
    let releaseFirstSave: ((metadata: { size: number; lastModified: number }) => void) | undefined;
    const write = vi.spyOn(vaultService, "writeText")
      .mockImplementationOnce(() => new Promise((resolve) => { releaseFirstSave = resolve; }))
      .mockResolvedValue({ size: 15, lastModified: 3 });
    await useDocumentStore.getState().open("Nota.md");
    useDocumentStore.getState().updateContent("Nota.md", "prima modifica");
    const saving = useDocumentStore.getState().save("Nota.md");
    await Promise.resolve();
    useDocumentStore.getState().updateContent("Nota.md", "seconda modifica");
    releaseFirstSave?.({ size: 13, lastModified: 2 });
    await saving;

    expect(useDocumentStore.getState().sessions["Nota.md"]).toMatchObject({
      content: "seconda modifica",
      savedContent: "prima modifica",
      status: "dirty",
    });
    await vi.advanceTimersByTimeAsync(900);
    expect(write).toHaveBeenLastCalledWith("Nota.md", "seconda modifica", { size: 13, lastModified: 2 });
    expect(useDocumentStore.getState().sessions["Nota.md"]?.status).toBe("saved");
  });
  it("keeps a detected external conflict blocked while editing continues", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Nota.md", content: "originale", size: 9, lastModified: 1 });
    vi.spyOn(vaultService, "statText").mockResolvedValue({ size: 22, lastModified: 2 });
    const write = vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 11, lastModified: 3 });
    await useDocumentStore.getState().open("Nota.md");
    useDocumentStore.getState().updateContent("Nota.md", "bozza");
    await useDocumentStore.getState().checkExternalChanges();
    useDocumentStore.getState().updateContent("Nota.md", "altra bozza");
    await vi.advanceTimersByTimeAsync(1000);
    await useDocumentStore.getState().save("Nota.md");
    expect(write).not.toHaveBeenCalled();
    expect(useDocumentStore.getState().sessions["Nota.md"]?.status).toBe("conflict");
    await useDocumentStore.getState().forceSave("Nota.md");
    expect(write).toHaveBeenCalledWith("Nota.md", "altra bozza", undefined);
  });

  it("does not reuse an in-flight note from a previous Vault or restore a removed note", async () => {
    let finish!: (value: { path: string; content: string; size: number; lastModified: number }) => void;
    const read = vi.spyOn(vaultService, "readText");
    read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const old = useDocumentStore.getState().open("Nota.md");
    useDocumentStore.getState().reset();
    read.mockResolvedValue({ path: "Nota.md", content: "Nuovo Vault", size: 11, lastModified: 2 });
    await useDocumentStore.getState().open("Nota.md");
    finish({ path: "Nota.md", content: "Vecchio Vault", size: 13, lastModified: 1 }); await old;
    expect(useDocumentStore.getState().sessions["Nota.md"]?.content).toBe("Nuovo Vault");
    read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const removed = useDocumentStore.getState().open("Rimossa.md");
    useDocumentStore.getState().removePaths("Rimossa.md");
    finish({ path: "Rimossa.md", content: "Rimossa", size: 7, lastModified: 1 }); await removed;
    expect(useDocumentStore.getState().sessions["Rimossa.md"]).toBeUndefined();
  });
});
