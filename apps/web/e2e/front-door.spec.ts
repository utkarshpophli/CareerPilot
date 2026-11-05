import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { APP_PORT, resetData, sql } from "./support";

// The dashboard's front-door cards (roadmap M3), on the demo data.
test.beforeAll(resetData);

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  // The ids and where they are, so a failure says what to fix.
  expect(violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`)).toEqual([]);
}

test("answers how many, where, which resume and template, and what needs you, without a click", async ({ page }) => {
  await page.goto("/");
  const applications = page.getByRole("region", { name: "Applications" });
  await expect(applications).toContainText(/\d+ drafts? · \d+ sent/);
  await expect(applications).toContainText(/This week: \d+ started, \d+ sent/);

  await expect(page.getByRole("region", { name: "Where you apply" })).toBeVisible();

  const resume = page.getByRole("region", { name: "Your resume" });
  await expect(resume).toContainText(/\d+ versions? across \d+ resumes?/);
  await expect(resume.getByRole("list", { name: "Templates used" })).toBeVisible();

  const assistants = page.getByRole("region", { name: "Your assistants" });
  await expect(assistants).toContainText("No assistant is connected yet.");
  await assistants.getByRole("link", { name: "Connect an assistant" }).click();
  await expect(page).toHaveURL(/\/connect$/);
});

test("shows a connected assistant, a running run, and an agent draft waiting for review", async ({ page }) => {
  await sql(`INSERT INTO "ApiToken" (id, name, "tokenHash", prefix, scope, "lastUsedAt") VALUES ('fd-token', 'claude-code', repeat('a', 64), 'cp_fdtest', 'WRITE', now())`);
  await sql(`INSERT INTO "AgentRun" (id, kind, title, "actorKind", "actorName", status, "lastStep") VALUES ('fd-run', 'scan', 'Scan Berlin', 'CLI', 'claude-code', 'RUNNING', 'Fetched 3 boards')`);
  await sql(`INSERT INTO "Application" (id, "updatedAt", title, "awaitingReview", origin) VALUES ('fd-draft', now(), 'Drafted by an assistant', true, 'AGENT')`);

  await page.goto("/");
  const assistants = page.getByRole("region", { name: "Your assistants" });
  await expect(assistants).toContainText("1 assistant connected");
  await expect(assistants.getByRole("list", { name: "Connected assistants" })).toContainText("claude-code");
  await expect(assistants.getByRole("list", { name: "Running now" }).getByRole("link", { name: "Scan Berlin" })).toHaveAttribute("href", "/runs/fd-run");

  const needs = page.getByRole("region", { name: "Needs you" });
  await expect(needs.getByRole("link", { name: /1 draft from your assistant/ })).toHaveAttribute("href", "/agent");
  // An agent draft is not an application yet: it waits for review.
  await expect(page.getByRole("region", { name: "Applications" })).not.toContainText("Drafted by an assistant");
});

test("counts the postings scans found that wait on the Review page, and links there", async ({ page }) => {
  await sql(
    `INSERT INTO "ScannedPosting" (id, source, "externalId", "companyName", title, url, "canonicalKey", fingerprint, "firstSeenAt", "lastSeenAt", state)
     VALUES ('fd-p1', 'GREENHOUSE', 'acme:1', 'Acme', 'Designer', 'https://example.test/1', 'acme_designer', 'a', now(), now(), 'NEW'),
            ('fd-p2', 'GREENHOUSE', 'acme:2', 'Acme', 'Researcher', 'https://example.test/2', 'acme_researcher', 'b', now(), now(), 'NEW'),
            ('fd-p3', 'GREENHOUSE', 'acme:3', 'Acme', 'Cook', 'https://example.test/3', 'acme_cook', 'c', now(), now(), 'DISMISSED')`,
  );
  await page.goto("/");
  const link = page.getByRole("region", { name: "Needs you" }).getByRole("link", { name: "2 new postings" });
  await expect(link).toHaveAttribute("href", "/review");
  await link.click();
  await expect(page).toHaveURL(/\/review$/);
  await sql(`DELETE FROM "ScannedPosting"`);
});

test("counts the drafts whose job was found closed, and links to the draft when there is one", async ({ page }) => {
  await sql(`INSERT INTO "Application" (id, "updatedAt", title, "postingOpen", "postingCheckedAt", "postingCheckNote") VALUES ('fd-closed', now(), 'Designer at Closed Co', false, now(), 'Greenhouse no longer lists it on the employer''s board.')`);
  await page.goto("/");
  const link = page.getByRole("region", { name: "Needs you" }).getByRole("link", { name: "1 draft", exact: true });
  await expect(link).toHaveAttribute("href", "/applications/fd-closed");
  await sql(`DELETE FROM "Application" WHERE id = 'fd-closed'`);
});

// The app's shell has no phone layout of its own (its sidebar is 260px wide unless collapsed to icons; roadmap M10 has
// the responsive pass), so a phone is tested in the shell's small state: the sidebar collapsed.
test("fits a phone with the sidebar collapsed, and has no serious accessibility problems", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.context().addCookies([{ name: "dossier_sidebar", value: "collapsed", url: `http://localhost:${APP_PORT}` }]);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Applications" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await expectAccessible(page);

  // The detail pages the cards link to fit too.
  await page.goto("/insights");
  await expect(page.getByRole("heading", { name: "Insights", level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

  await page.context().clearCookies({ name: "dossier_sidebar" });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto("/");
  await expectAccessible(page);
});
