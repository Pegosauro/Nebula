/// <reference lib="webworker" />
import { buildQuickSearchDocument, searchQuickDocuments } from "../domain/searchIndex";
import type { QuickSearchRequest, QuickSearchResponse } from "../features/search/quickSearchClient";

let documents: ReturnType<typeof buildQuickSearchDocument>[] = [];
self.addEventListener("message", (event: MessageEvent<QuickSearchRequest>) => {
  const request = event.data;
  if (request.type === "catalog") documents = request.documents.map(buildQuickSearchDocument);
  else self.postMessage({ id: request.id, results: searchQuickDocuments(documents, request.query, request.recentPaths, request.limit) } satisfies QuickSearchResponse);
});
