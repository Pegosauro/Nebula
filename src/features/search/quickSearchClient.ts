import type { KnowledgeIndexData } from "../../domain/knowledge";
import type { VaultEntry } from "../../domain/vault";
import type { SearchResult } from "../../domain/search";
import { buildQuickSearchDocument, searchQuickDocuments, type QuickSearchSource } from "../../domain/searchIndex";

export type QuickSearchRequest = { type: "catalog"; documents: QuickSearchSource[] } | { type: "search"; id: number; query: string; recentPaths: string[]; limit: number };
export type QuickSearchResponse = { id: number; results: SearchResult[] };
type Job = { id: number; generation: number; key: string; query: string; recentPaths: string[]; limit: number; resolve: (results: SearchResult[]) => void; reject: (error: Error) => void };

export function quickCatalog(entries: VaultEntry[], knowledge: KnowledgeIndexData["documents"]): QuickSearchSource[] {
  const catalog: QuickSearchSource[] = [];
  const visit = (items: VaultEntry[]) => {
    for (const entry of items) {
      if (entry.type === "directory") visit(entry.children ?? []);
      else if (entry.extension === ".md") catalog.push({ path: entry.path, title: knowledge[entry.path]?.title, aliases: knowledge[entry.path]?.aliases, modifiedAt: entry.modifiedAt });
    }
  };
  visit(entries); return catalog;
}

/** An independent, metadata-only worker: quick opening never waits for graph indexing. */
export class QuickSearchClient {
  private worker?: Worker;
  private catalog: QuickSearchSource[] = [];
  private fallback?: ReturnType<typeof buildQuickSearchDocument>[];
  private generation = 0;
  private sequence = 0;
  private active?: Job;
  private queued?: Job;
  private cache = new Map<string, SearchResult[]>();

  constructor() {
    if (typeof Worker === "undefined") return;
    try {
      this.worker = new Worker(new URL("../../workers/quickSearch.worker.ts", import.meta.url), { type: "module" });
      this.worker.addEventListener("message", (event: MessageEvent<QuickSearchResponse>) => {
        if (this.active?.id === event.data.id) this.finish(this.active, event.data.results);
      });
      this.worker.addEventListener("error", () => {
        this.worker?.terminate(); this.worker = undefined;
        // Retry the current request with the lightweight local index.
        if (this.active) this.run(this.active);
      });
    } catch { /* Workers can be restricted by the browser; keep local search available. */ }
  }

  replace(documents: QuickSearchSource[]) {
    this.catalog = documents; this.fallback = undefined; this.generation++; this.cache.clear(); this.cancelQueued();
    this.worker?.postMessage({ type: "catalog", documents } satisfies QuickSearchRequest);
  }

  search(query: string, recentPaths: string[], limit = 30): Promise<SearchResult[]> {
    const key = JSON.stringify([query.trim(), recentPaths, limit]);
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      const job: Job = { id: ++this.sequence, generation: this.generation, key, query, recentPaths, limit, resolve, reject };
      if (this.active) { this.cancelQueued(); this.queued = job; }
      else this.run(job);
    });
  }

  cancelQueued() { this.queued?.resolve([]); this.queued = undefined; }

  private run(job: Job) {
    this.active = job;
    if (this.worker) this.worker.postMessage({ type: "search", id: job.id, query: job.query, recentPaths: job.recentPaths, limit: job.limit } satisfies QuickSearchRequest);
    else setTimeout(() => {
      try {
        this.fallback ??= this.catalog.map(buildQuickSearchDocument);
        this.finish(job, searchQuickDocuments(this.fallback, job.query, job.recentPaths, job.limit));
      } catch (error) {
        job.reject(error instanceof Error ? error : new Error("Ricerca non disponibile."));
        this.finish(job, [], false);
      }
    }, 0);
  }

  private finish(job: Job, results: SearchResult[], cache = true) {
    if (job.generation === this.generation && cache) {
      this.cache.set(job.key, results);
      if (this.cache.size > 24) this.cache.delete(this.cache.keys().next().value!);
      job.resolve(results);
    } else job.resolve([]);
    this.active = undefined;
    const next = this.queued; this.queued = undefined;
    if (next) this.run(next);
  }
}

export const quickSearchClient = new QuickSearchClient();
