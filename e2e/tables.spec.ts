import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { tmpdir } from "node:os";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const vault = await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-table-test", { create: true });
      const attachments = await vault.getDirectoryHandle("attachments", { create: true });
      const image = await (await attachments.getFileHandle("pixel.png", { create: true })).createWritable();
      const png = atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lS8AAAAASUVORK5CYII=");
      await image.write(new Uint8Array(Array.from(png, c => c.charCodeAt(0)))); await image.close();
      const note = await (await vault.getFileHandle("Dati progetto.md", { create: true })).createWritable();
      await note.write("# Dati progetto\n\n![Immagine locale](attachments/pixel.png)\n\n| A | B | C |\n| --- | --- | --- |\n| Uno | *Due* | Tre |\n| Quattro | Cinque | Sei |\n\nFine della nota\n"); await note.close();
      return vault;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault", exact: true }).click();
  await page.getByRole("button", { name: "Dati progetto", exact: true }).click();
});

test("hides attachments, saves merged resized cells, and keeps writing centered like reading", async ({ page }, testInfo) => {
  await expect(page.locator('.file-tree .tree-name').filter({ hasText: /^attachments$/i })).toHaveCount(0);
  await expect(page.locator('.live-image img[alt="Immagine locale"]')).toBeVisible();
  await page.locator('.live-table td').first().click();
  await page.getByRole("button", { name: "Modifica tabella", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Modifica tabella", exact: true });
  await dialog.getByRole("button", { name: "Seleziona riga 1 colonna 1", exact: true }).click();
  await dialog.getByRole("button", { name: "Seleziona riga 2 colonna 2", exact: true }).click({ modifiers: ["Shift"] });
  await dialog.getByRole("button", { name: "Unisci celle", exact: true }).click();
  await expect(dialog.locator('td[rowspan="2"][colspan="2"]')).toHaveCount(1);
  await dialog.getByRole("spinbutton", { name: "Larghezza colonna in pixel" }).fill("220");
  await dialog.getByRole("spinbutton", { name: "Larghezza colonna in pixel" }).press("Tab");
  await dialog.getByRole("separator", { name: "Ridimensiona colonna 1", exact: true }).press("ArrowRight");
  const resize = await dialog.getByRole("separator", { name: "Ridimensiona colonna 3", exact: true }).boundingBox();
  expect(resize).not.toBeNull();
  await page.mouse.move(resize!.x + resize!.width / 2, resize!.y + resize!.height / 2);
  await page.mouse.down(); await page.mouse.move(resize!.x + resize!.width / 2 + 60, resize!.y + resize!.height / 2); await page.mouse.up();
  await dialog.getByRole("button", { name: "Applica modifiche", exact: true }).click();
  const table = page.locator('.live-table table');
  await expect(table.locator('td[rowspan="2"][colspan="2"]')).toContainText("Cinque");
  await expect(table).toHaveCSS("width", "610px");
  await expect(page.locator('.cm-content')).not.toContainText("nebula-table:");
  await expect(page.getByText("Salvato automaticamente", { exact: true })).toBeVisible();
  const file = await page.evaluate(async () => (await (await (await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-table-test")).getFileHandle("Dati progetto.md")).getFile()).text());
  expect(file.match(/<!-- nebula-table:/g)).toHaveLength(1); expect(file).toContain('"widths":[230,160,220]'); expect(file).toContain("Quattro | Cinque");
  await page.locator('.live-table td').first().click();
  await page.getByRole("button", { name: "Modifica tabella", exact: true }).click();
  await dialog.getByRole("button", { name: "Dividi celle", exact: true }).click();
  await expect(dialog.getByRole("textbox", { name: "Riga 2 colonna 2", exact: true })).toHaveValue("Cinque");
  await dialog.getByRole("button", { name: "Chiudi", exact: true }).click();
  for (const width of [1280, 1920, 430]) {
    await page.setViewportSize({ width, height: 900 });
    for (const theme of ["first", "second"]) {
      const writing = await page.locator('.cm-content').evaluate(element => {
        const box = element.getBoundingClientRect(), parent = element.parentElement!;
        return { width: box.width, left: box.left - parent.getBoundingClientRect().left, right: parent.getBoundingClientRect().left + parent.clientWidth - box.right };
      });
      expect(Math.abs(writing.left - writing.right)).toBeLessThan(4);
      await page.screenshot({ path: join(tmpdir(), `nebula-tables-write-${width}-${theme}-${testInfo.project.name}.png`) });
      await page.getByRole("button", { name: "Blocca pagina", exact: true }).click();
      await expect(page.locator('.editor-surface > .markdown-preview table td[rowspan="2"][colspan="2"]')).toHaveCount(1);
      const reading = await page.locator('.editor-surface > .markdown-preview > div').boundingBox();
      expect(reading!.width).toBeCloseTo(writing.width, 0);
      await page.screenshot({ path: join(tmpdir(), `nebula-tables-read-${width}-${theme}-${testInfo.project.name}.png`) });
      await page.getByRole("button", { name: "Sblocca pagina", exact: true }).click();
      await page.locator('.header-actions button[aria-label^="Tema:"]').click();
    }
  }
});
