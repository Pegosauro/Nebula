import { markdown } from "@codemirror/lang-markdown";
import { EditorState } from "@codemirror/state";
import { expect, it } from "vitest";
import { renderMarkdownSafe } from "../../infrastructure/markdown/renderMarkdown";
import { externalLinkAt, externalLinkReplacement } from "./externalLinkEditing";

it("preserves existing formatting and tooltips while storing a validated Markdown link style", () => {
  const doc = '[**Catalogo**](https://example.org/file.pdf "Titolo originale")';
  const state = EditorState.create({ doc, extensions: markdown() });
  const link = externalLinkAt(state, 0)!;
  expect(link.standalone).toBe(true);
  expect(link.draft.label).toBe("Catalogo");
  const updated = externalLinkReplacement(state, link, { ...link.draft, appearance: { icon: "pdf", tone: "ardesia" } })!;
  expect(updated).toBe('[**Catalogo**](https://example.org/file.pdf "Titolo originale nebula-link:v1:pdf:ardesia")');
  const safe = renderMarkdownSafe(updated);
  expect(safe).toContain('title="Titolo originale"');
  expect(safe).toContain("<strong>Catalogo</strong>");
  expect(safe).not.toContain("nebula-link");
  const stale = EditorState.create({ doc: "Prima " + doc, extensions: markdown() });
  expect(externalLinkReplacement(stale, link, link.draft)).toBeUndefined();
  expect(externalLinkReplacement(state, link, { ...link.draft, address: "javascript:alert(1)" })).toBeUndefined();
});

it("edits an inline link without adding a card or changing its destination", () => {
  const doc = "Vedi [sito](<https://example.org/pagina?a=1&b=2>) prima di procedere.";
  const state = EditorState.create({ doc, extensions: markdown() });
  const link = externalLinkAt(state, 5)!;
  expect(link.standalone).toBe(false);
  expect(externalLinkReplacement(state, link, { ...link.draft, label: "guida [PDF]" }))
    .toBe("[guida \\[PDF\\]](<https://example.org/pagina?a=1&b=2>)");
});
