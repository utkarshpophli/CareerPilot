import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { hydrated, resetData, sql } from "./support";

// Settings → Watched companies end to end, without reading any real board: adding from a careers link, pausing,
// resuming and removing, and a board that failed shown as failed. (Scan now reads the real services; it is covered by
// the action's tests with the network layer replaced.)
test.beforeEach(resetData);

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`)).toEqual([]);
}

const rowOf = (page: Page, name: string) => page.getByRole("list", { name: "Watched companies" }).getByRole("listitem").filter({ hasText: name });

test("adds a company from its careers link, pauses and resumes it, and removes it after asking", async ({ page }) => {
  await page.goto("/settings?section=companies");
  await expect(page.getByText(/No companies are watched yet/)).toBeVisible();
  const board = page.getByLabel("Job board name or careers link");
  await hydrated(board);
  await board.fill("https://job-boards.greenhouse.io/stripe");
  await page.getByLabel("Name (optional)").fill("Stripe");
  await page.getByRole("button", { name: "Watch", exact: true }).click();
  await expect(page.getByText("Now watching Stripe.")).toBeVisible();
  await expect(rowOf(page, "Stripe")).toContainText("Greenhouse · stripe");
  await expect(rowOf(page, "Stripe")).toContainText("Not read yet");
  await expectAccessible(page);

  await page.getByRole("button", { name: "Pause Stripe" }).click();
  await expect(rowOf(page, "Stripe")).toContainText("Paused");
  await page.reload();
  await expect(rowOf(page, "Stripe")).toContainText("Paused");
  await page.getByRole("button", { name: "Resume Stripe" }).click();
  await expect(rowOf(page, "Stripe")).not.toContainText("Paused");

  await page.getByRole("button", { name: "Remove Stripe" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("saved postings stay");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(rowOf(page, "Stripe")).toBeVisible();
  await page.getByRole("button", { name: "Remove Stripe" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove company" }).click();
  await expect(page.getByText("Removed Stripe.")).toBeVisible();
  await expect(page.getByText(/No companies are watched yet/)).toBeVisible();
  expect(await sql(`SELECT 1 FROM "TrackedCompany"`)).toHaveLength(0);
});

test("says why a board could not be read, and asks which source when a bare name is given", async ({ page }) => {
  await sql(
    `INSERT INTO "TrackedCompany" (id, source, slug, region, name, enabled, "lastScanAt", "lastError", "lastFound") VALUES ('wc-1', 'LEVER', 'gone', '', 'Gone Co', true, now(), 'The source has no such board. Check the name.', 0)`,
  );
  await page.goto("/settings?section=companies");
  await expect(rowOf(page, "Gone Co")).toContainText("Could not be read: The source has no such board. Check the name.");
  const board = page.getByLabel("Job board name or careers link");
  await hydrated(board);
  await board.fill("stripe");
  await page.getByRole("button", { name: "Watch", exact: true }).click();
  await expect(page.getByText(/Say which source it is on/)).toBeVisible();
  await expect(page.getByRole("list", { name: "Watched companies" }).getByRole("listitem")).toHaveCount(1);
});
