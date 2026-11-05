import { expect, test } from "@playwright/test";
import { tmpdir } from "node:os";
import { join } from "node:path";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      return root.getDirectoryHandle("Nebula-notes-test", { create: true });
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vault pronto" })).toBeVisible();
});

test("captures from different areas into one real sheet, starting blank every time", async ({ page }) => {
  for (const [area, text] of [["Impostazioni", "Primo appunto"], ["Configuratori", "Secondo appunto"], ["Recenti", "Terzo appunto"]]) {
    await page.getByRole("button", { name: area, exact: true }).click();
    await page.getByRole("button", { name: "Nota veloce", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Nota veloce", exact: true });
    await expect(dialog.getByRole("textbox")).toHaveValue("");
    await dialog.getByRole("textbox").fill(text!);
    await dialog.getByRole("button", { name: "Aggiungi appunto", exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("button", { name: area, exact: true })).toHaveAttribute("aria-pressed", "true");
  }
  const content = await page.evaluate(async () => {
    const vault = await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-notes-test");
    return (await (await vault.getFileHandle("Appunti veloci.md")).getFile()).text();
  });
  expect(content).toContain("Primo appunto"); expect(content).toContain("Secondo appunto"); expect(content).toContain("Terzo appunto");
  expect(content.indexOf("Primo appunto")).toBeLessThan(content.indexOf("Secondo appunto"));
  expect(content.match(/^## \d{2}\/\d{2}\/\d{4} · \d{2}:\d{2}:\d{2}$/gm)).toHaveLength(3);
  await page.getByRole("button", { name: "Apri foglio", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Appunti veloci", exact: true })).toBeVisible();
  await expect(page.locator(".cm-content")).toContainText("Terzo appunto");
});

test("properties are optional, hideable and persisted in Markdown without changing the body", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Nuovo", exact: true }).last().click();
  const dialog = page.getByRole("dialog", { name: "Nuova nota" });
  await dialog.getByLabel("Nome della nota").fill("Nota libera");
  await dialog.getByRole("button", { name: "Crea nota", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Nota libera", exact: true })).toBeVisible();
  const panel = page.getByRole("region", { name: "Proprietà della nota" });
  await expect(panel).toHaveCount(0);
  await page.getByRole("button", { name: "Proprietà", exact: true }).click();
  await panel.getByLabel("Tipo", { exact: true }).selectOption("procedura");
  await panel.getByLabel("Categoria", { exact: true }).fill("Officina");
  await panel.getByLabel("Categoria", { exact: true }).press("Tab");
  await panel.getByLabel("Tag", { exact: true }).fill("pergola, manutenzione");
  await panel.getByLabel("Tag", { exact: true }).press("Tab");
  await page.screenshot({ path: join(tmpdir(), `nebula-properties-${testInfo.project.name}.png`) });
  await page.getByRole("button", { name: "Nascondi proprietà", exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.locator(".cm-content")).not.toContainText("Officina");
  await expect(page.getByText("Salvato automaticamente", { exact: true })).toBeVisible();
  const content = await page.evaluate(async () => {
    const vault = await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-notes-test");
    return (await (await vault.getFileHandle("Nota libera.md")).getFile()).text();
  });
  expect(content).toContain('category: "Officina"'); expect(content).toContain('tags: ["pergola","manutenzione"]'); expect(content.endsWith("# Nota libera\n")).toBe(true);
  await page.getByRole("button", { name: "Sorgente", exact: true }).click();
  await expect(page.locator(".cm-content")).toContainText("Officina");
});


test("hides capture IDs and displays both italic syntaxes in Scrivi and locked reading", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Nota veloce", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nota veloce", exact: true });
  await dialog.getByRole("textbox").fill("*Asterischi* e _underscore_");
  await dialog.getByRole("button", { name: "Aggiungi appunto", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Apri foglio", exact: true }).click();
  await expect(page.locator(".cm-content")).toContainText("Asterischi");
  await expect(page.locator(".cm-content")).not.toContainText("nebula-quick-note");
  for (const mode of ["write", "locked"]) {
    if (mode === "locked") await page.getByRole("button", { name: "Blocca pagina", exact: true }).click();
    const emphasis = page.locator(mode === "write" ? ".live-emphasis" : '.markdown-preview em');
    await expect(emphasis).toHaveCount(2);
    for (let theme = 0; theme < 2; theme++) {
      for (const element of await emphasis.all()) {
        await expect(element).toHaveCSS("font-style", "italic");
        expect(await element.evaluate(node => getComputedStyle(node).getPropertyValue("font-synthesis"))).toContain("style");
      }
      await page.screenshot({ path: join(tmpdir(), `nebula-italic-${mode}-${theme}-${testInfo.project.name}.png`) });
      await page.locator('.header-actions button[aria-label^="Tema:"]').click();
    }
  }
  await expect(page.getByRole("article", { name: "Nota in sola lettura" })).not.toContainText("nebula-quick-note");
  await page.getByRole("button", { name: "Sblocca pagina", exact: true }).click();
  await page.getByRole("button", { name: "Sorgente", exact: true }).click();
  await expect(page.locator(".cm-content")).toContainText("nebula-quick-note");
});
