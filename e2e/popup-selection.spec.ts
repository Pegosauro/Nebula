import { expect, test, type Locator, type Page } from "@playwright/test";

async function dragOutside(page: Page, popup: Locator, text: Locator) {
  await expect(popup).toBeVisible();
  await popup.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  const box = (await popup.boundingBox())!;
  const start = await text.evaluate(element => {
    if (element instanceof HTMLTextAreaElement) {
      const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
      return { x: rect.left + element.clientLeft + parseFloat(style.paddingLeft), y: rect.top + element.clientTop + parseFloat(style.paddingTop) + 8 };
    }
    const range = document.createRange();
    range.setStart(element.firstChild!, 0);
    range.setEnd(element.firstChild!, 1);
    const rect = range.getBoundingClientRect();
    return { x: rect.left + 1, y: rect.top + rect.height / 2 };
  });
  const outside = { x: box.x + box.width + 5, y: start.y };
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  const within = await text.evaluate(element => {
    if (element instanceof HTMLTextAreaElement) return element.getBoundingClientRect().right - 6;
    const range = document.createRange();
    const node = element.lastChild!;
    range.setStart(node, Math.min(25, (node.textContent?.length ?? 1) - 1));
    range.setEnd(node, range.startOffset + 1);
    return range.getBoundingClientRect().right;
  });
  await page.mouse.move(within, start.y, { steps: 12 });
  if (await text.evaluate(element => element.tagName !== "TEXTAREA")) {
    await expect.poll(() => page.evaluate(() => String(getSelection()).length)).toBeGreaterThan(5);
  }
  await page.mouse.move(outside.x, outside.y, { steps: 3 });
  // Stay outside with the button down beyond the hover dismissal delay.
  await new Promise(resolve => setTimeout(resolve, 250));
  await page.mouse.up();
  return outside;
}

test.describe("editor popups", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.showDirectoryPicker = async () => {
        const origin = await navigator.storage.getDirectory();
        const vault = await origin.getDirectoryHandle("PopupSelection", { create: true });
        const quote = "5 mm di gioco";
        const body = `# Verifica quote\n\n${quote} tra i profili.\n\n[[Dettaglio]]\n\n![Disegno tecnico](attachments/schema.png)\n`;
        const from = body.indexOf(quote);
        const comments = [{ id: crypto.randomUUID(), text: "Verificare la tolleranza prima di aggiornare la distinta.", quote, from, before: body.slice(0, from), after: body.slice(from + quote.length, from + quote.length + 48) }];
        const trailer = encodeURIComponent(JSON.stringify(comments)).replaceAll("-", "%2D");
        const write = async (path: string, data: string | Blob, directory = vault) => {
          const stream = await (await directory.getFileHandle(path, { create: true })).createWritable();
          await stream.write(data);
          await stream.close();
        };
        await write("Verifica quote.md", body + `\n\n<!-- nebula-text-comments:v1 ${trailer} -->\n`);
        await write("Dettaglio.md", "La misura va controllata sul disegno.");
        const attachments = await vault.getDirectoryHandle("attachments", { create: true });
        await write("schema.png", await (await fetch("./icons/nebula-192.png")).blob(), attachments);
        return vault;
      };
    });
    await page.goto("/");
    await page.getByRole("button", { name: "Apri Vault", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Inizio" })).toBeVisible();
    const explorer = page.getByRole("region", { name: "Explorer" });
    if (!await explorer.isVisible()) await page.getByRole("button", { name: "File", exact: true }).click();
    await explorer.getByRole("button", { name: "Verifica quote", exact: true }).click();
    const scrim = page.getByRole("button", { name: "Chiudi pannello sinistro", exact: true });
    if (await scrim.isVisible()) await scrim.click();
  });

  test("preserves selection in the comment balloon and edit dialog", async ({ page }) => {
    await page.locator(".cm-content [data-text-comment]").hover();
    const balloon = page.locator(".text-comment-balloon");
    await dragOutside(page, balloon, balloon.locator("p"));
    await expect(balloon).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toContain("Verificare la tolleranza");

    await balloon.getByRole("button", { name: "Modifica commento" }).click();
    const dialog = page.getByRole("dialog", { name: "Modifica commento" });
    const field = dialog.getByRole("textbox", { name: "Commento" });
    const backdrop = await dragOutside(page, dialog, field);
    await expect(dialog).toBeVisible();
    await expect.poll(() => field.evaluate((element: HTMLTextAreaElement) => element.value.slice(element.selectionStart, element.selectionEnd))).toContain("Verificare la tolleranza");
    await page.mouse.click(backdrop.x, backdrop.y);
    await expect(dialog).toBeHidden();
  });

  test("preserves selection in the note link preview", async ({ page }) => {
    await page.locator(".cm-content [data-live-target]").hover();
    const popup = page.locator(".note-link-preview");
    await expect(popup.getByText("La misura va controllata sul disegno.")).toBeVisible();
    const outside = await dragOutside(page, popup, popup.locator(".note-preview-content p"));
    await expect(popup).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toContain("La misura va controllata");
    await page.mouse.click(outside.x, outside.y);
    await expect(popup).toBeHidden();
  });

  test("preserves title selection in the image viewer", async ({ page }) => {
    await page.locator(".live-image img").dblclick();
    const viewer = page.getByRole("dialog", { name: /Anteprima immagine/ });
    await dragOutside(page, viewer, viewer.locator("header strong"));
    await expect(viewer).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toContain("Disegno tecnico");
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
  });
});

test("preserves selection in the configurator rule preview", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault di prova", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inizio" })).toBeVisible();
  await page.getByRole("button", { name: "Configuratori", exact: true }).click();
  await page.getByRole("button", { name: /Pergola dimostrativa/ }).first().click();
  await page.getByRole("button", { name: "Componenti", exact: true }).click();
  await page.getByPlaceholder("Codice o descrizione").fill("PR001");
  await page.locator('summary[aria-label="Azioni PR001"]').click();
  await page.getByRole("button", { name: "Modifica regola per PR001" }).hover();
  const popup = page.locator(".config-rule-preview");
  const outside = await dragOutside(page, popup, popup.locator("strong"));
  await expect(popup).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.getSelection()?.toString())).toContain("Regole attive");
  await page.mouse.click(outside.x, outside.y);
  await expect(popup).toBeHidden();
});
