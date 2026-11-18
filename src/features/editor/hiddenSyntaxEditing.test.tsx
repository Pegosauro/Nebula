import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, expect, it } from "vitest";
import { EditorView } from "@codemirror/view";
import { forceParsing } from "@codemirror/language";
import CodeMirrorEditor from "./CodeMirrorEditor";
import { clearEditorMemories } from "./editorSessionCache";
import type { EditorApi } from "./editorCommands";

let root: Root | undefined, host: HTMLDivElement;
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 100, 20);
  Element.prototype.scrollIntoView = () => {};
});
afterEach(async () => { if (root) await act(async () => root!.unmount()); host?.remove(); root = undefined; clearEditorMemories(); });
async function editor(content: string, source = false, reveal = false) {
  host = document.createElement("div"); document.body.append(host); root = createRoot(host);
  const api = createRef<EditorApi>();
  await act(async () => root!.render(<CodeMirrorEditor path="N.md" value={content} source={source} visible showMarkdownAtCursor={reveal} apiRef={api} onChange={() => {}} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} onUiChange={() => {}} onPanel={() => {}} onImages={() => {}} />));
  const view = EditorView.findFromDOM(host.querySelector<HTMLElement>(".cm-editor")!)!;
  await act(async () => { forceParsing(view, view.state.doc.length); view.dispatch({ selection: { anchor: content.length } }); });
  return { view, api };
}
async function key(key: string, ctrlKey = false) { await act(async () => host.querySelector(".cm-content")!.dispatchEvent(new KeyboardEvent("keydown", { key, code: key, ctrlKey, bubbles: true, cancelable: true }))); }

it.each(["**testo**", "*testo*", "~~testo~~", "`testo`", "***testo***", "==testo==", "[testo](https://example.com)", "[[Nota|testo]]"])("deletes visible text beside %s without damaging its formatting", async formatted => {
  const { view, api } = await editor(formatted + " X");
  await key("Backspace"); await key("Backspace");
  expect(view.state.doc.toString()).toBe(formatted);
  await key("Backspace");
  expect(view.state.doc.toString()).toBe(formatted.replace("testo", "test"));
  await act(async () => api.current!.undo());
  expect(view.state.doc.toString()).toContain("testo");
});
it("skips hidden delimiters with arrows and forward deletion", async () => {
  const { view } = await editor("**testo** dopo");
  await act(async () => view.dispatch({ selection: { anchor: 2 } }));
  await key("ArrowLeft"); expect(view.state.selection.main.head).toBe(0);
  await key("ArrowRight"); expect(view.state.selection.main.head).toBe(2);
  await key("Delete"); expect(view.state.doc.toString()).toBe("**esto** dopo");
  await act(async () => view.dispatch({ selection: { anchor: 6 } }));
  await key("Delete"); expect(view.state.doc.toString()).toBe("**esto**dopo");
});
it("removes empty wrappers and preserves wrappers around partially selected text", async () => {
  const { view } = await editor("**abc** dopo");
  await act(async () => view.dispatch({ selection: { anchor: 4, head: 9 } }));
  await key("Backspace"); expect(view.state.doc.toString()).toBe("**ab**opo");
  await act(async () => view.dispatch({ selection: { anchor: 6 } }));
  await key("Backspace", true); expect(view.state.doc.toString()).toBe("opo");
});
it("keeps source mode fully editable", async () => {
  const { view } = await editor("## Titolo\n**testo**", true);
  expect(host.querySelector(".live-heading-icon")).toBeNull();
  expect(host.querySelector(".cm-content")?.textContent).toContain("## Titolo");
  await key("Backspace"); expect(view.state.doc.toString()).toBe("## Titolo\n**testo*");
});
it("leaves visible Markdown editable when reveal-at-cursor is enabled", async () => {
  const { view } = await editor("**testo**", false, true);
  await key("Backspace"); expect(view.state.doc.toString()).toBe("**testo*");
});
it("shows one heading icon on the active H1–H4 line, even at the start of the marker", async () => {
  const content = "# Uno #\n## Due\n### Tre\n#### Quattro\n##### Cinque\n###### Sei\n\nTitolo\n======\n\n```md\n## Esempio\n```\n\nParagrafo";
  const { view } = await editor(content, false, true);
  const icons = () => Array.from(host.querySelectorAll(".live-heading-icon"));
  expect(icons()).toHaveLength(0);
  const digits = new Set();
  for (let level = 1; level <= view.state.doc.lines; level++) {
    const line = view.state.doc.line(level);
    await act(async () => view.dispatch({ selection: { anchor: line.from } }));
    expect(icons().map(icon => icon.getAttribute("aria-label"))).toEqual(level <= 4 ? [`Titolo H${level}`] : []);
    if (level <= 4) digits.add(icons()[0]?.querySelector("path:last-child")?.getAttribute("d"));
  }
  expect(digits.size).toBe(4);
  await act(async () => view.dispatch({ selection: { anchor: 0 } }));
  await key("ArrowRight");
  expect(view.state.selection.main.head).toBe(2);
  expect(view.state.doc.toString()).toBe(content);
  await act(async () => view.contentDOM.blur());
  await expect.poll(() => icons().length).toBe(0);
});
it.each([["Backspace", 7], ["Delete", 0]] as const)("turns a heading into plain text with %s next to its icon", async (button, anchor) => {
  const content = "####   **Testo** ###  \n\nAltro";
  const { view, api } = await editor(content);
  await act(async () => view.dispatch({ selection: { anchor } }));
  await key(button);
  expect(view.state.doc.toString()).toBe("**Testo**\n\nAltro");
  expect(host.querySelector(".live-heading-icon")).toBeNull();
  await act(async () => api.current!.undo());
  expect(view.state.doc.toString()).toBe(content);
});
it("changes the heading level from its icon and preserves the text, caret and undo", async () => {
  const content = "##  **Titolo** ###  \n\nTesto";
  const { view, api } = await editor(content);
  const caret = content.indexOf("Titolo") + 2;
  await act(async () => api.current!.select(caret));
  const icon = () => host.querySelector<HTMLButtonElement>(".live-heading-icon")!;
  await act(async () => icon().click());
  const menu = host.querySelector<HTMLElement>(".heading-level-menu")!;
  expect(icon().getAttribute("aria-expanded")).toBe("true");
  const options = [...menu.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
  expect(options.map(option => option.textContent)).toEqual(["Titolo H1", "Titolo H2", "Titolo H3", "Titolo H4"]);
  expect(options[1]?.getAttribute("aria-checked")).toBe("true");
  await act(async () => options[1]!.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })));
  expect(document.activeElement?.textContent).toBe("Converti in testo normale");
  await act(async () => options[3]?.click());
  expect(view.state.doc.toString()).toBe("####" + content.slice(2));
  expect(view.state.selection.main.head).toBe(caret + 2);
  await expect.poll(() => icon()?.getAttribute("aria-label")).toBe("Titolo H4");
  expect(host.querySelector(".heading-level-menu")).toBeNull();
  await act(async () => api.current!.undo());
  expect(view.state.doc.toString()).toBe(content);
  await expect.poll(() => icon()?.getAttribute("aria-label")).toBe("Titolo H2");
  await act(async () => icon().click());
  await act(async () => host.querySelector<HTMLButtonElement>('.heading-level-menu [role="menuitem"]')!.click());
  expect(view.state.doc.toString()).toBe("**Titolo**\n\nTesto");
  expect(host.querySelector(".live-heading-icon")).toBeNull();
});

