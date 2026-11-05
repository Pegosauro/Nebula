import { act, createRef, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { forceParsing } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import CodeMirrorEditor from "./CodeMirrorEditor";
import MarkdownEditorView from "./MarkdownEditorView";
import * as pagePdf from "./exportPagePdf";
import { NoteLinkPreview } from "./NoteLinkPreview";
import type { EditorApi } from "./editorCommands";
import { clearEditorMemories } from "./editorSessionCache";
import { SettingsView } from "../settings/SettingsView";
import { useSettingsStore } from "../settings/settingsStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useDocumentStore } from "./documentStore";
import { vaultService } from "../vault/vaultService";

let root: Root | undefined, host: HTMLDivElement | undefined;
beforeAll(() => {
  vi.stubGlobal("__APP_VERSION__", "test");
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 100, 20);
  Element.prototype.scrollIntoView = () => {};
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount()); host?.remove(); root = undefined; host = undefined;
  useDocumentStore.getState().reset(); useWorkspaceStore.getState().resetDocuments(); clearEditorMemories();
  useSettingsStore.setState({ editorFontSize: 17, editorPageWidth: 780, editorFullWidth: false, showMarkdownAtCursor: true });
  useKnowledgeStore.setState({ documents: {}, suggestions: [] }); vi.restoreAllMocks(); vi.useRealTimers();
});
function mount() { host = document.createElement("div"); document.body.append(host); root = createRoot(host); }
function pointer(element: Element, type: string, options: MouseEventInit = {}) { element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 30, clientY: 30, ...options })); }

it("updates and persists page appearance in both writing and locked reading without editing the file", async () => {
  const content = "# Nota\n\nTesto";
  vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Nota.md", content, size: content.length, lastModified: 1 });
  useWorkspaceStore.setState({ tabs: [{ id: "n", kind: "document", title: "Nota", path: "Nota.md", extension: ".md" }], activeTabId: "n" });
  mount(); await act(async () => root!.render(<MarkdownEditorView />));
  await act(async () => { await vi.waitFor(() => expect(host!.querySelector('.editor-appearance button')).toBeTruthy()); });
  await act(async () => host!.querySelector<HTMLButtonElement>('.editor-appearance button')!.click());
  const font = host!.querySelector<HTMLInputElement>('[aria-label="Dimensione del testo"]')!;
  const width = host!.querySelector<HTMLInputElement>('[aria-label="Larghezza della pagina"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(font, "22"); font.dispatchEvent(new Event("input", { bubbles: true }));
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(width, "1000"); width.dispatchEvent(new Event("input", { bubbles: true }));
  });
  const page = host!.querySelector<HTMLElement>(".editor-v2")!;
  expect(page.style.getPropertyValue("--note-font-size")).toBe("1.375rem");
  expect(page.style.getPropertyValue("--note-width")).toBe("1000px");
  expect(JSON.parse(localStorage.getItem("nebula.settings.v1")!).state.editorFontSize).toBe(22);
  await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Chiudi aspetto pagina"]')!.click());
  await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Blocca pagina"]')!.click());
  await act(async () => host!.querySelector<HTMLButtonElement>('.editor-appearance button')!.click());
  await act(async () => host!.querySelector<HTMLInputElement>('.appearance-full-width input')!.click());
  expect(page.style.getPropertyValue("--note-width")).toBe("100%");
  expect(host!.querySelector<HTMLInputElement>('[aria-label="Larghezza della pagina"]')!.disabled).toBe(true);
  expect(useDocumentStore.getState().sessions["Nota.md"]!.content).toBe(content);
  expect(host!.querySelector('[aria-label="Sblocca pagina"]')).toBeTruthy();
});

