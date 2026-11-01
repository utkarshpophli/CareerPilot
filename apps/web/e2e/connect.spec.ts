import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { APP_PORT, PASSWORD, resetData, sql } from "./support";

// The Connect screen: make a token, copy the commands for each tool, and watch the first call arrive.
test.beforeAll(resetData);

const ORIGIN = `http://localhost:${APP_PORT}`;

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
  expect(violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => violation.id)).toEqual([]);
}

test("shows the commands for each tool, filled in with this server's address", async ({ page }) => {
  await page.goto("/connect");
  await expect(page.getByRole("heading", { name: "Connect an assistant", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Add CareerPilot to Claude Code")).toHaveText(`claude mcp add --transport http careerpilot ${ORIGIN}/api/mcp`);
  await expectAccessible(page);

  await page.getByRole("tab", { name: "OpenCode" }).click();
  await expect(page.getByLabel("Add CareerPilot to OpenCode")).toHaveText(`opencode mcp add careerpilot --url ${ORIGIN}/api/mcp`);
  await expect(page.getByLabel("Or put this in opencode.json in your project")).toContainText('"$schema": "https://opencode.ai/config.json"');
  await expectAccessible(page);

  await page.getByRole("tab", { name: /Other/ }).click();
  await expect(page.getByLabel("Or call the REST API directly")).toContainText(`${ORIGIN}/api/v1/status`);
  await expectAccessible(page);
});

test("OpenCode: one button turns the connector on and allows its sign-in address", async ({ page }) => {
  await page.goto("/connect");
  await page.getByRole("tab", { name: "OpenCode" }).click();
  await page.getByRole("button", { name: "Turn on the connector and allow OpenCode" }).click();
  await expect(page.getByText(/Ready: the connector is on/)).toBeVisible();
  const [row] = await sql<{ value: string }>(`SELECT value FROM "Setting" WHERE key = 'connectorRedirects'`);
  expect(JSON.parse(row!.value)).toContain("http://127.0.0.1:19876/mcp/oauth/callback");
  // Still there after a reload: it was saved, not just shown.
  await page.reload();
  await page.getByRole("tab", { name: "OpenCode" }).click();
  await expect(page.getByText(/Ready: the connector is on/)).toBeVisible();
});

test("make a token, see it fill the commands, watch its first call arrive, then revoke it", async ({ page, playwright }) => {
  await page.goto("/connect");
  await page.getByLabel("Name").fill("e2e assistant");
  await page.getByLabel("Your password").fill(PASSWORD);
  await page.getByRole("button", { name: "Make token" }).click();

  const notice = page.getByRole("status", { name: "New token" });
  const token = (await notice.locator("pre").textContent())!;
  expect(token).toMatch(/^cp_[A-Za-z0-9_-]{43}$/);
  await expect(page.getByLabel("Environment for the pilot command (macOS, Linux)")).toContainText(`export CAREERPILOT_TOKEN='${token}'`);
  await expect(page.getByRole("list", { name: "Connected assistants" })).toContainText("e2e assistant");

  // Test connection: nothing yet, then a real call from outside the browser.
  await page.getByRole("button", { name: "Wait for the first call" }).click();
  await expect(page.getByText(/Listening. Nothing yet/)).toBeVisible();
  const client = await playwright.request.newContext({ baseURL: ORIGIN, storageState: undefined });
  expect((await client.get("/api/v1/status", { headers: { authorization: `Bearer ${token}` } })).status()).toBe(200);
  await expect(page.getByText("Connected: e2e assistant just called CareerPilot.")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("list", { name: "Connected assistants" })).toContainText("last seen");

  // Gone from the page once hidden, and revoking stops it working.
  await page.getByRole("button", { name: "Done, hide it" }).click();
  await expect(page.getByText(token)).toHaveCount(0);
  await page.getByRole("button", { name: "Revoke e2e assistant" }).click();
  await expect(page.getByText("None yet. Start with step 1.")).toBeVisible();
  expect((await client.get("/api/v1/status", { headers: { authorization: `Bearer ${token}` } })).status()).toBe(401);
  await client.dispose();
});

test("a wrong password makes no token", async ({ page }) => {
  await page.goto("/connect");
  await page.getByLabel("Name").fill("should not exist");
  await page.getByLabel("Your password").fill("not-the-password");
  await page.getByRole("button", { name: "Make token" }).click();
  await expect(page.getByRole("status", { name: "New token" })).toHaveCount(0);
  expect(await sql(`SELECT 1 FROM "ApiToken" WHERE name = 'should not exist'`)).toHaveLength(0);
});
