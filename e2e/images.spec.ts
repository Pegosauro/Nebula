import { expect, test } from "@playwright/test";

test("resizes, zooms, archives and undoes a note image", async ({ page }) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const vault = await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-image-test", { create: true });
      const attachments = await vault.getDirectoryHandle("attachments", { create: true });
      const image = await (await attachments.getFileHandle("schema.png", { create: true })).createWritable();
      await image.write(await (await fetch("./icons/nebula-192.png")).blob());
      await image.close();
      const note = await (await vault.getFileHandle("Schema.md", { create: true })).createWritable();
      await note.write("# Schema\n\n![Disegno](attachments/schema.png)\n\nDopo\n");
      await note.close();
      return vault;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault", exact: true }).click();
  await page.getByRole("button", { name: "Schema", exact: true }).click();
  const image = page.locator(".live-image img[alt='Disegno']");
  const handles = page.getByRole("button", { name: /Ridimensiona dall’angolo/ });
  await expect.poll(() => image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBe(192);
  await image.click();
  await expect(handles).toHaveCount(4);
  const corner = (await page.getByRole("button", { name: "Ridimensiona dall’angolo in basso a destra" }).boundingBox())!;
  await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
  await page.mouse.down();
  await page.mouse.move(corner.x + corner.width / 2 + 36, corner.y + corner.height / 2 + 36, { steps: 4 });
  await page.mouse.up();
  await expect(image).toHaveAttribute("width", "228");
  await image.dblclick();
  const viewer = page.getByRole("dialog", { name: /Anteprima immagine/ });
  const zoom = viewer.getByLabel("Livello di zoom");
  await viewer.getByRole("button", { name: "Aumenta zoom" }).click();
  await expect(zoom).toHaveText("125%");
  await viewer.getByRole("button", { name: "Adatta" }).click();
  await expect(zoom).toHaveText("100%");
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await page.getByRole("button", { name: "Blocca pagina", exact: true }).click();
  const readingImage = page.locator(".markdown-preview img[alt='Disegno']");
  await expect(readingImage).toHaveAttribute("width", "228");
  await readingImage.dblclick();
  await expect(viewer).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Sblocca pagina", exact: true }).click();
  await image.click();
  await page.keyboard.press("Delete");
  await expect(image).toHaveCount(0);
  const attachmentExists = () => page.evaluate(async () => {
    const vault = await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-image-test");
    const folder = await vault.getDirectoryHandle("attachments");
    try { await folder.getFileHandle("schema.png"); return true; }
    catch (error) { if (error instanceof DOMException && error.name === "NotFoundError") return false; throw error; }
  });
  await expect.poll(attachmentExists).toBe(false);
  await page.keyboard.press("Control+z");
  await expect(image).toHaveAttribute("width", "228");
  await expect.poll(attachmentExists).toBe(true);
});
