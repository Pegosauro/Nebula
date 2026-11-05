import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { VaultOperationDialog } from "../explorer/VaultOperationDialog";
import { SaveTemplateDialog } from "./SaveTemplateDialog";
import { useVaultStore } from "../vault/vaultStore";
import { vaultService } from "../vault/vaultService";
import type { VaultSnapshot } from "../../domain/vault";

let root: Root;
let host: HTMLDivElement;
const snapshot: VaultSnapshot = { name: "Test", scannedAt: 1, stats: { files: 1, notes: 1, boards: 0, directories: 2 }, root: [
  { id: "Procedure", name: "Procedure", path: "Procedure", type: "directory", extension: "", children: [] },
  { id: "Modelli", name: "Modelli", path: "Modelli", type: "directory", extension: "", children: [
    { id: "Modelli/Mio.md", name: "Mio.md", path: "Modelli/Mio.md", type: "file", extension: ".md" },
  ] },
] };
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(async () => { if (root) await act(async () => root.unmount()); host?.remove(); vi.restoreAllMocks(); });
async function mount(element: React.ReactNode) { host = document.createElement("div"); document.body.append(host); root = createRoot(host); await act(async () => root.render(element)); }
async function select(label: string, value: string) {
  const element = [...host.querySelectorAll("label")].find(item => item.firstChild?.textContent === label)!.querySelector("select")!;
  await act(async () => { element.value = value; element.dispatchEvent(new Event("change", { bubbles: true })); });
}
async function input(value: string) { const element = host.querySelector("input")!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }); }
async function submit() { await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }); }

