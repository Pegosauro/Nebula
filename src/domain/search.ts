export type SearchMode = "full" | "quick";

export interface SearchResult {
  path: string;
  title: string;
  breadcrumb: string;
  snippet: string;
  aliases: string[];
  tags: string[];
  score: number;
  modifiedAt?: number;
  match: "title" | "path" | "alias" | "tag" | "content" | "recent";
}
