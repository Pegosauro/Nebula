import { formatEdit } from "./markdownFormatting";
import { startCompletion, completionStatus, acceptCompletion } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import { taskMarkers, toggleMarkdownTask } from "./markdownTasks";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import MarkdownEditorView from "./MarkdownEditorView";
import { useDocumentStore } from "./documentStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { vaultService } from "../vault/vaultService";
import CodeMirrorEditor from "./CodeMirrorEditor";
import MarkdownPreview from "./MarkdownPreview";
import { clearEditorMemories, getEditorMemory } from "./editorSessionCache";
import { editorUiState, type EditorApi } from "./editorCommands";
import { findText, markdownTables, parseTsv, serializeTable, headingEntries } from "./markdownTools";
import { renderMarkdownSafe } from "../../infrastructure/markdown/renderMarkdown";
import { TablePanel } from "./EditorPanels";

let root: Root | undefined, host: HTMLDivElement | undefined;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 100, 20);
  Element.prototype.scrollIntoView = () => {};
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); host?.remove(); root = undefined; host = undefined; clearEditorMemories(); useDocumentStore.getState().reset(); useWorkspaceStore.getState().resetDocuments(); window.getSelection()?.removeAllRanges(); vi.restoreAllMocks(); });
function mountRoot() { host = document.createElement("div"); document.body.append(host); root = createRoot(host); return root; }

describe("editor continuity", () => {
  it("preserves undo and selection through source/preview toggles and remounting a note", async () => {
    mountRoot(); const api = createRef<EditorApi>(); let content = "# Titolo\n\nTesto";
    const onChange = (value: string) => { content = value; };
    const render = async (visible: boolean, source = false) => act(async () => root!.render(<CodeMirrorEditor path="A.md" value={content} visible={visible} source={source} onChange={onChange} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} apiRef={api} onUiChange={() => {}} onPanel={() => {}} onImages={() => {}} />));
    await render(true);
    await act(async () => { api.current!.select(content.length - 5, content.length); api.current!.format("bold"); });
    expect(content).toBe("# Titolo\n\n**Testo**");
    const selection = api.current!.getSelection();
    await render(false); await render(true, true);
    expect(api.current!.getSelection()).toEqual(selection);
    await act(async () => root!.render(null));
    expect(getEditorMemory("A.md")?.state).toBeTruthy();
    await render(true);
    expect(api.current!.getSelection()).toEqual(selection);
    await act(async () => api.current!.undo());
    expect(content).toBe("# Titolo\n\nTesto");
    await act(async () => api.current!.redo()); expect(content).toContain("**Testo**");
    // Updating from an interactive preview is also one reversible transaction.
    await act(async () => api.current!.replace(0, 1, "##"));
    await render(false); await render(true);
    await act(async () => api.current!.undo()); expect(content).toContain("# Titolo");
  });
  it("routes formatting shortcuts and inserts a table from Excel clipboard", async () => {
    mountRoot(); const api = createRef<EditorApi>(); let content = "abc";
    await act(async () => root!.render(<CodeMirrorEditor path="B.md" value={content} visible source={false} onChange={value => { content = value; }} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} apiRef={api} onUiChange={() => {}} onPanel={() => {}} onImages={() => {}} />));
    await act(async () => { api.current!.select(0, 3); host!.querySelector('[contenteditable="true"]')!.dispatchEvent(new KeyboardEvent("keydown", { key: "b", code: "KeyB", ctrlKey: true, bubbles: true, cancelable: true })); });
    expect(content).toBe("**abc**");
    await act(async () => { api.current!.select(content.length); const event = new Event("paste", { bubbles: true, cancelable: true }); Object.defineProperty(event, "clipboardData", { value: { files: [], getData: (kind: string) => kind === "text/plain" ? "Nome\tValore\nA\t10" : "<table></table>" } }); host!.querySelector('[contenteditable="true"]')!.dispatchEvent(event); });
    expect(markdownTables(content)[0]?.rows).toEqual([["Nome", "Valore"], ["A", "10"]]);
  });
  it("completes wikilinks with full paths and closing brackets, and exposes slash commands", async () => {
    mountRoot(); const api = createRef<EditorApi>(); let content = "[[Not"; const panel = vi.fn();
    await act(async () => root!.render(<CodeMirrorEditor path="C.md" value={content} visible source={false} onChange={value => { content = value; }} onSave={() => {}} onOpenLink={() => {}} suggestions={[{ path: "Progetti/Nota.md", label: "Nota", detail: "Progetti/Nota", aliases: [] }]} apiRef={api} onUiChange={() => {}} onPanel={panel} onImages={() => {}} />));
    const view = EditorView.findFromDOM(host!.querySelector<HTMLElement>(".cm-editor")!)!;
    await act(async () => { api.current!.select(content.length); startCompletion(view); });
    await act(async () => { await vi.waitFor(() => expect(completionStatus(view.state)).toBe("active")); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); expect(acceptCompletion(view)).toBe(true); });
    expect(content).toBe("[[Progetti/Nota]]");
    await act(async () => { api.current!.replace(0, content.length, "/tabella"); api.current!.select(content.length); startCompletion(view); });
    await act(async () => { await vi.waitFor(() => expect(completionStatus(view.state)).toBe("active")); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 100)); expect(acceptCompletion(view)).toBe(true); });
    expect(panel).toHaveBeenCalledWith("table"); expect(content).toBe("");
  });

});

