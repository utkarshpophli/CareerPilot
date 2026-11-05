import { expect, test } from "@playwright/test";

import { resetData, sql } from "./support";

// The History panel (M7.2): who made each version, and what it changed word by word.
let url = "";
test.beforeAll(async () => {
  await resetData();
  const [row] = await sql<{ id: string; documentId: string }>(
    `SELECT a.id, d.id AS "documentId" FROM "Application" a JOIN "Document" d ON d."applicationId" = a.id AND d.kind = 'RESUME' WHERE a.company = 'Ledgerly' LIMIT 1`,
  );
  url = `/applications/${row.id}`;
  await sql(`DELETE FROM "DocumentVersion" WHERE "documentId" = $1`, [row.documentId]);
  const summary = (text: string) => JSON.stringify([{ id: "summary", label: "Summary", text }]);
  await sql(
    `INSERT INTO "DocumentVersion" (id, "documentId", units, cause, actor, detail, "createdAt") VALUES
       ('vd-1', $1, $2::json, 'WRITTEN', 'APP_AI', '', now() - interval '3 hours'),
       ('vd-2', $1, $3::json, 'EDITED', 'YOU', '', now() - interval '2 hours'),
       ('vd-3', $1, $4::json, 'WRITTEN', 'ASSISTANT', '', now() - interval '1 hour')`,
    [row.documentId, summary("Designer who ships calm products."), summary("Designer who delivers calm products."), summary("Designer who delivers calm products, fast.")],
  );
});

test("says who made each version and what it changed", async ({ page }) => {
  await page.goto(url);
  await page.getByRole("button", { name: "History" }).first().click();
  // Only the versions themselves: the changes of one are a list of their own inside its item.
  const versions = page.getByRole("list", { name: "Versions" }).locator("> li");
  await expect(versions).toHaveCount(3);
  await expect(versions.nth(0)).toContainText("An assistant");
  await expect(versions.nth(1)).toContainText("Edited by hand");
  await expect(versions.nth(1)).toContainText("You");
  await expect(versions.nth(2)).toContainText("CareerPilot's AI");

  await versions.nth(1).getByRole("button", { name: /^(Hide changes|Changes) in the version from/ }).click();
  const changes = versions.nth(1).getByRole("list", { name: "What changed" });
  await expect(changes).toContainText("Summary · Changed");
  await expect(changes.locator("del")).toHaveText("Removed: ships");
  await expect(changes.locator("ins")).toHaveText("Added: delivers");

  await versions.nth(0).getByRole("button", { name: /^(Hide changes|Changes) in the version from/ }).click();
  await expect(versions.nth(0).locator("del")).toHaveText("Removed: products.");
  await expect(versions.nth(0).locator("ins")).toHaveText("Added: products, fast.");

  await versions.nth(2).getByRole("button", { name: /^(Hide changes|Changes) in the version from/ }).click();
  await expect(versions.nth(2)).toContainText("This is the first version");
});
