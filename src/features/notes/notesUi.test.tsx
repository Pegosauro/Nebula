import { act, createRef, Profiler, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { EditorView } from "@codemirror/view";
import MarkdownEditorView from "../editor/MarkdownEditorView";
import CodeMirrorEditor from "../editor/CodeMirrorEditor";
import type { EditorApi } from "../editor/editorCommands";
import { QuickNoteDialog } from "./QuickNoteDialog";
import { QuickNoteOrganizer } from "./QuickNoteOrganizer";
import * as quickNotes from "./quickNotes";
import { useDocumentStore } from "../editor/documentStore";
import { clearEditorMemories } from "../editor/editorSessionCache";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useSettingsStore } from "../settings/settingsStore";
import { vaultService } from "../vault/vaultService";
import { AppHeader } from "../shell/AppHeader";
import { useVaultStore } from "../vault/vaultStore";
import { useQuickNoteUiStore } from "./quickNoteUiStore";
import type { VaultSnapshot } from "../../domain/vault";

let root: Root, host: HTMLDivElement;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 100, 20);
  Element.prototype.scrollIntoView = () => {};
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(async () => {
  if (root) await act(async () => root.unmount()); host?.remove();
  useDocumentStore.getState().reset(); clearEditorMemories(); useWorkspaceStore.getState().resetDocuments();
  useSettingsStore.setState({ showNotePropertiesByDefault: false }); useQuickNoteUiStore.getState().hide(); vi.restoreAllMocks();
});
async function mount(element: React.ReactNode) { host = document.createElement("div"); document.body.append(host); root = createRoot(host); await act(async () => root.render(element)); }
async function click(selector: string) { await act(async () => host.querySelector<HTMLButtonElement>(selector)!.click()); }
async function input(value: string) { const element = host.querySelector("textarea")!; await act(async () => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(element, value); element.dispatchEvent(new Event("input", { bubbles: true })); }); }
async function submit() { await act(async () => host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))); }

