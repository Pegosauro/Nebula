import { describe, expect, it, vi } from "vitest";
import { readVaultImage, resolveImagePath, saveVaultImage } from "./vaultImages";

describe("Vault images", () => {
  it("resolves references from nested notes without permitting escape from the Vault", () => {
    expect(resolveImagePath("Progetti/A/Nota.md", "../../attachments/foto%20uno.png")).toBe("attachments/foto uno.png");
    expect(resolveImagePath("A/Nota.md", "/attachments/foto.png")).toBe("attachments/foto.png");
    expect(() => resolveImagePath("A.md", "../privato.png")).toThrow();
    expect(() => resolveImagePath("A.md", "%2e%2e/privato.png")).toThrow();
    expect(() => resolveImagePath("A.md", "javascript:alert(1)")).toThrow();
  });
  it("copies a raster attachment with a unique name and aborts a failed write", async () => {
    const write = vi.fn().mockResolvedValue(undefined), close = vi.fn().mockResolvedValue(undefined), abort = vi.fn().mockResolvedValue(undefined);
    const folder = { getFileHandle: vi.fn().mockResolvedValue({ createWritable: async () => ({ write, close, abort }) }), removeEntry: vi.fn().mockResolvedValue(undefined) };
    const root = { getDirectoryHandle: vi.fn().mockResolvedValue(folder) } as unknown as FileSystemDirectoryHandle;
    const file = new File(["PNG"], "Foto uno.png", { type: "image/png" });
    const path = await saveVaultImage(root, "A/B/Nota.md", file);
    expect(path).toMatch(/^\.\.\/\.\.\/attachments\/Foto-uno-[\da-f-]+\.png$/);
    expect(write).toHaveBeenCalledWith(file); expect(close).toHaveBeenCalled();
    expect(folder.removeEntry).not.toHaveBeenCalled();
    write.mockRejectedValueOnce(new Error("Disco pieno"));
    await expect(saveVaultImage(root, "A.md", file)).rejects.toThrow("Disco pieno");
    expect(abort).toHaveBeenCalled(); expect(folder.removeEntry).toHaveBeenCalled();
  });
  it("rejects active image formats and can read a local raster with a safe MIME", async () => {
    const root = { getFileHandle: async () => ({ getFile: async () => new File(["PNG"], "foto.png") }) } as unknown as FileSystemDirectoryHandle;
    expect((await readVaultImage(root, "foto.png")).type).toBe("image/png");
    await expect(readVaultImage(root, "foto.svg")).rejects.toThrow("Formato immagine");
    await expect(saveVaultImage(root, "A.md", new File(["<svg>"], "foto.svg", { type: "image/svg+xml" }))).rejects.toThrow("Usa un’immagine");
  });
});