describe("Markdown editing operations", () => {
  it.each([
    ["ciao ", 0, 5, "*ciao* "],
    [" ciao ", 0, 6, " *ciao* "],
    ["**ciao**", 2, 6, "***ciao***"],
    ["_ciao_", 1, 5, "ciao"],
    ["_ciao_", 0, 6, "ciao"],
    ["***ciao***", 3, 7, "**ciao**"],
    ["**_ciao_**", 3, 7, "**ciao**"],
    ["   ", 0, 3, "   "],
  ])("toggles italic in %j without losing whitespace or bold", (doc, from, to, expected) => {
    const edit = formatEdit(doc as string, from as number, to as number, "italic");
    expect((doc as string).slice(0, edit.from) + edit.insert + (doc as string).slice(edit.to)).toBe(expected);
  });
  it("toggles format without duplicating markers and toggles a multiline list", () => {
    expect(formatEdit("**ciao**", 2, 6, "italic").insert).toBe("*ciao*");
    expect(formatEdit("**ciao**", 2, 6, "bold")).toMatchObject({ from: 0, to: 8, insert: "ciao" });
    expect(formatEdit("prima\nseconda", 0, 13, "task").insert).toBe("- [ ] prima\n- [ ] seconda");
    expect(formatEdit("- [ ] prima\n- [x] seconda", 0, 26, "task").insert).toBe("prima\nseconda");
  });
  it("parses Excel quotes, multiline cells and escaped table pipes", () => {
    expect(parseTsv('Nome\tValore\r\n"A\nB"\t"x""y"\r\n')).toEqual([["Nome", "Valore"], ["A\nB", 'x"y']]);
    expect(serializeTable([["A", "B"], ["uno|due", "a\nb"]])).toContain("uno\\|due | a<br>b");
  });
  it("maps table and heading offsets to CRLF source and ignores fenced examples", () => {
    const source = "# Inizio\r\n\r\n```md\r\n| No | Tabella |\r\n|---|---|\r\n```\r\n\r\n## Dati\r\n\r\n| A | B |\r\n|---|---|\r\n| x | y |\r\n\r\nFine";
    const table = markdownTables(source)[0]!;
    expect(markdownTables(source)).toHaveLength(1);
    expect(source.slice(table.from, table.to)).toBe("| A | B |\r\n|---|---|\r\n| x | y |");
    expect(source.slice(headingEntries(source)[1]!.from)).toMatch(/^## Dati/);
  });
  it("only finds actual task markers, excluding code examples", () => {
    const source = "- [ ] Attività\n\n```\n- [ ] Esempio\n```\n\n    - [ ] Codice indentato\n\n- [x] Fatto";
    expect(taskMarkers(source).map(t => t.checked)).toEqual([false, true]);
  });
  it("searches literal punctuation and whole Unicode words", () => {
    expect(findText("a.b axb a.b", "a.b")).toHaveLength(2);
    expect(findText("nota annotazione NOTA", "nota", false, true)).toHaveLength(2);
    expect(findText("caffè caffèlatte", "caffè", false, true)).toHaveLength(1);
  });
});

describe("italic input", () => {
  it.each([false, true])("types and toggles italic with Ctrl+I in source=%s, with undo/redo", async source => {
    mountRoot(); const api = createRef<EditorApi>(); let content = "";
    await act(async () => root!.render(<CodeMirrorEditor path="Italic.md" value={content} visible source={source} onChange={value => { content = value; }} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} apiRef={api} onUiChange={() => {}} onPanel={() => {}} onImages={() => {}} />));
    const view = EditorView.findFromDOM(host!.querySelector<HTMLElement>(".cm-editor")!)!;
    const shortcut = () => view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "i", code: "KeyI", ctrlKey: true, bubbles: true, cancelable: true }));
    await act(async () => { api.current!.focus(); shortcut(); });
    expect(api.current!.getSelection().text).toBe("testo");
    await act(async () => view.dispatch(view.state.replaceSelection("caffè")));
    expect(content).toBe("*caffè*");
    expect(editorUiState(view).active).toContain("italic");
    if (!source) expect(host!.querySelector(".live-emphasis")).toBeTruthy();
    await act(async () => shortcut());
    expect(content).toBe("caffè");
    expect(api.current!.getSelection().from).toBe(5);
    await act(async () => api.current!.undo()); expect(content).toBe("*caffè*");
    await act(async () => api.current!.redo()); expect(content).toBe("caffè");
  });
  it("does not show italic as active on a bold-only selection", async () => {
    mountRoot(); const api = createRef<EditorApi>();
    await act(async () => root!.render(<CodeMirrorEditor path="Bold.md" value="**ciao**" visible source={false} onChange={() => {}} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} apiRef={api} onUiChange={() => {}} onPanel={() => {}} onImages={() => {}} />));
    const view = EditorView.findFromDOM(host!.querySelector<HTMLElement>(".cm-editor")!)!;
    await act(async () => api.current!.select(2, 6));
    expect(editorUiState(view).active).toContain("bold");
    expect(editorUiState(view).active).not.toContain("italic");
  });
});

