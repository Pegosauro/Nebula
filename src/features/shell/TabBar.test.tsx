import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { TabBar } from "./TabBar";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useDocumentStore } from "../editor/documentStore";
import { vaultService } from "../vault/vaultService";

let root: Root | undefined, host: HTMLDivElement | undefined;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  host?.remove(); root = undefined; host = undefined;
  useWorkspaceStore.getState().resetDocuments(); useDocumentStore.getState().reset(); vi.restoreAllMocks();
});
async function mount(count: number) {
  useWorkspaceStore.getState().resetDocuments();
  const home = useWorkspaceStore.getState().tabs[0]!;
  const notes = Array.from({ length: count }, (_, index) => ({ id: `note-${index}`, kind: "document" as const, title: `Nota ${index}`, path: `Nota${index}.md`, extension: ".md" }));
  useWorkspaceStore.setState({ tabs: [home, ...notes], activeTabId: notes.at(-1)?.id ?? home.id });
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  await act(async () => root!.render(<TabBar />));
}
async function click(selector: string) {
  await act(async () => host!.querySelector<HTMLButtonElement>(selector)!.click());
}

describe("close all notes", () => {
  it.each([0, 1, 2, 4])("shows the red X on Inizio only with multiple notes (%s)", async count => {
    await mount(count);
    const button = host!.querySelector('[aria-label="Chiudi tutte le note"]');
    expect(Boolean(button)).toBe(count > 1);
    if (button) {
      expect(button.classList.contains("tab-close-all")).toBe(true);
      expect(button.closest(".document-tab")?.querySelector('[role="tab"]')?.textContent).toBe("Inizio");
    }
  });
  it("requires confirmation and leaves notes open on cancel or Escape", async () => {
    await mount(2); const flush = vi.spyOn(useDocumentStore.getState(), "flushPaths");
    await click('[aria-label="Chiudi tutte le note"]');
    expect(host!.querySelector("dialog")?.open).toBe(true);
    expect(useWorkspaceStore.getState().tabs).toHaveLength(3);
    await click('.vault-dialog-footer button[type="button"]');
    expect(host!.querySelector("dialog")).toBeNull();
    await click('[aria-label="Chiudi tutte le note"]');
    await act(async () => host!.querySelector("dialog")!.dispatchEvent(new Event("cancel", { bubbles: true, cancelable: true })));
    expect(host!.querySelector("dialog")).toBeNull();
    expect(useWorkspaceStore.getState().tabs).toHaveLength(3); expect(flush).not.toHaveBeenCalled();
  });
  it("saves dirty notes before closing all tabs and keeps their content", async () => {
    await mount(2);
    vi.spyOn(vaultService, "readText").mockImplementation(async path => ({ path, content: "originale", size: 9, lastModified: 1 }));
    const write = vi.spyOn(vaultService, "writeText").mockResolvedValue({ size: 5, lastModified: 2 });
    await useDocumentStore.getState().open("Nota0.md");
    await act(async () => useDocumentStore.getState().updateContent("Nota0.md", "bozza"));
    await click('[aria-label="Chiudi tutte le note"]'); await click('dialog button[type="submit"]');
    expect(write).toHaveBeenCalledWith("Nota0.md", "bozza", { size: 9, lastModified: 1 });
    expect(useDocumentStore.getState().sessions["Nota0.md"]?.savedContent).toBe("bozza");
    expect(useWorkspaceStore.getState().tabs.map(tab => tab.title)).toEqual(["Inizio"]);
    expect(useWorkspaceStore.getState().activeTabId).toBe("workspace-home");
    expect(host!.querySelector("dialog")).toBeNull();
    expect(host!.querySelector('[aria-label="Chiudi tutte le note"]')).toBeNull();
  });
  it("keeps every note open and shows an error when saving fails", async () => {
    await mount(2);
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Nota0.md", content: "originale", size: 9, lastModified: 1 });
    vi.spyOn(vaultService, "writeText").mockRejectedValue(new Error("Disco non disponibile"));
    await useDocumentStore.getState().open("Nota0.md");
    await act(async () => useDocumentStore.getState().updateContent("Nota0.md", "bozza"));
    await click('[aria-label="Chiudi tutte le note"]'); await click('dialog button[type="submit"]');
    expect(useWorkspaceStore.getState().tabs).toHaveLength(3);
    expect(useDocumentStore.getState().sessions["Nota0.md"]?.content).toBe("bozza");
    expect(host!.querySelector('[role="alert"]')?.textContent).toContain("Le note restano aperte");
    expect(host!.querySelector<HTMLButtonElement>('dialog button[type="submit"]')!.disabled).toBe(false);
  });
});
