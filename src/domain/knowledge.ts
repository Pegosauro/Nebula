export type KnowledgeLinkStatus = "resolved" | "unresolved" | "ambiguous";

export interface ParsedWikilink {
  raw: string;
  target: string;
  display: string;
  heading?: string;
  start: number;
  end: number;
}

export interface ParsedKnowledgeDocument {
  path: string;
  aliases: string[];
  links: ParsedWikilink[];
}

export interface KnowledgeLinkReference extends ParsedWikilink {
  status: KnowledgeLinkStatus;
  resolvedPath?: string;
  candidates: string[];
}

export interface KnowledgeDocumentIndex {
  path: string;
  title?: string;
  aliases: string[];
  outgoing: KnowledgeLinkReference[];
  incoming: string[];
}

export interface KnowledgeSuggestion {
  label: string;
  path: string;
  detail: string;
  aliases: string[];
}

export interface KnowledgeIndexData {
  documents: Record<string, KnowledgeDocumentIndex>;
  suggestions: KnowledgeSuggestion[];
  documentCount: number;
  linkCount: number;
  unresolvedCount: number;
  ambiguousCount: number;
}

export interface KnowledgeSourceDocument {
  path: string;
  content: string;
  size?: number;
  lastModified?: number;
}

export type KnowledgeWorkerResponse =
  | { requestId: number; ok: true; type: "index"; data: KnowledgeIndexData }
  | { requestId: number; ok: true; type: "search"; results: import("./search").SearchResult[] }
  | { requestId: number; ok: false; error: string };

export type KnowledgeWorkerRequest =
  | { requestId: number; type: "rebuild"; documents: KnowledgeSourceDocument[] }
  | { requestId: number; type: "update"; document: KnowledgeSourceDocument }
  | { requestId: number; type: "remove"; basePath: string }
  | { requestId: number; type: "remap"; oldPath: string; newPath: string }
  | { requestId: number; type: "search"; query: string; mode: import("./search").SearchMode; recentPaths: string[]; limit: number }
  | { requestId: number; type: "reset" };
