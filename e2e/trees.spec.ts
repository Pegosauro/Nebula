import { expect, test } from "@playwright/test";

test("apre la struttura dimostrativa, propone il codice, blocca il duplicato e protegge la radice", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault di prova", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vault pronto", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Strutture", exact: true }).click();
  if (testInfo.project.name === "chromium-desktop") {
    await page.getByLabel("Nome della struttura").fill("Prova");
    await page.getByLabel("Codice della radice").fill("PR");
    await page.getByLabel("Nome della radice").fill("Radice prova");
    await page.getByRole("button", { name: "Crea struttura" }).click();
    await expect(page.getByRole("heading", { name: "Prova", exact: true })).toBeVisible();
    await expect(page.getByLabel("Codice del nodo")).toHaveValue("PR");
    await page.getByRole("region", { name: "Strutture" }).getByRole("button", { name: /Tenda finestra/ }).click();
  } else {
    await page.getByRole("button", { name: /Tenda finestra/ }).first().click();
  }
  const closeSidebar = page.getByRole("button", { name: "Chiudi pannello sinistro" });
  if (await closeSidebar.isVisible()) await closeSidebar.click();
  await expect(page.getByRole("heading", { name: "FL · Tenda finestra" })).toBeVisible();
  await expect(page.getByText("Salvato nel Vault").first()).toBeVisible();
  await page.getByLabel("Cerca codice o nome").fill("Limite larghezza");
  await expect(page.getByText("1 risultato")).toBeVisible();
  await page.getByLabel("Cerca codice o nome").fill("");
  await page.getByRole("treeitem", { name: /FL-07(?!\d)/ }).click();
  await page.getByRole("button", { name: "Aggiungi figlio", exact: true }).click();
  const draft = page.locator(".tree-item.is-draft");
  await expect(draft.locator(".tree-code")).toHaveText("FL-0703");
  const newName = page.getByLabel("Nome del nuovo nodo");
  await expect(newName).toBeFocused();
  await expect(newName).toHaveValue("Nuovo nodo");
  await expect(page.getByLabel("Codice del nuovo nodo")).toHaveCount(0);
  await expect.poll(() => newName.evaluate(element => {
    const input = element as HTMLInputElement;
    return input.selectionStart === 0 && input.selectionEnd === input.value.length;
  })).toBe(true);
  await draft.locator(".tree-code").dblclick();
  const newCode = page.getByLabel("Codice del nuovo nodo");
  await expect(newCode).toBeFocused();
  await expect(newCode).toHaveValue("FL-0703");
  await expect(page.getByLabel("Nome del nuovo nodo")).toHaveCount(0);
  await newCode.fill("FL-0701");
  await expect(draft.getByRole("alert")).toContainText("Codice già usato");
  await newCode.press("Enter");
  await expect(draft.getByRole("alert")).toContainText("Codice già usato");
  await expect(newCode).toBeVisible();
  await newCode.press("Escape");
  const sheet = page.getByRole("button", { name: "Scheda nodo" });
  if (await sheet.isVisible()) await sheet.click();
  await expect(page.getByRole("button", { name: "Elimina", exact: true })).toBeEnabled();
  const closeSheet = page.getByRole("button", { name: "Chiudi scheda" }).first();
  if (await closeSheet.isVisible()) await closeSheet.click();
  await page.getByRole("treeitem", { name: /Tenda finestra/ }).click();
  if (await sheet.isVisible()) await sheet.click();
  await expect(page.getByRole("button", { name: "Elimina", exact: true })).toBeDisabled();
  await expect(page.getByText("La radice non si può eliminare")).toBeVisible();
  if (await closeSheet.isVisible()) await closeSheet.click();
  const expand = page.getByRole("button", { name: "Espandi FL-07", exact: true });
  if (await expand.isVisible()) await expand.click();
  await page.getByRole("treeitem", { name: /FL-0702/ }).click();
  if (await sheet.isVisible()) await sheet.click();
  await expect(page.getByRole("button", { name: "Elimina", exact: true })).toBeEnabled();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