it("opens live note and web links on a single click but preserves drag selection and Alt-click editing", async () => {
  mount(); const api = createRef<EditorApi>(), open = vi.fn(), external = vi.spyOn(window, "open").mockReturnValue(null);
  const content = "Intro [[Destinazione]] e [Web](https://example.com).";
  await act(async () => root!.render(<CodeMirrorEditor path="A.md" value={content} source={false} visible apiRef={api} onChange={() => {}} onSave={() => {}} onOpenLink={open} onImages={() => {}} onPanel={() => {}} onUiChange={() => {}} suggestions={[]} />));
  const link = host!.querySelector<HTMLElement>("[data-live-target]")!;
  const view = EditorView.findFromDOM(host!.querySelector<HTMLElement>(".cm-editor")!)!;
  await act(async () => { pointer(link, "pointerdown"); pointer(link, "pointermove", { clientX: 70 }); pointer(link, "pointerup", { clientX: 70 }); });
  expect(open).not.toHaveBeenCalled();
  await act(async () => { pointer(link, "pointerdown", { altKey: true }); pointer(link, "pointerup", { altKey: true }); });
  expect(open).not.toHaveBeenCalled();
  await act(async () => { pointer(link, "pointerdown"); pointer(link, "pointerup"); });
  expect(open).toHaveBeenCalledExactlyOnceWith("Destinazione");
  const web = host!.querySelector<HTMLElement>("[data-live-href]")!;
  await act(async () => { pointer(web, "pointerdown"); pointer(web, "pointerup"); });
  expect(external).toHaveBeenCalledExactlyOnceWith("https://example.com", "_blank", "noopener,noreferrer");
  expect(view.state.doc.toString()).toBe(content);
});

function PreviewHarness() {
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref}><span data-live-target="A">A</span><a href="B.md">B</a><span data-live-target="Manca">Manca</span><a href="https://example.com/web.md">Web</a><NoteLinkPreview root={ref} sourcePath="Origine.md" /></div>;
}
async function previews() {
  vi.useFakeTimers();
  useKnowledgeStore.setState({ documents: Object.fromEntries(["A.md", "B.md"].map(path => [path, { path, aliases: [], outgoing: [], incoming: [] }])) });
  mount(); await act(async () => root!.render(<PreviewHarness />));
}
async function hover(selector: string) { await act(async () => { pointer(host!.querySelector(selector)!, "pointerover"); await vi.advanceTimersByTimeAsync(360); }); }

