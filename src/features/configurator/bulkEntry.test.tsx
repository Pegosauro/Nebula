import { useState, type ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { ComponentEditor } from "./DefinitionEditors";
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
async function click(text: string) {
  const button = [...host!.querySelectorAll("button")].find(item => item.textContent?.trim() === text);
  expect(button, text).toBeTruthy();
  await act(async () => button!.click());
}
async function typeIn(label: string, value: string) {
  const input = host!.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`);
  expect(input).toBeTruthy();
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input!.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await act(async () => input!.blur());
}

describe("inserimento rapido", () => {
  it("applies one edit from the grid and restores the snapshot", async () => {
    const seen: Configurator[] = [];
    await mount(<Harness initial={exampleConfigurator("Pergola")} onChange={data => seen.push(data)} />);
    await click("Inserimento rapido");
    expect(host!.textContent).toContain("PR001");
    const cell = [...host!.querySelectorAll("td")].find(item => item.textContent === "Profilo laterale")!;
    await act(async () => cell.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    await typeIn("Descrizione di PR001", "Profilo revisionato");
    await click("Anteprima e applica… (1)");
    expect(host!.textContent).toContain("Profilo laterale → Profilo revisionato");
    await click("Applica solo le 1 righe valide");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.version).toBe(1);
    expect(seen[0]!.components[0]).toMatchObject({ id: "profile", name: "Profilo revisionato" });
    expect(seen[0]!.rules).toEqual(exampleConfigurator("Pergola").rules);
    await click("Annulla import");
    expect(seen).toHaveLength(2);
    expect(seen[1]!.components[0]!.name).toBe("Profilo laterale");
  });
  it("blocks a legacy measure until the confirmed conversion, which is one edit", async () => {
    const initial = exampleConfigurator("Pergola");
    initial.components[0]!.measure = { parameter: "width", offset: -1, unit: "cm" };
    const seen: Configurator[] = [];
    vi.spyOn(window, "confirm").mockReturnValue(true);
    await mount(<Harness initial={initial} onChange={data => seen.push(data)} />);
    expect(host!.textContent).toContain("Converti misure legacy");
    await click("Converti misure legacy");
    expect(seen).toHaveLength(1);
    expect(seen[0]!.version).toBe(6);
    expect(seen[0]!.components[0]!.measure).toBeUndefined();
    expect(seen[0]!.components[0]!.dimensions?.[0]).toMatchObject({ name: "Lunghezza", parameter: "width", offset: -1, unit: "cm" });
    expect(seen[0]!.components[1]).toBe(initial.components[1]);
    await click("Annulla conversione");
    expect(seen[1]!.components[0]!.measure).toEqual({ parameter: "width", offset: -1, unit: "cm" });
    expect(seen[1]!.components[0]!.dimensions).toBeUndefined();
  });
});
