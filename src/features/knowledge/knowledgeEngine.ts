import type { KnowledgeIndexData, KnowledgeSourceDocument } from "../../domain/knowledge";
import { isPathInside } from "../../domain/path";
import { resolveKnowledgeIndex } from "../../domain/resolveKnowledge";
import { parseKnowledgeDocument } from "../../infrastructure/markdown/parseKnowledge";
import type { SearchMode, SearchResult } from "../../domain/search";
import { buildSearchDocument, searchDocuments } from "../../domain/searchIndex";

export class KnowledgeEngine {
  private documents = new Map<string, ReturnType<typeof parseKnowledgeDocument>>();
  private sources = new Map<string, KnowledgeSourceDocument>();
  private searchIndex = new Map<string, ReturnType<typeof buildSearchDocument>>();

  rebuild(documents: KnowledgeSourceDocument[]): KnowledgeIndexData {
    this.documents.clear();
    this.sources.clear();
    this.searchIndex.clear();
    for (const document of documents) this.updateParsed(document);
    return this.snapshot();
  }

  update(document: KnowledgeSourceDocument): KnowledgeIndexData {
    this.updateParsed(document);
    return this.snapshot();
  }

  remove(basePath: string): KnowledgeIndexData {
    for (const path of this.documents.keys()) {
      if (isPathInside(path, basePath)) this.documents.delete(path);
    }
    for (const path of this.sources.keys()) {
      if (isPathInside(path, basePath)) { this.sources.delete(path); this.searchIndex.delete(path); }
    }
    return this.snapshot();
  }

  remap(oldPath: string, newPath: string): KnowledgeIndexData {
    const remapped: Array<[string, ReturnType<typeof parseKnowledgeDocument>]> = [];
    const remappedSources: Array<[string, KnowledgeSourceDocument]> = [];
    for (const [path, document] of this.documents) {
      if (!isPathInside(path, oldPath)) continue;
      this.documents.delete(path);
      const nextPath = `${newPath}${path.slice(oldPath.length)}`;
      remapped.push([nextPath, { ...document, path: nextPath }]);
    }
    for (const [path, source] of this.sources) {
      if (!isPathInside(path, oldPath)) continue;
      this.sources.delete(path);
      this.searchIndex.delete(path);
      const nextPath = `${newPath}${path.slice(oldPath.length)}`;
      remappedSources.push([nextPath, { ...source, path: nextPath }]);
    }
    for (const [path, document] of remapped) this.documents.set(path, document);
    for (const [path, source] of remappedSources) { this.sources.set(path, source); this.searchIndex.set(path, buildSearchDocument(source, this.documents.get(path))); }
    return this.snapshot();
  }

  reset(): KnowledgeIndexData {
    this.documents.clear();
    this.sources.clear();
    this.searchIndex.clear();
    return this.snapshot();
  }

  search(query: string, mode: SearchMode, recentPaths: string[], limit: number): SearchResult[] {
    return searchDocuments(this.searchIndex.values(), query, mode, recentPaths, limit);
  }

  private updateParsed(document: KnowledgeSourceDocument): void {
    this.sources.set(document.path, document);
    const parsed = parseKnowledgeDocument(document.path, document.content);
    this.documents.set(document.path, parsed);
    this.searchIndex.set(document.path, buildSearchDocument(document, parsed));
  }

  private snapshot(): KnowledgeIndexData {
    const data = resolveKnowledgeIndex([...this.documents.values()]);
    for (const [path, document] of this.searchIndex) if (data.documents[path]) data.documents[path]!.title = document.title;
    return data;
  }
}