describe("note hover preview", () => {
  it("shows the unsaved draft without opening a session and removes executable HTML and media", async () => {
    await previews(); const read = vi.spyOn(vaultService, "readText");
    useDocumentStore.setState({ sessions: { "A.md": { path: "A.md", loaded: true, content: '**Bozza corrente**\n\n<img src="https://example.com/photo.jpg"><script>bad()</script>', savedContent: "Vecchia", size: 7, lastModified: 1, status: "dirty" } } });
    await hover('[data-live-target="A"]');
    expect(document.querySelector('[role="tooltip"]')!.textContent).toContain("Bozza corrente");
    expect(document.querySelector('[role="tooltip"] img, [role="tooltip"] script')).toBeNull();
    expect(read).not.toHaveBeenCalled();
    await act(async () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });
  it("ignores an earlier slow read after moving to another note", async () => {
    await previews(); let resolveA: (value: { path: string; content: string; size: number; lastModified: number }) => void = () => {};
    vi.spyOn(vaultService, "readText").mockImplementation(path => path === "A.md" ? new Promise(resolve => { resolveA = resolve; }) : Promise.resolve({ path, content: "Contenuto B", size: 11, lastModified: 1 }));
    await hover('[data-live-target="A"]'); await hover('a[href="B.md"]');
    expect(document.querySelector('[role="tooltip"]')!.textContent).toContain("Contenuto B");
    await act(async () => resolveA({ path: "A.md", content: "Risposta A tardiva", size: 17, lastModified: 1 }));
    expect(document.querySelector('[role="tooltip"]')!.textContent).not.toContain("Risposta A tardiva");
    await act(async () => window.dispatchEvent(new Event("resize")));
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
  });
  it("does not read unresolved or external targets and shows a useful missing-note message", async () => {
    await previews(); const read = vi.spyOn(vaultService, "readText");
    await hover('[data-live-target="Manca"]'); expect(document.querySelector('[role="tooltip"]')!.textContent).toContain("non esiste ancora");
    await hover('a[href^="https:"]'); expect(document.querySelector('[role="tooltip"]')).toBeNull();
    expect(read).not.toHaveBeenCalled();
  });
});


it("exports current unsaved page content in both writing and locked reading without modifying it",async()=>{
  const content="# Nota\n\nVersione su disco";
  vi.spyOn(vaultService,"readText").mockResolvedValue({path:"Nota.md",content,size:content.length,lastModified:1});
  const exporter=vi.spyOn(pagePdf,"exportPagePdf").mockResolvedValue(0);
  useWorkspaceStore.setState({tabs:[{id:"n",kind:"document",title:"Nota",path:"Nota.md",extension:".md"}],activeTabId:"n"});
  mount();await act(async()=>root!.render(<MarkdownEditorView/>));
  await act(async()=>{await vi.waitFor(()=>expect(host!.querySelector('[aria-label="Esporta pagina in PDF"]')).toBeTruthy());});
  const updated="# Nota\n\nUltima modifica non salvata";
  await act(async()=>useDocumentStore.getState().updateContent("Nota.md",updated));
  await act(async()=>host!.querySelector<HTMLButtonElement>('[aria-label="Esporta pagina in PDF"]')!.click());
  expect(exporter).toHaveBeenLastCalledWith(updated,"Nota","Nota.md");
  await act(async()=>host!.querySelector<HTMLButtonElement>('[aria-label="Blocca pagina"]')!.click());
  await act(async()=>host!.querySelector<HTMLButtonElement>('[aria-label="Esporta pagina in PDF"]')!.click());
  expect(exporter).toHaveBeenCalledTimes(2);
  expect(useDocumentStore.getState().sessions["Nota.md"]!.content).toBe(updated);
  expect(useDocumentStore.getState().sessions["Nota.md"]!.savedContent).toBe(content);
});


it("persists the cursor syntax preference and applies it without replacing the editor or undo history", async () => {
  const content = "# Titolo\n\n**Testo** e [Link](https://example.com)\n\n- [ ] Fare";
  vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Nota.md", content, size: content.length, lastModified: 1 });
  useWorkspaceStore.setState({ tabs: [{ id: "n", kind: "document", title: "Nota", path: "Nota.md", extension: ".md" }], activeTabId: "n" });
  mount(); await act(async () => root!.render(<><SettingsView /><MarkdownEditorView /></>));
  const view = EditorView.findFromDOM(host!.querySelector<HTMLElement>(".cm-editor")!)!;
  await act(async () => { forceParsing(view, view.state.doc.length); view.dispatch({ selection: { anchor: content.indexOf("Testo") + 2 } }); });
  expect(host!.querySelector(".cm-content")!.textContent).toContain("**Testo**");
  const setting = [...host!.querySelectorAll("label")].find(label => label.textContent?.includes("Mostra sintassi Markdown al cursore"))!.querySelector<HTMLInputElement>("input")!;
  await act(async () => setting.click());
  expect(useSettingsStore.getState().showMarkdownAtCursor).toBe(false);
  expect(JSON.parse(localStorage.getItem("nebula.settings.v1")!).state.showMarkdownAtCursor).toBe(false);
  expect(EditorView.findFromDOM(host!.querySelector<HTMLElement>(".cm-editor")!)).toBe(view);
  for (const anchor of [0, content.indexOf("Testo") + 2, content.indexOf("Link") + 2, content.indexOf("[ ]") + 1]) {
    await act(async () => view.dispatch({ selection: { anchor } }));
    expect(host!.querySelector(".cm-content")!.textContent).not.toMatch(/\*\*|https:|\[ \]|# Titolo/);
  }
  const at = content.indexOf("Testo") + 2;
  await act(async () => view.dispatch({ changes: { from: at, insert: "x" }, selection: { anchor: at + 1 }, userEvent: "input" }));
  expect(view.state.doc.toString()).toContain("**Texsto**");
  await act(async () => setting.click());
  expect(host!.querySelector(".cm-content")!.textContent).toContain("**Texsto**");
  await act(async () => host!.querySelector<HTMLElement>(".cm-content")!.dispatchEvent(new KeyboardEvent("keydown", { key: "z", code: "KeyZ", ctrlKey: true, bubbles: true, cancelable: true })));
  expect(view.state.doc.toString()).toBe(content);
  await act(async () => setting.click());
  await act(async () => [...host!.querySelectorAll<HTMLButtonElement>(".editor-mode button")].find(b => b.textContent === "Sorgente")!.click());
  expect(host!.querySelector(".cm-content")!.textContent).toContain("**Testo**");
});
