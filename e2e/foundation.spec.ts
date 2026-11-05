import { expect, test } from "@playwright/test";

test("foundation shell exposes navigation, settings and theme", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Nebula", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Aree di Nebula" })).toBeVisible();

  await page.getByRole("button", { name: "Impostazioni" }).click();
  await expect(page.getByRole("heading", { name: "Impostazioni" })).toBeVisible();
  await expect(page.getByText(/^Versione \d+\.\d+\.\d+ · Editor$/)).toBeVisible();

  await page.getByRole("button", { name: "Chiaro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Scuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("narrow layout keeps the workspace and bottom navigation usable", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium-narrow", "Narrow viewport only");
  await page.goto("/");

  const navigation = page.getByRole("navigation", { name: "Aree di Nebula" });
  await expect(navigation).toBeVisible();
  await expect(page.locator(".side-panel")).toHaveCount(0);
  await expect(page.locator(".context-panel")).toHaveCount(0);
  const box = await navigation.boundingBox();
  expect(box?.y).toBeGreaterThan(800);
  await expect(page.locator("main.workspace")).toBeVisible();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(hasHorizontalOverflow).toBe(false);
});
