import { describe, expect, it } from "vitest";
import { KnowledgeEngine } from "./knowledgeEngine";

describe("KnowledgeEngine", () => {
  it("updates backlinks incrementally after a saved document changes", () => {
    const engine = new KnowledgeEngine();
    engine.rebuild([{ path: "Home.md", content: "" }, { path: "Nota.md", content: "" }]);
    const updated = engine.update({ path: "Home.md", content: "[[Nota]]" });
    expect(updated.documents["Nota.md"]?.incoming).toEqual(["Home.md"]);
  });

  it("keeps full-text search synchronized with document updates", () => {
    const engine = new KnowledgeEngine();
    engine.rebuild([
      { path: "Guide/Orion.md", content: "# Costellazione\n\nUna nota sulla cintura di Orione.", lastModified: 10 },
      { path: "Journal.md", content: "# Diario\n\nPensieri quotidiani.", lastModified: 20 },
    ]);

    expect(engine.search("cintura", "full", [], 10).map((result) => result.path)).toEqual(["Guide/Orion.md"]);
    expect(engine.search("ori", "quick", [], 10)[0]?.path).toBe("Guide/Orion.md");

    engine.update({ path: "Guide/Orion.md", content: "# Costellazione\n\nTesto aggiornato sulla nebulosa.", lastModified: 30 });
    expect(engine.search("cintura", "full", [], 10)).toEqual([]);
    expect(engine.search("nebulosa", "full", [], 10)[0]?.path).toBe("Guide/Orion.md");
  });

  it("remaps and removes documents without retaining stale links", () => {
    const engine = new KnowledgeEngine();
    engine.rebuild([{ path: "Home.md", content: "[[Area/Nota]]" }, { path: "Area/Nota.md", content: "" }]);
    const moved = engine.remap("Area/Nota.md", "Archivio/Nota.md");
    expect(moved.documents["Home.md"]?.outgoing[0]?.status).toBe("unresolved");
    const removed = engine.remove("Archivio");
    expect(removed.documentCount).toBe(1);
  });
});
