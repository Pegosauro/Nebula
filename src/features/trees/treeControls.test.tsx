import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { vaultService } from "../vault/vaultService";
import { demoTree } from "./demoTree";
import { serializeTreeFile } from "./serializeTree";
import TreeView from "./TreeView";
import { useTreeStore } from "./treeStore";
import { useTreeUiStore } from "./treeUiStore";
import { serializeTree } from "./serializeTree";

const path = "Strutture/Controlli.tree.json";
let host: HTMLDivElement;
let root: Root;
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  useTreeStore.getState().reset(); useTreeUiStore.getState().clear(); localStorage.clear(); vi.restoreAllMocks();
});
async function mount() {
  vi.spyOn(vaultService, "readText").mockResolvedValue({ path, content: serializeTreeFile(demoTree()), size: 40, lastModified: 1 });
  vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 41, lastModified: 2 });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => { root.render(<TreeView path={path} />); });
}
async function click(element: Element | null | undefined) {
  if (!element) throw new Error("Controllo mancante");
  await act(async () => (element as HTMLElement).click());
}
function button(name: string) { return [...host.querySelectorAll("button")].find(item => item.textContent === name || item.getAttribute("aria-label") === name); }
function row(id: string) { return host.querySelector(`[data-node-id="${id}"]`); }
function category(id: string) { return useTreeStore.getState().sessions[path]!.data.nodes.find(node => node.id === id)!.categoryId; }
async function choose(name: string) {
  await click(host.querySelector('[aria-label="Categoria del nodo"]'));
  await click([...host.querySelectorAll('[role="option"]')].find(option => option.textContent === name));
}
function filterCheckbox(text: string) { return [...host.querySelectorAll(".tree-filter-popover label")].find(label => label.textContent === text)?.querySelector("input"); }
async function fill(label: string, value: string) {
  const field = host.querySelector<HTMLInputElement | HTMLTextAreaElement>(`[aria-label="${label}"]`)!;
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(field, value); field.dispatchEvent(new Event("input", { bubbles: true })); });
  return field;
}

it("filtra categorie multiple, nasconde gli altri e consente di ripristinarli dal menu", async () => {
  await mount();
  expect(host.querySelector(".tree-legend")).toBeNull();
  expect(host.querySelector('[aria-label="Filtra per categoria"]')).toBeNull();
  await click(button("Filtro categorie"));
  await click(filterCheckbox("Dimensioni"));
  expect(row("n-root")).toBeNull(); expect(row("n-47")).toBeNull(); expect(row("n-0701")).not.toBeNull();
  await click(filterCheckbox("Avvisi"));
  expect(row("n-47")).not.toBeNull(); expect(row("n-root")).toBeNull();
  await click(filterCheckbox("Mostra anche gli altri nodi"));
  expect(row("n-root")).not.toBeNull(); expect(row("n-44")).not.toBeNull();
  await click(button("Tutte"));
  expect(row("n-root")).not.toBeNull();
});

it("conferma il cambio multiplo e applica ai discendenti solo dopo scelta esplicita", async () => {
  await mount();
  await click(row("n-01"));
  await act(async () => row("n-04")!.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true })));
  expect(host.querySelectorAll('[role="treeitem"][aria-selected="true"]')).toHaveLength(4);
  expect(host.querySelector('[aria-label="Nodi selezionati"]')).not.toBeNull();
  await choose("Avvisi");
  expect(host.querySelector("dialog")?.textContent).toContain("4 nodi selezionati");
  expect(category("n-01")).toBe("c-cfg");
  await click(button("Annulla")); expect(category("n-01")).toBe("c-cfg");
  await choose("Avvisi"); await click(button("Applica categoria"));
  for (const id of ["n-01", "n-03", "n-44", "n-04"]) expect(category(id)).toBe("c-avv");
  expect(category("n-root")).toBe("c-cfg");
  await click(row("n-07")); await choose("Colori e finiture");
  expect(host.querySelector("dialog")?.textContent).toContain("2 nodi discendenti");
  await click(button("Applica categoria"));
  expect(category("n-07")).toBe("c-col"); expect(category("n-0701")).toBe("c-dim");
  await choose("Avvisi"); await click(host.querySelector('dialog input[type="checkbox"]')); await click(button("Applica categoria"));
  for (const id of ["n-07", "n-0701", "n-0702"]) expect(category(id)).toBe("c-avv");
  expect(category("n-08")).toBe("c-dim");
});

