import { describe, expect, it } from "vitest";
import { quickNoteCaptures, quickNoteDocument } from "./quickNoteConversion";
import { quickNoteEntry } from "./quickNotes";

describe("quick note conversion", () => {
  const date = new Date(2026, 9, 1, 9, 2, 3);
  it("separates captures with identical timestamps and preserves nested headings and indentation", () => {
    const content = "# Appunti veloci\n\n" + quickNoteEntry("# Dettaglio\n\n    codice  ", date, "one") + "\n" + quickNoteEntry("Secondo", date, "two");
    const captures = quickNoteCaptures(content);
    expect(captures.map(item => item.text)).toEqual(["# Dettaglio\n\n    codice  ", "Secondo"]);
    expect(captures[0]!.id).not.toBe(captures[1]!.id);
  });
  it("recognizes legacy CRLF notes but ignores timestamps inside code examples", () => {
    const content = quickNoteEntry("```md\n## 01/10/2026 · 09:02:03\nExample\n```\n\nFine", date).replaceAll("\n", "\r\n");
    expect(quickNoteCaptures(content)).toHaveLength(1);
    expect(quickNoteCaptures(content)[0]!.text).toContain("Example");
  });
  it("finds a new marked capture after an unfinished fence", () => {
    const content = quickNoteEntry("```\nCodice incompleto", date, "one") + "\n" + quickNoteEntry("Secondo", date, "two");
    expect(quickNoteCaptures(content).map(item => item.text)).toEqual(["```\nCodice incompleto", "Secondo"]);
  });
  it("keeps user headings and template tokens literal, rebases assets and adds capture date", () => {
    const capture = { id: "one", timestamp: "01/10/2026 · 09:02:03", text: "# Mio titolo\n{{titolo}} {{data}}\n![Foto](attachments/foto.png)\n[Nota](Altra.md)" };
    const result = quickNoteDocument(capture, "Nota autonoma", false, date);
    expect(result).toContain("# Nota autonoma\n"); expect(result).toContain("# Mio titolo\n{{titolo}} {{data}}");
    expect(result).toContain("![Foto](/attachments/foto.png)"); expect(result).toContain("[Nota](/Altra.md)");
    expect(result).toContain(capture.timestamp); expect(capture.text).toContain("attachments/foto.png");
  });
  it("creates a procedure skeleton before the intact source, even with an unfinished code fence", () => {
    const result = quickNoteDocument({ id: "one", timestamp: "01/10/2026 · 09:02:03", text: "```\nDa sviluppare" }, "Procedura", true, date);
    expect(result).toContain('type: "procedura"'); expect(result).toContain("## Controlli finali");
    expect(result.indexOf("## Controlli finali")).toBeLessThan(result.indexOf("```"));
    expect(result).toContain("## Appunto di partenza"); expect(result).toContain("```\nDa sviluppare");
  });
});
