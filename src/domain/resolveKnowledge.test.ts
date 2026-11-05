import { describe, expect, it } from "vitest";
import { parseKnowledgeDocument } from "../infrastructure/markdown/parseKnowledge";
import { resolveKnowledgeIndex } from "./resolveKnowledge";

describe("knowledge resolver", () => {
  it("resolves exact paths, basenames and frontmatter aliases", () => {
    const index = resolveKnowledgeIndex([
      parseKnowledgeDocument("Home.md", "[[Guide/Intro]] [[Progetto]] [[Inizio]]"),
      parseKnowledgeDocument("Guide/Intro.md", "---\naliases: [Inizio]\n---"),
      parseKnowledgeDocument("Area/Progetto.md", "[[Home]]"),
    ]);
    expect(index.documents["Home.md"]?.outgoing.map((link) => link.resolvedPath)).toEqual([
      "Guide/Intro.md",
      "Area/Progetto.md",
      "Guide/Intro.md",
    ]);
    expect(index.documents["Home.md"]?.incoming).toEqual(["Area/Progetto.md"]);
  });

  it("keeps ambiguous and unresolved links explicit", () => {
    const index = resolveKnowledgeIndex([
      parseKnowledgeDocument("Home.md", "[[Nota]] [[Mancante]]"),
      parseKnowledgeDocument("A/Nota.md", ""),
      parseKnowledgeDocument("B/Nota.md", ""),
    ]);
    expect(index.documents["Home.md"]?.outgoing[0]).toMatchObject({ status: "ambiguous", candidates: ["A/Nota.md", "B/Nota.md"] });
    expect(index.documents["Home.md"]?.outgoing[1]).toMatchObject({ status: "unresolved", candidates: [] });
    expect(index.unresolvedCount).toBe(1);
    expect(index.ambiguousCount).toBe(1);
  });
});
