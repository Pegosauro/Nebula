import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { appendDocumentText, useDocumentStore } from "../editor/documentStore";
import { vaultService } from "../vault/vaultService";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { ExternalFileConflictError, VaultEntryNotFoundError } from "../../infrastructure/filesystem/vaultFileOperations";
import { QUICK_NOTES_PATH, quickNoteEntry, saveQuickNote } from "./quickNotes";
import type { VaultSnapshot } from "../../domain/vault";

const snapshot = { name: "Test", root: [], scannedAt: 1, stats: { notes: 0, files: 0, boards: 0, directories: 0 } } as VaultSnapshot;
let disk = "", modified = 1;
beforeEach(() => {
  useDocumentStore.getState().reset(); useWorkspaceStore.getState().resetDocuments(); useVaultStore.setState({ status: "ready", snapshot });
  disk = "# Appunti veloci\n\nAppunto precedente\n"; modified = 1;
  vi.spyOn(vaultService, "currentVaultId").mockReturnValue("vault-test");
  vi.spyOn(vaultService, "statText").mockImplementation(async () => ({ size: disk.length, lastModified: modified }));
  vi.spyOn(vaultService, "readText").mockImplementation(async path => ({ path, content: disk, size: disk.length, lastModified: modified }));
  vi.spyOn(vaultService, "writeText").mockImplementation(async (_path, content, expected) => {
    if (expected && expected.lastModified !== modified) throw new ExternalFileConflictError({ size: disk.length, lastModified: modified });
    disk = content; modified++; return { size: disk.length, lastModified: modified };
  });
});
afterEach(() => { useDocumentStore.getState().reset(); vi.restoreAllMocks(); });
describe("quick notes", () => {
  it("appends consecutive captures with local date/time without changing the active screen", async () => {
    useWorkspaceStore.getState().setActivity("settings");
    const date = new Date(2026, 9, 1, 9, 5, 7);
    await saveQuickNote("Primo appunto", date); await saveQuickNote("Secondo appunto", date);
    expect(disk.indexOf("Appunto precedente")).toBeLessThan(disk.indexOf("Primo appunto"));
    expect(disk.indexOf("Primo appunto")).toBeLessThan(disk.indexOf("Secondo appunto"));
    expect(disk.match(/## 01\/10\/2026 · 09:05:07/g)).toHaveLength(2);
    expect(useWorkspaceStore.getState().activity).toBe("settings"); expect(useWorkspaceStore.getState().tabs).toHaveLength(1);
    expect(useDocumentStore.getState().sessions[QUICK_NOTES_PATH]?.content).toBe(disk);
  });
  it("creates a real Markdown sheet on the first capture", async () => {
    vi.mocked(vaultService.statText).mockRejectedValueOnce(new VaultEntryNotFoundError(QUICK_NOTES_PATH));
    const original = useVaultStore.getState().createNote;
    const createNote = vi.fn().mockImplementation(async (_parent, _name, _open, content) => { disk = content; return QUICK_NOTES_PATH; });
    useVaultStore.setState({ createNote });
    try { await saveQuickNote("Primo"); expect(createNote).toHaveBeenCalledWith("", "Appunti veloci", false, "# Appunti veloci\n"); expect(disk).toContain("Primo"); }
    finally { useVaultStore.setState({ createNote: original }); }
  });
  it("saves a dirty sheet before appending and preserves both changes", async () => {
    await useDocumentStore.getState().open(QUICK_NOTES_PATH);
    useDocumentStore.getState().updateContent(QUICK_NOTES_PATH, "# Appunti veloci\nModifica manuale\n");
    await saveQuickNote("Nuova cattura");
    expect(disk).toContain("Modifica manuale"); expect(disk).toContain("Nuova cattura"); expect(vaultService.writeText).toHaveBeenCalledTimes(2);
  });
  it("refreshes an externally changed clean sheet before appending", async () => {
    await useDocumentStore.getState().open(QUICK_NOTES_PATH); disk += "Aggiunta esterna\n"; modified++;
    await saveQuickNote("Cattura"); expect(disk).toContain("Aggiunta esterna"); expect(disk).toContain("Cattura");
  });
  it("does not append into an unresolved conflict or overwrite the dirty buffer", async () => {
    await useDocumentStore.getState().open(QUICK_NOTES_PATH);
    useDocumentStore.getState().updateContent(QUICK_NOTES_PATH, "Bozza locale"); disk = "Testo esterno"; modified++;
    await expect(saveQuickNote("Cattura")).rejects.toThrow();
    expect(disk).toBe("Testo esterno"); expect(useDocumentStore.getState().sessions[QUICK_NOTES_PATH]?.content).toBe("Bozza locale");
    expect(disk).not.toContain("Cattura");
  });
  it("keeps a failed append out of the buffer and retries without duplicates", async () => {
    vi.mocked(vaultService.writeText).mockRejectedValueOnce(new DOMException("No write", "NoModificationAllowedError"));
    await expect(saveQuickNote("Unico appunto")).rejects.toThrow();
    expect(useDocumentStore.getState().sessions[QUICK_NOTES_PATH]?.content).not.toContain("Unico appunto");
    await saveQuickNote("Unico appunto"); expect(disk.match(/Unico appunto/g)).toHaveLength(1);
  });
  it("locks only the target editor during append and blocks duplicate submissions", async () => {
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(vaultService.writeText).mockImplementationOnce(async (_path, content) => { await wait; disk = content; return { size: content.length, lastModified: 2 }; });
    const saving = saveQuickNote("Unico");
    await vi.waitFor(() => expect(useDocumentStore.getState().sessions[QUICK_NOTES_PATH]?.operationLocked).toBe(true));
    useDocumentStore.getState().updateContent(QUICK_NOTES_PATH, "Cancellazione concorrente");
    await expect(saveQuickNote("Duplicato")).rejects.toThrow("corso");
    await expect(appendDocumentText(QUICK_NOTES_PATH, "Duplicato")).rejects.toThrow("corso");
    release(); await saving;
    expect(disk).not.toContain("Duplicato"); expect(disk).not.toContain("Cancellazione");
    expect(useDocumentStore.getState().sessions[QUICK_NOTES_PATH]?.operationLocked).toBe(false);
  });
  it("reconciles a committed write after a metadata failure without appending twice", async () => {
    vi.mocked(vaultService.writeText).mockImplementationOnce(async (_path, content) => { disk = content; modified++; throw new Error("Metadata temporarily unavailable"); });
    const id = "test-capture";
    await expect(saveQuickNote("Una sola volta", new Date(), id)).rejects.toThrow();
    await saveQuickNote("Una sola volta", new Date(), id);
    expect(disk.match(/Una sola volta/g)).toHaveLength(1);
    expect(useDocumentStore.getState().sessions[QUICK_NOTES_PATH]?.content).toBe(disk);
  });
  it("rejects whitespace and does not normalize meaningful Markdown inside a capture", () => {
    expect(quickNoteEntry("    codice  ")).toContain("\n\n    codice  \n");
    expect(quickNoteEntry("- uno\n- due", new Date(2026, 0, 2, 3, 4, 5))).toBe("## 02/01/2026 · 03:04:05\n\n- uno\n- due\n");
  });
});
