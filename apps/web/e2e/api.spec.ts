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
