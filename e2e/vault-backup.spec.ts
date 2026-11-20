import { expect, test } from "@playwright/test";

const primaryName = "Test Nebula principale";
const backupName = "Test Nebula backup";
const notePath = "Nota di recupero.md";

test("continues writing in the backup and reconciles a conflict when the primary returns", async ({ page }) => {
  await page.addInitScript(({ primaryName, backupName }) => {
    window.showDirectoryPicker = async options => (await navigator.storage.getDirectory())
      .getDirectoryHandle(options?.id === "nebula-vault-backup" ? backupName : primaryName, { create: true });
    const query = FileSystemDirectoryHandle.prototype.queryPermission;
    const request = FileSystemDirectoryHandle.prototype.requestPermission;
    const denied = (handle: FileSystemDirectoryHandle) => handle.name === primaryName && localStorage.getItem("test-primary-unavailable") === "yes";
    FileSystemDirectoryHandle.prototype.queryPermission = function (options) { return denied(this) ? Promise.resolve("denied") : query?.call(this, options) ?? Promise.resolve("granted"); };
    FileSystemDirectoryHandle.prototype.requestPermission = function (options) { return denied(this) ? Promise.resolve("denied") : request?.call(this, options) ?? Promise.resolve("granted"); };
  }, { primaryName, backupName });
  await page.goto("/");
  const write = (directory: string, text: string) => page.evaluate(async ({ directory, notePath, text }) => {
    const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle(directory, { create: true });
    const stream = await (await folder.getFileHandle(notePath, { create: true })).createWritable();
    await stream.write(text);
    await stream.close();
  }, { directory, notePath, text });
  const read = (directory: string) => page.evaluate(async ({ directory, notePath }) => {
    const folder = await (await navigator.storage.getDirectory()).getDirectoryHandle(directory);
    return (await (await folder.getFileHandle(notePath)).getFile()).text();
  }, { directory, notePath });

  await write(primaryName, "Testo iniziale");
  await page.getByRole("button", { name: "Apri Vault", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vault pronto" })).toBeVisible();
  await page.getByRole("button", { name: "Impostazioni", exact: true }).click();
  await page.getByRole("button", { name: "Configura backup", exact: true }).click();
  await expect(page.getByRole("button", { name: "Aggiorna ora", exact: true })).toBeEnabled();
  expect(await read(backupName)).toBe("Testo iniziale");

  await page.evaluate(() => localStorage.setItem("test-primary-unavailable", "yes"));
  await page.reload();
  await page.getByRole("button", { name: "Apri backup", exact: true }).click();
  await expect(page.getByText("Modalità backup", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Nota di recupero", exact: true }).click();
  const editor = page.getByRole("textbox", { name: "Testo della nota" });
  await expect(editor).toContainText("Testo iniziale");
  await editor.click();
  await editor.press("Control+a");
  await page.keyboard.insertText("Modifica durante il guasto");
  await expect.poll(() => read(backupName)).toBe("Modifica durante il guasto");
  expect(await read(primaryName)).toBe("Testo iniziale");

  await write(primaryName, "Modifica fatta altrove");
  await page.evaluate(() => localStorage.removeItem("test-primary-unavailable"));
  await page.getByRole("button", { name: "Confronta modifiche", exact: true }).click();
  const review = page.getByRole("dialog", { name: "Confronta Vault principale e backup" });
  await expect(review.getByText("Conflitto tra versioni")).toBeVisible();
  await review.getByText("Vedi versioni", { exact: true }).click();
  await expect(review.getByText("Modifica fatta altrove", { exact: true })).toBeVisible();
  await expect(review.getByText("Modifica durante il guasto", { exact: true })).toBeVisible();
  const apply = review.getByRole("button", { name: "Applica e apri il Vault principale", exact: true });
  await expect(apply).toBeDisabled();
  await review.getByRole("combobox", { name: `Versione da tenere per ${notePath}` }).selectOption("backup");
  await apply.click();
  await expect(review).not.toBeVisible();
  await expect(page.getByText("Modalità backup", { exact: true })).not.toBeVisible();
  expect(await read(primaryName)).toBe("Modifica durante il guasto");
});
