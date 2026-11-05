/// <reference lib="webworker" />

import type { KnowledgeWorkerRequest, KnowledgeWorkerResponse } from "../domain/knowledge";
import { KnowledgeEngine } from "../features/knowledge/knowledgeEngine";

const engine = new KnowledgeEngine();

self.addEventListener("message", (event: MessageEvent<KnowledgeWorkerRequest>) => {
  const request = event.data;
  try {
    if (request.type === "search") {
      const results = engine.search(request.query, request.mode, request.recentPaths, request.limit);
      const response: KnowledgeWorkerResponse = { requestId: request.requestId, ok: true, type: "search", results };
      self.postMessage(response);
      return;
    }
    const data = request.type === "rebuild"
      ? engine.rebuild(request.documents)
      : request.type === "update"
        ? engine.update(request.document)
        : request.type === "remove"
          ? engine.remove(request.basePath)
          : request.type === "remap"
            ? engine.remap(request.oldPath, request.newPath)
            : engine.reset();
    const response: KnowledgeWorkerResponse = { requestId: request.requestId, ok: true, type: "index", data };
    self.postMessage(response);
  } catch (error) {
    const response: KnowledgeWorkerResponse = {
      requestId: request.requestId,
      ok: false,
      error: error instanceof Error ? error.message : "Indicizzazione non riuscita.",
    };
    self.postMessage(response);
  }
});

export {};
