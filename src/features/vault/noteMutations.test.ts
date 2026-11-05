import { afterEach, expect, it, vi } from "vitest";
import { useVaultStore } from "./vaultStore";
import { vaultService } from "./vaultService";
import { useWorkspaceStore } from "../workspace/workspaceStore";
import { useDocumentStore } from "../editor/documentStore";
import { useKnowledgeStore } from "../knowledge/knowledgeStore";
import type { VaultEntry, VaultSnapshot } from "../../domain/vault";

afterEach(() => { vi.restoreAllMocks(); useDocumentStore.getState().reset(); useWorkspaceStore.getState().resetDocuments(); useVaultStore.setState({ status: "idle", snapshot: undefined, error: undefined }); });
it("duplicates the latest unsaved draft, opens its copy and indexes it without saving over the original", async () => {
  const entry: VaultEntry = { id: "Idea.md", name: "Idea.md", path: "Idea.md", type: "file", extension: ".md" };
  const copy = { ...entry, id: "copy", name: "Idea (copia).md", path: "Idea (copia).md" };
  const snapshot: VaultSnapshot = { name: "Test", root: [entry, copy], scannedAt: 1, stats: { files: 2, notes: 2, directories: 0, boards: 0 } };
  useDocumentStore.setState({ sessions: { "Idea.md": { path: "Idea.md", content: "Bozza corrente", savedContent: "Disco", size: 5, lastModified: 1, loaded: true, status: "dirty" } } });
  const duplicate = vi.spyOn(vaultService, "duplicateNote").mockResolvedValue({ path: copy.path, snapshot });
  const write = vi.spyOn(vaultService, "writeText");
  const open = vi.spyOn(useWorkspaceStore.getState(), "openEntry").mockImplementation(() => {});
  useKnowledgeStore.setState({ status: "ready" }); const index = vi.spyOn(useKnowledgeStore.getState(), "addDocument").mockResolvedValue();
  expect(await useVaultStore.getState().duplicateNote(entry)).toBe(copy.path);
  expect(duplicate).toHaveBeenCalledWith(entry, "Bozza corrente"); expect(open).toHaveBeenCalledWith(copy, false, true); expect(index).toHaveBeenCalledWith(copy.path);
  expect(write).not.toHaveBeenCalled(); expect(useDocumentStore.getState().sessions[entry.path]?.content).toBe("Bozza corrente");
});
