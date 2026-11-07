import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";

const shots = "/opt/cursor/artifacts";
try { mkdirSync(shots, { recursive: true }); } catch { /* screenshots are optional outside this environment */ }
const shot = async (page: import("@playwright/test").Page, name: string) => {
  try { await page.screenshot({ path: `${shots}/${name}.png` }); } catch { /* keep the assertions authoritative */ }
};

test("guided component creation covers the three inclusion modes in the browser", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Apri Vault di prova", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vault pronto", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Configuratori", exact: true }).click();
  await page.getByRole("textbox", { name: "Nome del progetto" }).fill("Guida componenti");
  await page.getByRole("checkbox", { name: /Parti da un esempio/ }).check();
  await page.getByRole("button", { name: "Crea configuratore", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Guida componenti", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Componenti", exact: true }).click();

  await page.getByRole("button", { name: "Componente", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Nuovo componente" });
  await expect(dialog.getByRole("heading", { name: "Codice e descrizione" })).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Dimensioni del componente" })).toHaveCount(0);
  await expect(dialog.getByRole("region", { name: "Proprietà del componente" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Inserisci il codice");
  await expect(dialog.getByRole("textbox", { name: "Codice" })).toBeFocused();
  await expect(dialog.getByRole("textbox", { name: "Codice" })).toHaveAttribute("aria-invalid", "true");
  await shot(page, "guided-identity-error");

  await dialog.getByRole("textbox", { name: "Codice" }).fill("CAT9");
  await dialog.getByRole("textbox", { name: "Descrizione" }).fill("Solo catalogo");
  await dialog.getByRole("button", { name: "Avanti", exact: true }).click();
  const choices = dialog.getByRole("radio");
  await expect(choices).toHaveCount(3);
  await expect(dialog.getByRole("radio", { name: /Sempre presente/ })).not.toBeChecked();
  await expect(dialog.getByRole("radio", { name: /Solo in certe condizioni/ })).not.toBeChecked();
  await expect(dialog.getByRole("radio", { name: /Solo catalogo/ })).not.toBeChecked();
  await shot(page, "guided-presence-choice");
  await choices.nth(0).focus();
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("radio", { name: /Solo in certe condizioni/ })).toBeChecked();
  await page.keyboard.press("ArrowDown");
  await expect(dialog.getByRole("radio", { name: /Solo catalogo/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(dialog.getByText("Nessuna regola verrà aggiunta")).toBeVisible();
  await dialog.getByRole("button", { name: "Crea componente", exact: true }).click();
  await expect(page.getByRole("button", { name: /Modifica CAT9/ })).toBeVisible();

  await page.getByRole("button", { name: "Componente", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Codice" }).fill("TMP");
  await dialog.getByRole("button", { name: "Annulla", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("TMP")).toHaveCount(0);

  await page.getByRole("button", { name: "Componente", exact: true }).click();
  await dialog.getByRole("button", { name: "Modalità completa", exact: true }).click();
  await expect(dialog.getByRole("region", { name: "Dimensioni del componente" })).toBeVisible();
  await expect(dialog.getByRole("region", { name: "Proprietà del componente" })).toBeVisible();
  await dialog.getByRole("region", { name: "Dimensioni del componente" }).scrollIntoViewIfNeeded();
  await shot(page, "guided-complete-mode");
  await dialog.getByRole("button", { name: "Torna alla guida", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Codice" }).fill("ALW9");
  await dialog.getByRole("textbox", { name: "Descrizione" }).fill("Sempre in distinta");
  await dialog.getByRole("button", { name: "Avanti", exact: true }).click();
  await dialog.getByRole("radio", { name: /Sempre presente/ }).check();
  await dialog.getByRole("button", { name: "Avanti", exact: true }).click();
  await dialog.getByRole("spinbutton", { name: "Quantità" }).fill("2");
  await dialog.getByRole("button", { name: "Crea componente", exact: true }).click();

  await page.getByRole("button", { name: "Componente", exact: true }).click();
  await dialog.getByRole("textbox", { name: "Codice" }).fill("CND9");
  await dialog.getByRole("textbox", { name: "Descrizione" }).fill("Solo con LED");
  await dialog.getByRole("button", { name: "Avanti", exact: true }).click();
  await dialog.getByRole("radio", { name: /Solo in certe condizioni/ }).check();
  await dialog.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(dialog.getByRole("combobox", { name: "Parametro della condizione" })).toHaveCount(0);
  await dialog.getByRole("button", { name: "Crea componente", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("Nessuna condizione è preselezionata");
  await shot(page, "guided-conditional-empty");
  await dialog.getByRole("button", { name: "Condizione", exact: true }).click();
  const parameter = dialog.getByRole("combobox", { name: "Parametro della condizione" });
  await expect(parameter).toHaveValue("");
  await parameter.selectOption({ label: "LED" });
  await expect(dialog.getByRole("combobox", { name: "Valore" })).toHaveValue("true");
  await dialog.getByRole("button", { name: "Indietro", exact: true }).click();
  await expect(dialog.getByRole("radio", { name: /Solo in certe condizioni/ })).toBeChecked();
  await dialog.getByRole("button", { name: "Avanti", exact: true }).click();
  await expect(parameter).toHaveValue("led");
  await dialog.getByRole("button", { name: "Crea componente", exact: true }).click();

  await page.getByRole("button", { name: "BOM", exact: true }).click();
  const row = (code: string) => page.locator(".config-bom-row").filter({ hasText: code });
  await expect(row("ALW9").locator(".config-bom-state")).toHaveText("Certo");
  await expect(row("ALW9").locator(".config-bom-quantity")).toContainText("2");
  await expect(row("CAT9")).toHaveCount(0);
  await expect(row("CND9").locator(".config-bom-state")).toHaveText("Possibile");
  await page.getByRole("button", { name: "LED: Sì", exact: true }).click();
  await expect(row("CND9").locator(".config-bom-state")).toHaveText("Certo");
  await expect(row("CAT9")).toHaveCount(0);
  await row("ALW9").scrollIntoViewIfNeeded();
  await shot(page, "guided-bom-inclusion");
  await page.getByRole("button", { name: "LED: Sì", exact: true }).click();
  await page.getByRole("button", { name: "LED: No", exact: true }).click();
  await expect(row("CND9")).toHaveCount(0);
  await expect(row("ALW9").locator(".config-bom-state")).toHaveText("Certo");
  await expect(row("CAT9")).toHaveCount(0);
});
