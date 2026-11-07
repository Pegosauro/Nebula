import { useState, type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ComponentEditor } from "./DefinitionEditors";
import { evaluate } from "./engine";
import { exampleConfigurator, type Configurator } from "./model";

let root: Root | undefined, host: HTMLDivElement | undefined;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove(); root = undefined; host = undefined;
  vi.restoreAllMocks();
});
async function mount(element: ReactNode) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(element));
}
function Harness({ initial, onChange }: { initial: Configurator; onChange: (data: Configurator) => void }) {
  const [data, setData] = useState(initial);
  return <ComponentEditor data={data} notes={["Schede/a.md"]} change={next => { onChange(next); setData(next); }} />;
}
function button(text: string) {
  const found = [...host!.querySelectorAll("button")].find(item => item.textContent?.trim() === text);
  expect(found, text).toBeTruthy();
  return found as HTMLButtonElement;
}
async function click(text: string) { await act(async () => button(text).click()); }
async function type(id: string, value: string) {
  const input = host!.querySelector<HTMLInputElement>(`#${id}, [aria-label="${id}"]`)!;
  expect(input, id).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
async function choose(label: string) {
  const input = [...host!.querySelectorAll<HTMLInputElement>('input[name="guided-inclusion"]')].find(item => item.closest("label")?.textContent?.includes(label));
  expect(input, label).toBeTruthy();
  await act(async () => input!.click());
}
async function key(target: HTMLElement, keyName: string) {
  await act(async () => target.dispatchEvent(new KeyboardEvent("keydown", { key: keyName, bubbles: true })));
}
function radios() { return [...host!.querySelectorAll<HTMLInputElement>('input[name="guided-inclusion"]')]; }

describe("dialogo di creazione guidata", () => {
  it("walks forward and back without losing the draft, then cancels without writing", async () => {
    const seen: Configurator[] = [];
    const initial = exampleConfigurator("Pergola");
    await mount(<Harness initial={initial} onChange={data => seen.push(data)} />);
    expect(button("Inserimento rapido")).toBeTruthy();
    await click("Componente");
    expect(host!.querySelector("dialog h2")?.textContent).toBe("Nuovo componente");
    expect(host!.querySelector("dialog h3")?.textContent).toBe("Codice e descrizione");
    expect(host!.querySelector('[aria-label="Dimensioni del componente"]')).toBeNull();
    expect(host!.querySelector('[aria-label="Proprietà del componente"]')).toBeNull();
    await type("guided-code", "NEW1");
    await type("guided-name", "Nuovo pezzo");
    await click("Avanti");
    expect(radios().map(item => item.checked)).toEqual([false, false, false]);
    expect(radios().map(item => item.getAttribute("aria-describedby"))).toEqual(["guided-mode-always", "guided-mode-conditional", "guided-mode-catalog"]);
    radios()[0]!.focus();
    await key(radios()[0]!, "ArrowDown");
    expect(radios()[1]!.checked).toBe(true);
    expect(document.activeElement).toBe(radios()[1]);
    expect(radios()[1]!.value).toBe("conditional");
    await key(radios()[1]!, "End");
    expect(radios()[2]!.checked).toBe(true);
    await key(radios()[2]!, "Home");
    expect(radios()[0]!.checked).toBe(true);
    await key(radios()[0]!, "ArrowRight");
    await click("Avanti");
    expect(host!.querySelector('[aria-label="Parametro della condizione"]')).toBeNull();
    expect(host!.textContent).toContain("non viene scelta al posto tuo");
    await click("Condizione");
    const parameter = host!.querySelector<HTMLSelectElement>('[aria-label="Parametro della condizione"]')!;
    expect(parameter.value).toBe("");
    expect(parameter.selectedOptions[0]?.textContent).toBe("Parametro…");
    await type("Quantità", "3");
    await click("Avanti");
    await type("Gruppo", "Accessori");
    await click("Avanti");
    expect(host!.querySelector("dialog h3")?.textContent).toBe("Dimensioni");
    expect(host!.querySelector('[aria-label="Dimensioni del componente"]')).toBeTruthy();
    expect(host!.querySelector('[aria-label="Proprietà del componente"]')).toBeNull();
    await click("Indietro");
    expect(host!.querySelector<HTMLInputElement>('[aria-label="Gruppo"]')!.value).toBe("Accessori");
    await click("Indietro");
    expect(host!.querySelector<HTMLInputElement>('[aria-label="Quantità"]')!.value).toBe("3");
    expect(host!.querySelector('[aria-label="Parametro della condizione"]')).toBeTruthy();
    await click("Indietro");
    expect(radios()[1]!.checked).toBe(true);
    await click("Indietro");
    expect(host!.querySelector<HTMLInputElement>("#guided-code")!.value).toBe("NEW1");
    expect(host!.querySelector<HTMLInputElement>("#guided-name")!.value).toBe("Nuovo pezzo");
    await click("Avanti");
    expect(radios()[1]!.checked).toBe(true);
    await click("Annulla");
    expect(seen).toEqual([]);
    expect(host!.querySelector("dialog")).toBeNull();
  });

  it("exposes accessible errors and keeps keyboard submission on the invalid field", async () => {
    await mount(<Harness initial={exampleConfigurator("Pergola")} onChange={() => { throw new Error("nessuna scrittura"); }} />);
    await click("Componente");
    await act(async () => host!.querySelector<HTMLFormElement>("dialog form")!.requestSubmit());
    const code = host!.querySelector<HTMLInputElement>("#guided-code")!;
    expect(code.getAttribute("aria-invalid")).toBe("true");
    expect(code.getAttribute("aria-describedby")).toBe("guided-code-error");
    expect(host!.querySelector("#guided-code-error")?.textContent).toContain("Inserisci il codice");
    expect(host!.querySelector("[role='alert']")?.textContent).toContain("Inserisci il codice");
    expect(document.activeElement).toBe(code);
    await type("guided-code", "PR001");
    await type("guided-name", "Duplicato");
    await click("Avanti");
    expect(host!.querySelector("#guided-code-error")?.textContent).toContain("già usato");
    await type("guided-code", "NEW1");
    await click("Avanti");
    await act(async () => host!.querySelector<HTMLFormElement>("dialog form")!.requestSubmit());
    const group = host!.querySelector("fieldset")!;
    expect(group.getAttribute("aria-invalid")).toBe("true");
    expect(group.getAttribute("aria-describedby")).toBe("guided-mode-error");
    expect(host!.querySelector("[role='alert']")?.textContent).toContain("Scegli quando il componente entra in distinta");
    expect(document.activeElement).toBe(host!.querySelector("[data-guided-error]"));
    expect(radios().some(item => item.checked)).toBe(false);
  });

  it("creates each inclusion mode with the matching BOM and leaves editing on the full dialog", async () => {
    const seen: Configurator[] = [];
    await mount(<Harness initial={exampleConfigurator("Pergola")} onChange={data => seen.push(structuredClone(data))} />);
    await click("Componente");
    expect(host!.querySelector('[aria-label="Dimensioni del componente"]')).toBeNull();
    await click("Modalità completa");
    expect(host!.querySelector('[aria-label="Dimensioni del componente"]')).toBeTruthy();
    expect(host!.querySelector('[aria-label="Proprietà del componente"]')).toBeTruthy();
    await type("guided-code", "CAT1");
    await type("guided-name", "Solo catalogo");
    await choose("Solo catalogo");
    await click("Torna alla guida");
    expect(host!.querySelector<HTMLInputElement>("#guided-code")!.value).toBe("CAT1");
    await click("Avanti");
    expect(radios().find(item => item.checked)?.value).toBe("catalog");
    await click("Modalità completa");
    await click("Crea componente");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.rules).toEqual(exampleConfigurator("Pergola").rules);
    expect(seen[0]!.components.at(-1)).toMatchObject({ code: "CAT1", name: "Solo catalogo" });
    expect(evaluate(seen[0]!, { model: "A", led: true, width: 3000 }).bom.some(row => row.component === seen[0]!.components.at(-1)!.id)).toBe(false);
    expect(evaluate(seen[0]!, {}).possible.some(row => row.component === seen[0]!.components.at(-1)!.id)).toBe(false);

    await click("Componente");
    await type("guided-code", "ALW1");
    await type("guided-name", "Sempre in distinta");
    await click("Avanti");
    await choose("Sempre presente");
    await click("Avanti");
    await type("Quantità", "-1");
    await click("Crea componente");
    expect(seen).toHaveLength(1);
    expect(host!.querySelector("[role='alert']")?.textContent).toContain("Controlla quantità");
    await type("Quantità", "4");
    await click("Crea componente");
    const always = seen[1]!.components.find(item => item.code === "ALW1")!;
    expect(evaluate(seen[1]!, {}).bom.find(row => row.component === always.id)).toMatchObject({ quantity: 4, certain: true });
    expect(evaluate(seen[1]!, { model: "B", led: false, width: 2000 }).bom.find(row => row.component === always.id)?.quantity).toBe(4);
    expect(seen[1]!.rules.at(-1)).toMatchObject({ conditions: [], actions: [expect.objectContaining({ component: always.id })] });

    await click("Componente");
    await type("guided-code", "CND1");
    await type("guided-name", "Solo con LED");
    await click("Avanti");
    await choose("Solo in certe condizioni");
    await click("Avanti");
    await click("Crea componente");
    expect(seen).toHaveLength(2);
    expect(host!.querySelector("[role='alert']")?.textContent).toContain("Nessuna condizione è preselezionata");
    expect(host!.querySelector('[aria-label="Parametro della condizione"]')).toBeNull();
    await click("Condizione");
    const parameter = host!.querySelector<HTMLSelectElement>('[aria-label="Parametro della condizione"]')!;
    expect(parameter.value).toBe("");
    await act(async () => { parameter.value = "led"; parameter.dispatchEvent(new Event("change", { bubbles: true })); });
    const value = host!.querySelector<HTMLSelectElement>('[aria-label="Valore"]')!;
    expect(value.value).toBe("true");
    await click("Crea componente");
    const conditional = seen[2]!.components.find(item => item.code === "CND1")!;
    expect(evaluate(seen[2]!, { led: true }).bom.some(row => row.component === conditional.id)).toBe(true);
    expect(evaluate(seen[2]!, { led: false }).bom.some(row => row.component === conditional.id)).toBe(false);
    expect(evaluate(seen[2]!, {}).bom.some(row => row.component === conditional.id)).toBe(false);

    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Modifica PR001 · Profilo laterale"]')!.click());
    expect(host!.querySelector("dialog h2")?.textContent).toBe("Dettagli componente");
    expect(host!.textContent).toContain("Dimensioni");
    expect(host!.textContent).not.toContain("Modalità completa");
    await click("Annulla");
    expect(seen).toHaveLength(3);
  });

  it("discards a confirmed close and keeps an unconfirmed close open", async () => {
    const seen: Configurator[] = [];
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    await mount(<Harness initial={exampleConfigurator("Pergola")} onChange={data => seen.push(data)} />);
    await click("Componente");
    await type("guided-code", "TMP");
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Chiudi dettagli"]')!.click());
    expect(confirm).toHaveBeenCalled();
    expect(host!.querySelector("dialog")).toBeTruthy();
    expect(seen).toEqual([]);
    confirm.mockReturnValue(true);
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Chiudi dettagli"]')!.click());
    expect(host!.querySelector("dialog")).toBeNull();
    expect(seen).toEqual([]);
  });
});
