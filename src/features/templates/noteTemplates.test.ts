import { describe, expect, it } from "vitest";
import { BUILTIN_TEMPLATES, instantiateTemplate, personalTemplates } from "./noteTemplates";
import { preparePersonalTemplate } from "./preparePersonalTemplate";
import type { VaultSnapshot } from "../../domain/vault";

describe("note templates", () => {
  it("fills title and local date in every built-in without leaving tokens", () => {
    for (const template of BUILTIN_TEMPLATES) {
      const content = instantiateTemplate(template.content!, "Controllo pergola.md", new Date(2026, 9, 1, 0, 30));
      expect(content).toContain("# Controllo pergola\n");
      expect(content).toContain("01/10/2026");
      expect(content).not.toContain("{{");
      expect(content).toContain('status: "bozza"');
      expect(content).not.toContain("**Stato:**");
    }
  });
  it("validates filenames and inserts special title characters literally", () => {
    expect(() => instantiateTemplate("{{titolo}}", "../Fuori")).toThrow();
    expect(instantiateTemplate("# {{titolo}}", "Test [A]")).toBe("# Test \\[A\\]");
    expect(instantiateTemplate("{{titolo}} {{data}} {{altro}}", "Test", new Date(2026, 9, 1))).toContain("{{altro}}");
  });
  it("uses only Markdown files directly inside the Vault's model folder", () => {
    const snapshot = { root: [{ name: "modelli", type: "directory", children: [
      { name: "Mio.md", path: "modelli/Mio.md", type: "file", extension: ".md" },
      { name: "Foto.png", path: "modelli/Foto.png", type: "file", extension: ".png" },
    ] }] } as VaultSnapshot;
    expect(personalTemplates(snapshot)).toEqual([{ id: "personal:modelli/Mio.md", name: "Mio", path: "modelli/Mio.md", description: "Modello personale nel Vault" }]);
  });
  it("preserves code examples, reuses the main heading, and keeps image references valid", () => {
    const original = "```md\n# Esempio\n![esempio](foto.png)\n```\n\n# Titolo originale\n\n![Foto](../attachments/foto%20uno.png)\n![Web](https://example.com/a.png)\n## Dettagli\n";
    const model = preparePersonalTemplate(original, "Procedure/Originale.md");
    expect(model).toContain("# {{titolo}}");
    expect(model).toContain("![Foto](/attachments/foto%20uno.png)");
    expect(model).toContain("![esempio](foto.png)");
    expect(model).toContain("![Web](https://example.com/a.png)");
    expect(model).toContain("## Dettagli");
    expect(preparePersonalTemplate(model, "Modelli/Mio.md")).toBe(model);
    expect(original).toContain("# Titolo originale");
  });
  it("rejects local asset paths that escape the Vault", () => {
    expect(() => preparePersonalTemplate("![Foto](../../fuori.png)", "Nota.md")).toThrow("Vault");
  });
});
