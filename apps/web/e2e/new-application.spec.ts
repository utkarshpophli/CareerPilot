import { expect, test } from "@playwright/test";

import { resetData, sql } from "./support";

// A new application from a pasted posting (E7), with the fake AI server.
test.beforeAll(resetData);

const POSTING = `Ledgerly: Senior Product Designer, Payments
Amsterdam (hybrid, 3 days in office) · €75,000–€90,000

What we're looking for
- 5+ years of product design
- You've built or maintained a design system
- Strong prototyping skills in Figma
- Experience with Kubernetes
- Dutch is a plus`;

test("reads a posting, shows the match and writes tailored documents", async ({ page }) => {
  await page.goto("/new?fresh=1");
  await page.getByLabel("Job posting").fill(POSTING);
  await page.getByRole("button", { name: "Read the posting →" }).click();

  await expect(page.getByRole("heading", { name: "How you match" })).toBeVisible();
  await expect(page.getByLabel("Company")).toHaveValue("Ledgerly");
  await expect(page.getByLabel("Role")).toHaveValue("Senior Product Designer, Payments");
  await expect(page.getByText("Experience with Kubernetes")).toBeVisible();

  await page.getByLabel("Anything I should know?").fill("I'm moving to Amsterdam in January.");
  await page.getByRole("button", { name: "Create application →" }).click();
  await page.waitForURL(/\/applications\/c/, { timeout: 30_000 });

  await expect(page.getByRole("heading", { level: 1, name: "Senior Product Designer, Payments · Ledgerly" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Resume" })).toContainText("Jane Doe");
  await page.getByRole("tab", { name: "Cover letter" }).click();
  await expect(page.getByText("Payments are where trust is won or lost")).toBeVisible();
  // What you told the AI is the application's first fact (APP-15).
  await page.getByRole("tab", { name: /Job posting/ }).click();
  await expect(page.getByRole("region", { name: "Facts for this application" }).getByRole("textbox", { name: "Fact 1", exact: true })).toHaveValue("I'm moving to Amsterdam in January.");
});

test("says so when the posting repeats an application already sent (M7.8)", async ({ page }) => {
  const [{ id }] = await sql<{ id: string }>(
    `INSERT INTO "Application" (id, "updatedAt", title, company, role, location, status, "sentAt")
     VALUES ('dup-sent', now(), 'Senior Product Designer, Payments · Ledgerly', 'Ledgerly GmbH', 'Senior Product Designer, Payments', 'Amsterdam', 'SENT', now() - interval '6 days')
     RETURNING id`,
  );
  try {
    await page.goto("/new?fresh=1");
    await page.getByLabel("Job posting").fill(POSTING);
    await page.getByRole("button", { name: "Read the posting →" }).click();
    await expect(page.getByRole("heading", { name: "How you match" })).toBeVisible();

    const note = page.getByRole("note", { name: "Applications you already have" });
    await expect(note).toContainText("You applied for this lately.");
    await expect(note).toContainText("the same company, role and place, sent 6 days ago");
    // The application the first test made from this same posting is listed too.
    await expect(note.locator(`a[href="/applications/${id}"]`)).toBeVisible();
    // It only tells: the application can still be made.
    await expect(page.getByRole("button", { name: "Create application →" })).toBeEnabled();

    // Another place is another opening, so the notice goes.
    await page.getByLabel("Location").fill("Rotterdam");
    await expect(note).toBeHidden();
  } finally {
    await sql(`DELETE FROM "Application" WHERE id = 'dup-sent'`);
  }
});

test("won't fetch a posting from the server's own network (E7-8)", async ({ page }) => {
  await page.goto("/new?fresh=1");
  await page.getByLabel(/^Link to the posting/).fill("http://localhost:3100/login");
  await page.getByRole("button", { name: "Fetch" }).click();
  await expect(page.getByText("CareerPilot doesn't fetch addresses on your own network. Paste the posting instead.")).toBeVisible();
  await expect(page.getByLabel("Job posting")).toHaveValue("");
});

