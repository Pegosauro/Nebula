import { findVaultEntry } from "../../domain/vault";
import { VaultEntryNotFoundError } from "../../infrastructure/filesystem/vaultFileOperations";
import { readableFileSystemError } from "../../infrastructure/filesystem/filesystemErrors";
import { appendDocumentText } from "../editor/documentStore";
import { vaultService } from "../vault/vaultService";
import { useVaultStore } from "../vault/vaultStore";
import { useWorkspaceStore } from "../workspace/workspaceStore";

export const QUICK_NOTES_PATH = "Appunti veloci.md";
export function quickNoteEntry(text: string, date = new Date(), captureId?: string): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const timestamp = `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} · ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  const body = text.replace(/\r\n/g, "\n");
  return `## ${timestamp}\n\n${captureId ? `<!-- nebula-quick-note:${captureId} -->\n\n` : ""}${body}${body.endsWith("\n") ? "" : "\n"}`;
}
let saving = false;
export async function saveQuickNote(text: string, date = new Date(), captureId: string = crypto.randomUUID()): Promise<void> {
  if (!text.trim()) throw new Error("Scrivi un appunto prima di salvarlo.");
  if (saving) throw new Error("Un appunto è già in corso di salvataggio.");
  const vault = useVaultStore.getState();
  if (vault.status !== "ready" || !vault.snapshot) throw new Error("Collega un Vault per salvare gli appunti veloci.");
  saving = true;
  try {
    try { await vaultService.statText(QUICK_NOTES_PATH); }
    catch (caught) {
      if (!(caught instanceof VaultEntryNotFoundError) && !(caught instanceof DOMException && caught.name === "NotFoundError")) throw caught;
      await useVaultStore.getState().createNote("", "Appunti veloci", false, "# Appunti veloci\n");
    }
    await appendDocumentText(QUICK_NOTES_PATH, quickNoteEntry(text, date, captureId), `<!-- nebula-quick-note:${captureId} -->`);
  } catch (caught) { throw new Error(readableFileSystemError(caught)); }
  finally { saving = false; }
}
export function openQuickNotes(): void {
  const snapshot = useVaultStore.getState().snapshot;
  const entry = snapshot && findVaultEntry(snapshot.root, QUICK_NOTES_PATH);
  if (entry?.type === "file") useWorkspaceStore.getState().openEntry(entry);
}

export function quickNoteTitle(text: string): string {
  return (text.split(/\r?\n/).find(line => line.trim()) ?? "Appunto")
    .replace(/^[#>*\-\s]+/, "").replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80).replace(/[. ]+$/, "") || "Appunto";
}

