import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { createLiveMarkdown } from "./liveMarkdown";
import { KnowledgeEngine } from "../knowledge/knowledgeEngine";
import { buildQuickSearchDocument, searchQuickDocuments } from "../../domain/searchIndex";

describe("large workspace performance", () => {
  it("bounds quick-search results in a 50,000-note metadata catalog", () => {
    const catalog = Array.from({ length: 50000 }, (_, n) => buildQuickSearchDocument({ path: `Archivio/Documento ${String(n).padStart(5, "0")}.md`, aliases: [`Scheda ${n}`] }));
    const samples: number[] = [];
    for (const query of ["d", "do", "doc", "docu", "docum", "docume", "documen", "document", "documento", "documento 4"]) {
      const start = performance.now();
      expect(searchQuickDocuments(catalog, query)).toHaveLength(30);
      samples.push(performance.now() - start);
    }
    expect(searchQuickDocuments(catalog, "documento 49999")[0]?.path).toBe("Archivio/Documento 49999.md");
    console.info(JSON.stringify({ benchmark: "quick-search", documents: catalog.length, queryMs: samples }));
  });
  it("keeps a long note and its table intact through consecutive typing", () => {
    const source = "# Nota estesa\n\n" + "Un paragrafo di progetto con dettagli, misure e annotazioni.\n\n".repeat(3000) + "| Nome | Qta |\n| --- | --- |\n| Profilo | 2 |\n\nTesto finale ";
    const start = performance.now();
    let state = EditorState.create({ doc: source, extensions: [markdown({ base: markdownLanguage }), createLiveMarkdown("Lunga.md")] });
    const opened = performance.now();
    const samples: number[] = [];
    for (let i = 0; i < 60; i++) {
      const before = performance.now();
      state = state.update({ changes: { from: state.doc.length, insert: i % 10 === 9 ? "\nNuova riga " : "a" } }).state;
      samples.push(performance.now() - before);
    }
    samples.sort((a, b) => a - b);
    console.info(JSON.stringify({ benchmark: "long-note", bytes: source.length, openMs: opened - start, typingMedianMs: samples[30], typingP95Ms: samples[57] }));
    expect(state.doc.toString()).toContain("| Profilo | 2 |");
    expect(state.doc.length).toBeGreaterThan(source.length);
  });

  it("keeps search and links current in a large vault", () => {
    const engine = new KnowledgeEngine();
    const docs = Array.from({ length: 1500 }, (_, n) => ({ path: `Nota ${n}.md`, content: `# Nota ${n}\n\nProgetto ${n} [[Nota ${(n + 1) % 1500}]] [[Nota ${(n + 2) % 1500}]]` }));
    const start = performance.now();
    const index = engine.rebuild(docs);
    const indexed = performance.now();
    for (let i = 0; i < 10; i++) engine.search(`progetto ${i}`, "full", [], 20);
    console.info(JSON.stringify({ benchmark: "vault", documents: docs.length, indexMs: indexed - start, tenSearchesMs: performance.now() - indexed }));
    expect(index.documents["Nota 1.md"]?.incoming).toContain("Nota 0.md");
    engine.update({ path: "Nota 0.md", content: "# Documento aggiornato\n\nUnicorisultato" });
    expect(engine.search("Unicorisultato", "full", [], 20)[0]?.path).toBe("Nota 0.md");
    engine.remap("Nota 0.md", "Archivio/Rinominata.md");
    expect(engine.search("Unicorisultato", "full", [], 20)[0]?.path).toBe("Archivio/Rinominata.md");
    engine.remove("Archivio");
    expect(engine.search("Unicorisultato", "full", [], 20)).toEqual([]);
  });
});
