import { Diamond, Table2, type LucideIcon } from "lucide-react";
import type { TreeObject } from "./model";

/** Icone approvate: tabella ciano, rombo pieno viola per la propria, rombo vuoto ambra per l'acquisita. */
export interface ObjectPresentation { label: string; Icon: LucideIcon; className: string; filled: boolean }
export function objectPresentation(object: TreeObject): ObjectPresentation {
  if (object.type === "externalTable") return { label: "Tabella esterna", Icon: Table2, className: "is-table", filled: false };
  if (object.kind === "acquired") return { label: "Caratteristica acquisita", Icon: Diamond, className: "is-acquired", filled: false };
  return { label: "Caratteristica propria", Icon: Diamond, className: "is-own", filled: true };
}
export function objectLeafText(object: TreeObject): string {
  return object.type === "externalTable" ? object.tableName : `${object.code} - ${object.description}`;
}