describe("template dialogs", () => {
  it("converts a single capture to a procedure in the selected folder without writing the sheet", async () => {
    const original = useVaultStore.getState().createNote;
    const createNote = vi.fn().mockResolvedValue("Procedure/Controllo.md"); useVaultStore.setState({ createNote });
    const write = vi.spyOn(vaultService, "writeText");
    try {
      await mount(<VaultOperationDialog request={{ type: "create-note", parentPath: "", initialTemplateId: "procedure", quickNote: { id: "one", timestamp: "01/10/2026 · 09:02:03", text: "Controllare il fissaggio\n\n{{titolo}}" } }} snapshot={snapshot} onClose={vi.fn()} onCompleted={vi.fn()} />);
      await input("Controllo"); await select("Cartella di destinazione", "Procedure"); await submit();
      await act(async () => { await vi.waitFor(() => expect(createNote).toHaveBeenCalled()); });
      expect(createNote).toHaveBeenCalledWith("Procedure", "Controllo", true, expect.stringContaining("## Appunto di partenza"));
      expect(createNote.mock.calls[0][3]).toContain("Controllare il fissaggio\n\n{{titolo}}");
      expect(write).not.toHaveBeenCalled();
    } finally { useVaultStore.setState({ createNote: original }); }
  });
  it("keeps a capture available after a name collision and can retry as a free note", async () => {
    const original = useVaultStore.getState().createNote;
    const createNote = vi.fn().mockRejectedValueOnce(new Error("Esiste già un elemento")).mockResolvedValue("Nuovo.md");
    useVaultStore.setState({ createNote }); const close = vi.fn();
    try {
      await mount(<VaultOperationDialog request={{ type: "create-note", parentPath: "", quickNote: { id: "one", timestamp: "01/10/2026 · 09:02:03", text: "Testo da conservare" } }} snapshot={snapshot} onClose={close} onCompleted={vi.fn()} />);
      await submit(); expect(close).not.toHaveBeenCalled(); expect(host.textContent).toContain("Testo da conservare");
      await input("Nuovo"); await submit();
      expect(createNote.mock.calls[1][3]).toContain("# Nuovo\n"); expect(createNote.mock.calls[1][3]).toContain("Testo da conservare"); expect(close).toHaveBeenCalledOnce();
    } finally { useVaultStore.setState({ createNote: original }); }
  });
  it("creates a complete built-in in the chosen folder and opens it", async () => {
    const createNote = vi.fn().mockResolvedValue("Procedure/Test.md");
    const original = useVaultStore.getState().createNote; useVaultStore.setState({ createNote });
    const completed = vi.fn(); const close = vi.fn();
    try {
      await mount(<VaultOperationDialog request={{ type: "create-note", parentPath: "" }} snapshot={snapshot} onClose={close} onCompleted={completed} />);
      await select("Modello", "procedure"); await input("Test"); await select("Cartella di destinazione", "Procedure"); await submit();
      expect(createNote).toHaveBeenCalledWith("Procedure", "Test", true, expect.stringContaining("## Controlli finali"));
      expect(createNote.mock.calls[0][3]).toContain("# Test");
      expect(close).toHaveBeenCalled(); expect(completed).toHaveBeenCalled();
    } finally { useVaultStore.setState({ createNote: original }); }
  });
  it("keeps the form and user's choices when creation fails", async () => {
    const original = useVaultStore.getState().createNote;
    useVaultStore.setState({ createNote: vi.fn().mockRejectedValue(new Error("Esiste già un elemento")) });
    const close = vi.fn();
    try {
      await mount(<VaultOperationDialog request={{ type: "create-note", parentPath: "Procedure" }} snapshot={snapshot} onClose={close} onCompleted={vi.fn()} />);
      await input("Test"); await submit();
      expect(host.querySelector('[role="alert"]')?.textContent).toContain("Esiste già");
      expect(host.querySelector("input")?.value).toBe("Test"); expect(close).not.toHaveBeenCalled();
    } finally { useVaultStore.setState({ createNote: original }); }
  });
  it("loads a personal model and retains its local images", async () => {
    vi.spyOn(vaultService, "readText").mockResolvedValue({ content: "# Mio\n\n![Foto](../attachments/foto.png)", path: "Modelli/Mio.md", size: 1, lastModified: 1 });
    const original = useVaultStore.getState().createNote;
    const createNote = vi.fn().mockResolvedValue("Test.md"); useVaultStore.setState({ createNote });
    try {
      await mount(<VaultOperationDialog request={{ type: "create-note", parentPath: "" }} snapshot={snapshot} onClose={vi.fn()} onCompleted={vi.fn()} />);
      await select("Modello", "personal:Modelli/Mio.md");
      await act(async () => { await import("./preparePersonalTemplate"); });
      await input("Test"); await submit();
      expect(createNote).toHaveBeenCalledWith("", "Test", true, "# Test\n\n![Foto](/attachments/foto.png)");
    } finally { useVaultStore.setState({ createNote: original }); }
  });
  it("does not silently create an empty note when a personal model cannot be read", async () => {
    vi.spyOn(vaultService, "readText").mockRejectedValue(new Error("Modello non disponibile"));
    await mount(<VaultOperationDialog request={{ type: "create-note", parentPath: "" }} snapshot={snapshot} onClose={vi.fn()} onCompleted={vi.fn()} />);
    await select("Modello", "personal:Modelli/Mio.md"); await input("Test");
    expect(host.querySelector('[role="alert"]')?.textContent).toBe("Modello non disponibile");
    expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(true);
    await select("Modello", ""); expect(host.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });
  it("saves the current draft as a model without saving or replacing its source", async () => {
    const original = useVaultStore.getState().saveTemplate;
    const saveTemplate = vi.fn().mockResolvedValue("Modelli/Mio.md"); useVaultStore.setState({ saveTemplate });
    const onSaved = vi.fn();
    try {
      await mount(<SaveTemplateDialog title="Nota" content={"# Nota\nBozza corrente"} sourcePath="Procedure/Nota.md" hasUnsavedChanges onClose={vi.fn()} onSaved={onSaved} />);
      expect(host.textContent).toContain("modifiche attualmente presenti");
      await input("Mio"); await submit();
      expect(saveTemplate).toHaveBeenCalledWith("Mio", "# Nota\nBozza corrente", "Procedure/Nota.md");
      expect(onSaved).toHaveBeenCalledWith(expect.stringContaining("Modelli/Mio.md"));
    } finally { useVaultStore.setState({ saveTemplate: original }); }
  });
});
