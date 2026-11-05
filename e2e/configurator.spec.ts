import { expect, test } from "@playwright/test";

test("uses the populated demo Vault and preserves a measured BOM after leaving the project", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button",{name:"Apri Vault di prova",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Vault pronto",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Configuratori",exact:true}).click();
  await page.getByRole("button",{name:/Pergola dimostrativa/}).first().click();
  await page.getByRole("button",{name:"BOM",exact:true}).click();
  await page.getByRole("button",{name:"TELO: Sì",exact:true}).click();
  await page.getByRole("button",{name:"MODELLO: TELO",exact:true}).click();
  await page.getByRole("spinbutton",{name:"Larghezza",exact:true}).fill("300");
  const row=page.locator('.config-bom-row').filter({has:page.getByText('PR001',{exact:true})});
  await expect(row.locator('.config-bom-measure')).toHaveText("299 cm");
  await expect(row.locator('.config-bom-quantity')).toContainText("2");
  await page.getByRole("button",{name:"Impostazioni",exact:true}).click();
  await page.getByRole("tab",{name:"Pergola dimostrativa",exact:true}).click();
  await expect(page.getByRole("button",{name:"TELO: Sì",exact:true})).toHaveAttribute("aria-pressed","true");
  await expect(row.locator('.config-bom-measure')).toHaveText("299 cm");
  await page.getByRole("button",{name:"Grafo",exact:true}).last().click();
  await page.getByRole("button",{name:"Adatta alla finestra",exact:true}).click();
  await page.getByRole("button",{name:"Selezione multipla",exact:true}).click();
  await expect(page.getByRole("button",{name:"Selezione multipla",exact:true})).toHaveAttribute("aria-pressed","true");
});
