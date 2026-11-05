import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { NoteTitle } from "./NoteTitle";
import { useVaultStore } from "../vault/vaultStore";
import type { VaultEntry } from "../../domain/vault";

let root: Root | undefined, host: HTMLDivElement;
const entry: VaultEntry = { id: "Idea.md", path: "Idea.md", name: "Idea.md", extension: ".md", type: "file" };
beforeAll(() => { (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true; });
afterEach(async () => { if (root) await act(async () => root!.unmount()); host?.remove(); root = undefined; vi.restoreAllMocks(); useVaultStore.setState({ snapshot: undefined }); });
async function mount(disabled = false) {
  useVaultStore.setState({ snapshot: { name: "Test", root: [entry], scannedAt: 0, stats: { notes: 1, files: 1, boards: 0, directories: 0 } } });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<NoteTitle path="Idea.md" title="Idea" disabled={disabled} />));
  const rename = vi.spyOn(useVaultStore.getState(), "renameEntry").mockResolvedValue("Nuova.md");
  return rename;
}
async function edit(value: string) {
  await act(async () => host.querySelector<HTMLButtonElement>("button")!.click());
  const input = host.querySelector<HTMLInputElement>("input")!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value); input.dispatchEvent(new Event("input", { bubbles: true })); });
  return input;
}
async function submit() { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }
it("edits locally and renames only when confirmed, stripping the optional Markdown extension", async () => {
  const rename = await mount(); const input = await edit("Nuova.md");
  expect(document.activeElement).toBe(input); expect(rename).not.toHaveBeenCalled();
  await submit(); expect(rename).toHaveBeenCalledExactlyOnceWith(entry, "Nuova"); expect(host.querySelector("input")).toBeNull();
});
it("cancels with Escape and keeps locked titles unchanged", async () => {
  const rename = await mount(); const input = await edit("Altra");
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })));
  expect(rename).not.toHaveBeenCalled(); expect(host.textContent).toBe("Idea");
  await act(async () => root!.render(<NoteTitle path="Idea.md" title="Idea" disabled />));
  expect(host.querySelector<HTMLButtonElement>("button")!.disabled).toBe(true);
});
it("shows invalid names and collisions inline while retaining the draft for correction", async () => {
  const rename = await mount(); await edit("../Altra"); await submit();
  expect(rename).not.toHaveBeenCalled(); expect(host.querySelector('[role="alert"]')?.textContent).toContain("non validi");
  const input = host.querySelector<HTMLInputElement>("input")!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Esistente"); input.dispatchEvent(new Event("input", { bubbles: true })); });
  rename.mockRejectedValue(new Error("Esiste già una nota con questo nome.")); await submit();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain("Esiste già"); expect(input.value).toBe("Esistente");
});
it("confirms on blur and ignores repeated submissions during the same rename", async () => {
  const rename = await mount(); const input = await edit("Nuova");
  let resolve: (path: string) => void = () => {};
  rename.mockImplementation(() => new Promise(done => { resolve = done; }));
  await act(async () => input.blur());
  await submit(); expect(rename).toHaveBeenCalledTimes(1);
  await act(async () => resolve("Nuova.md")); expect(host.querySelector("input")).toBeNull();
});
