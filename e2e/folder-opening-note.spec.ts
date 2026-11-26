import { expect, test, type Page } from "@playwright/test";

async function showExplorer(page: Page) {
  const explorer = page.getByRole("region", { name: "Explorer" });
  if (!(await explorer.isVisible())) await page.getByRole("button", { name: "File", exact: true }).click();
  return explorer;
}

async function hideExplorerOverlay(page: Page) {
  const overlay = page.getByRole("button", { name: "Chiudi pannello sinistro", exact: true });
  if (await overlay.isVisible()) await overlay.click();
}

test("toggles linked folders by name and shows the link icon only on hover", async ({ page }) => {
  await page.addInitScript(() => {
    window.showDirectoryPicker = async () => {
      const root = await navigator.storage.getDirectory();
      const vault = await root.getDirectoryHandle("Nebula-folder-opening-test", { create: true });
      const folder = await vault.getDirectoryHandle("Montaggio pergola", { create: true });
      for (const name of ["Riepilogo montaggio", "Checklist sopralluogo"]) {
        const file = await (await folder.getFileHandle(name + ".md", { create: true })).createWritable();
        await file.write("# " + name + "\n");
        await file.close();
      }
      return vault;
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Inizio", exact: true })).toBeVisible();
  const explorer = await showExplorer(page);
  const folder = explorer.getByRole("button", { name: "Montaggio pergola", exact: true });
  const first = explorer.getByRole("button", { name: "Riepilogo montaggio", exact: true });
  const second = explorer.getByRole("button", { name: "Checklist sopralluogo", exact: true });
  const tab = page.getByRole("tab", { name: "Riepilogo montaggio", exact: true });
  const properties = page.getByRole("region", { name: "Proprietà della nota" });
  const checkbox = properties.getByRole("switch", { name: "Apri questa nota dalla cartella padre" });

  await first.click();
  await hideExplorerOverlay(page);
  await page.getByRole("button", { name: "Proprietà", exact: true }).click();
  await checkbox.click();
  await expect(properties.getByText("Nota di apertura di «Montaggio pergola»")).toBeVisible();

  await page.getByRole("button", { name: "Chiudi Riepilogo montaggio", exact: true }).click();
  await showExplorer(page);
  const badge = folder.locator(".tree-opening-note");
  await expect(badge).toHaveCount(1);
  await page.mouse.move(0, 0);
  await expect(badge).toBeHidden();
  await folder.hover();
  await expect(badge).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(badge).toBeHidden();

  await folder.click();
  await expect(first).toBeHidden();
  await expect(tab).toHaveCount(0);
  await explorer.getByRole("button", { name: "Espandi Montaggio pergola", exact: true }).click();
  await expect(first).toBeVisible();
  await expect(tab).toHaveCount(0);
  await explorer.getByRole("button", { name: "Comprimi Montaggio pergola", exact: true }).click();
  await expect(first).toBeHidden();

  await folder.click();
  await hideExplorerOverlay(page);
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await showExplorer(page);
  await expect(first).toBeVisible();
  await folder.click();
  await expect(first).toBeHidden();
  await expect(tab).toHaveAttribute("aria-selected", "true");
  await explorer.getByRole("button", { name: "Espandi Montaggio pergola", exact: true }).click();
  await second.click();
  await hideExplorerOverlay(page);
  if (!(await properties.isVisible())) await page.getByRole("button", { name: "Proprietà", exact: true }).click();
  await expect(checkbox).not.toBeChecked();
  await expect(properties.getByText(/Attiva per sostituirla/)).toBeVisible();
  await checkbox.click();
  await expect(checkbox).toBeChecked();

  const metadata = await page.evaluate(async () => {
    const vault = await (await navigator.storage.getDirectory()).getDirectoryHandle("Nebula-folder-opening-test");
    const folder = await vault.getDirectoryHandle("Montaggio pergola");
    return JSON.parse(await (await (await folder.getFileHandle(".nebula-opening-note.json")).getFile()).text());
  });
  expect(metadata).toEqual({ version: 1, note: "Checklist sopralluogo.md" });
  await showExplorer(page);
  await folder.click();
  await expect(folder).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Inizio", exact: true })).toBeVisible();
  await showExplorer(page);
  await folder.click();
  await hideExplorerOverlay(page);
  await expect(page.getByRole("tab", { name: "Checklist sopralluogo", exact: true })).toHaveAttribute("aria-selected", "true");
  if (!(await properties.isVisible())) await page.getByRole("button", { name: "Proprietà", exact: true }).click();
  await checkbox.click();
  await expect(properties.getByText("Cartella padre · Montaggio pergola")).toBeVisible();
  await showExplorer(page);
  await expect(explorer.getByRole("button", { name: "Comprimi Montaggio pergola", exact: true })).toHaveCount(0);
});
