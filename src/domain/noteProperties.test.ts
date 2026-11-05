import { describe, expect, it } from "vitest";
import { frontmatterRange, maskFrontmatter, readNoteProperties, updateNoteProperty } from "./noteProperties";
import { headingEntries } from "../features/editor/markdownTools";
import { taskMarkers } from "../features/editor/markdownTasks";
import { parseWikilinks } from "../infrastructure/markdown/parseKnowledge";
import { preparePersonalTemplate } from "../features/templates/preparePersonalTemplate";
import { renderMarkdownSafe } from "../infrastructure/markdown/renderMarkdown";

describe("optional note properties", () => {
  it("leaves an ordinary note unchanged until a real property is set", () => {
    const source = "# Nota\n\nTesto **intatto**\n";
    expect(readNoteProperties(source).values.category).toBe("");
    expect(updateNoteProperty(source, "type", "")).toBe(source);
    const added = updateNoteProperty(source, "type", "procedura");
    expect(added.endsWith(source)).toBe(true);
    expect(readNoteProperties(added).values.type).toBe("procedura");
    expect(updateNoteProperty(added, "type", "")).toBe(source);
  });
  it("roundtrips special characters and preserves unrelated YAML and CRLF", () => {
    const source = '\uFEFF---\r\naliases:\r\n  - Alias\r\n# Keep this\r\ncustom:\r\n  nested: unchanged\r\n---\r\n# Nota\r\n';
    const next = updateNoteProperty(source, "category", 'Officina: "A" # prove');
    expect(readNoteProperties(next).values.category).toBe('Officina: "A" # prove');
    expect(next).toContain('aliases:\r\n  - Alias\r\n# Keep this\r\ncustom:\r\n  nested: unchanged\r\n');
    expect(next.endsWith('# Nota\r\n')).toBe(true);
    expect(updateNoteProperty(next, "category", "")).toBe(source);
  });
  it("edits YAML inline and block tags without leaving old list items", () => {
    for (const tags of ['tags: [uno, "due"]\n', 'tags:\n  - uno\n  - due\n', 'tags:\n- uno\n- due\n']) {
      const source = `---\n${tags}aliases: [Alias]\n---\nTesto`;
      expect(readNoteProperties(source).values.tags, tags).toBe("uno, due");
      const next = updateNoteProperty(source, "tags", "#tre, quattro, tre");
      expect(next).toContain('tags: ["tre","quattro"]\n');
      expect(next).not.toContain("- uno");
      expect(next).toContain("aliases: [Alias]");
    }
  });
  it("preserves YAML comments in a complex tag list by leaving it to Sorgente", () => {
    const source = "---\ntags:\n  - uno\n\n# keep comment\n  - due\naliases: [Alias]\n---\nTesto";
    expect(readNoteProperties(source).unsupported).toContain("tags");
    expect(() => updateNoteProperty(source, "tags", "tre")).toThrow();
  });
  it("blocks ambiguous or advanced owned values rather than destroying YAML", () => {
    for (const source of ['---\ncategory: >\n  linea\n---\nTesto', '---\ncategory: A\ncategory: B\n---\nTesto', '---\ncategory: A\nTesto']) {
      expect(() => updateNoteProperty(source, "category", "C")).toThrow("Sorgente");
    }
  });
  it("hides metadata from reading, outline, tasks and links while preserving offsets", () => {
    const source = '---\ncategory: "[[Privato]]"\ncustom: |\n  # Nascosto\n  - [ ] Nascosto\n---\n# Titolo\n\n- [ ] Visibile\n[[Nota]]\n';
    const bodyFrom = frontmatterRange(source)!.end;
    expect(maskFrontmatter(source).length).toBe(source.length);
    expect(headingEntries(source)).toEqual([{ from: bodyFrom, level: 1, text: "Titolo" }]);
    expect(taskMarkers(source)).toHaveLength(1);
    expect(taskMarkers(source)[0]!.from).toBe(source.indexOf("[ ] Visibile"));
    expect(parseWikilinks(source).map(link => link.target)).toEqual(["Nota"]);
    const html = renderMarkdownSafe(source);
    expect(html).not.toContain("category"); expect(html).not.toContain("Nascosto"); expect(html).toContain("Titolo");
  });
  it("keeps frontmatter at the start when preparing personal templates without a heading", () => {
    const model = preparePersonalTemplate('---\ncategory: "Officina"\n---\nTesto', "Nota.md");
    expect(model).toBe('---\ncategory: "Officina"\n---\n# {{titolo}}\n\nTesto');
  });
});
