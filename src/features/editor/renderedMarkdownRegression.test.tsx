/// <reference types="node" />
import { readFileSync } from "node:fs";
import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import CodeMirrorEditor from "./CodeMirrorEditor";
import MarkdownPreview from "./MarkdownPreview";
import { clearEditorMemories } from "./editorSessionCache";
import type { EditorApi } from "./editorCommands";
import { internalNoteMarkerRanges, maskInternalNoteMarkers } from "../../infrastructure/markdown/internalNoteMarkers";
import { renderMarkdownSafe } from "../../infrastructure/markdown/renderMarkdown";
import { quickNoteEntry } from "../notes/quickNotes";
import { quickNoteCaptures } from "../notes/quickNoteConversion";

let root: Root | undefined, host: HTMLDivElement | undefined;
const styles: HTMLStyleElement[] = [];
beforeAll(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect(0, 0, 100, 20);
  Element.prototype.scrollIntoView = () => {};
});
afterEach(async () => {
  if (root) await act(async () => root!.unmount()); host?.remove(); root = undefined; host = undefined;
  styles.splice(0).forEach(style => style.remove()); clearEditorMemories(); vi.restoreAllMocks();
});
async function mount(element: React.ReactNode) { host = document.createElement("div"); document.body.append(host); root = createRoot(host); await act(async () => root!.render(element)); }
function loadStyles() {
  for (const file of ["../../styles/base.css", "../../styles/editor.css"]) {
    const style = document.createElement("style"); style.textContent = readFileSync(new URL(file, import.meta.url), "utf8"); document.head.append(style); styles.push(style);
  }
}
const date = new Date(2026, 9, 1, 9, 2, 3);
const id = "de18d19c-fb80-4b4c-a7f2-710f9ea63702";

describe("rendered Markdown regressions", () => {
  it.each(["\n", "\r\n"])("masks capture metadata and preserves offsets and original captures (%j)", newline => {
    const content = (quickNoteEntry("Primo", date, id) + "\n" + quickNoteEntry("Secondo", date, "second")).replaceAll("\n", newline);
    const masked = maskInternalNoteMarkers(content);
    expect(masked.length).toBe(content.length); expect(masked.indexOf("Secondo")).toBe(content.indexOf("Secondo"));
    expect(internalNoteMarkerRanges(content)).toHaveLength(2);
    expect(masked).not.toContain("nebula-quick-note");
    expect(quickNoteCaptures(content).map(capture => capture.text)).toEqual(["Primo", "Secondo"]);
  });
  it("preserves ordinary comments and literal code examples but hides a real capture after an unfinished fence", () => {
    const example = "```md\n<!-- nebula-quick-note:example -->\n```\n\n<!-- mio commento -->\n";
    expect(maskInternalNoteMarkers(example)).toBe(example);
    const broken = quickNoteEntry("```\nCodice incompleto", date, id) + "\n" + quickNoteEntry("Secondo", date, "second");
    expect(internalNoteMarkerRanges(broken)).toHaveLength(2);
    expect(renderMarkdownSafe(broken)).not.toContain("nebula-quick-note");
    expect(renderMarkdownSafe(broken)).toContain("Secondo");
  });
  it("never exposes IDs in Scrivi, even at the cursor, while Sorgente keeps the complete file", async () => {
    const api = createRef<EditorApi>(); const change = vi.fn();
    const content = "# Appunti veloci\n\n" + quickNoteEntry("Primo *corsivo*", date, id) + "\n" + quickNoteEntry("Secondo _corsivo_", date, "second");
    const render = async (source: boolean) => act(async () => root!.render(<CodeMirrorEditor path="Appunti veloci.md" value={content} visible source={source} apiRef={api} onChange={change} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} onUiChange={() => {}} onPanel={() => {}} onImages={() => {}} />));
    await mount(null); await render(false);
    expect(host!.querySelector(".cm-content")!.textContent).not.toContain("nebula-quick-note");
    expect(host!.textContent).toContain("Primo"); expect(host!.textContent).toContain("Secondo");
    await act(async () => api.current!.select(content.indexOf(id) + 4));
    expect(host!.querySelector(".cm-content")!.textContent).not.toContain(id);
    await render(true); expect(host!.querySelector(".cm-content")!.textContent).toContain(id);
    await render(false); expect(host!.querySelector(".cm-content")!.textContent).not.toContain(id);
    expect(change).not.toHaveBeenCalled();
    await act(async () => root!.render(<MarkdownPreview content={content} sourcePath="Appunti veloci.md" readOnly />));
    expect(host!.textContent).not.toContain(id); expect(host!.querySelectorAll("em")).toHaveLength(2);
  });
  it.each(["light", "dark"])("allows visible italic for both syntaxes in writing and locked reading (%s)", async theme => {
    loadStyles(); document.documentElement.dataset.theme = theme;
    const content = "*Asterischi* e _underscore_ e ***entrambi***";
    await mount(<CodeMirrorEditor path="Corsivo.md" value={content} visible source={false} apiRef={createRef<EditorApi>()} onChange={() => {}} onSave={() => {}} onOpenLink={() => {}} suggestions={[]} onUiChange={() => {}} onPanel={() => {}} onImages={() => {}} />);
    expect(getComputedStyle(document.documentElement).getPropertyValue("font-synthesis")).toBe("none");
    const emphasis = host!.querySelectorAll(".live-emphasis"); expect(emphasis).toHaveLength(3);
    for (const span of emphasis) { expect(getComputedStyle(span).fontStyle).toBe("italic"); expect(getComputedStyle(span).getPropertyValue("font-synthesis")).toBe("style"); }
    await act(async () => root!.render(<MarkdownPreview content={content} sourcePath="Corsivo.md" readOnly />));
    const rendered = host!.querySelectorAll("em"); expect(rendered).toHaveLength(3);
    for (const em of rendered) { expect(getComputedStyle(em).fontStyle).toBe("italic"); expect(getComputedStyle(em).getPropertyValue("font-synthesis")).toBe("style"); }
  });
});


it.each(["light", "dark"])("aligns locked task checkboxes without duplicate bullets (%s)", async theme => {
  loadStyles(); document.documentElement.dataset.theme = theme;
  await mount(<section className="editor-v2 is-locked"><MarkdownPreview sourcePath="Tasks.md" content={"- [ ] Attività\n  - [x] Sottoattività\n\n- [ ] Attività con paragrafo\n\n  Dettaglio\n\n- Punto normale"} readOnly onTaskToggle={() => {}} /></section>);
  const items = host!.querySelectorAll("li.nebula-task-item"); expect(items).toHaveLength(3);
  for (const item of items) {
    expect(getComputedStyle(item).listStyle).toBe("none");
    const checkbox = item.querySelector<HTMLInputElement>("input")!;
    expect(getComputedStyle(checkbox).position).toBe("absolute");
    expect(getComputedStyle(checkbox).cursor).toBe("pointer");
    expect(checkbox.disabled).toBe(false);
  }
  expect(host!.querySelectorAll("li:not(.nebula-task-item)")).toHaveLength(1);
});
