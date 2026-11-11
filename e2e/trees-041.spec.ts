import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

mkdirSync("/opt/cursor/artifacts", { recursive: true });

async function openTenda(page: Page, testInfo: TestInfo) {
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault di prova", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vault pronto", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Strutture", exact: true }).click();
  if (testInfo.project.name === "chromium-desktop") {
    await page.getByLabel("Nome della struttura").fill("Prova 041");
    await page.getByLabel("Codice della radice").fill("PR");
    await page.getByLabel("Nome della radice").fill("Radice prova");
    await page.getByRole("button", { name: "Crea struttura" }).click();
    await expect(page.getByRole("heading", { name: "Prova 041", exact: true })).toBeVisible();
    await page.getByRole("region", { name: "Strutture" }).getByRole("button", { name: /Tenda finestra/ }).click();
  } else {
    await page.getByRole("button", { name: /Tenda finestra/ }).first().click();
  }
  const closeSidebar = page.getByRole("button", { name: "Chiudi pannello sinistro" });
  if (await closeSidebar.isVisible()) await closeSidebar.click();
  await expect(page.getByRole("heading", { name: "FL · Tenda finestra" })).toBeVisible();
  const closeSheet = page.getByRole("button", { name: "Chiudi scheda" });
  if (await closeSheet.isVisible()) await closeSheet.click();
}

function node(page: Page, code: string) {
  return page.getByRole("treeitem").filter({ has: page.locator(".tree-code", { hasText: new RegExp(`^${code}$`) }) });
}
async function selectNode(page: Page, code: string) {
  await node(page, code).locator(".tree-code").click();
  await expect(node(page, code)).toHaveAttribute("aria-selected", "true");
}
async function openSheet(page: Page) {
  const sheet = page.getByRole("button", { name: "Scheda nodo" });
  if (await sheet.isVisible()) await sheet.click();
}
async function closeSheet(page: Page) {
  const close = page.locator(".tree-sheet-close");
  if (await close.isVisible()) await close.click();
}

test("categoria singola, nota, eliminazione, formato, inserimento e radice sempre aperta", async ({ page }, testInfo) => {
  await openTenda(page, testInfo);
  const project = testInfo.project.name;
  const root = node(page, "FL");
  await expect(root.getByRole("button", { name: /Espandi|Comprimi/ })).toHaveCount(0);
  await expect(root).toHaveAttribute("aria-expanded", "true");
  await expect(root.getByRole("img", { name: "Ha una nota" })).toBeVisible();
  await expect(node(page, "FL-47").getByRole("img", { name: "Ha una nota" })).toBeVisible();
  await expect(node(page, "FL-01").getByRole("img", { name: "Ha una nota" })).toHaveCount(0);
  const dot = await node(page, "FL-47").getByRole("img", { name: "Ha una nota" }).evaluate(element => getComputedStyle(element).backgroundColor);
  expect(dot).toBe("rgb(245, 197, 24)");
  const nameWeight = await node(page, "FL-07").locator(".tree-name").evaluate(element => getComputedStyle(element).fontWeight);
  const codeWeight = await node(page, "FL-07").locator(".tree-code").evaluate(element => getComputedStyle(element).fontWeight);
  expect(["400", "normal"]).toContain(nameWeight);
  expect(["400", "normal"]).toContain(codeWeight);
  await expect(page.locator(".tree-inherit")).toHaveCount(0);
  const nameColor = await node(page, "FL-07").locator(".tree-name").evaluate(element => getComputedStyle(element).color);
  const codeColor = await node(page, "FL-07").locator(".tree-code").evaluate(element => getComputedStyle(element).color);
  expect(nameColor).not.toBe(codeColor);
  await page.screenshot({ path: `/opt/cursor/artifacts/codice-nome-${project}.png` });
  await page.screenshot({ path: `/opt/cursor/artifacts/nota-gialla-${project}.png` });
  await page.screenshot({ path: `/opt/cursor/artifacts/radice-sempre-aperta-${project}.png` });

  await page.getByRole("button", { name: "Comprimi", exact: true }).click();
  await expect(node(page, "FL-01")).toBeVisible();
  await selectNode(page, "FL");
  await page.locator(".tree-scroll").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(node(page, "FL-01")).toBeVisible();
  await expect(root).toHaveAttribute("aria-expanded", "true");
  await openSheet(page);
  await expect(page.getByRole("button", { name: "Elimina", exact: true })).toBeDisabled();
  await expect(page.getByText("La radice non si può eliminare")).toBeVisible();
  await closeSheet(page);

  await page.getByRole("button", { name: "Espandi FL-07", exact: true }).click();
  await selectNode(page, "FL-0701");
  await openSheet(page);
  const picker = page.getByLabel("Categoria del nodo");
  await expect(picker).toHaveValue("c-dim");
  await expect(picker.locator("option")).toHaveCount(8);
  await expect(page.getByRole("button", { name: "Eredita dal padre", exact: true })).toBeEnabled();
  await expect(page.getByText("Ereditata da")).toHaveCount(0);
  await page.screenshot({ path: `/opt/cursor/artifacts/categoria-singola-${project}.png` });
  await picker.selectOption({ label: "Avvisi" });
  await expect(page.getByText("Hai modificato la categoria")).toBeVisible();
  await page.getByRole("button", { name: "Eredita dal padre", exact: true }).click();
  await expect(picker).toHaveValue("c-dim");
  await expect(page.getByText("Hai modificato la categoria")).toHaveCount(0);
  await closeSheet(page);

  await page.getByRole("region", { name: "Albero" }).getByRole("button", { name: "Aggiungi figlio", exact: true }).click();
  const draftName = page.getByLabel("Nome del nuovo nodo");
  await expect(draftName).toBeFocused();
  await expect(draftName).toHaveValue("Nuovo nodo");
  await expect.poll(() => draftName.evaluate(element => {
    const input = element as HTMLInputElement;
    return input.selectionStart === 0 && input.selectionEnd === input.value.length;
  })).toBe(true);
  await page.screenshot({ path: `/opt/cursor/artifacts/inserimento-nome-${project}.png` });
  await draftName.press("Escape");
  await page.locator(".tree-scroll").focus();
  await page.keyboard.press("Insert");
  await expect(page.getByLabel("Nome del nuovo nodo")).toBeFocused();
  await page.keyboard.press("Escape");

  await selectNode(page, "FL-08");
  await openSheet(page);
  await page.getByRole("button", { name: "Elimina", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Eliminare FL-08 e 4 nodi discendenti?");
  await expect(dialog).toContainText("Verranno eliminati 5 nodi.");
  await page.screenshot({ path: `/opt/cursor/artifacts/elimina-conferma-${project}.png` });
  await dialog.getByRole("button", { name: "Elimina", exact: true }).click();
  await closeSheet(page);
  await expect(node(page, "FL-08")).toHaveCount(0);
  await expect(node(page, "FL-0803")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Annulla ripristina nodi, ordine, codici, categorie e note" })).toBeVisible();
  await page.screenshot({ path: `/opt/cursor/artifacts/elimina-annulla-${project}.png` });
  await page.getByRole("button", { name: "Annulla eliminazione" }).click();
  await expect(node(page, "FL-08")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Eliminazione annullata" })).toBeVisible();
  await page.getByRole("button", { name: "Espandi FL-08", exact: true }).click();
  await expect(node(page, "FL-0803").getByRole("img", { name: "Ha una nota" })).toBeVisible();
  await expect(root.getByRole("button", { name: /Espandi|Comprimi/ })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
