import { createHash } from "node:crypto";

import { expect, request, test } from "@playwright/test";

import { APP_PORT, resetData, sql } from "./support";

// The REST API through the real server and proxy: it takes a bearer token,
// not a session, and answers in JSON either way.
test.beforeAll(resetData);

const TOKEN = "cp_e2e-token-for-the-rest-api-spec-0123456789";
const BASE = `http://localhost:${APP_PORT}`;

test("answers a JSON 401 without a token, and works with one", async () => {
  // A fresh context: no session cookie, unlike the page tests.
  const anonymous = await request.newContext({ baseURL: BASE, storageState: undefined });
  const denied = await anonymous.get("/api/v1/status", { maxRedirects: 0 });
  expect(denied.status()).toBe(401);
  expect(denied.headers()["www-authenticate"]).toContain("Bearer");
  expect(await denied.json()).toMatchObject({ error: { code: "unauthorized" } });

  await sql(`INSERT INTO "ApiToken" (id, name, "tokenHash", prefix, scope) VALUES ('e2e-token', 'e2e client', $1, 'cp_e2e-', 'READ')`, [createHash("sha256").update(TOKEN).digest("hex")]);
  const allowed = await anonymous.get("/api/v1/applications?limit=2", { headers: { authorization: `Bearer ${TOKEN}` } });
  expect(allowed.status()).toBe(200);
  const { data } = (await allowed.json()) as { data: { title: string; status: string }[] };
  expect(data).toHaveLength(2);
  expect(data[0]).toHaveProperty("status");

  // A read-only token can't use the posting check.
  const forbidden = await anonymous.post("/api/v1/postings/check", { headers: { authorization: `Bearer ${TOKEN}` }, data: { text: "hello" } });
  expect(forbidden.status()).toBe(403);

  await sql(`UPDATE "ApiToken" SET "revokedAt" = now() WHERE id = 'e2e-token'`);
  expect((await anonymous.get("/api/v1/status", { headers: { authorization: `Bearer ${TOKEN}` } })).status()).toBe(401);
  await anonymous.dispose();
});

test("makes a token in Settings, shows it once, and revoking it stops it working", async ({ page, playwright }) => {
  await page.goto("/settings?section=tokens");
  await page.getByLabel("Name").fill("e2e from settings");
  await page.getByRole("button", { name: "Make token" }).click();
  const shown = page.getByRole("status").locator("code");
  await expect(shown).toHaveText(/^cp_[A-Za-z0-9_-]{43}$/);
  const token = (await shown.textContent())!;
  await expect(page.getByRole("list", { name: "API tokens" })).toContainText("e2e from settings");

  const client = await playwright.request.newContext({ baseURL: BASE, storageState: undefined });
  const ok = await client.get("/api/v1/status", { headers: { authorization: `Bearer ${token}` } });
  expect(ok.status()).toBe(200);
  expect(await ok.json()).toMatchObject({ data: { token: { name: "e2e from settings", scope: "READ" } } });

  // After a reload the secret is gone from the page, and only a prefix is shown.
  await page.reload();
  await expect(page.getByText(token)).toHaveCount(0);
  await page.getByRole("button", { name: "Revoke e2e from settings" }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "e2e from settings" })).toContainText("Revoked");
  expect((await client.get("/api/v1/status", { headers: { authorization: `Bearer ${token}` } })).status()).toBe(401);
  await client.dispose();
});
