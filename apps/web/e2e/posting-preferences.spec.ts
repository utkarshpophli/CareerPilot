import { expect, test } from "@playwright/test";

import { hydrated, resetData, sql } from "./support";

// Settings → Posting preferences end to end: what the owner avoids changes the scores on the Review page at once.
test.beforeEach(async () => {
  await resetData();
  await sql(
    `INSERT INTO "ScannedPosting" (id, source, "externalId", "companyName", title, location, url, description, "canonicalKey", fingerprint, "firstSeenAt", "lastSeenAt", score, "scoreBand")
     VALUES ('pp-1', 'GREENHOUSE', 'acme:1', 'Acme', 'Product Designer', 'Berlin', 'https://example.test/jobs/1', 'Commission only. Figma and research.', 'acme_product-designer', 'p1', now(), now(), 80, 'good')`,
  );
});

test("a word the owner avoids vetoes a kept posting, and the Review page shows why", async ({ page }) => {
  await page.goto("/settings?section=matching");
  await expect(page.getByRole("heading", { name: "Posting preferences" })).toBeVisible();
  const words = page.getByLabel("Words to avoid");
  await hydrated(words);
  await words.fill("commission only");
  await words.blur();
  await expect(page.getByText(/Saved\. 1 posting scored again\./)).toBeVisible();

  await page.reload();
  await expect(page.getByLabel("Words to avoid")).toHaveValue("commission only");

  await page.goto("/review");
  const card = page.getByRole("list", { name: "Postings" }).locator(":scope > li").first();
  await expect(card.getByRole("img", { name: "Score 0 of 100" })).toBeVisible();
  await expect(card).toContainText('Contains "commission only", which you excluded');
});

test("remote work and the lowest pay save on their own, and a half-filled pay is explained", async ({ page }) => {
  await page.goto("/settings?section=matching");
  const no = page.getByRole("radio", { name: /^No,/ });
  await hydrated(no);
  await no.check();
  await expect(page.getByText("Saved.", { exact: false }).first()).toBeVisible();
  await page.getByLabel("Lowest yearly pay").fill("65000");
  await page.getByLabel("Lowest yearly pay").blur();
  await expect(page.getByText("Give the currency as three letters, such as EUR.")).toBeVisible();
  await page.getByLabel("Currency").fill("eur");
  await page.getByLabel("Currency").blur();
  await page.reload();
  await expect(page.getByRole("radio", { name: /^No,/ })).toBeChecked();
  await expect(page.getByLabel("Lowest yearly pay")).toHaveValue("65000");
  await expect(page.getByLabel("Currency")).toHaveValue("EUR");
});
