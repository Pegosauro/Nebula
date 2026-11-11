import type { DocumentStatus } from "../editor/documentStore";
import type { Configurator } from "../configurator/model";
import { serializeConfigurator } from "../configurator/serializeConfigurator";
import type { Tree } from "../trees/model";
import { serializeTree } from "../trees/serializeTree";
export type SaveStatus = DocumentStatus;
export function configuratorSaveStatus(session: { saving: boolean; error?: string; data: Configurator; saved: string }): SaveStatus {
  if (session.error) return "error";
  if (session.saving) return "saving";
  return serializeConfigurator(session.data) === session.saved ? "saved" : "dirty";
}
export function treeSaveStatus(session: { saving: boolean; error?: string; conflict?: boolean; data: Tree; saved: string }): SaveStatus {
  if (session.conflict) return "conflict";
  if (session.error) return "error";
  if (session.saving) return "saving";
  return serializeTree(session.data) === session.saved ? "saved" : "dirty";
}
export function saveStatusLabel(status: SaveStatus): string {
  return { loading: "Apertura file…", saved: "Salvato nel Vault", dirty: "Modifiche in attesa", saving: "Salvataggio…", error: "Non salvato", conflict: "Conflitto sul file" }[status];
}
export function saveStatusTone(status: SaveStatus): string {
  return status === "error" || status === "conflict" ? "error" : status === "dirty" ? "pending" : status === "saving" || status === "loading" ? "working" : "saved";
}