describe("interactive preview", () => {
  it("toggles the correct checklist source and offers table editing", async () => {
    mountRoot(); const change = vi.fn(), editTable = vi.fn();
    const content = "```\n- [ ] esempio\n```\n\n- [ ] Fare\n\n| A | B |\n|---|---|\n| 1 | 2 |";
    await act(async () => root!.render(<MarkdownPreview sourcePath="A.md" content={content} onChange={change} onTable={editTable} />));
    const checkbox = host!.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
    expect(checkbox.disabled).toBe(false);
    await act(async () => checkbox.click());
    expect(change).toHaveBeenCalledWith(content.replace("[ ] Fare", "[x] Fare"));
    await act(async () => host!.querySelector<HTMLButtonElement>('button[data-table-index]')!.click());
    expect(editTable).toHaveBeenCalledWith(expect.objectContaining({ rows: [["A", "B"], ["1", "2"]] }));
  });
  it("renders highlights/callouts/images while preserving HTML safety", () => {
    const html = renderMarkdownSafe('==importante==\n\n> [!NOTE]\n> testo\n\n![foto](../attachments/foto.png)\n\n[Sito](https://example.com)\n\n<img src="data:text/html,x" onerror="alert(1)"><script>alert(1)</script>');
    expect(html).toContain("<mark>importante</mark>"); expect(html).toContain("markdown-callout");
    expect(html).toContain('data-nebula-image="../attachments/foto.png"'); expect(html).toContain('rel="noopener noreferrer"');
    expect(html).not.toContain("onerror"); expect(html).not.toContain("<script"); expect(html).not.toContain("data:text/html");
  });
  it("edits table cells and changes alignment before committing Markdown", async () => {
    mountRoot(); const save = vi.fn();
    await act(async () => root!.render(<TablePanel onClose={() => {}} onSave={save} />));
    const cell = host!.querySelector<HTMLInputElement>('input[aria-label="Riga 1 colonna 1"]')!;
    await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(cell, "Modificato"); cell.dispatchEvent(new Event("input", { bubbles: true })); });
    await act(async () => host!.querySelector<HTMLButtonElement>('button[aria-label="Allinea al centro"]')!.click());
    const button = [...host!.querySelectorAll("button")].find(b => b.textContent === "Inserisci tabella")!;
    await act(async () => button.click());
    expect(save).toHaveBeenCalledWith(expect.stringContaining("Modificato")); expect(save.mock.calls[0]![0]).toContain(":---:");
  });
});