it("removes the heading prefix through mobile beforeinput at the start of the text", async () => {
  const { view } = await editor("## Titolo");
  await act(async () => view.dispatch({ selection: { anchor: 3 } }));
  await act(async () => view.contentDOM.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteContentBackward", bubbles: true, cancelable: true })));
  expect(view.state.doc.toString()).toBe("Titolo");
  expect(host.querySelector(".live-heading")).toBeNull();
});

it("opens the color palette with Backspace and changes only the highlight emoji", async () => {
  const content = "Prima ==🟢**testo**== dopo";
  const { view, api } = await editor(content);
  expect(host.querySelector(".live-highlight-icon")).toBeNull();
  expect(host.querySelector(".cm-content")?.textContent).toBe("Prima testo dopo");
  await act(async () => view.dispatch({ selection: { anchor: "Prima ==🟢".length } }));
  expect(host.querySelector(".live-highlight-icon")?.getAttribute("aria-expanded")).toBe("false");
  await key("Backspace");
  expect(view.state.doc.toString()).toBe(content);
  const options = Array.from(host.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]'));
  expect(options.map(option => option.textContent)).toEqual(["Verde", "Giallo", "Arancione", "Rosso", "Viola", "Blu"]);
  expect(options[0]?.getAttribute("aria-checked")).toBe("true");
  await act(async () => options[4]?.click());
  expect(view.state.doc.toString()).toBe("Prima ==🟣**testo**== dopo");
  expect(host.querySelector('[role="menu"]')).toBeNull();
  await act(async () => api.current!.undo());
  expect(view.state.doc.toString()).toBe(content);
});
it("opens the palette for a legacy highlight and inserts the selected color", async () => {
  const { view } = await editor("==testo==", false, true);
  await act(async () => view.dispatch({ selection: { anchor: 2 } }));
  await act(async () => host.querySelector<HTMLButtonElement>(".live-highlight-icon")!.click());
  expect(host.querySelector('[aria-checked="true"]')?.textContent).toBe("Giallo");
  await act(async () => Array.from(host.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')).find(option => option.textContent === "Blu")?.click());
  expect(view.state.doc.toString()).toBe("==🔵testo==");
});
it("keeps a previously saved shade visible until an original color replaces it", async () => {
  const { view, api } = await editor("=={#374151}testo==");
  expect(host.querySelector(".live-highlight")?.getAttribute("data-highlight-color")).toBe("#374151");
  expect(host.querySelector(".cm-content")!.textContent).not.toContain("#374151");
  await act(async () => api.current!.select("=={#374151}".length));
  await key("Backspace");
  const options = [...host.querySelectorAll<HTMLButtonElement>('.highlight-color-menu [role="menuitemradio"]')];
  expect(options).toHaveLength(6);
  expect(options.some(option => option.getAttribute("aria-checked") === "true")).toBe(false);
  await act(async () => options.find(option => option.textContent === "Blu")!.click());
  expect(view.state.doc.toString()).toBe("==🔵testo==");
  await act(async () => api.current!.undo());
  expect(view.state.doc.toString()).toBe("=={#374151}testo==");
});
it("handles mobile beforeinput and Unicode without deleting delimiters", async () => {
  const { view } = await editor("**A😀**");
  await act(async () => host.querySelector(".cm-content")!.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteContentBackward", bubbles: true, cancelable: true })));
  expect(view.state.doc.toString()).toBe("**A**");
  await key("Backspace"); expect(view.state.doc.toString()).toBe("");
});
