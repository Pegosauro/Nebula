import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultSnapshot } from "../../domain/vault";
import { vaultService } from "../vault/vaultService";
import { useKnowledgeStore } from "./knowledgeStore";

const snapshot: VaultSnapshot = {
  name: "Test",
  scannedAt: 1,
  stats: { directories: 0, files: 2, notes: 2, boards: 0 },
  root: [
    { id: "Home.md", name: "Home.md", path: "Home.md", type: "file", extension: ".md", size: 0, modifiedAt: 1 },
    { id: "Nota.md", name: "Nota.md", path: "Nota.md", type: "file", extension: ".md", size: 0, modifiedAt: 1 },
  ],
};

describe("knowledgeStore", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useKnowledgeStore.getState().reset();
  });

  it("builds the Vault index and updates backlinks after save", async () => {
    vi.spyOn(vaultService, "readText").mockImplementation(async (path) => ({
      path,
      content: path === "Home.md" ? "" : "---\naliases: [Seconda]\n---",
      size: 0,
      lastModified: 1,
    }));
    await useKnowledgeStore.getState().rebuild(snapshot);
    expect(useKnowledgeStore.getState()).toMatchObject({ status: "ready", documentCount: 2, progress: 2 });

    await useKnowledgeStore.getState().indexSavedDocument("Home.md", "[[Seconda]]");
    expect(useKnowledgeStore.getState().documents["Nota.md"]?.incoming).toEqual(["Home.md"]);
  });

  it("does not lose a save completed while the initial index is reading", async () => {
    let releaseHome: ((value: { path: string; content: string; size: number; lastModified: number }) => void) | undefined;
    const homeRead = new Promise<{ path: string; content: string; size: number; lastModified: number }>((resolve) => { releaseHome = resolve; });
    vi.spyOn(vaultService, "readText").mockImplementation(async (path) => {
      if (path === "Home.md") return homeRead;
      return { path, content: "", size: 0, lastModified: 1 };
    });

    const rebuilding = useKnowledgeStore.getState().rebuild(snapshot);
    await useKnowledgeStore.getState().indexSavedDocument("Home.md", "[[Nota]]");
    releaseHome?.({ path: "Home.md", content: "", size: 0, lastModified: 1 });
    await rebuilding;

    expect(useKnowledgeStore.getState().documents["Nota.md"]?.incoming).toEqual(["Home.md"]);
  });
});
