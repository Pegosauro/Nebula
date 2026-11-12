import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalFileConflictError } from "../../infrastructure/filesystem/vaultFileOperations";
import { vaultService } from "../vault/vaultService";
import { demoTree } from "./demoTree";
import { planNodeImport } from "./importNodes";
import { deleteNode, setNodesCategory, updateCategory, updateNode } from "./model";
import { serializeTree, serializeTreeFile } from "./serializeTree";
import { useTreeStore } from "./treeStore";

const path = "Strutture/Storico.tree.json";
const store = () => useTreeStore.getState();
const current = () => store().sessions[path]!;
async function load() {
  vi.useFakeTimers();
  vi.spyOn(vaultService, "readText").mockResolvedValue({ path, content: serializeTreeFile(demoTree()), size: 20, lastModified: 1 });
  vi.spyOn(vaultService, "writeText").mockImplementation(async (_path, content) => ({ size: content.length, lastModified: 2 }));
  await store().load(path);
}
afterEach(() => { store().reset(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("storico completo delle strutture", () => {
  it("annulla e ripristina nomi, categorie, formattazione, importazione e cancellazione in ordine", async () => {
    await load();
    const states = [serializeTree(current().data)];
    const rename = updateNode(current().data, "n-07", { name: "Nome nuovo", note: "Nota nuova" });
    if (!rename.ok) throw new Error(rename.error);
    store().edit(path, rename.tree, { label: "Nome e nota" }); states.push(serializeTree(current().data));
    const categories = setNodesCategory(current().data, ["n-07"], "c-avv", true);
    if (!categories.ok) throw new Error(categories.error);
    store().edit(path, categories.tree, { label: "Categorie" }); states.push(serializeTree(current().data));
    const format = updateCategory(current().data, "c-avv", { textStyle: { bold: true, strike: true } });
    if (!format.ok) throw new Error(format.error);
    store().edit(path, format.tree, { label: "Formato" }); states.push(serializeTree(current().data));
    const imported = planNodeImport(current().data, "n-07", "Profilo\tNuova categoria\tNota\nAccessorio", { header: false, createCategories: true });
    store().edit(path, imported.tree!, { label: "Importazione" }); states.push(serializeTree(current().data));
    const deleted = deleteNode(current().data, "n-07");
    if (!deleted.ok) throw new Error(deleted.error);
    store().applyDelete(path, deleted.tree); states.push(serializeTree(current().data));
    for (let index = states.length - 2; index >= 0; index -= 1) { expect(store().undo(path)).toBe(true); expect(serializeTree(current().data)).toBe(states[index]); }
    expect(store().undo(path)).toBe(false);
    for (let index = 1; index < states.length; index += 1) { expect(store().redo(path)).toBe(true); expect(serializeTree(current().data)).toBe(states[index]); }
    expect(store().redo(path)).toBe(false);
  });
  it("raggruppa la digitazione, interrompe il gruppo al blur e limita lo storico", async () => {
    await load();
    for (const name of ["A", "Ab", "Abc"]) {
      const result = updateNode(current().data, "n-07", { name });
      if (result.ok) store().edit(path, result.tree, { label: "Nome", group: "name:n-07" });
      vi.setSystemTime(Date.now() + 100);
    }
    expect(current().undoStack).toHaveLength(1);
    store().endEditGroup(path);
    const result = updateNode(current().data, "n-07", { name: "Altro" });
    if (result.ok) store().edit(path, result.tree, { group: "name:n-07" });
    expect(current().undoStack).toHaveLength(2);
    expect(store().undo(path)).toBe(true); expect(current().data.nodes.find(node => node.id === "n-07")?.name).toBe("Abc");
    expect(store().undo(path)).toBe(true); expect(current().data.nodes.find(node => node.id === "n-07")?.name).toBe("Larghezza tenda");
    for (let index = 0; index < 120; index += 1) store().edit(path, { ...current().data, title: `Titolo ${index}` });
    expect(current().undoStack).toHaveLength(100);
  });
  it("svuota Ripristina solo dopo una nuova modifica reale", async () => {
    await load();
    store().edit(path, { ...current().data, title: "A" }); store().undo(path);
    expect(current().redoStack).toHaveLength(1);
    store().edit(path, structuredClone(current().data)); expect(current().redoStack).toHaveLength(1);
    store().edit(path, { ...current().data, title: "B" }); expect(current().redoStack).toHaveLength(0);
    expect(store().redo(path)).toBe(false);
  });
  it("mantiene l'ultima versione quando si annulla durante una scrittura in corso", async () => {
    await load();
    let finish!: (metadata: { size: number; lastModified: number }) => void;
    const write = vi.mocked(vaultService.writeText).mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    store().edit(path, { ...current().data, title: "Modificata" });
    const saving = store().save(path);
    expect(current().saving).toBe(true);
    expect(store().undo(path)).toBe(true);
    finish({ size: 40, lastModified: 2 }); await saving;
    expect(current().data.title).toBe("FL · Tenda finestra");
    await vi.advanceTimersByTimeAsync(700);
    expect(write).toHaveBeenCalledTimes(2);
    expect(JSON.parse(write.mock.calls[1]![1]).title).toBe("FL · Tenda finestra");
    expect(write.mock.calls[1]![2]).toEqual({ size: 40, lastModified: 2 });
    expect(current().redoStack).toHaveLength(1);
  });
  it("mantiene il conflitto durante Annulla e azzera lo storico alla ricarica esplicita", async () => {
    await load();
    const write = vi.mocked(vaultService.writeText).mockRejectedValue(new ExternalFileConflictError({ size: 50, lastModified: 9 }));
    store().edit(path, { ...current().data, title: "Bozza" });
    expect(await store().save(path)).toBe(false); expect(current().conflict).toBe(true);
    store().undo(path); await vi.advanceTimersByTimeAsync(700);
    expect(current().conflict).toBe(true); expect(write).toHaveBeenCalledTimes(1);
    await store().load(path, true);
    expect(current().undoStack).toEqual([]); expect(current().redoStack).toEqual([]); expect(current().conflict).toBe(false);
  });
  it("trasferisce lo storico con il percorso e lo elimina insieme alla sessione", async () => {
    await load(); store().edit(path, { ...current().data, title: "Nuova" });
    const moved = "Strutture/Rinominata.tree.json";
    store().remap(path, moved); expect(store().sessions[moved]?.undoStack).toHaveLength(1);
    expect(store().undo(moved)).toBe(true); expect(store().sessions[moved]?.redoStack).toHaveLength(1);
    store().remove(moved); expect(store().undo(moved)).toBe(false); expect(store().redo(moved)).toBe(false);
  });
});