describe("unified writing surface", () => {
  async function editor(content: string, onTable = vi.fn()) {
    mountRoot(); const api = createRef<EditorApi>(); const change = vi.fn();
    const render = async (source = false) => act(async () => root!.render(<CodeMirrorEditor path="Live.md" value={content} visible source={source} onChange={value => { content = value; change(value); }} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} apiRef={api} onUiChange={() => {}} onPanel={() => {}} onImages={() => {}} onTable={onTable} />));
    await render();
    const text = () => host!.querySelector(".cm-content")!.textContent!;
    const view = EditorView.findFromDOM(host!.querySelector<HTMLElement>(".cm-editor")!)!;
    return { api, text, render, view, change };
  }
  it("reveals only the caret's formatted span and hides every delimiter during selection", async () => {
    const content = "Piano **forte** e *calmo* e ==luce== e `codice`.";
    const { api, text, render, view } = await editor(content);
    expect(text()).toBe("Piano forte e calmo e luce e codice.");
    await act(async () => api.current!.select(content.indexOf("forte") + 2));
    expect(text()).toContain("**forte**"); expect(text()).not.toContain("*calmo*"); expect(text()).not.toContain("==");
    await act(async () => api.current!.select(content.indexOf("forte"), content.indexOf("luce") + 4));
    expect(text()).toBe("Piano forte e calmo e luce e codice.");
    expect(view.state.doc.toString()).toBe(content);
    await render(true); expect(text()).toBe(content);
    await render(false); expect(text()).toBe("Piano forte e calmo e luce e codice.");
  });
  it("keeps formatted selection rendered after toolbar operations and undo", async () => {
    const { api, text, view } = await editor("Prima parola dopo");
    await act(async () => { api.current!.select(6, 12); api.current!.format("bold"); });
    expect(view.state.doc.toString()).toBe("Prima **parola** dopo");
    expect(text()).toBe("Prima parola dopo");
    await act(async () => api.current!.undo()); expect(text()).toBe("Prima parola dopo");
    expect(view.state.doc.toString()).toBe("Prima parola dopo");
  });
  it("renders links, callouts, code and separators while leaving source intact", async () => {
    const content = "Introduzione\n\n[Visita](https://example.com) e [[Nota|alias]]\n\n> [!TIP]\n> Utile **qui**\n\n```js\nconst a = 1;\n```\n\n---";
    const { api, text, view } = await editor(content);
    expect(text()).toContain("Visita e alias"); expect(text()).not.toContain("https://");
    expect(text()).toContain("Suggerimento"); expect(text()).not.toContain("[!TIP]");
    expect(text()).toContain("const a = 1;"); expect(text()).not.toContain("```");
    expect(host!.querySelector(".live-divider")).toBeTruthy();
    await act(async () => api.current!.select(0, content.length));
    expect(text()).not.toContain("[!TIP]"); expect(text()).not.toContain("**");
    expect(view.state.doc.toString()).toBe(content);
  });
  it("keeps a visual table during selection with direct controls and no advanced popup", async () => {
    const content = "Dati\n\n| A | B |\n|---|---|\n| 1 | 2 |\n\nFine";
    const onTable = vi.fn(); const { api, text, view } = await editor(content, onTable);
    expect(host!.querySelectorAll(".live-table td")).toHaveLength(2);
    await act(async () => api.current!.select(0, content.length));
    expect(text()).not.toContain("|---|");
    expect(host!.querySelector('.live-table button[aria-label="Modifica tabella"]')).toBeNull();
    await act(async () => host!.querySelector<HTMLButtonElement>('.live-table button[aria-label="Seleziona colonna 1"]')!.click());
    expect(host!.querySelectorAll(".live-table .is-selected")).toHaveLength(2);
    expect(onTable).not.toHaveBeenCalled();
    expect(view.state.doc.toString()).toBe(content);
  });
  it("updates a checkbox in the live document and restores it with undo", async () => {
    const content = "Attività\n\n- [ ] Fare";
    const { api, view } = await editor(content);
    await act(async () => host!.querySelector<HTMLInputElement>(".live-task")!.click());
    expect(view.state.doc.toString()).toContain("[x] Fare");
    await act(async () => api.current!.undo()); expect(view.state.doc.toString()).toBe(content);
  });
});


