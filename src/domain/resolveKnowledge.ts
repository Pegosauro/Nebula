import { basename, extensionOf, withoutMarkdownExtension } from "./path";
import type {
  KnowledgeDocumentIndex,
  KnowledgeIndexData,
  KnowledgeLinkReference,
  ParsedKnowledgeDocument,
} from "./knowledge";

function documentBasename(path: string): string {
  const name = basename(path);
  return extensionOf(name) === ".md" ? name.slice(0, -3) : name;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

type TargetDocument = Pick<ParsedKnowledgeDocument, "path" | "aliases">;
type TargetDocuments = readonly TargetDocument[] | Record<string, TargetDocument>;
const targetIndexes = new WeakMap<TargetDocuments, Array<Map<string, string[]>>>();
export function resolveKnowledgeTarget(target: string, documents: TargetDocuments): string[] {
  let maps = targetIndexes.get(documents);
  if (!maps) {
    maps = Array.from({ length: 5 }, () => new Map<string, string[]>());
    const add = (index: number, key: string, path: string) => { const values = maps![index]!.get(key); if (values) values.push(path); else maps![index]!.set(key, [path]); };
    for (const document of Object.values(documents)) {
      const path = withoutMarkdownExtension(document.path), name = documentBasename(document.path);
      add(0, path, document.path); add(1, name, document.path);
      add(2, path.toLocaleLowerCase(), document.path); add(3, name.toLocaleLowerCase(), document.path);
      for (const alias of new Set(document.aliases.map(alias => alias.toLocaleLowerCase()))) add(4, alias, document.path);
    }
    targetIndexes.set(documents, maps);
  }
  const folded = target.toLocaleLowerCase();
  return maps[0]!.get(target) ?? maps[1]!.get(target) ?? maps[2]!.get(folded) ?? maps[3]!.get(folded) ?? maps[4]!.get(folded) ?? [];
}

export function resolveKnowledgeIndex(parsedDocuments: ParsedKnowledgeDocument[]): KnowledgeIndexData {
  const markdownDocuments = parsedDocuments.filter((document) => extensionOf(document.path) === ".md");
  const documents: Record<string, KnowledgeDocumentIndex> = {};
  let linkCount = 0;
  let unresolvedCount = 0;
  let ambiguousCount = 0;

  for (const document of markdownDocuments) {
    const outgoing: KnowledgeLinkReference[] = document.links.map((link) => {
      const candidates = unique(resolveKnowledgeTarget(link.target, markdownDocuments));
      linkCount += 1;
      if (candidates.length === 0) unresolvedCount += 1;
      if (candidates.length > 1) ambiguousCount += 1;
      return {
        ...link,
        candidates,
        status: candidates.length === 1 ? "resolved" : candidates.length > 1 ? "ambiguous" : "unresolved",
        resolvedPath: candidates.length === 1 ? candidates[0] : undefined,
      };
    });
    documents[document.path] = { path: document.path, aliases: document.aliases, outgoing, incoming: [] };
  }

  for (const source of Object.values(documents)) {
    for (const link of source.outgoing) {
      if (!link.resolvedPath) continue;
      const destination = documents[link.resolvedPath];
      if (destination && !destination.incoming.includes(source.path)) destination.incoming.push(source.path);
    }
  }

  for (const document of Object.values(documents)) document.incoming.sort((left, right) => left.localeCompare(right));

  const basenameCounts = new Map<string, number>();
  for (const document of markdownDocuments) {
    const name = documentBasename(document.path);
    basenameCounts.set(name, (basenameCounts.get(name) ?? 0) + 1);
  }

  const labelOrder = new Intl.Collator(undefined, { sensitivity: "base" });
  const suggestions = markdownDocuments.map((document) => {
    const name = documentBasename(document.path);
    const label = basenameCounts.get(name) === 1 ? name : withoutMarkdownExtension(document.path);
    return { label, path: document.path, detail: withoutMarkdownExtension(document.path), aliases: document.aliases };
  }).sort((left, right) => labelOrder.compare(left.label, right.label));

  return {
    documents,
    suggestions,
    documentCount: markdownDocuments.length,
    linkCount,
    unresolvedCount,
    ambiguousCount,
  };
}
