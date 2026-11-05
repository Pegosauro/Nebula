import { resolveKnowledgeTarget } from "../../domain/resolveKnowledge";
import type { KnowledgeIndexData } from "../../domain/knowledge";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import { useVaultStore } from "../vault/vaultStore";
import { configuratorEntries } from "./entries";
import { configTitle } from "./model";
let cached: KnowledgeIndexData | undefined;
let cachedDocuments: KnowledgeIndexData["documents"] | undefined;
let cachedEntries: unknown;

// Resources participate in link navigation without being parsed as Markdown or
// becoming nodes in the existing note graph.
export function navigationKnowledge(): KnowledgeIndexData {
  const knowledge=useKnowledgeStore.getState();
  const root=useVaultStore.getState().snapshot?.root;
  if(cached && cachedDocuments===knowledge.documents && cachedEntries===root) return cached;
  const entries=configuratorEntries(root ?? []);
  const documents={...knowledge.documents};
  for(const e of entries) documents[e.path]={path:e.path,aliases:[configTitle(e.name),configTitle(e.path)],incoming:[],outgoing:[]};
  const resources=new Set(entries.map(e=>e.path));
  for(const d of Object.values(knowledge.documents)) {
    const targets=new Set(d.outgoing.flatMap(link=>resolveKnowledgeTarget(link.target,documents)));
    for(const target of targets) if(resources.has(target)) documents[target]!.incoming.push(d.path);
  }
  cachedDocuments=knowledge.documents; cachedEntries=root;
  cached={...knowledge,documents,suggestions:[...knowledge.suggestions,...entries.map(e=>({label:configTitle(e.name),path:e.path,detail:e.path,aliases:[configTitle(e.name)]}))]};
  return cached;
}