describe("locked reading", () => {
  it("blocks all editor changes while preserving selection, external reloads and undo after unlock", async () => {
    mountRoot(); const api = createRef<EditorApi>(); const images = vi.fn(), panel = vi.fn();
    let content = "Nota\n\n- [ ] Fare\n\n| A | B |\n|---|---|\n| 1 | 2 |";
    const render = async (readOnly: boolean) => act(async () => root!.render(<CodeMirrorEditor path="Lock.md" value={content} visible readOnly={readOnly} source={false} apiRef={api} onChange={value => { content = value; }} onImages={images} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} onUiChange={() => {}} onPanel={panel} />));
    await render(false);
    await act(async () => { api.current!.select(0, 4); api.current!.format("bold"); });
    const edited = content;
    await render(true);
    const view = EditorView.findFromDOM(host!.querySelector<HTMLElement>(".cm-editor")!)!;
    expect(view.state.readOnly).toBe(true);
    expect(view.contentDOM.getAttribute("contenteditable")).toBe("false");
    expect(host!.querySelector<HTMLInputElement>(".live-task")!.disabled).toBe(true);
    expect(host!.querySelector(".live-table button")).toBeNull();
    await act(async () => {
      api.current!.select(0, 8); api.current!.format("italic"); api.current!.insert("NO"); api.current!.replace(0, 1, "NO"); api.current!.replaceAll([{ from: 0, to: 1, insert: "NO" }]); api.current!.undo(); api.current!.redo();
      view.dispatch({ changes: { from: 0, insert: "NO" }, userEvent: "input.type" });
      view.contentDOM.dispatchEvent(new KeyboardEvent("keydown", { key: "b", ctrlKey: true, bubbles: true, cancelable: true }));
      const paste = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(paste, "clipboardData", { value: { files: [new File(["x"], "photo.png", { type: "image/png" })] } });
      view.contentDOM.dispatchEvent(paste);
    });
    expect(content).toBe(edited); expect(images).not.toHaveBeenCalled(); expect(api.current!.getSelection().from).toBe(0);
    content = edited + "\nDal disco"; await render(true);
    expect(view.state.doc.toString()).toBe(content);
    await render(false); await act(async () => api.current!.insert("Sì")); expect(content).toContain("Sì");
    await act(async () => api.current!.undo()); expect(content).toBe(edited + "\nDal disco");
  });
  it("uses rendered text for selection/copy and disables preview controls", async () => {
    mountRoot(); const change = vi.fn(), edit = vi.fn();
    await act(async () => root!.render(<MarkdownPreview sourcePath="Lock.md" readOnly content={'# Titolo\n\n**Testo** e [Link](https://example.com)\n\n- [ ] Fare\n\n<div contenteditable="true">Testo HTML</div>\n\n| A | B |\n|---|---|\n| 1 | 2 |'} onChange={change} onTable={edit} />));
    const preview = host!.querySelector<HTMLElement>('[aria-label="Nota in sola lettura"]')!;
    expect(preview.querySelector("[contenteditable]")).toBeNull();
    expect(preview.querySelector<HTMLInputElement>("input")!.disabled).toBe(true);
    expect(preview.querySelector("button")).toBeNull();
    await act(async () => { preview.querySelector<HTMLInputElement>("input")!.click(); preview.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true, cancelable: true })); });
    expect(window.getSelection()!.toString()).toContain("Testo e Link");
    expect(window.getSelection()!.toString()).not.toContain("**");
    expect(change).not.toHaveBeenCalled(); expect(edit).not.toHaveBeenCalled();
  });
  it("locks the actual page, keeps it locked on return and restores writing controls on unlock", async () => {
    const content = "# Titolo\n\n**Testo**\n\n- [ ] Fare";
    vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Pagina.md", content, size: content.length, lastModified: 1 });
    useWorkspaceStore.setState({ tabs: [{ id: "document:Pagina.md", kind: "document", title: "Pagina", path: "Pagina.md", extension: ".md" }], activeTabId: "document:Pagina.md" });
    mountRoot(); await act(async () => root!.render(<MarkdownEditorView />));
    await act(async () => { await vi.waitFor(() => expect(host!.querySelector('[aria-label="Blocca pagina"]')).toBeTruthy()); });
    expect(host!.querySelector(".cm-activeLine")).toBeNull();
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Blocca pagina"]')!.click());
    await act(async () => { await vi.waitFor(() => expect(host!.querySelector('[aria-label="Nota in sola lettura"]')).toBeTruthy()); });
    expect(host!.querySelector('[aria-label="Formattazione nota"]')).toBeNull();
    expect(host!.querySelector<HTMLDivElement>(".editor-write-surface")!.hidden).toBe(true);
    expect([...host!.querySelectorAll<HTMLButtonElement>(".editor-mode button")].every(button => button.disabled)).toBe(true);
    expect(useDocumentStore.getState().sessions["Pagina.md"]!.content).toBe(content);
    await act(async () => root!.render(null)); await act(async () => root!.render(<MarkdownEditorView />));
    expect(host!.querySelector('[aria-label="Sblocca pagina"]')).toBeTruthy();
    await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Sblocca pagina"]')!.click());
    expect(host!.querySelector('[aria-label="Formattazione nota"]')).toBeTruthy();
    expect(host!.querySelector('[aria-label="Nota in sola lettura"]')).toBeNull();
    expect(host!.querySelector('[contenteditable="true"]')).toBeTruthy();
  });
});


