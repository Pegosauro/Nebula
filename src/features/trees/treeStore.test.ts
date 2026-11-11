import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalFileConflictError } from "../../infrastructure/filesystem/vaultFileOperations";
import { vaultService } from "../vault/vaultService";
import { treeSaveStatus } from "../workspace/saveStatus";
import { demoTree } from "./demoTree";
import { addSibling, deleteNode, newTree, planMove, upsertObject } from "./model";
import { serializeTree, serializeTreeFile } from "./serializeTree";
import { useTreeStore } from "./treeStore";
import { useTreeUiStore } from "./treeUiStore";

const path = "Strutture/Tenda.tree.json";
afterEach(() => { useTreeStore.getState().reset(); useTreeUiStore.getState().clear(); vi.restoreAllMocks(); vi.useRealTimers(); });
const snapshot = () => ({ path, content: serializeTreeFile(newTree("Tenda", "FL", "Tenda")), size: 20, lastModified: 1 });

describe("sessioni delle strutture", () => {
  it("autosalva dopo 700 ms e non scrive se non ci sono modifiche", async () => {
    vi.useFakeTimers();
    vi.spyOn(vaultService, "readText").mockResolvedValue(snapshot());
    const write = vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 21, lastModified: 2 });
    await useTreeStore.getState().load(path);
    expect(await useTreeStore.getState().save(path)).toBe(true);
    expect(write).not.toHaveBeenCalled();
    const session = useTreeStore.getState().sessions[path]!;
    useTreeStore.getState().edit(path, { ...session.data, title: "Tenda nuova" });
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(699);
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0]?.[2]).toEqual({ size: 20, lastModified: 1 });
    expect(JSON.parse(useTreeStore.getState().sessions[path]!.saved).title).toBe("Tenda nuova");
    expect(treeSaveStatus(useTreeStore.getState().sessions[path]!)).toBe("saved");
  });

  it("non scrive una sigla duplicata e resta su Non salvato", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path, content: serializeTreeFile(demoTree()), size: 20, lastModified: 1 });
    const write = vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 21, lastModified: 2 });
    await useTreeStore.getState().load(path);
    const broken = structuredClone(useTreeStore.getState().sessions[path]!.data);
    broken.nodes.find(node => node.id === "n-0803")!.objects.push({ id: "dup", type: "characteristic", order: 9, kind: "acquired", code: "P", description: "Doppia" });
    useTreeStore.getState().edit(path, broken);
    expect(await useTreeStore.getState().save(path)).toBe(false);
    expect(write).not.toHaveBeenCalled();
    expect(useTreeStore.getState().sessions[path]!.error).toMatch(/duplicata/);
    expect(treeSaveStatus(useTreeStore.getState().sessions[path]!)).toBe("error");
    expect(upsertObject(demoTree(), "n-0803", { type: "characteristic", kind: "acquired", code: "P", description: "Doppia" }).ok).toBe(false);
  });

  it("segnala il conflitto e non scarta una bozza sporca", async () => {
    const read = vi.spyOn(vaultService, "readText").mockResolvedValue(snapshot());
    vi.spyOn(vaultService, "writeText").mockRejectedValue(new ExternalFileConflictError({ size: 30, lastModified: 4 }));
    await useTreeStore.getState().load(path);
    useTreeStore.getState().edit(path, { ...useTreeStore.getState().sessions[path]!.data, title: "Bozza" });
    expect(await useTreeStore.getState().flush()).toBe(false);
    expect(useTreeStore.getState().sessions[path]!.data.title).toBe("Bozza");
    expect(treeSaveStatus(useTreeStore.getState().sessions[path]!)).toBe("conflict");
    read.mockResolvedValue({ ...snapshot(), content: serializeTreeFile(newTree("Esterno", "FL", "Esterno")), size: 40, lastModified: 5 });
    await useTreeStore.getState().checkExternalChanges();
    expect(useTreeStore.getState().sessions[path]!.data.title).toBe("Bozza");
    expect(useTreeStore.getState().sessions[path]!.conflict).toBe(true);
  });

  it("ricarica un file pulito cambiato fuori e dimentica la sessione rimossa", async () => {
    const read = vi.spyOn(vaultService, "readText").mockResolvedValue(snapshot());
    await useTreeStore.getState().load(path);
    read.mockResolvedValue({ ...snapshot(), content: serializeTreeFile(newTree("Esterno", "FL", "Esterno")), size: 30, lastModified: 2 });
    await useTreeStore.getState().checkExternalChanges();
    expect(useTreeStore.getState().sessions[path]!.data.title).toBe("Esterno");
    let finish!: (value: ReturnType<typeof snapshot>) => void;
    read.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = useTreeStore.getState().load(path);
    useTreeStore.getState().remove(path);
    finish(snapshot());
    await pending;
    expect(useTreeStore.getState().sessions).toEqual({});
  });

  it("annulla l'ultimo spostamento con una scrittura e lo dimentica alla modifica successiva", async () => {
    vi.useFakeTimers();
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path, content: serializeTreeFile(demoTree()), size: 20, lastModified: 1 });
    const write = vi.spyOn(vaultService, "writeText").mockImplementation(async (_path, content) => ({ size: content.length, lastModified: 2 }));
    await useTreeStore.getState().load(path);
    const before = serializeTree(useTreeStore.getState().sessions[path]!.data);
    const plan = planMove(useTreeStore.getState().sessions[path]!.data, "n-07", "n-12");
    expect(plan.tree).not.toBeNull();
    useTreeStore.getState().applyMove(path, plan.tree!);
    expect(useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-07")!.code).toBe("FL-1201");
    expect(useTreeStore.getState().undoMove(path)).toBe(true);
    expect(serializeTree(useTreeStore.getState().sessions[path]!.data)).toBe(before);
    expect(useTreeStore.getState().sessions[path]!.moveUndo).toBeUndefined();
    await vi.advanceTimersByTimeAsync(700);
    expect(write).not.toHaveBeenCalled();
    useTreeStore.getState().applyMove(path, plan.tree!);
    await vi.advanceTimersByTimeAsync(700);
    expect(write).toHaveBeenCalledTimes(1);
    expect(useTreeStore.getState().undoMove(path)).toBe(true);
    await vi.advanceTimersByTimeAsync(700);
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[1]?.[1]).toContain("\"code\": \"FL-0701\"");
    expect(write.mock.calls[1]?.[1]).not.toContain("FL-120101");
    const again = planMove(useTreeStore.getState().sessions[path]!.data, "n-07", "n-12");
    useTreeStore.getState().applyMove(path, again.tree!);
    useTreeStore.getState().edit(path, { ...useTreeStore.getState().sessions[path]!.data, title: "Toccato" });
    expect(useTreeStore.getState().sessions[path]!.moveUndo).toBeUndefined();
    expect(useTreeStore.getState().undoMove(path)).toBe(false);
  });

  it("annulla l'eliminazione di un ramo e ripristina ordine, codici, categorie e note", async () => {
    vi.useFakeTimers();
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path, content: serializeTreeFile(demoTree()), size: 20, lastModified: 1 });
    const write = vi.spyOn(vaultService, "writeText").mockImplementation(async (_path, content) => ({ size: content.length, lastModified: 3 }));
    await useTreeStore.getState().load(path);
    const before = useTreeStore.getState().sessions[path]!.data;
    const snapshot = serializeTree(before);
    const order = before.nodes.filter(node => node.parentId === "n-root").sort((a, b) => a.order - b.order).map(node => node.id);
    const removed = deleteNode(before, "n-08");
    expect(removed.ok).toBe(true);
    if (!removed.ok) return;
    useTreeStore.getState().applyDelete(path, removed.tree);
    expect(useTreeStore.getState().sessions[path]!.moveUndo?.kind).toBe("delete");
    expect(useTreeStore.getState().sessions[path]!.data.nodes.some(node => node.id === "n-0803")).toBe(false);
    expect(useTreeStore.getState().undoMove(path)).toBe(true);
    const restored = useTreeStore.getState().sessions[path]!.data;
    expect(serializeTree(restored)).toBe(snapshot);
    expect(restored.nodes.filter(node => node.parentId === "n-root").sort((a, b) => a.order - b.order).map(node => node.id)).toEqual(order);
    const note = restored.nodes.find(node => node.id === "n-0803")!;
    expect(note.code).toBe("FL-0803");
    expect(note.categoryId).toBe("c-dim");
    expect(note.note).toContain("Altezza utile");
    expect(useTreeStore.getState().sessions[path]!.moveUndo).toBeUndefined();
    await vi.advanceTimersByTimeAsync(700);
    expect(write).not.toHaveBeenCalled();
    useTreeStore.getState().applyDelete(path, removed.tree);
    useTreeStore.getState().edit(path, { ...useTreeStore.getState().sessions[path]!.data, title: "Toccato" });
    expect(useTreeStore.getState().undoMove(path)).toBe(false);
  });

  it("inserisce un fratello con edit: autosalva dopo 700 ms e dimentica l'annullamento, come un figlio", async () => {
    vi.useFakeTimers();
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path, content: serializeTreeFile(demoTree()), size: 20, lastModified: 1 });
    const write = vi.spyOn(vaultService, "writeText").mockImplementation(async (_path, content) => ({ size: content.length, lastModified: 2 }));
    await useTreeStore.getState().load(path);
    const plan = planMove(useTreeStore.getState().sessions[path]!.data, "n-04", "n-12");
    expect(plan.tree).not.toBeNull();
    useTreeStore.getState().applyMove(path, plan.tree!);
    expect(useTreeStore.getState().sessions[path]!.moveUndo?.kind).toBe("move");
    const current = useTreeStore.getState().sessions[path]!.data;
    const codes = new Map(current.nodes.map(node => [node.id, node.code]));
    const orders = current.nodes.filter(node => node.parentId === "n-07").sort((a, b) => a.order - b.order);
    const result = addSibling(current, "n-0701");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    useTreeStore.getState().edit(path, result.tree);
    expect(useTreeStore.getState().sessions[path]!.moveUndo).toBeUndefined();
    expect(useTreeStore.getState().undoMove(path)).toBe(false);
    const saved = useTreeStore.getState().sessions[path]!.data;
    for (const [id, code] of codes) expect(saved.nodes.find(node => node.id === id)!.code).toBe(code);
    const siblings = saved.nodes.filter(node => node.parentId === "n-07").sort((a, b) => a.order - b.order);
    expect(siblings.map(node => node.id)).toEqual([orders[0]!.id, result.node.id, orders[1]!.id]);
    expect(siblings.map(node => node.order)).toEqual([orders[0]!.order, orders[0]!.order + 1, orders[1]!.order + 1]);
    expect(siblings.find(node => node.id === result.node.id)!.categoryMode).toBe("own");
    expect(siblings.find(node => node.id === result.node.id)!.categoryId).toBeNull();
    expect(write).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(700);
    expect(write).toHaveBeenCalledTimes(1);
    const file = JSON.parse(String(write.mock.calls[0]?.[1])) as { nodes: Array<{ id: string; code: string; order: number }> };
    expect(file.nodes.find(node => node.id === result.node.id)?.code).toBe("FL-0703");
    expect(file.nodes.find(node => node.id === "n-0702")?.code).toBe("FL-0702");
    expect(file.nodes.find(node => node.id === "n-0702")?.order).toBe(orders[1]!.order + 1);
  });

  it("tiene lo stato di vista fuori dal file", () => {
    useTreeUiStore.getState().update("vault:Strutture/Tenda.tree.json", { expanded: ["n-root"], selectedId: "n-07", categoryId: "c-dim" });
    expect(serializeTree(demoTree())).not.toContain("expanded");
    expect(serializeTree(demoTree())).not.toContain("selectedId");
    const stored = JSON.parse(localStorage.getItem("nebula.tree-ui.v1")!);
    expect(stored.state.trees["vault:Strutture/Tenda.tree.json"].expanded).toEqual(["n-root"]);
  });
});
