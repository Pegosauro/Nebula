import { expect, test, type Locator, type Page } from "@playwright/test";

const buttonName = "Aggiungi controllo";

async function openNote(page: Page) {
  const explorer = page.getByRole("region", { name: "Explorer" });
  if (!await explorer.isVisible()) await page.getByRole("button", { name: "File", exact: true }).click();
  await explorer.getByRole("button", { name: "Controlli", exact: true }).click();
  const scrim = page.getByRole("button", { name: "Chiudi pannello sinistro", exact: true });
  if (await scrim.isVisible()) await scrim.click();
}

async function createButton(page: Page, template: string) {
  await page.getByRole("button", { name: "Inserisci", exact: true }).click();
  const insert = page.getByRole("dialog", { name: "Inserisci elemento" });
  await insert.getByRole("textbox", { name: "Cerca funzione" }).fill("Pulsante di testo");
  await insert.getByRole("button", { name: /Pulsante di testo/ }).click();
  const form = page.getByRole("dialog", { name: "Pulsante di testo" });
  await form.getByRole("textbox", { name: "Nome" }).fill(buttonName);
  const field = form.getByRole("textbox", { name: "Testo da inserire" });
  await field.fill(template);
  return { form, field };
}

async function dragTextOutside(page: Page, popup: Locator, field: Locator) {
  const box = (await popup.boundingBox())!, input = (await field.boundingBox())!;
  const start = { x: input.x + 12, y: input.y + 18 };
  const outsideX = box.x + box.width + 4;
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(input.x + 136, start.y, { steps: 8 });
  await page.mouse.move(outsideX, start.y, { steps: 6 });
  await page.mouse.up();
  await expect(popup).toBeVisible();
  await expect.poll(() => field.evaluate((element: HTMLTextAreaElement) => element.selectionEnd - element.selectionStart)).toBeGreaterThan(0);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      const vault = await root.getDirectoryHandle("Nebula-text-button-test", { create: true });
      const file = await vault.getFileHandle("Controlli.md", { create: true });
      if (!(await file.getFile()).size) {
        const writable = await file.createWritable();
        await writable.write("# Controlli\n\nTesto originale.\n");
        await writable.close();
      }
      return vault;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inizio", exact: true })).toBeVisible();
  await openNote(page);
});

test("inserts editable Markdown and resolves the date on every click", async ({ page }) => {
  await page.clock.setFixedTime(new Date(2026, 10, 26, 14, 25));
  await page.getByRole("button", { name: "Elenchi, citazioni e avvisi" }).click();
  const menu = page.getByRole("menu", { name: "Elenchi, citazioni e avvisi" });
  const action = menu.getByRole("menuitem", { name: "Pulsante di testo" });
  await expect(action.locator(".text-button-icon")).toBeVisible();
  await action.click();
  await expect(menu).toBeHidden();
  const form = page.getByRole("dialog", { name: "Pulsante di testo" });
  await form.getByRole("textbox", { name: "Nome" }).fill(buttonName);
  const field = form.getByRole("textbox", { name: "Testo da inserire" });
  await field.fill("### Controllo del ");
  await field.press("End");
  await form.getByRole("button", { name: "Inserisci data attuale" }).click();
  await expect(field).toHaveValue("### Controllo del {{data}}");
  await field.press("End");
  await page.keyboard.insertText("\n\n- [ ] Verificare profilo");
  await form.getByRole("button", { name: "Inserisci pulsante" }).click();

  const button = page.getByRole("button", { name: buttonName, exact: true });
  await expect(button).toBeVisible();
  await expect(page.locator(".text-button-icon")).toBeVisible();
  await page.clock.setFixedTime(new Date(2026, 10, 27, 9, 15));
  await button.click();
  const content = page.locator(".cm-content");
  await expect(content).toContainText("27/11/2026");
  await expect(content.locator(".live-task")).toHaveCount(1);

  await page.clock.setFixedTime(new Date(2026, 10, 28, 10, 30));
  await button.click();
  await expect(content).toContainText("28/11/2026");
  await expect(content.locator(".live-task")).toHaveCount(2);
  await page.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(content).not.toContainText("28/11/2026");
  await expect(content).toContainText("27/11/2026");
  await expect(button).toBeVisible();
  await page.getByRole("textbox", { name: "Testo della nota" }).press("Control+s");
  await expect(page.getByText("Salvato automaticamente", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const vault = await root.getDirectoryHandle("Nebula-text-button-test");
    const file = await (await vault.getFileHandle("Controlli.md")).getFile();
    return file.text().catch(error => {
      if (error instanceof DOMException && error.name === "NotReadableError") return "";
      throw error;
    });
  })).toContain("### Controllo del 27/11/2026");
  await page.getByRole("button", { name: "Chiudi Controlli", exact: true }).click();
  await openNote(page);
  await expect(button).toBeVisible();
});

test("configures the button from the context menu and preserves text selection", async ({ page }) => {
  const { form } = await createButton(page, "Confermare la distinta tecnica.");
  await form.getByRole("button", { name: "Inserisci pulsante" }).click();
  const button = page.getByRole("button", { name: buttonName, exact: true });
  await button.click({ button: "right" });

  const config = page.getByRole("dialog", { name: "Configura pulsante" });
  const field = config.getByRole("textbox", { name: "Testo da inserire" });
  await expect(field).toHaveValue("Confermare la distinta tecnica.");
  await dragTextOutside(page, config, field);
  await config.getByRole("button", { name: "Prima", exact: true }).click();
  await config.getByRole("button", { name: "Salva", exact: true }).click();
  await button.click();
  await expect(page.locator(".cm-content")).toContainText("Confermare la distinta tecnica.");
  await expect.poll(() => page.locator(".cm-content").evaluate(content => {
    const text = [...content.querySelectorAll(".cm-line")].find(line => line.textContent === "Confermare la distinta tecnica.");
    const widget = content.querySelector(".note-text-button");
    return !!text && !!widget && Boolean(text.compareDocumentPosition(widget) & Node.DOCUMENT_POSITION_FOLLOWING);
  })).toBe(true);

  await page.getByRole("button", { name: "Sorgente", exact: true }).click();
  await expect(page.locator(".cm-content")).toContainText("nebula-text-button:v1");
  await page.getByRole("button", { name: "Scrivi", exact: true }).click();
  await button.click({ button: "right" });
  await config.getByRole("button", { name: "Rimuovi pulsante" }).click();
  await expect(button).toHaveCount(0);
  await expect(page.locator(".cm-content")).toContainText("Confermare la distinta tecnica.");
});


test.describe("touch", () => {
  test.use({ hasTouch: true });

  test("opens configuration with a long press and inserts with a tap", async ({ page, context }) => {
    const { form } = await createButton(page, "Una nuova verifica.");
    await form.getByRole("button", { name: "Inserisci pulsante" }).click();
    const button = page.getByRole("button", { name: buttonName, exact: true });
    await expect(button).toBeVisible();
    await button.scrollIntoViewIfNeeded();
    const box = (await button.boundingBox())!;
    const cdp = await context.newCDPSession(page);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2 }] });
    const config = page.getByRole("dialog", { name: "Configura pulsante" });
    await expect(config).toBeVisible();
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    await config.getByRole("button", { name: "Chiudi", exact: true }).tap();
    await expect(page.locator(".cm-content")).not.toContainText("Una nuova verifica.");
    await button.tap();
    await expect(page.locator(".cm-content")).toContainText("Una nuova verifica.");
    await cdp.detach();
  });
});
