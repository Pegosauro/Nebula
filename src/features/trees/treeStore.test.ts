import { afterEach, describe, expect, it, vi } from "vitest";
import { ExternalFileConflictError } from "../../infrastructure/filesystem/vaultFileOperations";
import { vaultService } from "../vault/vaultService";
import { treeSaveStatus } from "../workspace/saveStatus";
import { demoTree } from "./demoTree";
import { newTree, upsertObject } from "./model";
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

  it("tiene lo stato di vista fuori dal file", () => {
    useTreeUiStore.getState().update("vault:Strutture/Tenda.tree.json", { expanded: ["n-root"], selectedId: "n-07", categoryId: "c-dim" });
    expect(serializeTree(demoTree())).not.toContain("expanded");
    expect(serializeTree(demoTree())).not.toContain("selectedId");
    const stored = JSON.parse(localStorage.getItem("nebula.tree-ui.v1")!);
    expect(stored.state.trees["vault:Strutture/Tenda.tree.json"].expanded).toEqual(["n-root"]);
  });
});
