import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { VaultEntry } from "../../domain/vault";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { FileTree } from "./FileTree";

const entries: VaultEntry[] = [
  { id: "Progetti", name: "Progetti", path: "Progetti", type: "directory", extension: "", children: [] },
  { id: "Nota.md", name: "Nota.md", path: "Nota.md", type: "file", extension: ".md", size: 10 },
];

let host: HTMLDivElement | undefined;

afterEach(() => {
  host?.remove();
  host = undefined;
  useWorkspaceStore.getState().resetDocuments();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("FileTree", () => {
  it("hides attachments directories and children without changing the Vault entries", async () => {
    host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
    const attachments: VaultEntry = { id: "attachments", path: "attachments", name: "attachments", type: "directory", extension: "", children: [{ id: "photo", path: "attachments/photo.png", name: "photo.png", type: "file", extension: ".png" }] };
    const tree = [attachments, { ...entries[0]!, children: [{ ...attachments, id: "nested", path: "Progetti/attachments" }, entries[1]!] }];
    await act(async () => root.render(<FileTree entries={tree} vaultRevision={1} onAction={() => {}} />));
    expect(host.textContent).not.toContain("attachments"); expect(host.textContent).not.toContain("photo.png");
    expect(host.textContent).toContain("Progetti"); expect(host.textContent).toContain("Nota");
    expect(host.querySelector(".tree-count")!.textContent).toBe("1"); expect(attachments.children).toHaveLength(1);
    await act(async () => root.unmount());
  });
  it("selects folders and exposes entry actions from the accessible menu", async () => {
    host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    const onAction = vi.fn();
    await act(async () => root.render(<FileTree entries={entries} vaultRevision={1} onAction={onAction} />));

    const folderButton = Array.from(host.querySelectorAll("button")).find((button) => button.textContent?.includes("Progetti"));
    await act(async () => folderButton?.click());
    expect(useWorkspaceStore.getState().selectedEntry?.path).toBe("Progetti");

    expect(host.textContent).toContain("Nota");
    expect(host.textContent).not.toContain("Nota.md");

    const menuButton = host.querySelector<HTMLButtonElement>('button[aria-label="Azioni per Nota"]');
    await act(async () => menuButton?.click());
    expect(host.querySelector('[role="menu"]')).not.toBeNull();

    const renameButton = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
      .find((button) => button.textContent?.includes("Rinomina"));
    await act(async () => renameButton?.click());
    expect(onAction).toHaveBeenCalledWith({ type: "rename", entry: entries[1] });

    await act(async () => menuButton?.click());
    const duplicate = [...host.querySelectorAll<HTMLButtonElement>('[role="menuitem"]')].find(button => button.textContent?.includes("Duplica nota"));
    await act(async () => duplicate?.click());
    expect(onAction).toHaveBeenCalledWith({ type: "duplicate", entry: entries[1] });
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Azioni per Progetti"]')!.click());
    expect(host.textContent).not.toContain("Duplica nota");

    await act(async () => root.unmount());
  });
});


it("keeps nested expansion and scroll across refresh, remount and Vault changes", async () => {
  host = document.createElement("div"); host.className = "explorer-scroll"; document.body.append(host);
  const root = createRoot(host);
  const nested: VaultEntry = { ...entries[0]!, id: "Progetti/Sub", name: "Sub", path: "Progetti/Sub", children: [entries[1]!] };
  const tree = [{ ...entries[0]!, children: [nested] }];
  const render = async (vaultId: string, revision = 1) => act(async () => root.render(<FileTree entries={structuredClone(tree)} vaultId={vaultId} vaultRevision={revision} onAction={() => {}} />));
  const folder = (name: string) => [...host!.querySelectorAll<HTMLButtonElement>(".tree-row-main")].find(button => button.textContent?.startsWith(name))!;
  await render("vault-one");
  await act(async () => folder("Sub").click());
  expect(folder("Sub").getAttribute("aria-expanded")).toBe("true");
  await act(async () => folder("Progetti").click());
  await render("vault-one", 2);
  expect(folder("Progetti").getAttribute("aria-expanded")).toBe("false");
  host.scrollTop = 220; window.dispatchEvent(new Event("pagehide"));
  await act(async () => root.render(null));
  host.scrollTop = 0;
  await render("vault-one", 3);
  expect(host.scrollTop).toBe(220);
  expect(folder("Progetti").getAttribute("aria-expanded")).toBe("false");
  await act(async () => folder("Progetti").click());
  expect(folder("Sub").getAttribute("aria-expanded")).toBe("true");
  await render("vault-two");
  expect(folder("Progetti").getAttribute("aria-expanded")).toBe("true");
  expect(folder("Sub").getAttribute("aria-expanded")).toBe("false");
  await render("vault-one");
  expect(folder("Sub").getAttribute("aria-expanded")).toBe("true");
  await act(async () => root.unmount());
});

it("keeps folders usable with corrupt or unavailable browser storage", async () => {
  localStorage.setItem("nebula.explorer.v1:broken", '{"expanded":false}');
  host = document.createElement("div"); document.body.append(host); const root = createRoot(host);
  await act(async () => root.render(<FileTree entries={entries} vaultId="broken" vaultRevision={1} onAction={() => {}} />));
  const folder = host.querySelector<HTMLButtonElement>(".tree-row-main")!;
  expect(folder.getAttribute("aria-expanded")).toBe("true");
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
  await act(async () => folder.click());
  expect(folder.getAttribute("aria-expanded")).toBe("false");
  await act(async () => root.unmount());
});
