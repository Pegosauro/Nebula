import { expect, test } from "@playwright/test";

const noteTitle = "Collegamenti esterni";
const note = [
  "# Collegamenti esterni",
  "",
  "[Catalogo tecnico](https://example.org/catalogo.pdf)",
  "[Area tecnica](https://example.org/produttore)",
  "",
  "Consulta la [guida del produttore](https://example.org/guida) per le quote.",
  "",
  "[[Una nota collegata]]",
  "",
].join("\n");

test("customizes standalone external cards and keeps inline links discreet", async ({ page }) => {
  await page.addInitScript(source => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      const vault = await root.getDirectoryHandle("Nebula-link-cards", { create: true });
      const handle = await vault.getFileHandle("Collegamenti esterni.md", { create: true });
      const file = await handle.createWritable();
      await file.write(source);
      await file.close();
      return vault;
    };
  }, note);
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inizio", exact: true })).toBeVisible();
  const explorer = page.getByRole("region", { name: "Explorer" });
  if (!await explorer.isVisible()) await page.getByRole("button", { name: "File", exact: true }).click();
  await explorer.getByRole("button", { name: noteTitle, exact: true }).click();
  const scrim = page.getByRole("button", { name: "Chiudi pannello sinistro", exact: true });
  if (await scrim.isVisible()) await scrim.click();

  const editor = page.getByRole("textbox", { name: "Testo della nota" });
  const cards = editor.locator(".external-link-card");
  const pdf = editor.getByRole("link", { name: "Catalogo tecnico", exact: true });
  await expect(cards).toHaveCount(2);
  await expect(pdf).toHaveAttribute("data-tone", "rosso");
  await expect(pdf).toHaveAttribute("target", "_blank");
  await expect(pdf.locator(".external-link-glyph")).toHaveCSS("width", "38px");
  await pdf.click({ button: "right" });

  const dialog = page.getByRole("dialog", { name: "Modifica collegamento" });
  const address = dialog.getByRole("textbox", { name: "Indirizzo" });
  await expect(address).toHaveValue("https://example.org/catalogo.pdf");
  const box = (await address.boundingBox())!;
  const bounds = (await dialog.boundingBox())!;
  const releaseX = bounds.x > 10 ? bounds.x - 5 : bounds.x + bounds.width + 4;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(releaseX, box.y + box.height / 2, { steps: 15 });
  await page.mouse.up();
  await expect(dialog).toBeVisible();
  const selected = await address.evaluate(input => {
    const element = input as HTMLInputElement;
    return element.value.slice(element.selectionStart ?? 0, element.selectionEnd ?? 0);
  });
  expect(selected.length).toBeGreaterThan(0);
  await page.keyboard.press("Control+c");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(selected);
  await page.mouse.click(releaseX, box.y + box.height / 2);
  await expect(dialog).toBeHidden();

  await editor.getByRole("button", { name: "Modifica collegamento: Catalogo tecnico" }).click();
  await expect(dialog.getByRole("group", { name: "Icona" }).getByRole("button")).toHaveCount(10);
  await dialog.getByRole("button", { name: "Excel", exact: true }).click();
  await dialog.getByRole("button", { name: "Verde", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Testo", exact: true }).fill("Distinta materiali");
  await address.fill("https://example.org/distinta.xlsx");
  await expect(dialog.locator(".external-link-example")).toHaveAttribute("data-tone", "verde");
  await expect(dialog.locator(".external-link-domain")).toHaveText("example.org · Excel");
  await dialog.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(editor.getByRole("link", { name: "Distinta materiali" })).toHaveAttribute("href", "https://example.org/distinta.xlsx");

  const sentence = editor.locator(".cm-line").filter({ hasText: "Consulta la" });
  const inlineLink = sentence.locator(".live-link");
  await expect(inlineLink).toHaveText("guida del produttore");
  await expect(inlineLink).not.toHaveAttribute("title");
  await sentence.click({ position: { x: 3, y: 5 } });
  await expect(dialog).toBeHidden();
  await expect(page.locator(".note-link-preview")).toHaveCount(0);
  await inlineLink.click({ button: "right" });
  await expect(dialog.getByRole("group", { name: "Icona" })).toHaveCount(0);
  await dialog.getByRole("textbox", { name: "Testo", exact: true }).fill("istruzioni");
  await dialog.getByRole("button", { name: "Salva", exact: true }).click();
  await expect(sentence.locator(".live-link")).toHaveText("istruzioni");
  await sentence.locator(".live-link").click({ button: "right" });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  await expect(page.getByText("Salvato automaticamente", { exact: true })).toBeVisible();
  const saved = await page.evaluate(async title => {
    const vault = await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-link-cards");
    return (await (await vault.getFileHandle(`${title}.md`)).getFile()).text();
  }, noteTitle);
  expect(saved).toContain("nebula-link:v1:excel:verde");
  expect(saved).toContain("[[Una nota collegata]]");
  await page.getByRole("button", { name: "Blocca pagina", exact: true }).click();
  const reading = page.getByRole("article", { name: "Nota in sola lettura" });
  await expect(reading.locator(".external-link-card")).toHaveCount(2);
  await expect(reading.getByRole("link", { name: "Distinta materiali" })).toHaveAttribute("data-tone", "verde");
  await expect(reading.getByRole("link", { name: "istruzioni" })).toHaveAttribute("href", "https://example.org/guida");
});
