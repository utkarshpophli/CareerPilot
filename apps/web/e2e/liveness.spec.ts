import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

import { resetData, sql } from "./support";

// "Check if it's still open" on the Job posting tab (roadmap M4d.2). The page
// of a link nobody can read is the one case that needs no network.
test.beforeAll(resetData);

test("says it can't tell for a link it can't read, remembers that, and has no serious accessibility problems", async ({ page }) => {
  await sql(`INSERT INTO "Application" (id, "updatedAt", title, company, "postingUrl", "postingText") VALUES ('lv-app', now(), 'Designer', 'Example', 'https://example.test/jobs/7', 'A job.')`);
  await page.goto("/applications/lv-app");
  await page.getByRole("tab", { name: /^Job posting/ }).click();
  await expect(page.getByText("Not checked yet.")).toBeVisible();
  await page.getByRole("button", { name: "Check if it's still open" }).click();
  await expect(page.getByText(/^Can't tell · Can't tell from here: this link isn't a posting on Greenhouse, Lever or Ashby\./)).toBeVisible();

  // Kept: a fresh load shows the saved check, with its date.
  await page.reload();
  await page.getByRole("tab", { name: /^Job posting/ }).click();
  await expect(page.getByText(/^Can't tell · Can't tell from here.*Checked \d/)).toBeVisible();

  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => violation.id)).toEqual([]);
});
