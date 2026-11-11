import { mkdirSync } from "node:fs";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

mkdirSync("/opt/cursor/artifacts", { recursive: true });

async function openTenda(page: Page, testInfo: TestInfo) {
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault di prova", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vault pronto", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Strutture", exact: true }).click();
  if (testInfo.project.name === "chromium-desktop") {
    await page.getByLabel("Nome della struttura").fill("Prova spostamento");
    await page.getByLabel("Codice della radice").fill("PR");
    await page.getByLabel("Nome della radice").fill("Radice prova");
    await page.getByRole("button", { name: "Crea struttura" }).click();
    await expect(page.getByRole("heading", { name: "Prova spostamento", exact: true })).toBeVisible();
    await page.getByRole("region", { name: "Strutture" }).getByRole("button", { name: /Tenda finestra/ }).click();
  } else {
    await page.getByRole("button", { name: /Tenda finestra/ }).first().click();
  }
  const closeSidebar = page.getByRole("button", { name: "Chiudi pannello sinistro" });
  if (await closeSidebar.isVisible()) await closeSidebar.click();
  await expect(page.getByRole("heading", { name: "FL · Tenda finestra" })).toBeVisible();
  await page.getByRole("button", { name: "Modalità spostamento", exact: true }).click();
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
async function dragInside(page: Page, code: string, target: string) {
  const box = await node(page, target).boundingBox();
  if (!box) throw new Error(target);
  await page.getByRole("button", { name: `Trascina ${code}` }).dragTo(node(page, target), {
    targetPosition: { x: Math.min(72, box.width / 3), y: box.height / 2 },
    steps: 18,
  });
}
function destination(page: Page, code: string) {
  return page.getByRole("dialog").locator('[role="option"]').filter({ has: page.locator("strong", { hasText: new RegExp(`^${code}$`) }) });
}

test("Sposta in mostra l'anteprima, rinumera FL-07 e Annulla ripristina", async ({ page }, testInfo) => {
  await openTenda(page, testInfo);
  await selectNode(page, "FL-07");
  await page.getByRole("region", { name: "Albero" }).getByRole("button", { name: "Sposta in…" }).click();
  const dialog = page.getByRole("dialog", { name: /Sposta FL-07/ });
  await dialog.getByLabel("Cerca il nuovo padre").fill("Accessori");
  await destination(page, "FL-12").click();
  await expect(dialog.getByRole("cell", { name: "FL-1201", exact: true })).toBeVisible();
  await expect(dialog.getByRole("cell", { name: "FL-120101", exact: true })).toBeVisible();
  await expect(dialog.getByRole("cell", { name: "FL-120102", exact: true })).toBeVisible();
  await expect(dialog.getByText(/codice rinumerato|codici rinumerati/)).toBeVisible();
  await page.screenshot({ path: `/opt/cursor/artifacts/sposta-anteprima-${testInfo.project.name}.png` });
  await dialog.getByRole("button", { name: "Sposta in FL-12" }).click();
  await expect(node(page, "FL-1201")).toBeVisible();
  await expect(node(page, "FL-120101")).toBeVisible();
  await expect(node(page, "FL-120102")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Spostato" })).toBeVisible();
  if (testInfo.project.name === "chromium-desktop") await page.screenshot({ path: "/opt/cursor/artifacts/sposta-banner-desktop.png" });
  await page.getByRole("button", { name: "Annulla spostamento" }).click();
  await expect(node(page, "FL-07")).toBeVisible();
  await expect(node(page, "FL-1201")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Spostamento annullato" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(overflow).toBe(false);
});

test("il trascinamento dentro FL-12 rinumera e si annulla", async ({ page }, testInfo) => {
  await openTenda(page, testInfo);
  await dragInside(page, "FL-07", "FL-12");
  await expect(node(page, "FL-1201")).toBeVisible();
  await expect(node(page, "FL-120101")).toBeVisible();
  await expect(node(page, "FL-120102")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "3 codici rinumerati" })).toBeVisible();
  await page.getByRole("button", { name: "Annulla spostamento" }).click();
  await expect(node(page, "FL-07")).toBeVisible();
  await expect(page.getByText("FL-120101")).toHaveCount(0);
});

test("FL-0804 dentro FL-09 è bloccato perché FL-0907 esiste sotto FL-19", async ({ page }, testInfo) => {
  await openTenda(page, testInfo);
  await page.getByRole("button", { name: "Espandi FL-08" }).click();
  await selectNode(page, "FL-0804");
  await page.getByRole("region", { name: "Albero" }).getByRole("button", { name: "Sposta in…" }).click();
  const dialog = page.getByRole("dialog", { name: /Sposta FL-0804/ });
  await destination(page, "FL-09").click();
  await expect(dialog.getByRole("alert")).toContainText("FL-0907");
  await expect(dialog.getByRole("alert")).toContainText("FL-19");
  await expect(dialog.getByRole("button", { name: /Sposta in FL-09/ })).toBeDisabled();
  if (testInfo.project.name === "chromium-desktop") await page.screenshot({ path: "/opt/cursor/artifacts/sposta-blocco-desktop.png" });
  await dialog.getByRole("button", { name: "Annulla", exact: true }).click();
  await dragInside(page, "FL-0804", "FL-09");
  await expect(page.getByRole("alert").filter({ hasText: "FL-0907" })).toBeVisible();
  await expect(node(page, "FL-0804")).toBeVisible();
  await page.getByRole("button", { name: "Espandi FL-19" }).click();
  await expect(node(page, "FL-0907")).toHaveCount(1);
});

test("il codice libero X-1 resta invariato e compare l'avviso", async ({ page }, testInfo) => {
  await openTenda(page, testInfo);
  await page.getByRole("button", { name: "Espandi FL-10" }).click();
  await selectNode(page, "X-1");
  await page.getByRole("region", { name: "Albero" }).getByRole("button", { name: "Sposta in…" }).click();
  const dialog = page.getByRole("dialog", { name: /Sposta X-1/ });
  await destination(page, "FL-12").click();
  await expect(dialog.getByText(/fuori prefisso/)).toBeVisible();
  await expect(dialog.getByText("Nessun codice cambia")).toBeVisible();
  if (testInfo.project.name === "chromium-desktop") await page.screenshot({ path: "/opt/cursor/artifacts/sposta-codice-libero-desktop.png" });
  await dialog.getByRole("button", { name: "Sposta in FL-12" }).click();
  await expect(node(page, "X-1")).toBeVisible();
  await expect(node(page, "X-101")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "fuori prefisso" })).toContainText("0 codici rinumerati");
});

test("Alt freccia riordina i fratelli senza cambiare i codici", async ({ page }, testInfo) => {
  await openTenda(page, testInfo);
  const before = await page.locator('[role="treeitem"][aria-level="2"]').allTextContents();
  expect(before.findIndex(text => text.includes("FL-04"))).toBeLessThan(before.findIndex(text => text.includes("FL-47")));
  await selectNode(page, "FL-04");
  await page.locator(".tree-scroll").focus();
  await page.keyboard.press("Alt+ArrowDown");
  await expect(page.getByRole("status").filter({ hasText: "i codici non cambiano" })).toBeVisible();
  const after = await page.locator('[role="treeitem"][aria-level="2"]').allTextContents();
  expect(after.findIndex(text => text.includes("FL-04"))).toBe(after.findIndex(text => text.includes("FL-47")) + 1);
  await expect(node(page, "FL-04")).toBeVisible();
  await page.getByRole("button", { name: "Annulla spostamento" }).click();
  const restored = await page.locator('[role="treeitem"][aria-level="2"]').allTextContents();
  expect(restored.findIndex(text => text.includes("FL-04"))).toBeLessThan(restored.findIndex(text => text.includes("FL-47")));
  if (testInfo.project.name === "chromium-narrow") {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
  }
});
