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
  it("cerca, aggiunge un figlio, blocca il codice duplicato, protegge la radice e segnala la sigla doppia", async () => {
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
    const name = host.querySelector<HTMLInputElement>('[aria-label="Nome del nuovo nodo"]');
    expect(code?.value).toBe("FL-02");
    expect(name?.value).toBe("Nuovo nodo");
    expect(document.activeElement).toBe(name);
    expect(name?.selectionStart).toBe(0);
    expect(name?.selectionEnd).toBe("Nuovo nodo".length);
    await typeInput("Codice del nuovo nodo", "FL-01");
    await act(async () => code?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(host.textContent).toContain("Codice già usato");
    expect(write).not.toHaveBeenCalled();
    await act(async () => code?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    const rootRow = treeRow("FL");
    expect(rootRow.querySelector("span.tree-name")?.textContent).toBe("Tenda finestra");
    expect(rootRow.querySelector("strong.tree-name")).toBeNull();
    expect(host!.querySelector(".tree-inherit")).toBeNull();
    expect(rootRow.querySelector("span.tree-code")?.textContent).toBe("FL");
    expect(rootRow.querySelector('[aria-label="Ha una nota"]')).not.toBeNull();
    expect(rootRow.querySelector('[aria-label="Comprimi FL"], [aria-label="Espandi FL"]')).toBeNull();
    expect(rootRow.getAttribute("aria-expanded")).toBe("true");
    expect(button("Elimina").hasAttribute("disabled")).toBe(true);
    expect(host.textContent).toMatch(/radice non si può eliminare/);
    const branch = treeRow("FL-07");
    await act(async () => branch.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(button("Elimina").hasAttribute("disabled")).toBe(false);
    expect(branch.querySelector(".tree-dot")).toBeNull();
    expect(treeRow("FL-01").querySelector('[aria-label="Ha una nota"]')).toBeNull();
    expect(treeRow("FL-47").querySelector('[aria-label="Ha una nota"]')).not.toBeNull();
    await click("Espandi FL-07");
    const leaf = [...host.querySelectorAll('[role="treeitem"]')].find(item => item.textContent?.includes("FL-0702"));
    await act(async () => leaf?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    await click("Elimina");
    expect(host.querySelector("dialog")?.textContent).toContain("FL-0702");
    await click("Annulla");
    await click("Espandi FL-08");
    await click("Espandi FL-0803");
    await click("P - PROFONDITA'");
    await typeInput("Modifica sigla P", "H");
    await pressKey("Modifica sigla P", "Enter");
    expect(host!.querySelector("[role='alert']")?.textContent).toMatch(/già usata/);
    const kept = useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-0803")!;
    expect(kept.objects).toHaveLength(3);
    expect(kept.objects.some(object => object.type === "characteristic" && object.code === "P")).toBe(true);
  });

  it("sceglie una sola categoria, elimina un ramo con conteggio e annulla", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path, content: serializeTreeFile(demoTree()), size: 40, lastModified: 1 });
    vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 41, lastModified: 2 });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root!.render(<TreeView path={path} />); });
    await act(async () => { await Promise.resolve(); });
    await click("Espandi FL-07");
    await clickTreeItem("FL-0701");
    const picker = host!.querySelector<HTMLSelectElement>('[aria-label="Categoria del nodo"]');
    expect(picker?.value).toBe("c-dim");
    expect(picker?.querySelectorAll("option")).toHaveLength(demoTree().categories.length + 1);
    expect(host!.textContent).not.toContain("Ereditata da");
    expect(host!.textContent).not.toContain("Se la modifichi");
    expect(host!.textContent).toContain("Eredita dal padre");
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(picker, "c-avv");
      picker?.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const detached = useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-0701")!;
    expect(detached.categoryMode).toBe("own");
    expect(detached.categoryId).toBe("c-avv");
    await click("Eredita dal padre");
    const restored = useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-0701")!;
    expect(restored.categoryMode).toBe("inherit");
    expect(restored.categoryId).toBeNull();
    await clickTreeItem("FL-47");
    const note = host!.querySelector<HTMLTextAreaElement>('[aria-label="Note del nodo"]');
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(note, "   ");
      note?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(treeRow("FL-47").querySelector('[aria-label="Ha una nota"]')).toBeNull();
    await act(async () => {
      setter?.call(note, "Avviso mostrato in fase d'ordine.");
      note?.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(treeRow("FL-47").querySelector('[aria-label="Ha una nota"]')).not.toBeNull();
    await clickTreeItem("FL-08");
    await click("Elimina");
    const dialog = host!.querySelector("dialog");
    expect(dialog?.textContent).toContain("Eliminare FL-08 e 4 nodi discendenti?");
    expect(dialog?.textContent).toContain("Verranno eliminati 5 nodi.");
    await act(async () => [...dialog!.querySelectorAll("button")].find(item => item.textContent === "Elimina")?.click());
    expect(useTreeStore.getState().sessions[path]!.data.nodes.some(node => node.id === "n-0803")).toBe(false);
    expect(host!.textContent).toContain("Annulla ripristina nodi, ordine, codici, categorie e note.");
    await click("Annulla eliminazione");
    const back = useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-0803")!;
    expect(back.code).toBe("FL-0803");
    expect(back.categoryId).toBe("c-dim");
    expect(back.note).toContain("Altezza utile");
    expect(host!.textContent).toContain("Eliminazione annullata");
  });

  it("mette il focus sul nome da tastiera, scheda e menu e non comprime la radice", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path, content: serializeTreeFile(demoTree()), size: 40, lastModified: 1 });
    vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 41, lastModified: 2 });
    useTreeUiStore.getState().update(`session:${path}`, { expanded: ["n-07"] });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root!.render(<TreeView path={path} />); });
    await act(async () => { await Promise.resolve(); });
    expect(host!.textContent).toContain("FL-01");
    expect(useTreeUiStore.getState().trees[`session:${path}`]?.expanded).toContain("n-root");
    const workspace = host!.querySelector(".tree-workspace");
    await act(async () => workspace?.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true })));
    expect(host!.textContent).toContain("FL-01");
    await click("Comprimi");
    expect(host!.textContent).toContain("FL-01");
    expect(host!.textContent).not.toContain("FL-0701");
    await clickTreeItem("FL-04");
    const panelAdd = [...host!.querySelectorAll<HTMLButtonElement>(".tree-node-actions button")].find(item => item.textContent?.includes("Figlio"));
    await act(async () => panelAdd?.click());
    expect(document.activeElement).toBe(host!.querySelector('[aria-label="Nome del nuovo nodo"]'));
    await act(async () => workspace?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await act(async () => workspace?.dispatchEvent(new KeyboardEvent("keydown", { key: "Insert", bubbles: true })));
    const inserted = host!.querySelector<HTMLInputElement>('[aria-label="Nome del nuovo nodo"]');
    expect(document.activeElement).toBe(inserted);
    expect(inserted?.selectionEnd).toBe(inserted?.value.length);
    await act(async () => workspace?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true })));
    await act(async () => treeRow("FL-04").dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 30, clientY: 40 })));
    const menuAdd = [...host!.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(item => item.textContent === "Aggiungi figlio");
    await act(async () => menuAdd?.click());
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Nome del nuovo nodo");
  });

  it("inserisce e modifica tabelle e caratteristiche in riga, con la sigla duplicata sulla riga", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path, content: serializeTreeFile(demoTree()), size: 40, lastModified: 1 });
    vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 41, lastModified: 2 });
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
    await act(async () => { root!.render(<TreeView path={path} />); });
    await act(async () => { await Promise.resolve(); });
    await click("Espandi FL-08");
    await clickTreeItem("FL-0803");
    expect(host!.textContent).not.toContain("Oggetto");
    expect(host!.querySelector("dialog")).toBeNull();
    const sigla = host!.querySelector<HTMLInputElement>('[aria-label="Nuova sigla propria"]')!;
    const description = host!.querySelector<HTMLInputElement>('[aria-label="Nuova descrizione propria"]')!;
    expect(sigla.compareDocumentPosition(description) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await typeInput("Nuova tabella", "TE_PROVA");
    await pressKey("Nuova tabella", "Enter");
    const saved = useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-0803")!;
    expect(saved.objects.some(object => object.type === "externalTable" && object.tableName === "TE_PROVA")).toBe(true);
    expect(host!.querySelector<HTMLInputElement>('[aria-label="Nuova tabella"]')!.value).toBe("");
    expect(document.activeElement).toBe(host!.querySelector('[aria-label="Nuova tabella"]'));
    await typeInput("Nuova sigla propria", "ZZ");
    await typeInput("Nuova descrizione propria", "Prova");
    await pressKey("Nuova descrizione propria", "Escape");
    expect(host!.querySelector<HTMLInputElement>('[aria-label="Nuova sigla propria"]')!.value).toBe("");
    expect(host!.querySelector<HTMLInputElement>('[aria-label="Nuova descrizione propria"]')!.value).toBe("");
    await typeInput("Nuova sigla propria", "ZZ");
    await typeInput("Nuova descrizione propria", "Prova");
    await pressKey("Nuova sigla propria", "Enter");
    expect(useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-0803")!.objects.some(object => object.type === "characteristic" && object.code === "ZZ")).toBe(true);
    expect(document.activeElement).toBe(host!.querySelector('[aria-label="Nuova sigla propria"]'));
    const row = [...host!.querySelectorAll("button")].find(item => item.textContent?.includes("P - PROFONDITA'"));
    await act(async () => row?.click());
    await typeInput("Modifica descrizione P", "Profondità rivista");
    await pressKey("Modifica descrizione P", "Enter");
    expect(useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-0803")!.objects.some(object => object.type === "characteristic" && object.code === "P" && object.description === "Profondità rivista")).toBe(true);
    const again = [...host!.querySelectorAll("button")].find(item => item.textContent?.includes("P - Profondità rivista"));
    await act(async () => again?.click());
    await typeInput("Modifica sigla P", "H");
    await pressKey("Modifica sigla P", "Enter");
    expect(host!.querySelector("[role='alert']")?.textContent).toMatch(/già usata/);
    expect(useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === "n-0803")!.objects.some(object => object.type === "characteristic" && object.code === "P")).toBe(true);
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

function treeRow(code: string) {
  const row = [...host!.querySelectorAll<HTMLElement>('[role="treeitem"]')].find(item => item.querySelector(".tree-code")?.textContent === code);
  if (!row) throw new Error(`Nodo non trovato: ${code}`);
  return row;
}
async function pressKey(label: string, key: string) {
  const field = host!.querySelector<HTMLInputElement>(`[aria-label="${label}"]`);
  if (!field) throw new Error(label);
  await act(async () => field.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true })));
}
async function clickTreeItem(text: string) {
  await act(async () => treeRow(text).dispatchEvent(new MouseEvent("click", { bubbles: true })));
}
async function clickOption(dialog: Element, code: string) {
  const option = [...dialog.querySelectorAll("button")].find(item => item.querySelector("strong")?.textContent === code);
  if (!option) throw new Error(`Destinazione non trovata: ${code}`);
  await act(async () => option.click());
}
