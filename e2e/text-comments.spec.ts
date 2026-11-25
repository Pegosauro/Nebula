import { expect, test, type Locator, type Page } from "@playwright/test";

const title = "Verifica quote";
const quote = "5 mm di gioco";
const comment = "Confermare la tolleranza con il disegno tecnico.";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const directory = await navigator.storage.getDirectory();
      const vault = await directory.getDirectoryHandle("TextComments", { create: true });
      const file = await vault.getFileHandle("Verifica quote.md", { create: true });
      if (!(await file.getFile()).size) {
        const writable = await file.createWritable();
        await writable.write("# Verifica quote\n\n5 mm di gioco tra i profili.\n\nControllo finale.\n");
        await writable.close();
      }
      return vault;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault", exact: true }).click();
  await page.getByRole("heading", { name: "Inizio", exact: true }).waitFor();
  await openFromExplorer(page);
});

async function openFromExplorer(page: Page) {
  const explorer = page.getByRole("region", { name: "Explorer" });
  if (!await explorer.isVisible()) await page.getByRole("button", { name: "File", exact: true }).click();
  await explorer.getByRole("button", { name: title, exact: true }).click();
  if (page.viewportSize()!.width <= 900 && await explorer.isVisible()) {
    await page.getByRole("button", { name: "Chiudi pannello sinistro", exact: true }).click();
  }
}

async function selectPassage(note: Locator) {
  await note.press("Control+Home");
  await note.press("ArrowDown");
  await note.press("ArrowDown");
  await note.press("Home");
  for (let i = 0; i < quote.length; i++) await note.press("Shift+ArrowRight");
}

test("anchors an animated comment to text, saves it and reads it in locked mode", async ({ page }) => {
  const note = page.getByRole("textbox", { name: "Testo della nota" });
  await selectPassage(note);
  await page.getByRole("button", { name: "Aggiungi commento", exact: true }).click();
  const form = page.getByRole("dialog", { name: "Aggiungi commento" });
  await form.getByRole("textbox", { name: "Commento" }).fill(comment);
  await form.getByRole("button", { name: "Aggiungi", exact: true }).click();

  const mark = note.locator("[data-text-comment]");
  await expect(mark).toHaveText(quote);
  await mark.hover();
  const balloon = page.locator(".text-comment-balloon");
  await expect(balloon).toContainText(comment);
  await page.keyboard.press("Escape");
  await expect(balloon).toHaveCount(0);

  await note.press("Control+s");
  await expect(page.getByText("Salvato automaticamente", { exact: true })).toBeVisible();
  await expect.poll(() => page.evaluate(async () => {
    const vault = await (await navigator.storage.getDirectory()).getDirectoryHandle("TextComments");
    const handle = await vault.getFileHandle("Verifica quote.md");
    return (await handle.getFile()).text().catch(error => {
      if (error instanceof DOMException && error.name === "NotReadableError") return "";
      throw error;
    });
  })).toContain("<!-- nebula-text-comments:v1 ");
  await expect(note).not.toContainText("nebula-text-comments");

  await page.getByRole("button", { name: `Chiudi ${title}`, exact: true }).click();
  await openFromExplorer(page);
  await expect(mark).toHaveText(quote);

  await page.getByRole("button", { name: "Blocca pagina" }).click();
  const lockedMark = page.getByRole("article", { name: "Nota in sola lettura" }).locator("[data-text-comment]");
  await expect(lockedMark).toHaveText(quote);
  const reader = page.getByRole("article", { name: "Nota in sola lettura" });
  await reader.press("Tab");
  await expect(lockedMark).toBeFocused();
  await expect(balloon).toContainText(comment);
  await expect(balloon.getByRole("button", { name: "Modifica commento" })).toHaveCount(0);
});

test("moves the anchor with edits, restores it on undo and can reattach it", async ({ page }) => {
  const note = page.getByRole("textbox", { name: "Testo della nota" });
  await selectPassage(note);
  await note.press("Control+Alt+m");
  const form = page.getByRole("dialog", { name: "Aggiungi commento" });
  await form.getByRole("textbox", { name: "Commento" }).fill(comment);
  await form.getByRole("button", { name: "Aggiungi", exact: true }).click();
  const mark = note.locator("[data-text-comment]");
  const listTrigger = page.getByRole("button", { name: "1 commento", exact: true });
  await expect(mark).toHaveText(quote);

  await note.press("Home");
  await page.keyboard.insertText("Misura: ");
  await expect(mark).toHaveText(quote);

  await listTrigger.click();
  const list = page.getByRole("dialog", { name: "Commenti della nota" });
  await list.getByRole("button", { name: "Vai al testo" }).click();
  await note.press("Backspace");
  await expect(mark).toHaveCount(0);
  await note.press("Control+z");
  await expect(mark).toHaveText(quote);
  await page.getByRole("button", { name: "Ripristina", exact: true }).click();
  await expect(mark).toHaveCount(0);

  await note.press("End");
  for (let i = 0; i < "profili.".length; i++) await note.press("Shift+ArrowLeft");
  await listTrigger.click();
  await expect(list).toContainText("Testo da ricollegare");
  await list.getByRole("button", { name: "Modifica", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "Modifica commento" });
  await edit.getByRole("button", { name: "Ricollega alla selezione" }).click();
  await expect(mark).toHaveText("profili.");
});


test.describe("touch", () => {
  test.use({ hasTouch: true });

  test("opens the comment on a tap and allows editing or removal", async ({ page }) => {
    const note = page.getByRole("textbox", { name: "Testo della nota" });
    await selectPassage(note);
    await note.press("Control+Alt+m");
    const form = page.getByRole("dialog", { name: "Aggiungi commento" });
    await form.getByRole("textbox", { name: "Commento" }).fill(comment);
    await form.getByRole("button", { name: "Aggiungi", exact: true }).click();
    const mark = note.locator("[data-text-comment]");
    await mark.tap();
    const balloon = page.locator(".text-comment-balloon");
    await expect(balloon).toContainText(comment);
    await balloon.getByRole("button", { name: "Modifica commento" }).tap();
    const edit = page.getByRole("dialog", { name: "Modifica commento" });
    await edit.getByRole("textbox", { name: "Commento" }).fill("Tolleranza confermata.");
    await edit.getByRole("button", { name: "Salva", exact: true }).click();
    await mark.tap();
    await expect(balloon).toContainText("Tolleranza confermata.");
    await balloon.getByRole("button", { name: "Modifica commento" }).tap();
    await edit.getByRole("button", { name: "Elimina", exact: true }).click();
    await edit.getByRole("button", { name: "Elimina", exact: true }).click();
    await expect(mark).toHaveCount(0);
    await expect(page.getByRole("button", { name: "1 commento", exact: true })).toHaveCount(0);
  });
});
