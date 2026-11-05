import { expect, test } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

test.beforeEach(async ({ page }) => {
  // Real local browser files, in isolated origin-private storage. No access to the
  // user's Vault and no production-only fixture hooks in application code.
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      const vault = await root.getDirectoryHandle("Nebula-test", { create: true });
      await vault.getDirectoryHandle("Procedure", { create: true });
      await vault.getDirectoryHandle("Archivio", { create: true });
      return vault;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vault pronto" })).toBeVisible();
});

test("creates a procedure, saves a reusable model, and reopens a derived note without data loss", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Nuovo", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Nuova nota" });
  await dialog.getByLabel("Modello", { exact: true }).selectOption("procedure");
  await dialog.getByLabel("Nome della nota").fill("Controllo pergola");
  await dialog.getByLabel("Cartella di destinazione").selectOption("Procedure");
  await dialog.getByText("Anteprima del modello", { exact: true }).click();
  await expect(dialog.locator("pre")).toContainText("# Controllo pergola");
  await expect(dialog.locator("pre")).toContainText("## Controlli finali");
  await page.screenshot({ path: join(tmpdir(), `nebula-models-create-${testInfo.project.name}.png`) });
  await dialog.getByRole("button", { name: "Crea nota", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Controllo pergola", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Sorgente", exact: true }).click();
  const editor = page.locator(".cm-content");
  await expect(editor).toContainText("## Controlli finali");
  await editor.click();
  await page.keyboard.press("Control+End");
  await page.keyboard.insertText("\nNota personale: verifica fissaggi.\n");
  await page.getByRole("button", { name: "Salva come modello", exact: true }).click();
  const saveDialog = page.getByRole("dialog", { name: "Salva come modello" });
  await saveDialog.getByLabel("Nome del modello").fill("Controllo personalizzato");
  await saveDialog.getByRole("button", { name: "Salva modello", exact: true }).click();
  await expect(saveDialog).not.toBeVisible();
  await expect(page.getByText("Modello salvato in Modelli/Controllo personalizzato.md. Disponibile dal pulsante Nuovo.")).toBeVisible();
  const readLocal = async (path: string) => page.evaluate(async segments => {
    let dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-test");
    for (const segment of segments.slice(0, -1)) dir = await dir.getDirectoryHandle(segment);
    return (await (await dir.getFileHandle(segments.at(-1)!)).getFile()).text();
  }, path.split("/"));
  expect(await readLocal("Modelli/Controllo personalizzato.md")).toContain("# {{titolo}}");
  expect(await readLocal("Modelli/Controllo personalizzato.md")).toContain("verifica fissaggi");
  await page.getByRole("tab", { name: "Inizio", exact: true }).click();
  await page.getByRole("button", { name: "Nuovo", exact: true }).last().click();
  await dialog.getByLabel("Modello", { exact: true }).selectOption("personal:Modelli/Controllo personalizzato.md");
  await dialog.getByLabel("Nome della nota").fill("Controllo seconda pergola");
  await dialog.getByLabel("Cartella di destinazione").selectOption("Archivio");
  await dialog.getByRole("button", { name: "Crea nota", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Controllo seconda pergola", exact: true })).toBeVisible();
  const copy = await readLocal("Archivio/Controllo seconda pergola.md");
  expect(copy).toContain("# Controllo seconda pergola");
  expect(copy).toContain("verifica fissaggi");
  expect(copy).not.toContain("{{titolo}}");
  expect(await readLocal("Procedure/Controllo pergola.md")).toContain("# Controllo pergola");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Vault pronto" })).toBeVisible();
  await page.getByRole("button", { name: "Nuovo", exact: true }).last().click();
  await expect(dialog.getByLabel("Modello", { exact: true }).locator("option[value='personal:Modelli/Controllo personalizzato.md']")).toHaveCount(1);
});

test("does not overwrite a duplicate note and preserves the dialog for correction", async ({ page }) => {
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("button", { name: "Nuovo", exact: true }).last().click();
    const dialog = page.getByRole("dialog", { name: "Nuova nota" });
    await dialog.getByLabel("Nome della nota").fill("Nota identica");
    if (attempt === 1) await dialog.getByLabel("Modello", { exact: true }).selectOption("solution");
    await dialog.getByRole("button", { name: "Crea nota", exact: true }).click();
    if (attempt === 0) {
      await expect(page.getByRole("heading", { name: "Nota identica", exact: true })).toBeVisible();
      await page.getByRole("tab", { name: "Inizio", exact: true }).click();
    } else {
      await expect(dialog.getByRole("alert")).toContainText("Esiste già");
      await expect(dialog).toBeVisible();
      const content = await page.evaluate(async () => {
        const dir = await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-test");
        return (await (await dir.getFileHandle("Nota identica.md")).getFile()).text();
      });
      expect(content).toBe("# Nota identica\n");
    }
  }
});
