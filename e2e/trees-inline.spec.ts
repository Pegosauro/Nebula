import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

mkdirSync("/opt/cursor/artifacts", { recursive: true });

async function openTenda(page: Page, testInfo: TestInfo) {
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault di prova", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vault pronto", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Strutture", exact: true }).click();
  if (testInfo.project.name === "chromium-desktop") {
    await page.getByLabel("Nome della struttura").fill("Prova righe");
    await page.getByLabel("Codice della radice").fill("PR");
    await page.getByLabel("Nome della radice").fill("Radice prova");
    await page.getByRole("button", { name: "Crea struttura" }).click();
    await expect(page.getByRole("heading", { name: "Prova righe", exact: true })).toBeVisible();
    await page.getByRole("region", { name: "Strutture" }).getByRole("button", { name: /Tenda finestra/ }).click();
  } else {
    await page.getByRole("button", { name: /Tenda finestra/ }).first().click();
  }
  const closeSidebar = page.getByRole("button", { name: "Chiudi pannello sinistro" });
  if (await closeSidebar.isVisible()) await closeSidebar.click();
  await expect(page.getByRole("heading", { name: "FL · Tenda finestra" })).toBeVisible();
  const close = page.locator(".tree-sheet-close");
  if (await close.isVisible()) await close.click();
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

test("nome normale, niente catena, oggetti in riga", async ({ page }, testInfo) => {
  await openTenda(page, testInfo);
  const project = testInfo.project.name;
  const nameWeight = await node(page, "FL-04").locator(".tree-name").evaluate(element => getComputedStyle(element).fontWeight);
  const codeWeight = await node(page, "FL-04").locator(".tree-code").evaluate(element => getComputedStyle(element).fontWeight);
  expect(["400", "normal"]).toContain(nameWeight);
  expect(["400", "normal"]).toContain(codeWeight);
  const nameColor = await node(page, "FL-04").locator(".tree-name").evaluate(element => getComputedStyle(element).color);
  const codeColor = await node(page, "FL-04").locator(".tree-code").evaluate(element => getComputedStyle(element).color);
  expect(nameColor).not.toBe(codeColor);
  await expect(page.locator(".tree-inherit")).toHaveCount(0);
  await expect(node(page, "FL-01").locator(".tree-name")).toHaveText("Tipologia di configurazione");
  await page.locator(".tree-scroll").screenshot({ path: `/opt/cursor/artifacts/nome-normale-${project}.png` });

  await page.getByRole("button", { name: "Espandi FL-07", exact: true }).click();
  await selectNode(page, "FL-0701");
  await openSheet(page);
  const panel = page.locator(".tree-panel");
  await expect(panel.getByRole("button", { name: "Eredita dal padre" })).toHaveCount(0);
  await expect(panel.getByText("Ereditata da")).toHaveCount(0);
  await expect(panel.getByText("Se la modifichi")).toHaveCount(0);
  await expect(panel.getByText("Propria", { exact: true })).toHaveCount(0);
  await panel.screenshot({ path: `/opt/cursor/artifacts/pannello-senza-legenda-${project}.png` });

  const close = page.locator(".tree-sheet-close");
  if (await close.isVisible()) await close.click();
  await page.getByRole("button", { name: "Espandi FL-08", exact: true }).click();
  await selectNode(page, "FL-0803");
  await openSheet(page);
  const sigla = page.getByLabel("Nuova sigla propria");
  const description = page.getByLabel("Nuova descrizione propria");
  await sigla.focus();
  await page.keyboard.press("Tab");
  await expect(description).toBeFocused();
  await sigla.fill("ZZ");
  await description.fill("Ingombro");
  await sigla.locator("xpath=ancestor::li[1]").screenshot({ path: `/opt/cursor/artifacts/riga-vuota-compilata-${project}.png` });
  await description.press("Escape");
  await expect(sigla).toHaveValue("");
  await expect(description).toHaveValue("");

  await page.getByRole("button", { name: "P - PROFONDITA'", exact: true }).click();
  const editSigla = page.getByLabel("Modifica sigla P");
  await expect(editSigla).toHaveValue("P");
  await expect(page.getByLabel("Modifica descrizione P")).toHaveValue("PROFONDITA'");
  await editSigla.locator("xpath=ancestor::li[1]").screenshot({ path: `/opt/cursor/artifacts/modifica-riga-${project}.png` });
  await editSigla.fill("H");
  await editSigla.press("Enter");
  const alert = page.getByRole("alert").filter({ hasText: "già usata" });
  await expect(alert).toBeVisible();
  await alert.locator("xpath=ancestor::li[1]").screenshot({ path: `/opt/cursor/artifacts/sigla-duplicata-${project}.png` });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "P - PROFONDITA'", exact: true })).toBeVisible();

  await page.getByLabel("Nuova tabella").fill("TE_PROVA");
  await page.getByLabel("Nuova tabella").press("Enter");
  await expect(page.getByLabel("Oggetti del nodo").getByRole("button", { name: "TE_PROVA Tabella esterna" })).toBeVisible();
  await expect(page.getByLabel("Nuova tabella")).toBeFocused();
  await expect(page.getByLabel("Nuova tabella")).toHaveValue("");
  await expect(page.getByRole("dialog", { name: /oggetto/i })).toHaveCount(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
