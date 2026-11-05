import { describe, expect, it } from "vitest";
import { basename, ensureMarkdownExtension, extensionOf, InvalidVaultPathError, joinVaultPath, normalizeRelativePath, validateVaultEntryName, withoutMarkdownExtension } from "./path";

describe("vault paths", () => {
  it("normalizes separators without changing a valid relative path", () => {
    expect(normalizeRelativePath("/Progetti\\Nebula//Roadmap.md/")).toBe("Progetti/Nebula/Roadmap.md");
  });

  it("blocks traversal segments", () => {
    expect(() => normalizeRelativePath("Note/../segreto.md")).toThrow(InvalidVaultPathError);
    expect(() => joinVaultPath("Note", "../../segreto.md")).toThrow(InvalidVaultPathError);
  });

  it("derives portable names and lowercase extensions", () => {
    expect(basename("Guide/Benvenuto.md")).toBe("Benvenuto.md");
    expect(extensionOf("SCHEMA.Excalidraw")).toBe(".excalidraw");
    expect(extensionOf("README")).toBe("");
  });

  it("hides the Markdown extension only when it is the final suffix", () => {
    expect(withoutMarkdownExtension("Guide/Benvenuto.md")).toBe("Guide/Benvenuto");
    expect(withoutMarkdownExtension("Guide/Archivio.MD")).toBe("Guide/Archivio");
    expect(withoutMarkdownExtension("Guide/Benvenuto.txt")).toBe("Guide/Benvenuto.txt");
  });

  it("validates portable names and adds the markdown extension", () => {
    expect(validateVaultEntryName("Progetto Nebula")).toBe("Progetto Nebula");
    expect(ensureMarkdownExtension("Progetto Nebula")).toBe("Progetto Nebula.md");
    expect(ensureMarkdownExtension("Nota.MD")).toBe("Nota.MD");
    expect(() => validateVaultEntryName("nota?.md")).toThrow(InvalidVaultPathError);
    expect(() => validateVaultEntryName("CON")).toThrow(InvalidVaultPathError);
  });
});
