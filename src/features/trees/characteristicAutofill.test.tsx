import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { InlineObjects } from "./InlineObjects";
import { demoTree } from "./demoTree";
import type { Tree } from "./model";

let host: HTMLDivElement;
let root: Root;
const save = vi.fn(() => undefined);
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => {
  await act(async () => root?.unmount());
  host?.remove();
  save.mockClear();
});

async function render(tree = demoTree(), nodeId = "n-07") {
  if (!host?.isConnected) {
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  }
  await act(async () => root.render(<InlineObjects tree={tree} node={tree.nodes.find(node => node.id === nodeId)!} onSave={save} onRemove={() => undefined} />));
}
function input(label: string) { return host.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!; }
async function type(label: string, value: string) {
  const field = input(label);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function key(label: string, value: string) {
  await act(async () => input(label).dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })));
}

describe("descrizioni automatiche delle caratteristiche", () => {
  it("riconosce sigle proprie e acquisite di altri nodi in entrambi gli elenchi, ignorando maiuscole e spazi", async () => {
    await render();
    await type("Nuova sigla propria", " ht ");
    expect(input("Nuova descrizione propria").value).toBe("Altezza tenda");
    await key("Nuova sigla propria", "Enter");
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "own", code: " ht ", description: "Altezza tenda" }));
    expect(input("Nuova sigla propria").value).toBe("");
    expect(input("Nuova descrizione propria").value).toBe("");
    await type("Nuova sigla acquisita", "p");
    expect(input("Nuova descrizione acquisita").value).toBe("PROFONDITA'");
    await key("Nuova sigla acquisita", "Enter");
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ kind: "acquired", description: "PROFONDITA'" }));
  });

  it("aggiorna la descrizione passando a un'altra sigla nota e la svuota se la nuova sigla non è nota", async () => {
    await render();
    await type("Nuova sigla propria", "P");
    await type("Nuova sigla propria", "HT");
    expect(input("Nuova descrizione propria").value).toBe("Altezza tenda");
    await type("Nuova sigla propria", "NUOVA");
    expect(input("Nuova descrizione propria").value).toBe("");
    await key("Nuova sigla propria", "Enter");
    expect(save).not.toHaveBeenCalled();
    expect(host.textContent).toContain("descrizione è obbligatoria");
  });

  it("conserva una descrizione personalizzata durante le modifiche alla stessa sigla e i rerender", async () => {
    const tree = demoTree();
    await render(tree);
    await type("Nuova sigla propria", "P");
    await type("Nuova descrizione propria", "Profondità personalizzata");
    await type("Nuova sigla propria", " p ");
    await render({ ...tree, nodes: [...tree.nodes] });
    expect(input("Nuova descrizione propria").value).toBe("Profondità personalizzata");
    await type("Nuova sigla propria", "NUOVA");
    expect(input("Nuova descrizione propria").value).toBe("Profondità personalizzata");
    await key("Nuova sigla propria", "Enter");
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ description: "Profondità personalizzata" }));
  });

  it("propone alternative senza scegliere arbitrariamente se una sigla ha descrizioni diverse", async () => {
    const tree = demoTree();
    tree.nodes.find(node => node.id === "n-08")!.objects.push({ id: "alternative", type: "characteristic", kind: "acquired", code: "p", description: "Profondità totale", order: 0 });
    tree.nodes.find(node => node.id === "n-09")!.objects.push({ id: "repeat", type: "characteristic", kind: "own", code: " P ", description: "PROFONDITA'", order: 0 });
    await render(tree);
    await type("Nuova sigla propria", "P");
    expect(input("Nuova descrizione propria").value).toBe("");
    const choices = host.querySelector<HTMLSelectElement>('select[aria-label="Descrizioni per P"]')!;
    expect([...choices.options].map(option => option.value).sort()).toEqual(["", "PROFONDITA'", "Profondità totale"].sort());
    await act(async () => { choices.value = "Profondità totale"; choices.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(input("Nuova descrizione propria").value).toBe("Profondità totale");
    await key("Nuova sigla propria", "Enter");
    expect(save).toHaveBeenLastCalledWith(expect.objectContaining({ description: "Profondità totale" }));
  });

  it("completa anche una caratteristica esistente cambiando sigla e mantiene il controllo dei duplicati nel nodo", async () => {
    await render(demoTree(), "n-0803");
    const edit = [...host.querySelectorAll("button")].find(button => button.textContent?.includes("P - PROFONDITA'"))!;
    await act(async () => edit.click());
    await type("Modifica sigla P", "ht");
    expect(input("Modifica descrizione P").value).toBe("Altezza tenda");
    await key("Modifica sigla P", "Enter");
    expect(save).not.toHaveBeenCalled();
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("già usata");
    await key("Modifica sigla P", "Escape");
    expect(host.textContent).toContain("P - PROFONDITA'");
  });

  it("azzera le bozze cambiando nodo o annullando e aggiorna il catalogo dopo un salvataggio", async () => {
    const tree = demoTree();
    await render(tree);
    await type("Nuova sigla propria", "P");
    await type("Nuova sigla acquisita", "HT");
    await render(tree, "n-09");
    expect(input("Nuova sigla propria").value).toBe("");
    expect(input("Nuova descrizione propria").value).toBe("");
    expect(input("Nuova descrizione acquisita").value).toBe("");
    await type("Nuova sigla propria", "P");
    await key("Nuova sigla propria", "Escape");
    expect(input("Nuova descrizione propria").value).toBe("");
    const updated = structuredClone(tree);
    updated.nodes.find(node => node.id === "n-08")!.objects.push({ id: "new", type: "characteristic", kind: "own", code: "NEW", description: "Nuova descrizione", order: 0 });
    await render(updated, "n-09");
    await type("Nuova sigla acquisita", "NEW");
    expect(input("Nuova descrizione acquisita").value).toBe("Nuova descrizione");
  });
});
