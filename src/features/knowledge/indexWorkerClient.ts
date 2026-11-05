import type {
  KnowledgeIndexData,
  KnowledgeSourceDocument,
  KnowledgeWorkerRequest,
  KnowledgeWorkerResponse,
} from "../../domain/knowledge";
import { KnowledgeEngine } from "./knowledgeEngine";
import type { SearchMode, SearchResult } from "../../domain/search";

type PendingRequest =
  | { type: "index"; resolve: (data: KnowledgeIndexData) => void; reject: (error: Error) => void }
  | { type: "search"; resolve: (results: SearchResult[]) => void; reject: (error: Error) => void };

type WithoutRequestId<T> = T extends { requestId: number } ? Omit<T, "requestId"> : never;
type KnowledgeWorkerPayload = WithoutRequestId<KnowledgeWorkerRequest>;
type KnowledgeIndexPayload = Exclude<KnowledgeWorkerPayload, { type: "search" }>;

export class KnowledgeWorkerClient {
  private worker?: Worker;
  private readonly fallback = new KnowledgeEngine();
  private readonly pending = new Map<number, PendingRequest>();
  private requestId = 0;
  private needsFallbackRebuild = false;

  constructor() {
    if (typeof Worker === "undefined") return;
    this.worker = new Worker(new URL("../../workers/index.worker.ts", import.meta.url), { type: "module" });
    this.worker.addEventListener("message", (event: MessageEvent<KnowledgeWorkerResponse>) => {
      const request = this.pending.get(event.data.requestId);
      if (!request) return;
      this.pending.delete(event.data.requestId);
      if (!event.data.ok) {
        request.reject(new Error(event.data.error || "Indicizzazione non riuscita."));
        return;
      }
      if (request.type === "index" && event.data.type === "index") request.resolve(event.data.data);
      else if (request.type === "search" && event.data.type === "search") request.resolve(event.data.results);
      else request.reject(new Error("Risposta non valida dal processo di indicizzazione."));
    });
    this.worker.addEventListener("error", () => {
      for (const request of this.pending.values()) request.reject(new Error("Il processo di indicizzazione si è interrotto."));
      this.pending.clear();
      this.worker?.terminate();
      this.worker = undefined;
      this.needsFallbackRebuild = true;
    });
  }

  rebuild(documents: KnowledgeSourceDocument[]): Promise<KnowledgeIndexData> {
    return this.send({ type: "rebuild", documents });
  }

  update(document: KnowledgeSourceDocument): Promise<KnowledgeIndexData> {
    return this.send({ type: "update", document });
  }

  remove(basePath: string): Promise<KnowledgeIndexData> {
    return this.send({ type: "remove", basePath });
  }

  remap(oldPath: string, newPath: string): Promise<KnowledgeIndexData> {
    return this.send({ type: "remap", oldPath, newPath });
  }

  reset(): Promise<KnowledgeIndexData> {
    return this.send({ type: "reset" });
  }

  search(query: string, mode: SearchMode, recentPaths: string[], limit = 50): Promise<SearchResult[]> {
    if (!this.worker) {
      if (this.needsFallbackRebuild) return Promise.reject(new Error("Ricostruisci l’indice prima di cercare."));
      return Promise.resolve(this.fallback.search(query, mode, recentPaths, limit));
    }
    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { type: "search", resolve, reject });
      this.worker?.postMessage({ type: "search", query, mode, recentPaths, limit, requestId } satisfies KnowledgeWorkerRequest);
    });
  }

  private send(payload: KnowledgeIndexPayload): Promise<KnowledgeIndexData> {
    if (!this.worker) {
      if (payload.type === "rebuild") {
        this.needsFallbackRebuild = false;
        return Promise.resolve(this.fallback.rebuild(payload.documents));
      }
      if (payload.type === "reset") {
        this.needsFallbackRebuild = false;
        return Promise.resolve(this.fallback.reset());
      }
      if (this.needsFallbackRebuild) return Promise.reject(new Error("Ricostruisci l’indice prima di aggiornarlo."));
      if (payload.type === "update") return Promise.resolve(this.fallback.update(payload.document));
      if (payload.type === "remove") return Promise.resolve(this.fallback.remove(payload.basePath));
      if (payload.type === "remap") return Promise.resolve(this.fallback.remap(payload.oldPath, payload.newPath));
      return Promise.resolve(this.fallback.reset());
    }
    const requestId = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { type: "index", resolve, reject });
      this.worker?.postMessage({ ...payload, requestId } as KnowledgeWorkerRequest);
    });
  }
}

export const indexWorkerClient = new KnowledgeWorkerClient();
