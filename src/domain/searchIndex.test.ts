import { describe, expect, it } from "vitest";
import { buildQuickSearchDocument, buildSearchDocument, searchDocuments, searchQuickDocuments } from "./searchIndex";

const documents = [
  buildSearchDocument({ path: "Progetti/Nebula.md", content: "---\naliases: [App note]\ntags: [progetto]\n---\n# Nebula\nUna PWA local-first per appunti collegati.", lastModified: 2 }),
  buildSearchDocument({ path: "Archivio/Verbale.md", content: "# Riunione\nContenuto del verbale tecnico.", lastModified: 1 }),
];

describe("search index", () => {
  it("finds by basename, path, alias, tag and full text", () => {
    expect(searchDocuments(documents, "Nebula", "full")[0]?.path).toBe("Progetti/Nebula.md");
    expect(searchDocuments(documents, "Archivio", "full")[0]?.path).toBe("Archivio/Verbale.md");
    expect(searchDocuments(documents, "App note", "full")[0]?.match).toBe("alias");
    expect(searchDocuments(documents, "progetto", "full")[0]?.match).toBe("tag");
    expect(searchDocuments(documents, "verbale tecnico", "full")[0]?.snippet).toContain("verbale tecnico");
  });

  it("ranks quick results by exact, prefix, fuzzy and recent usage", () => {
    expect(searchDocuments(documents, "Nebula", "quick")[0]?.path).toBe("Progetti/Nebula.md");
    expect(searchDocuments(documents, "Nbl", "quick")[0]?.path).toBe("Progetti/Nebula.md");
    expect(searchDocuments(documents, "", "quick", ["Archivio/Verbale.md"])[0]?.path).toBe("Archivio/Verbale.md");
  });

  it("preserves ranking, accent folding and stable ties while keeping only visible results", () => {
    const catalog = Array.from({ length: 120 }, (_, i) => buildQuickSearchDocument({ path: `Cartella/Nota${i}.md`, title: i % 2 ? "Quantità" : "Nota", aliases: ["Dimensioni"] }));
    for (const query of ["", "quantita", "nota", "dimensioni", "cartella"]) {
      const recent = ["Cartella/Nota119.md"];
      expect(searchQuickDocuments(catalog, query, recent, 30)).toEqual(searchQuickDocuments(catalog, query, recent, 120).slice(0, 30));
    }
    expect(searchQuickDocuments(catalog, "quantita")[0]?.title).toBe("Quantità");
  });
});
