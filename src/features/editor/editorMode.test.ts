import { describe, expect, it } from "vitest";
import { initialEditorMode, normalizeEditorMode } from "./editorMode";

describe("initialEditorMode", () => {
  it("opens existing notes ready to write by default", () => {
    expect(initialEditorMode("# Titolo\n\nContenuto")).toBe("edit");
  });

  it("opens empty and whitespace-only notes in write mode", () => {
    expect(initialEditorMode("")).toBe("edit");
    expect(initialEditorMode("  \n\t")).toBe("edit");
  });

  it("opens a newly created note in write mode even when it has an initial heading", () => {
    expect(initialEditorMode("# Nuova nota\n", true)).toBe("edit");
  });
});

it("migrates previous preview preferences to unified writing", () => {
  expect(normalizeEditorMode("preview")).toBe("edit");
  expect(normalizeEditorMode(undefined)).toBe("edit");
  expect(normalizeEditorMode("source")).toBe("source");
});
