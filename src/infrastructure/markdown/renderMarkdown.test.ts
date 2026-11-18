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

  it("renders highlight colors without showing the emoji and preserves legacy Markdown", () => {
    const html = renderMarkdownSafe("==🟢**verde**== ==🟡giallo== ==🟠arancione== ==🔴rosso== ==🟣viola== ==🔵blu== ==normale== `==🟢letterale==`");
    expect(html).toContain('<mark data-highlight-color="green"><strong>verde</strong></mark>');
    for (const [color, text] of [["yellow", "giallo"], ["orange", "arancione"], ["red", "rosso"], ["purple", "viola"], ["blue", "blu"]]) {
      expect(html).toContain(`<mark data-highlight-color="${color}">${text}</mark>`);
    }
    expect(html).toContain("<mark>normale</mark>");
    expect(html).toContain("<code>==🟢letterale==</code>");
  });

  it("renders three distinct blocks with decorative icons and no generated titles", () => {
    const html = renderMarkdownSafe("> Una citazione\n\n> [!TIP]\n> **Utile**\n\n> [!WARNING] Verificare\n\n> [!NOTE]\n> Nota esistente");
    const container = document.createElement("div");
    container.innerHTML = html;
    const blocks = [...container.querySelectorAll("blockquote")];
    expect(blocks.slice(0, 3).map(block => block.textContent?.trim())).toEqual(["Una citazione", "Utile", "Verificare"]);
    expect(blocks[3]?.querySelector(".callout-label")?.textContent).toBe("Nota");
    for (const [index, kind] of ["quote", "tip", "warning"].entries()) {
      expect(blocks[index]?.classList).toContain(`quote-block-${kind}`);
      expect(blocks[index]?.querySelector("svg[aria-hidden=true]")).toBeTruthy();
      expect(blocks[index]?.querySelector(".callout-label")).toBeNull();
    }
    expect(blocks[1]?.querySelector(".quote-block-content strong")?.textContent).toBe("Utile");
  });

  it("preserves line breaks in the three quote types without adding a blank line after the callout marker", () => {
    const container = document.createElement("div");
    container.innerHTML = renderMarkdownSafe([
      "Fuori\ndal blocco",
      "> Prima\n> **seconda**\n> terza",
      "> [!TIP]  \n> **Prima**\n> seconda  \n> terza",
      "> [!WARNING] Prima\n> seconda\n> terza",
    ].join("\n\n"));

    expect(container.querySelector(":scope > p")?.innerHTML).toBe("Fuori\ndal blocco");
    expect([...container.querySelectorAll("blockquote p")].map(p => p.innerHTML)).toEqual([
      "Prima<br><strong>seconda</strong><br>terza",
      "<strong>Prima</strong><br>seconda<br>terza",
      "Prima<br>seconda<br>terza",
    ]);
  });

  it("shows one icon for each outer block and preserves the content of nested quotes", () => {
    const container = document.createElement("div");
    container.innerHTML = renderMarkdownSafe([
      "> [!TIP]\n> > Testo\n> > **del suggerimento**",
      "> [!WARNING]\n> > Testo\n> > [dell’avviso](https://example.com)",
      "> Citazione\n> > [!TIP]\n> > Testo annidato\n> > ancora",
    ].join("\n\n"));

    const blocks = [...container.querySelectorAll(":scope > blockquote")];
    expect(blocks.map(block => block.querySelectorAll(".quote-block-icon").length)).toEqual([1, 1, 1]);
    expect(blocks.map(block => block.querySelector(":scope blockquote p")?.innerHTML)).toEqual([
      "Testo<br><strong>del suggerimento</strong>",
      'Testo<br><a href="https://example.com" target="_blank" rel="noopener noreferrer">dell’avviso</a>',
      "Testo annidato<br>ancora",
    ]);
    expect(container.querySelector("blockquote blockquote.nebula-quote-block")).toBeNull();
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
