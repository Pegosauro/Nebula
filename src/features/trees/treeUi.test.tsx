import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { vaultService } from "../vault/vaultService";
import { demoTree } from "./demoTree";
import { serializeTreeFile } from "./serializeTree";
import TreeView from "./TreeView";
import { useTreeStore } from "./treeStore";
import { useTreeUiStore } from "./treeUiStore";

const path = "Strutture/FL · Tenda finestra.tree.json";
let host: HTMLDivElement | undefined;
let root: Root | undefined;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove();
  root = undefined;
  host = undefined;
  useTreeStore.getState().reset();
  useTreeUiStore.getState().clear();
  localStorage.clear();
  vi.restoreAllMocks();
});

function button(name: string) {
  const found = [...host!.querySelectorAll("button")].find(item => item.textContent?.includes(name) || item.getAttribute("aria-label")?.includes(name));
  if (!found) throw new Error(`Pulsante non trovato: ${name}`);
  return found;
}
async function click(name: string) {
  await act(async () => button(name).click());
}
async function typeInput(label: string, value: string) {
  const field = host!.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  if (!field) throw new Error(label);
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
  return field;
}

describe("vista Strutture", () => {
  it("cerca, aggiunge un figlio, blocca il codice duplicato, vieta l'eliminazione di un ramo e segnala la sigla doppia", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path, content: serializeTreeFile(demoTree()), size: 40, lastModified: 1 });
    const write = vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 41, lastModified: 2 });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root!.render(<TreeView path={path} />); });
    await act(async () => { await Promise.resolve(); });
    expect(host.textContent).toContain("FL-07");
    expect(host.textContent).toContain("Salvato nel Vault");
    await typeInput("Cerca codice o nome", "Limite larghezza");
    expect(host.textContent).toContain("1 risultato");
    expect(host.querySelector("mark")?.textContent?.toLowerCase()).toContain("limite");
    await typeInput("Cerca codice o nome", "");
    await click("Aggiungi figlio");
    const code = host.querySelector<HTMLInputElement>('[aria-label="Codice del nuovo nodo"]');
    expect(code?.value).toBe("FL-02");
    await typeInput("Codice del nuovo nodo", "FL-01");
    await act(async () => code?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(host.textContent).toContain("Codice già usato");
    expect(write).not.toHaveBeenCalled();
    await act(async () => code?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    const branch = [...host.querySelectorAll('[role="treeitem"]')].find(item => item.textContent?.includes("FL-07"));
    await act(async () => branch?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(button("Elimina").hasAttribute("disabled")).toBe(true);
    expect(host.textContent).toMatch(/figli/);
    await click("Espandi FL-07");
    const leaf = [...host.querySelectorAll('[role="treeitem"]')].find(item => item.textContent?.includes("FL-0702"));
    await act(async () => leaf?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await click("Elimina");
    expect(host.querySelector("dialog")?.textContent).toContain("FL-0702");
    await click("Annulla");
    await click("Espandi FL-08");
    await click("Espandi FL-0803");
    await click("P - PROFONDITA'");
    await typeInput("Sigla", "H");
    await click("Salva oggetto");
    expect(host.textContent).toContain("già usata");
    expect(useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-0803")!.objects).toHaveLength(3);
  });

  it("anteprima di Sposta in, blocco del conflitto, annulla e riordino senza rinumerare", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path, content: serializeTreeFile(demoTree()), size: 40, lastModified: 1 });
    vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 41, lastModified: 2 });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root!.render(<TreeView path={path} />); });
    await act(async () => { await Promise.resolve(); });
    expect(button("Sposta in…").hasAttribute("disabled")).toBe(true);
    await clickTreeItem("FL-07");
    await click("Sposta in…");
    const dialog = host!.querySelector("dialog");
    if (!dialog) throw new Error("Manca la finestra Sposta in");
    await clickOption(dialog, "FL-12");
    expect(dialog.textContent).toContain("FL-1201");
    expect(dialog.textContent).toContain("FL-120101");
    expect(dialog.textContent).toContain("FL-120102");
    await act(async () => dialog.querySelector<HTMLButtonElement>("button.button-primary")?.click());
    const moved = useTreeStore.getState().sessions[path]!.data;
    expect(moved.nodes.find(node => node.id === "n-07")!.code).toBe("FL-1201");
    expect(moved.nodes.find(node => node.id === "n-0701")!.code).toBe("FL-120101");
    expect(moved.nodes.find(node => node.id === "n-07")!.parentId).toBe("n-12");
    await click("Annulla spostamento");
    expect(useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-07")!.code).toBe("FL-07");
    expect(useTreeStore.getState().sessions[path]!.moveUndo).toBeUndefined();
    await click("Espandi FL-08");
    await clickTreeItem("FL-0804");
    await click("Sposta in…");
    const blocked = host!.querySelector("dialog");
    if (!blocked) throw new Error("Manca la finestra del conflitto");
    await clickOption(blocked, "FL-09");
    expect(blocked.textContent).toContain("FL-0907");
    expect(blocked.querySelector<HTMLButtonElement>("button.button-primary")?.disabled).toBe(true);
    expect(useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-0804")!.code).toBe("FL-0804");
    await act(async () => [...blocked.querySelectorAll("button")].find(item => item.textContent === "Annulla")?.click());
    await clickTreeItem("FL-04");
    const workspace = host!.querySelector(".tree-workspace");
    await act(async () => workspace?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true })));
    const reordered = useTreeStore.getState().sessions[path]!.data;
    const ids = reordered.nodes.filter(node => node.parentId === "n-root").sort((a, b) => a.order - b.order).map(node => node.id);
    expect(ids.indexOf("n-04")).toBe(ids.indexOf("n-47") + 1);
    expect(reordered.nodes.find(node => node.id === "n-04")!.code).toBe("FL-04");
    await click("Annulla spostamento");
    const restored = useTreeStore.getState().sessions[path]!.data.nodes.filter(node => node.parentId === "n-root").sort((a, b) => a.order - b.order).map(node => node.id);
    expect(restored.indexOf("n-04")).toBeLessThan(restored.indexOf("n-47"));
  });
});

async function clickTreeItem(text: string) {
  const row = [...host!.querySelectorAll('[role="treeitem"]')].find(item => item.querySelector("strong")?.textContent === text);
  if (!row) throw new Error(`Nodo non trovato: ${text}`);
  await act(async () => row.dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function clickOption(dialog: Element, code: string) {
  const option = [...dialog.querySelectorAll("button")].find(item => item.querySelector("strong")?.textContent === code);
  if (!option) throw new Error(`Destinazione non trovata: ${code}`);
  await act(async () => option.click());
}
