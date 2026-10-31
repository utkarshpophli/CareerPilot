import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { resetData, sql } from "./support";

// The Activity Ledger on screen: what the person does shows up on Activity,
// who did it can be filtered, and Insights counts the demo data.
test.beforeAll(resetData);

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => violation.id)).toEqual([]);
}

test("Activity records a status change as the user, and filters by who did it", async ({ page }) => {
  await page.goto("/activity");
  await expect(page.getByText(/Nothing here yet/)).toBeVisible();

  const [draft] = await sql<{ id: string; title: string }>(`SELECT id, title FROM "Application" WHERE status = 'DRAFT' ORDER BY "createdAt" LIMIT 1`);
  await page.goto(`/applications/${draft!.id}`);
  await page.getByRole("button", { name: "Mark as sent" }).click();
  await expect(page.getByText("Marked as sent.")).toBeVisible();

  await page.goto("/activity");
  const feed = page.getByRole("list").filter({ hasText: "Draft to Sent" });
  await expect(feed).toContainText(draft!.title);
  await expect(feed).toContainText("You");
  await expect(feed.getByRole("link", { name: /Draft to Sent/ })).toHaveAttribute("href", `/applications/${draft!.id}`);
  await expectAccessible(page);

  await page.getByRole("link", { name: "AI assistants" }).click();
  await expect(page).toHaveURL(/actor=mcp/);
  await expect(page.getByText(/Nothing here yet/)).toBeVisible();
});

test("Insights counts the demo applications by platform and template", async ({ page }) => {
  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: "Insights", level: 1 })).toBeVisible();
  await expect(page.getByRole("table", { name: "By platform" })).toBeVisible();
  await expect(page.getByRole("table", { name: "By resume template" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Resume revisions" })).toBeVisible();
  await expectAccessible(page);
});