it("blocca gli spostamenti fuori modalità e limita la formattazione ai nomi", async () => {
  await mount(); await click(row("n-04"));
  const data = () => useTreeStore.getState().sessions[path]!.data;
  const original = data().nodes.find(node => node.id === "n-04")!.order;
  const press = async () => act(async () => { host.querySelector(".tree-workspace")!.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", altKey: true, bubbles: true })); });
  expect(host.querySelector(".tree-grip")).toBeNull();
  await press(); expect(data().nodes.find(node => node.id === "n-04")!.order).toBe(original);
  await click(button("Modalità spostamento")); expect(host.querySelector(".tree-grip")).not.toBeNull();
  await press(); expect(data().nodes.find(node => node.id === "n-04")!.order).toBe(original + 1);
  await click(button("Modalità spostamento")); expect(host.querySelector(".tree-grip")).toBeNull();
  await click(button("Gestisci…"));
  for (const name of ["Grassetto", "Corsivo", "Sottolineato", "Barrato", "Colore testo"]) await click(button(`${name} per Dimensioni`));
  const name = row("n-07")!.querySelector<HTMLElement>(".tree-name")!;
  expect(name.style.fontWeight).toBe("700"); expect(name.style.fontStyle).toBe("italic"); expect(name.style.textDecorationLine).toBe("underline line-through");
  expect(row("n-07")!.querySelector<HTMLElement>(".tree-code")!.style.fontWeight).toBe("");
  expect(row("n-01")!.querySelector<HTMLElement>(".tree-name")!.style.fontWeight).toBe("");
  expect(name.style.color).toBe("rgb(34, 211, 238)");
  expect(row("n-07")!.querySelector<HTMLElement>(".tree-code")!.style.color).toBe("");
  expect(row("n-01")!.querySelector<HTMLElement>(".tree-name")!.style.color).toBe("");
  expect(data().categories.find(item => item.id === "c-dim")!.textStyle).toEqual({ bold: true, italic: true, underline: true, strike: true, categoryColor: true });
  expect(button("Colore testo per Dimensioni")!.getAttribute("aria-pressed")).toBe("true");
  await click(button("Colore di Dimensioni"));
  await click(host.querySelector('[aria-label="Tavolozza per Dimensioni"] button[title="Verde"]'));
  expect(name.style.color).toBe("rgb(76, 175, 106)");
  await click(button("Colore testo per Dimensioni"));
  expect(name.style.color).toBe("");
  expect(name.style.fontWeight).toBe("700");
  expect(button("Colore testo per Dimensioni")!.getAttribute("aria-pressed")).toBe("false");
});

it("importa Nome, Categoria e Note con codici automatici e annulla/ripristina l'intero gruppo", async () => {
  await mount(); await click(row("n-07"));
  const before = serializeTree(useTreeStore.getState().sessions[path]!.data);
  await click(button("Incolla da Excel"));
  await fill("Celle copiate da Excel", "Primo\n\tDimensioni\tNota");
  expect(host.querySelector("dialog [role='alert']")?.textContent).toContain("nome è obbligatorio");
  expect(button("Importa 2 nodi")?.disabled).toBe(true);
  expect(serializeTree(useTreeStore.getState().sessions[path]!.data)).toBe(before);
  await fill("Celle copiate da Excel", "Primo\tDimensioni\tNota\nSecondo");
  expect(host.querySelector("dialog table")?.textContent).toContain("FL-0703");
  expect(host.querySelector("dialog table")?.textContent).toContain("FL-0704");
  expect(button("Importa 2 nodi")?.disabled).toBe(false);
  await click(button("Importa 2 nodi"));
  expect(host.querySelector("dialog")).toBeNull();
  const imported = useTreeStore.getState().sessions[path]!.data;
  expect(imported.nodes.at(-2)?.categoryId).toBe("c-dim"); expect(imported.nodes.at(-2)?.note).toBe("Nota");
  expect(imported.nodes.at(-1)?.categoryId).toBeNull(); expect(imported.nodes.at(-1)?.note).toBe("");
  const after = serializeTree(imported);
  await click(button("Annulla ultima modifica")); expect(serializeTree(useTreeStore.getState().sessions[path]!.data)).toBe(before);
  await click(button("Ripristina modifica")); expect(serializeTree(useTreeStore.getState().sessions[path]!.data)).toBe(after);
  const workspace = host.querySelector(".tree-workspace")!;
  await act(async () => { workspace.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true })); });
  expect(serializeTree(useTreeStore.getState().sessions[path]!.data)).toBe(before);
  await act(async () => { workspace.dispatchEvent(new KeyboardEvent("keydown", { key: "y", ctrlKey: true, bubbles: true })); });
  expect(serializeTree(useTreeStore.getState().sessions[path]!.data)).toBe(after);
});

it("raggruppa la digitazione del nome e conserva l'undo nativo nella ricerca", async () => {
  await mount(); await click(row("n-07"));
  expect(button("Annulla ultima modifica")?.disabled).toBe(true);
  await fill("Nome del nodo", "A"); const name = await fill("Nome del nodo", "Ab");
  expect(useTreeStore.getState().sessions[path]!.undoStack).toHaveLength(1);
  await act(async () => { name.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true })); });
  expect((host.querySelector('[aria-label="Nome del nodo"]') as HTMLInputElement).value).toBe("Larghezza tenda");
  await act(async () => { name.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, shiftKey: true, bubbles: true, cancelable: true })); });
  expect((host.querySelector('[aria-label="Nome del nodo"]') as HTMLInputElement).value).toBe("Ab");
  const event = new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true });
  await act(async () => { host.querySelector('[aria-label="Cerca codice o nome"]')!.dispatchEvent(event); });
  expect(event.defaultPrevented).toBe(false);
  expect((host.querySelector('[aria-label="Nome del nodo"]') as HTMLInputElement).value).toBe("Ab");
  await click(button("Filtro categorie")); await click(filterCheckbox("Dimensioni"));
  expect(host.querySelector('[aria-label="Filtri attivi"]')?.textContent).toContain("Dimensioni");
  await click(button("Azzera filtri")); expect(host.querySelector('[aria-label="Filtri attivi"]')).toBeNull();
});
