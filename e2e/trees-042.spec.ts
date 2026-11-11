import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

mkdirSync("/opt/cursor/artifacts", { recursive: true });

async function openTenda(page: Page, testInfo: TestInfo) {
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault di prova", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vault pronto", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Strutture", exact: true }).click();
  if (testInfo.project.name === "chromium-desktop") {
    await page.getByLabel("Nome della struttura").fill("Prova 042");
    await page.getByLabel("Codice della radice").fill("PR");
    await page.getByLabel("Nome della radice").fill("Radice prova");
    await page.getByRole("button", { name: "Crea struttura" }).click();
    await expect(page.getByRole("heading", { name: "Prova 042", exact: true })).toBeVisible();
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
function editing(page: Page, label: string) {
  return page.locator(".tree-item.is-editing").filter({ has: page.getByLabel(label) });
}
async function openSheet(page: Page) {
  const sheet = page.getByRole("button", { name: "Scheda nodo" });
  if (await sheet.isVisible()) await sheet.click();
}
async function closeSheet(page: Page) {
  const close = page.locator(".tree-sheet-close");
  if (await close.isVisible()) await close.click();
}
function shot(project: string, name: string) {
  return `/opt/cursor/artifacts/${name}-${project}.png`;
}

test("nome e codice si modificano separatamente", async ({ page }, testInfo) => {
  await openTenda(page, testInfo);
  const project = testInfo.project.name;
  const model = node(page, "FL-04");
  await model.locator(".tree-code").click();
  await expect(model).toHaveAttribute("aria-selected", "true");
  await expect(model.locator("input")).toHaveCount(0);

  await model.locator(".tree-name").dblclick();
  const name = page.getByLabel("Nome di FL-04");
  await expect(name).toBeFocused();
  await expect(name).toHaveValue("Modello");
  await expect.poll(() => name.evaluate(element => {
    const input = element as HTMLInputElement;
    return input.selectionStart === 0 && input.selectionEnd === input.value.length;
  })).toBe(true);
  await expect(model.locator(".tree-code")).toHaveText("FL-04");
  await expect(page.getByLabel("Codice di FL-04")).toHaveCount(0);
  await name.fill("Modello in modifica");
  await editing(page, "Nome di FL-04").screenshot({ path: shot(project, "name-only-editing") });
  await name.blur();
  await expect(page.getByLabel("Nome di FL-04")).toHaveCount(0);
  await expect(model.locator(".tree-name")).toHaveText("Modello");
  await openSheet(page);
  await expect(page.getByLabel("Nome del nodo")).toHaveValue("Modello");
  await expect(page.getByLabel("Codice del nodo")).toHaveValue("FL-04");
  await closeSheet(page);

  await model.locator(".tree-code").dblclick();
  const code = page.getByLabel("Codice di FL-04");
  await expect(code).toBeFocused();
  await expect(code).toHaveValue("FL-04");
  await expect(editing(page, "Codice di FL-04").locator(".tree-name")).toHaveText("Modello");
  await expect(page.getByLabel("Nome di FL-04")).toHaveCount(0);
  await editing(page, "Codice di FL-04").screenshot({ path: shot(project, "code-only-editing") });
  await code.press("Escape");
  await expect(model.locator(".tree-code")).toHaveText("FL-04");

  await page.locator(".tree-scroll").focus();
  await page.keyboard.press("F2");
  await expect(page.getByLabel("Nome di FL-04")).toBeFocused();
  await expect(page.getByLabel("Codice di FL-04")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await model.click({ button: "right" });
  await page.getByRole("menuitem", { name: "Rinomina", exact: true }).click();
  await expect(page.getByLabel("Nome di FL-04")).toBeFocused();
  await expect(page.getByLabel("Codice di FL-04")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await openSheet(page);
  await page.getByRole("button", { name: "Rinomina", exact: true }).click();
  await expect(page.getByLabel("Nome di FL-04")).toBeFocused();
  await expect(page.getByLabel("Codice di FL-04")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByLabel("Codice del nodo").fill("FL-01");
  await page.getByLabel("Codice del nodo").press("Enter");
  await expect(page.locator(".tree-panel").getByRole("alert")).toContainText("Codice già usato");
  await expect(model.locator(".tree-code")).toHaveText("FL-04");
  await expect(model.locator("input")).toHaveCount(0);
  await page.getByLabel("Codice del nodo").fill("FL-04");
  await page.getByLabel("Codice del nodo").blur();
  await expect(page.locator(".tree-panel").getByRole("alert")).toHaveCount(0);
  await closeSheet(page);

  await page.getByRole("button", { name: "Espandi FL-07", exact: true }).click();
  await node(page, "FL-0701").locator(".tree-code").dblclick();
  const childCode = page.getByLabel("Codice di FL-0701");
  await expect(childCode).toBeFocused();
  await expect(editing(page, "Codice di FL-0701").locator(".tree-name")).toHaveText("Limite larghezza");
  await childCode.fill("FL-0702");
  const duplicate = editing(page, "Codice di FL-0701").getByRole("alert");
  await expect(duplicate).toContainText("Codice già usato");
  await childCode.press("Enter");
  await expect(childCode).toBeVisible();
  await expect(duplicate).toContainText("Codice già usato");
  await expect(node(page, "FL-0701")).toHaveCount(0);
  await editing(page, "Codice di FL-0701").screenshot({ path: shot(project, "code-validation-inline") });
  await childCode.fill("   ");
  await expect(duplicate).toContainText("obbligatorio");
  await childCode.press("Enter");
  await expect(childCode).toBeVisible();
  await childCode.fill("LIBERO");
  await expect(editing(page, "Codice di FL-0701").locator(".tree-warning")).toContainText("Fuori prefisso");
  await expect(editing(page, "Codice di FL-0701").getByRole("alert")).toHaveCount(0);
  await childCode.press("Enter");
  await expect(node(page, "LIBERO").locator(".tree-name")).toHaveText("Limite larghezza");
  await expect(node(page, "LIBERO").locator(".tree-code")).toHaveText("LIBERO");

  await page.getByRole("region", { name: "Albero" }).getByRole("button", { name: "Aggiungi figlio", exact: true }).click();
  const draftName = page.getByLabel("Nome del nuovo nodo");
  const draft = page.locator(".tree-item.is-draft");
  await expect(draftName).toBeFocused();
  await expect(draftName).toHaveValue("Nuovo nodo");
  await expect(page.getByLabel("Codice del nuovo nodo")).toHaveCount(0);
  await expect(draft.locator(".tree-code")).toHaveText(/^LIBERO/);
  await expect.poll(() => draftName.evaluate(element => {
    const input = element as HTMLInputElement;
    return input.selectionStart === 0 && input.selectionEnd === input.value.length;
  })).toBe(true);
  await draftName.press("Escape");
  await expect(page.locator(".tree-item.is-draft")).toHaveCount(0);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
