import { describe, expect, it } from "vitest";
import { parseFrontmatterAliases, parseKnowledgeDocument, parseWikilinks } from "./parseKnowledge";

describe("knowledge parser", () => {
  it("parses aliases and supported wikilink forms", () => {
    const source = `---\naliases:\n  - Alpha\n  - "Secondo nome"\n---\n[[Nota]] [[Cartella/Nota|Etichetta]] [[Nota#Sezione]]`;
    expect(parseFrontmatterAliases(source)).toEqual(["Alpha", "Secondo nome"]);
    expect(parseKnowledgeDocument("Home.md", source).links).toMatchObject([
      { target: "Nota", display: "Nota" },
      { target: "Cartella/Nota", display: "Etichetta" },
      { target: "Nota", display: "Nota#Sezione", heading: "Sezione" },
    ]);
  });

  it("ignores code, embeds and unsafe traversal targets", () => {
    const source = "`[[Inline]]`\n```md\n[[Blocco]]\n```\n![[Immagine.png]] [[../Fuori]] [[Valida]]";
    expect(parseWikilinks(source).map((link) => link.target)).toEqual(["Valida"]);
  });

  it("supports inline frontmatter aliases", () => {
    expect(parseFrontmatterAliases("---\naliases: [Uno, 'Due']\n---\nTest")).toEqual(["Uno", "Due"]);
  });
});
