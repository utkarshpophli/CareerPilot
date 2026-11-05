import { expect, test } from "@playwright/test";

import { resetData, sql } from "./support";

// The ATS check on the Resume tab (M7.3): finds the characters applicant-tracking parsers garble, fixes them on
// request as a version, and Undo brings the resume back as it was.
let url = "";
test.beforeAll(async () => {
  await resetData();
  const [ledgerly] = await sql<{ id: string }>(`SELECT id FROM "Application" WHERE company = 'Ledgerly' LIMIT 1`);
  url = `/applications/${ledgerly.id}`;
  await sql(
    `UPDATE "Document" SET units = (
       SELECT jsonb_agg(CASE WHEN u->>'id' = 'summary' THEN jsonb_set(u, '{text}', to_jsonb($2::text)) ELSE u END)
       FROM jsonb_array_elements(units::jsonb) AS u
     )::json
     WHERE "applicationId" = $1 AND kind = 'RESUME'`,
    [ledgerly.id, "Product designer — “quietly” careful with complex tools."],
  );
});

test("finds characters parsers garble, fixes them, and undoes it", async ({ page }) => {
  await page.goto(url);
  const note = page.getByRole("note", { name: "ATS check" });
  await expect(note).toContainText("1 long dash (—)");
  await expect(note).toContainText("2 curly double quotes");

  await note.getByRole("button", { name: "Make ATS-safe" }).click();
  await expect(page.getByText(/Made \d+ parts? of the resume safe for applicant-tracking systems/)).toBeVisible();
  await expect(page.getByRole("note", { name: "ATS check" })).toBeHidden();
  await expect(page.getByRole("article", { name: "Resume" })).toContainText('Product designer - "quietly" careful');

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("note", { name: "ATS check" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Resume" })).toContainText("Product designer — “quietly” careful");

  // Both the cleaned text and the restore are in the history, with the right words.
  await page.getByRole("button", { name: "History" }).first().click();
  await expect(page.getByText("Made the text safe for applicant-tracking systems")).toBeVisible();
  await expect(page.getByText("As it was before making the text ATS-safe")).toBeVisible();
});
