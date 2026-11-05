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
  const { view } = await editor("**testo**", true);
  await key("Backspace"); expect(view.state.doc.toString()).toBe("**testo*");
});
it("leaves visible Markdown editable when reveal-at-cursor is enabled", async () => {
  const { view } = await editor("**testo**", false, true);
  await key("Backspace"); expect(view.state.doc.toString()).toBe("**testo*");
});
it("handles mobile beforeinput and Unicode without deleting delimiters", async () => {
  const { view } = await editor("**A😀**");
  await act(async () => host.querySelector(".cm-content")!.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteContentBackward", bubbles: true, cancelable: true })));
  expect(view.state.doc.toString()).toBe("**A**");
  await key("Backspace"); expect(view.state.doc.toString()).toBe("");
});
