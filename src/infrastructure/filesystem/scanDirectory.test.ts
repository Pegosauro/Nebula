import { describe, expect, it } from "vitest";
import { scanDirectoryHandle } from "./scanDirectory";

function fileHandle(name: string, content = "test", modifiedAt = 1000): FileSystemFileHandle {
  return {
    kind: "file",
    name,
    getFile: async () => new File([content], name, { lastModified: modifiedAt }),
  } as FileSystemFileHandle;
}

function directoryHandle(
  name: string,
  children: Array<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>,
): FileSystemDirectoryHandle {
  return {
    kind: "directory",
    name,
    async *entries() {
      for (const child of children) yield child;
    },
  } as FileSystemDirectoryHandle;
}

describe("scanDirectoryHandle", () => {
  it("builds a sorted metadata tree and ignores technical directories", async () => {
    const ignored = directoryHandle(".git", [["config", fileHandle("config")]]);
    const projects = directoryHandle("Progetti", [
      ["Schema.excalidraw", fileHandle("Schema.excalidraw", "{}")],
      ["Roadmap.md", fileHandle("Roadmap.md", "# Roadmap")],
    ]);
    const root = directoryHandle("Nebula Test", [
      ["Zeta.md", fileHandle("Zeta.md")],
      ["Progetti", projects],
      [".git", ignored],
      ["Alfa.txt", fileHandle("Alfa.txt")],
    ]);

    const progress: string[] = [];
    const snapshot = await scanDirectoryHandle(root, {
      yieldEvery: 2,
      onProgress: (item) => progress.push(item.path),
    });

    expect(snapshot.name).toBe("Nebula Test");
    expect(snapshot.root.map((entry) => entry.name)).toEqual(["Progetti", "Alfa.txt", "Zeta.md"]);
    expect(snapshot.stats).toEqual({ directories: 1, files: 4, notes: 2, boards: 1 });
    expect(progress).not.toContain(".git");
    expect(snapshot.root[0]?.children?.map((entry) => entry.name)).toEqual(["Roadmap.md", "Schema.excalidraw"]);
  });
});