describe("note UI", () => {
  it("organizes the selected capture using current editor text, separately from the other captures", async () => {
    useVaultStore.setState({ status: "ready", snapshot: { name: "Test", root: [] } as unknown as VaultSnapshot });
    const first = quickNotes.quickNoteEntry("Primo", new Date(2026, 9, 1), "one");
    const second = quickNotes.quickNoteEntry("Secondo aggiornato", new Date(2026, 9, 1), "two");
    await mount(<QuickNoteOrganizer content={first + "\n" + second} onCompleted={vi.fn()} />);
    expect(host.querySelectorAll(".quick-note-capture")).toHaveLength(0);
    await act(async () => { const details = host.querySelector("details")!; details.open = true; details.dispatchEvent(new Event("toggle")); });
    expect(host.querySelectorAll(".quick-note-capture")).toHaveLength(2);
    await click('.quick-note-capture:nth-of-type(2) button');
    expect(host.querySelector("dialog")?.textContent).toContain("Secondo aggiornato");
    expect(host.querySelector("dialog")?.textContent).not.toContain("Primo");
    expect(host.querySelector<HTMLInputElement>("input")?.value).toBe("Secondo aggiornato");
  });
  it("opens properties only on request, hides them completely and remembers the choice per note", async () => {
    const content = '---\ntype: "procedura"\ncategory: "Officina"\n---\n# Nota\n\nTesto';
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Nota.md", content, size: content.length, lastModified: 1 });
    useSettingsStore.setState({ showNotePropertiesByDefault: false });
    useWorkspaceStore.setState({ tabs: [{ id: "n", kind: "document", title: "Nota", path: "Nota.md", extension: ".md" }], activeTabId: "n" });
    await mount(<MarkdownEditorView />);
    await act(async () => { await vi.waitFor(() => expect(host.querySelector(".editor-properties-toggle")).toBeTruthy()); });
    expect(host.querySelector(".note-properties")).toBeNull();
    await click(".editor-properties-toggle"); expect(host.querySelector(".note-properties")).toBeTruthy();
    expect([...host.querySelectorAll<HTMLInputElement>(".note-property input")].map(input => input.value)).toContain("Officina");
    await click('[aria-label="Nascondi proprietà"]'); expect(host.querySelector(".note-properties")).toBeNull();
    expect(useDocumentStore.getState().sessions["Nota.md"]!.content).toBe(content);
    await act(async () => root.render(null)); await act(async () => root.render(<MarkdownEditorView />));
    expect(host.querySelector(".note-properties")).toBeNull();
  });
  it("hides YAML in Scrivi and protects it from selecting/replacing the entire visible body", async () => {
    const api = createRef<EditorApi>(); let content = '---\ncategory: "Officina"\n---\n# Nota\n\nTesto';
    const render = async (source: boolean) => act(async () => root.render(<CodeMirrorEditor path="Nota.md" value={content} source={source} visible apiRef={api} onChange={value => { content = value; }} onSave={() => {}} onOpenLink={() => {}} onImages={() => {}} onPanel={() => {}} onUiChange={() => {}} suggestions={[]} />));
    await mount(null); await render(false);
    const view = EditorView.findFromDOM(host.querySelector<HTMLElement>(".cm-editor")!)!;
    expect(host.querySelector(".cm-content")!.textContent).not.toContain("Officina");
    expect(api.current!.getSelection().from).toBe(content.indexOf("# Nota"));
    await act(async () => { api.current!.select(0, content.length); api.current!.insert("Nuovo corpo"); });
    expect(content).toBe('---\ncategory: "Officina"\n---\nNuovo corpo');
    await act(async () => api.current!.undo()); expect(content).toContain("# Nota\n\nTesto");
    await render(true); expect(host.querySelector(".cm-content")!.textContent).toContain("Officina");
    await render(false); expect(view.state.doc.toString()).toContain("Officina");
    content = content.replace("Officina", "Magazzino"); await render(false);
    await act(async () => api.current!.undo()); expect(content).toContain("Officina"); expect(content).not.toContain("Magazzino");
  });
  it("provides a global capture button in files, graph, boards and settings", async () => {
    useVaultStore.setState({ status: "ready", snapshot: { root: [] } as unknown as VaultSnapshot });
    await mount(<AppHeader />);
    for (const activity of ["files", "search", "configurators", "recent", "settings"] as const) {
      await act(async () => useWorkspaceStore.getState().setActivity(activity));
      expect(host.querySelector<HTMLButtonElement>('[aria-label="Nota veloce"]')!.disabled).toBe(false);
    }
    await click('[aria-label="Nota veloce"]'); expect(host.querySelector("textarea")!.value).toBe("");
    await click('[aria-label="Chiudi nota veloce"]'); expect(host.querySelector("textarea")).toBeNull();
  });
  it("starts each capture blank, preserves text after failure, and prevents accidental discard", async () => {
    const save = vi.spyOn(quickNotes, "saveQuickNote").mockRejectedValueOnce(new Error("Disco non scrivibile")).mockResolvedValue(undefined);
    function Dialog() { const [open, setOpen] = useState(true); return <><button onClick={() => setOpen(true)}>Apri</button>{open && <QuickNoteDialog onClose={() => setOpen(false)} onSaved={() => setOpen(false)} />}</>; }
    await mount(<Dialog />);
    expect(host.querySelector("textarea")!.value).toBe(""); expect(host.querySelector("textarea")!.placeholder).toBe("");
    await input("Da conservare"); await submit();
    expect(host.querySelector("textarea")!.value).toBe("Da conservare"); expect(host.textContent).toContain("Disco non scrivibile");
    await click('[aria-label="Chiudi nota veloce"]'); expect(host.textContent).toContain("Scartare questo appunto");
    await submit(); expect(save).toHaveBeenCalledTimes(2); expect(save.mock.calls[0]?.[2]).toBe(save.mock.calls[1]?.[2]);
    expect(host.querySelector("textarea")).toBeNull(); await click("button"); expect(host.querySelector("textarea")!.value).toBe("");
  });
  it("types a long quick note without rerendering the dialog for every character and saves the latest value", async () => {
    const save = vi.spyOn(quickNotes, "saveQuickNote").mockResolvedValue(undefined);
    const renders = vi.fn();
    await mount(<Profiler id="quick-note" onRender={renders}><QuickNoteDialog onClose={vi.fn()} onSaved={vi.fn()} /></Profiler>);
    const field = host.querySelector("textarea")!;
    expect(document.activeElement).toBe(field);
    let text = "Appunto con misure e dettagli.\n".repeat(4000);
    await input(text);
    renders.mockClear();
    for (const character of "Scrittura continua con accenti: è, à, ù. 日本語.") { text += character; await input(text); }
    expect(renders).not.toHaveBeenCalled();
    expect(host.querySelector("textarea")).toBe(field);
    expect(field.value).toBe(text);
    await submit();
    expect(save.mock.calls[0]?.[0]).toBe(text);
  });
});
