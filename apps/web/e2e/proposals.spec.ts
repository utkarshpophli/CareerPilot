import { createHash } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, request, test, type APIRequestContext, type Page } from "@playwright/test";

import { APP_PORT, resetData, sql } from "./support";

// The proposal queue end to end: an assistant proposes through the REST API, the owner sees it on the dashboard and
// on the application and answers with one click, and the assistant still cannot move the status itself.
test.beforeAll(async () => {
  await resetData();
  await sql(`INSERT INTO "ApiToken" (id, name, "tokenHash", prefix, scope) VALUES ('prop-token', 'claude-code', $1, 'cp_prop', 'WRITE')`, [createHash("sha256").update(TOKEN).digest("hex")]);
});

const TOKEN = "cp_e2e-proposal-token-0123456789abcdefghijklm";
const BASE = `http://localhost:${APP_PORT}`;

async function assistant(): Promise<APIRequestContext> {
  return request.newContext({ baseURL: BASE, storageState: undefined, extraHTTPHeaders: { authorization: `Bearer ${TOKEN}` } });
}

async function drafts(count: number) {
  return sql<{ id: string; title: string }>(`SELECT id, title FROM "Application" WHERE status = 'DRAFT' AND "awaitingReview" = false ORDER BY "createdAt" LIMIT ${count}`);
}

const statusOf = async (id: string) => (await sql<{ status: string }>(`SELECT status FROM "Application" WHERE id = $1`, [id]))[0]!.status;

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => `${violation.id}: ${violation.nodes.map((node) => node.target.join(" ")).join(" | ")}`)).toEqual([]);
}

test("an assistant cannot move an application to sent, but can propose it", async () => {
  const [app] = await drafts(1);
  const api = await assistant();
  const refused = await api.patch(`/api/v1/applications/${app!.id}/status`, { data: { status: "SENT" } });
  expect(refused.status()).toBe(403);
  expect(((await refused.json()) as { error: { message: string } }).error.message).toMatch(/propose/i);
  expect(await statusOf(app!.id)).toBe("DRAFT");

  const proposed = await api.post(`/api/v1/applications/${app!.id}/proposals`, { data: { status: "SENT", reason: "The user said they sent it" } });
  expect(proposed.status()).toBe(200);
  // A proposal changes nothing by itself.
  expect(await statusOf(app!.id)).toBe("DRAFT");
  await api.dispose();
});

test("the owner sees it on the dashboard, confirms it with one click, and can undo", async ({ page }) => {
  const [app, other] = await drafts(2);
  const api = await assistant();
  await api.post(`/api/v1/applications/${app!.id}/proposals`, { data: { status: "SENT", reason: "The user said they sent it" } });
  await api.post(`/api/v1/applications/${other!.id}/proposals`, { data: { status: "OFFER", reason: "An email said so" } });
  await api.dispose();

  await page.goto("/");
  const needs = page.getByRole("region", { name: "Needs you" });
  const list = needs.getByRole("list", { name: "Proposals from your assistants" });
  await expect(list).toContainText("claude-code proposes Sent");
  await expect(list).toContainText("The user said they sent it");
  await expect(list).toContainText("claude-code proposes Offer");
  await expectAccessible(page);

  await needs.getByRole("button", { name: `Mark as Sent for ${app!.title}` }).click();
  await expect(page.getByText(/Marked as sent/)).toBeVisible();
  await expect.poll(() => statusOf(app!.id)).toBe("SENT");
  await expect(list).not.toContainText("proposes Sent");

  // Undo from the toast puts it back.
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(() => statusOf(app!.id)).toBe("DRAFT");

  // Dismissing leaves the application as it was.
  await needs.getByRole("button", { name: `Dismiss the proposal for ${other!.title}` }).click();
  await expect(needs.getByRole("list", { name: "Proposals from your assistants" })).toHaveCount(0);
  expect(await statusOf(other!.id)).toBe("DRAFT");
});

test("it shows on the application itself too, and confirming there works", async ({ page }) => {
  const [app] = await drafts(1);
  const api = await assistant();
  await api.post(`/api/v1/applications/${app!.id}/proposals`, { data: { status: "SCREENING", reason: "They replied" } });
  await api.dispose();

  await page.goto(`/applications/${app!.id}`);
  const pill = page.getByRole("group", { name: "Proposal from claude-code" });
  await expect(pill).toContainText("proposes Screening");
  await pill.getByRole("button", { name: /^Mark as Screening for / }).click();
  await expect.poll(() => statusOf(app!.id)).toBe("SCREENING");
  await expect(pill).toHaveCount(0);
});

test("the activity page tells who proposed and who confirmed", async ({ page }) => {
  await page.goto("/activity");
  const feed = page.getByRole("list").filter({ hasText: "proposed" });
  await expect(feed).toContainText("claude-code proposed Sent");
  await expect(feed).toContainText("Confirmed claude-code's proposal");
});