it("allows only task toggles on a locked page, preserves focus, and saves through normal document handling", async () => {
  const content = "---\r\ntitle: Lista\r\n---\r\n# Attività\r\n\r\n```md\r\n- [ ] Esempio\r\n```\r\n\r\n- [ ] Fare\r\n  - [x] Sottoattività\r\n\r\n<input type=checkbox data-nebula-task=true data-task-index=0><input value=Protetto>";
  vi.spyOn(vaultService, "readText").mockResolvedValue({ path: "Lista.md", content, size: content.length, lastModified: 1 });
  useWorkspaceStore.setState({ tabs: [{ id: "n", kind: "document", title: "Lista", path: "Lista.md", extension: ".md" }], activeTabId: "n" });
  mountRoot(); await act(async () => root!.render(<MarkdownEditorView />));
  await act(async () => host!.querySelector<HTMLButtonElement>('[aria-label="Blocca pagina"]')!.click());
  await act(async () => { await vi.waitFor(() => expect(host!.querySelector(".markdown-preview input[data-task-index]")).toBeTruthy()); });
  const preview = host!.querySelector<HTMLElement>(".markdown-preview")!;
  const tasks = () => [...preview.querySelectorAll<HTMLInputElement>("input[data-task-index]")];
  expect(tasks()).toHaveLength(2);
  expect(tasks().every(input => !input.disabled && input.closest("li")!.classList.contains("nebula-task-item"))).toBe(true);
  expect([...preview.querySelectorAll<HTMLInputElement>("input:not([data-task-index])")].every(input => input.disabled)).toBe(true);
  await act(async () => tasks()[0]!.click());
  const changed = content.replace("- [ ] Fare", "- [x] Fare");
  expect(useDocumentStore.getState().sessions["Lista.md"]!.content).toBe(changed);
  expect(document.activeElement).toBe(tasks()[0]);
  const view = EditorView.findFromDOM(host!.querySelector<HTMLElement>(".cm-editor")!)!;
  expect(view.state.readOnly).toBe(true); expect(view.state.doc.toString()).toBe(changed.replaceAll("\r\n", "\n"));
  await act(async () => view.dispatch({ changes: { from: 0, insert: "vietato" } }));
  expect(view.state.doc.toString()).toBe(changed.replaceAll("\r\n", "\n"));
  const save = vi.spyOn(useDocumentStore.getState(), "save").mockResolvedValue();
  await act(async () => tasks()[0]!.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true, cancelable: true })));
  expect(save).toHaveBeenCalledWith("Lista.md");
  await act(async () => tasks()[0]!.click());
  expect(useDocumentStore.getState().sessions["Lista.md"]!.content).toBe(content);
  await act(async () => useDocumentStore.setState(state => ({ sessions: { ...state.sessions, "Lista.md": { ...state.sessions["Lista.md"]!, operationLocked: true } } })));
  expect(preview.querySelector<HTMLInputElement>("input[data-nebula-task]")!.disabled).toBe(true);
});

it("rejects attempts to toggle plain text or fenced examples", () => {
  const content = "- [ ] Fare\n\n```\n- [ ] Esempio\n```\n\nTesto [ ]";
  expect(toggleMarkdownTask(content, content.indexOf("[ ]"), true)).toContain("- [x] Fare");
  expect(toggleMarkdownTask(content, content.lastIndexOf("[ ]"), true)).toBe(content);
  expect(toggleMarkdownTask(content, content.indexOf("[ ] Esempio"), true)).toBe(content);
});
