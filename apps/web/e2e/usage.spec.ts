import { expect, test } from "@playwright/test";

import { resetData, sql } from "./support";

// The Usage page (roadmap M5.4): tokens as the providers reported them, nothing estimated, no price.
test.beforeAll(resetData);

test("totals the AI calls kept, and says what it does not know", async ({ page }) => {
  await sql(`DELETE FROM "AiCall"`);
  await sql(`INSERT INTO "AiCall" (id, at, provider, model, task, "inputTokens", "outputTokens") VALUES
    ('u1', now(), 'ANTHROPIC', 'claude-sonnet-5', 'extracted_posting', 1200, 300),
    ('u2', now(), 'LOCAL', 'qwen2.5:3b', 'text', NULL, NULL)`);
  await page.goto("/usage");
  await expect(page.getByRole("heading", { name: "Usage", level: 1 })).toBeVisible();
  await expect(page.getByText("2 calls in the last 30 days: 1,200 tokens in, 300 out.")).toBeVisible();
  await expect(page.getByText(/1 call came back without token numbers/)).toBeVisible();
  await expect(page.getByRole("table", { name: "By model" }).getByRole("row", { name: /claude-sonnet-5 1 1,200 300/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Usage" })).toBeVisible();
  await sql(`DELETE FROM "AiCall"`);
});
