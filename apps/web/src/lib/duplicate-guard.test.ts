import { describe, expect, it } from "vitest";

import { COOLDOWN_DAYS, describeDuplicates, findDuplicates, type Candidate, type KnownApplication } from "./duplicate-guard";

const NOW = new Date("2026-11-05T12:00:00Z");
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 86_400_000);

const known = (overrides: Partial<KnownApplication> = {}): KnownApplication => ({
  id: "a1",
  title: "Designer · Acme",
  company: "Acme GmbH",
  role: "Product Designer (m/f/d)",
  location: "Berlin",
  postingUrl: "https://boards.greenhouse.io/acme/jobs/123?gh_src=abc",
  status: "DRAFT",
  createdAt: daysAgo(3),
  sentAt: null,
  archived: false,
  ...overrides,
});

const candidate = (overrides: Partial<Candidate> = {}): Candidate => ({
  company: "Acme",
  role: "Product Designer",
  location: "Berlin",
  postingUrl: "",
  ...overrides,
});

describe("finding applications that are the same opening", () => {
  it("finds the same posting under a tracking-parameter-free address", () => {
    const found = findDuplicates(candidate({ postingUrl: "https://www.boards.greenhouse.io/acme/jobs/123/" }), [known()], NOW);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ id: "a1", relation: "same-url", withinCooldown: false });
  });

  it("finds the same company, role and place on another board", () => {
    const found = findDuplicates(candidate({ postingUrl: "https://www.linkedin.com/jobs/view/999" }), [known()], NOW);
    expect(found).toMatchObject([{ id: "a1", relation: "same-role" }]);
  });

  it("does not match the same role in another city", () => {
    expect(findDuplicates(candidate({ location: "Hamburg" }), [known()], NOW)).toEqual([]);
  });

  it("does not match another company, or an empty candidate", () => {
    expect(findDuplicates(candidate({ company: "Globex" }), [known()], NOW)).toEqual([]);
    expect(findDuplicates({ company: "", role: "", location: "", postingUrl: "" }, [known({ company: "", role: "", postingUrl: "" })], NOW)).toEqual([]);
  });

  it("leaves out archived applications", () => {
    expect(findDuplicates(candidate(), [known({ archived: true })], NOW)).toEqual([]);
  });

  it("says when an application for it was sent inside the cooldown, and not after it", () => {
    const recent = findDuplicates(candidate(), [known({ status: "SENT", sentAt: daysAgo(10) })], NOW);
    expect(recent[0]).toMatchObject({ withinCooldown: true, sentDaysAgo: 10 });
    const old = findDuplicates(candidate(), [known({ status: "SENT", sentAt: daysAgo(COOLDOWN_DAYS + 5) })], NOW);
    expect(old[0]).toMatchObject({ withinCooldown: false, sentDaysAgo: COOLDOWN_DAYS + 5 });
  });

  it("puts a sent application and the same address first", () => {
    const found = findDuplicates(
      candidate({ postingUrl: "https://boards.greenhouse.io/acme/jobs/123" }),
      [
        known({ id: "role-only", postingUrl: "https://example.test/other", createdAt: daysAgo(1) }),
        known({ id: "same-url", createdAt: daysAgo(9) }),
      ],
      NOW,
    );
    expect(found.map((entry) => entry.id)).toEqual(["same-url", "role-only"]);
  });
});

describe("telling the owner", () => {
  it("says in plain words how each one repeats the opening and where it stands", () => {
    const lines = describeDuplicates(findDuplicates(candidate(), [known({ status: "SENT", sentAt: daysAgo(1) }), known({ id: "a2", title: "Other", postingUrl: "" })], NOW));
    expect(lines).toEqual([
      "Designer · Acme: the same company, role and place, sent 1 day ago (inside the 90-day wait) [a1]",
      "Other: the same company, role and place, still draft [a2]",
    ]);
  });
});
