import { mkdirSync } from "node:fs";
import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";

mkdirSync("/opt/cursor/artifacts", { recursive: true });

async function openTenda(page: Page, testInfo: TestInfo) {
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault di prova", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vault pronto", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Strutture", exact: true }).click();
  if (testInfo.project.name === "chromium-desktop") {
    await page.getByLabel("Nome della struttura").fill("Prova 043");
    await page.getByLabel("Codice della radice").fill("PR");
    await page.getByLabel("Nome della radice").fill("Radice prova");
    await page.getByRole("button", { name: "Crea struttura" }).click();
    await expect(page.getByRole("heading", { name: "Prova 043", exact: true })).toBeVisible();
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
function toolbar(page: Page) {
  return page.getByRole("region", { name: "Albero" });
}
async function openSheet(page: Page) {
  const sheet = page.getByRole("button", { name: "Scheda nodo" });
  if (await sheet.isVisible()) await sheet.click();
}
async function closeSheet(page: Page) {
  const close = page.locator(".tree-sheet-close");
  if (await close.isVisible()) await close.click();
}
async function fullShot(page: Page, project: string, name: string) {
  if (project !== "chromium-desktop") return;
  await page.screenshot({ path: `/opt/cursor/artifacts/${name}.png` });
}
async function dotBesideName(row: Locator, trailing = 24) {
  const boxes = await row.evaluate(element => {
    const name = element.querySelector(".tree-name")?.getBoundingClientRect();
    const dot = element.querySelector('[aria-label="Ha una nota"]')?.getBoundingClientRect();
    const line = element.querySelector(".tree-name-line")?.getBoundingClientRect();
    return name && dot && line ? { name, dot, line, row: element.getBoundingClientRect() } : null;
  });
  expect(boxes).not.toBeNull();
  const gap = boxes!.dot.x - (boxes!.name.x + boxes!.name.width);
  expect(gap).toBeGreaterThanOrEqual(-1);
  expect(gap).toBeLessThan(16);
  expect(Math.abs((boxes!.dot.y + boxes!.dot.height / 2) - (boxes!.name.y + boxes!.name.height / 2))).toBeLessThan(12);
  expect(boxes!.dot.x).toBeLessThan(boxes!.line.x + boxes!.line.width + 1);
  expect(boxes!.row.right - boxes!.dot.right).toBeGreaterThan(trailing);
}

test("fratello, punto nota accanto al nome e clic fuori che annulla", async ({ page }, testInfo) => {
  await openTenda(page, testInfo);
  const project = testInfo.project.name;
  const root = node(page, "FL");
  await root.scrollIntoViewIfNeeded();
  await expect(root.locator(".tree-name-line").locator(".tree-name")).toHaveText("Tenda finestra");
  await expect(root.locator(".tree-name").locator("xpath=following-sibling::*[1]")).toHaveAttribute("aria-label", "Ha una nota");
  await dotBesideName(root);
  const noted = node(page, "FL-47");
  await noted.scrollIntoViewIfNeeded();
  await dotBesideName(noted, -1);
  await fullShot(page, project, "nota-accanto-al-nome");

  await node(page, "FL-04").click();
  const addChild = toolbar(page).getByRole("button", { name: "Aggiungi figlio", exact: true });
  const addSibling = toolbar(page).getByRole("button", { name: "Aggiungi fratello", exact: true });
  await expect(addChild).toBeEnabled();
  await expect(addSibling).toBeEnabled();
  await expect(addSibling).toHaveAttribute("title", /Invio/);
  const childBox = await addChild.boundingBox();
  const siblingBox = await addSibling.boundingBox();
  const buttonOrder = await toolbar(page).locator(".tree-toolbar").evaluate(bar => [...bar.querySelectorAll("button")].map(button => button.textContent?.replace(/\s+/g, " ").trim() ?? ""));
  const childAt = buttonOrder.findIndex(label => label.includes("Aggiungi figlio"));
  const siblingAt = buttonOrder.findIndex(label => label.includes("Aggiungi fratello"));
  expect(siblingAt).toBe(childAt + 1);
  if (Math.abs(siblingBox!.y - childBox!.y) < 8) expect(siblingBox!.x).toBeGreaterThan(childBox!.x);
  else expect(siblingBox!.y).toBeGreaterThan(childBox!.y);
  await fullShot(page, project, "toolbar-figlio-e-fratello");

  await addSibling.click();
  const draftName = page.getByLabel("Nome del nuovo nodo");
  const draft = page.locator(".tree-item.is-draft");
  await expect(draft.locator(".tree-code")).toHaveText("FL-02");
  await expect(draftName).toBeFocused();
  await expect(draftName).toHaveValue("Nuovo nodo");
  await expect(page.getByLabel("Codice del nuovo nodo")).toHaveCount(0);
  await expect.poll(() => draftName.evaluate(element => {
    const input = element as HTMLInputElement;
    return input.selectionStart === 0 && input.selectionEnd === input.value.length;
  })).toBe(true);
  const codes = page.locator('[role="treeitem"]');
  const labels = await codes.evaluateAll(rows => rows.map(row => row.classList.contains("is-draft") ? "draft" : row.querySelector(".tree-code")?.textContent));
  expect(labels.indexOf("draft")).toBe(labels.indexOf("FL-04") + 1);
  expect(labels[labels.indexOf("draft") + 1]).toBe("FL-47");
  await draft.scrollIntoViewIfNeeded();
  await fullShot(page, project, "fratello-nome-selezionato");
  await draftName.fill("Nome abbandonato");
  await draftName.blur();
  await expect(draft).toHaveCount(0);
  await expect(node(page, "FL-02").locator(".tree-name")).toHaveText("Nuovo nodo");
  await expect(node(page, "FL-04").locator(".tree-code")).toHaveText("FL-04");
  await expect(node(page, "FL-47").locator(".tree-code")).toHaveText("FL-47");
  await openSheet(page);
  await expect(page.getByLabel("Categoria del nodo")).toHaveValue("c-cfg");
  await closeSheet(page);

  await page.getByRole("button", { name: "Espandi FL-07", exact: true }).click();
  await node(page, "FL-0701").click();
  await page.locator(".tree-scroll").focus();
  await page.keyboard.press("Enter");
  const shortcut = page.getByLabel("Nome del nuovo nodo");
  await expect(shortcut).toBeFocused();
  await expect(shortcut).toHaveValue("Nuovo nodo");
  await expect(page.locator(".tree-item.is-draft .tree-code")).toHaveText("FL-0703");
  const nested = await page.locator('[role="treeitem"]').evaluateAll(rows => rows.map(row => row.classList.contains("is-draft") ? "draft" : row.querySelector(".tree-code")?.textContent));
  expect(nested.indexOf("draft")).toBe(nested.indexOf("FL-0701") + 1);
  expect(nested[nested.indexOf("draft") + 1]).toBe("FL-0702");
  await shortcut.fill("Non questo nome");
  await page.getByRole("button", { name: "Comprimi", exact: true }).click();
  await expect(page.getByLabel("Nome del nuovo nodo")).toHaveCount(0);
  await page.getByRole("button", { name: "Espandi", exact: true }).click();
  await expect(node(page, "FL-0703").locator(".tree-name")).toHaveText("Nuovo nodo");
  await expect(node(page, "FL-0701").locator(".tree-code")).toHaveText("FL-0701");
  await expect(node(page, "FL-0702").locator(".tree-code")).toHaveText("FL-0702");
  await openSheet(page);
  await node(page, "FL-0703").click();
  await expect(page.getByLabel("Categoria del nodo")).toHaveValue("c-dim");
  await closeSheet(page);

  await node(page, "FL-0702").click({ button: "right" });
  await page.getByRole("menuitem", { name: "Aggiungi fratello", exact: true }).click();
  await expect(page.locator(".tree-item.is-draft .tree-code")).toHaveText("FL-0704");
  await page.keyboard.press("Escape");
  await expect(node(page, "FL-0704")).toHaveCount(0);

  await openSheet(page);
  await node(page, "FL-04").click();
  await page.getByRole("button", { name: "Fratello", exact: true }).click();
  await expect(page.getByLabel("Nome del nuovo nodo")).toBeFocused();
  await page.locator(".tree-item.is-draft .tree-code").dblclick();
  const code = page.getByLabel("Codice del nuovo nodo");
  await expect(code).toBeFocused();
  await expect(code).toHaveValue(/^FL-/);
  await expect(page.getByLabel("Nome del nuovo nodo")).toHaveCount(0);
  const proposed = await code.inputValue();
  await code.fill("FL-0999");
  await code.blur();
  await expect(page.getByLabel("Codice del nuovo nodo")).toHaveCount(0);
  await expect(node(page, proposed).locator(".tree-name")).toHaveText("Nuovo nodo");
  await expect(node(page, "FL-0999")).toHaveCount(0);
  await closeSheet(page);

  await node(page, "FL-04").locator(".tree-name").dblclick();
  const rename = page.getByLabel("Nome di FL-04");
  await rename.fill("Non salvare");
  await page.getByRole("button", { name: "Comprimi", exact: true }).click();
  await expect(node(page, "FL-04").locator(".tree-name")).toHaveText("Modello");
  await expect(page.getByLabel("Nome di FL-04")).toHaveCount(0);
  await node(page, "FL-04").locator(".tree-code").dblclick();
  const renameCode = page.getByLabel("Codice di FL-04");
  await renameCode.fill("FL-99");
  await renameCode.blur();
  await expect(page.getByLabel("Codice di FL-04")).toHaveCount(0);
  await expect(node(page, "FL-04").locator(".tree-code")).toHaveText("FL-04");

  await root.click();
  await page.locator(".tree-scroll").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".tree-item.is-draft")).toHaveCount(0);
  await expect(addSibling).toBeDisabled();
  await expect(addSibling).toHaveAttribute("title", "La radice non ha fratelli");
  await openSheet(page);
  const panelSibling = page.getByRole("button", { name: "Fratello", exact: true });
  await expect(panelSibling).toBeDisabled();
  await expect(panelSibling).toHaveAttribute("title", "La radice non ha fratelli");
  await root.click({ button: "right" });
  const menuSibling = page.getByRole("menuitem", { name: /Aggiungi fratello/ });
  await expect(menuSibling).toBeDisabled();
  await page.keyboard.press("Escape");
  await closeSheet(page);
  await fullShot(page, project, "fratello-disattivato-sulla-radice");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});
