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
});
