import { describe, expect, it } from "vitest";
import { renderMarkdownSafe } from "./renderMarkdown";
import { parseKnowledgeDocument } from "./parseKnowledge";
import { resolveKnowledgeIndex } from "../../domain/resolveKnowledge";

describe("renderMarkdownSafe", () => {
  it("renders common Markdown and removes executable HTML", () => {
    const html = renderMarkdownSafe("# Titolo\n\n**testo**<script>alert(1)</script><img src=x onerror=alert(1)>");
    expect(html).toContain("<h1>Titolo</h1>");
    expect(html).toContain("<strong>testo</strong>");
    expect(html).not.toContain("script");
    expect(html).not.toContain("onerror");
  });

  it("removes unsafe link protocols", () => {
    const html = renderMarkdownSafe("[Apri](javascript:alert(1))");
    expect(html).not.toContain("javascript:");
  });

  it("renders resolved, unresolved and ambiguous wikilinks as safe controls", () => {
    const knowledge = resolveKnowledgeIndex([
      parseKnowledgeDocument("Home.md", "[[Nota]] [[Mancante]]"),
      parseKnowledgeDocument("A/Nota.md", ""),
      parseKnowledgeDocument("B/Nota.md", ""),
    ]);
    const html = renderMarkdownSafe("[[Nota]] [[Mancante|Nuova]]", knowledge);
    expect(html).toContain("is-ambiguous");
    expect(html).toContain("is-unresolved");
    expect(html).toContain('data-nebula-target="Mancante"');
    expect(html).not.toContain("[[");
  });
});
