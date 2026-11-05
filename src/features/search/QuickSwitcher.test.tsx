import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import { QuickSwitcher } from "./QuickSwitcher";
import { useSearchStore } from "./searchStore";
import { quickSearchClient } from "./quickSearchClient";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import type { SearchResult } from "../../domain/search";

let root: Root | undefined, host: HTMLDivElement;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  Element.prototype.scrollIntoView = () => {};
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount()); host?.remove(); root = undefined;
  vi.restoreAllMocks(); vi.useRealTimers(); useSearchStore.getState().reset(); useVaultStore.setState({ snapshot: undefined });
});
async function mount() {
  vi.useFakeTimers();
  vi.spyOn(quickSearchClient, "replace").mockImplementation(() => {});
  const search = vi.spyOn(quickSearchClient, "search").mockImplementation(async query => query ? [{ path: `${query}.md`, title: query, breadcrumb: "Vault", snippet: "", aliases: [], tags: [], score: 1, match: "title" } satisfies SearchResult] : []);
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<QuickSwitcher />));
  await act(async () => useSearchStore.getState().openQuickSwitcher()); search.mockClear();
  return { search, input: host.querySelector<HTMLInputElement>("input")! };
}
async function type(input: HTMLInputElement, value: string) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
it("updates input immediately, coalesces typing, and cancels work when dismissed", async () => {
  const { search, input } = await mount();
  await type(input, "A"); await type(input, "Al"); await type(input, "Alpha");
  expect(input.value).toBe("Alpha"); expect(search).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(60));
  expect(search).toHaveBeenCalledTimes(1); expect(host.querySelector('[role="option"]')?.textContent).toContain("Alpha");
  await type(input, "Beta");
  await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Chiudi Quick Switcher"]')!.click());
  await act(async () => vi.advanceTimersByTime(100));
  expect(search).toHaveBeenCalledTimes(1); expect(host.querySelector("dialog")).toBeNull();
});
it("flushes the latest input on Enter instead of opening an older result", async () => {
  const { search, input } = await mount();
  const openEntry = vi.spyOn(useWorkspaceStore.getState(), "openEntry").mockImplementation(() => {});
  await act(async () => useVaultStore.setState({ snapshot: { root: [{ id: "Beta.md", name: "Beta.md", path: "Beta.md", extension: ".md", type: "file" }], name: "QA", scannedAt: 0, stats: { files: 1, notes: 1, directories: 0, boards: 0 } } }));
  await type(input, "Alpha"); await act(async () => vi.advanceTimersByTime(60));
  await type(input, "Beta");
  await act(async () => input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })));
  expect(search).toHaveBeenLastCalledWith("Beta", expect.any(Array), 30);
  expect(openEntry).toHaveBeenCalledWith(expect.objectContaining({ path: "Beta.md" }));
  expect(host.querySelector("dialog")).toBeNull();
});
