import { beforeEach, describe, expect, it, vi } from "vitest";

const kept = vi.hoisted(() => ({ ran: [] as unknown[], outcome: { ok: true, id: "s1" } as { ok: boolean; id?: string; problem?: string; message?: string }, stored: { id: "s1", postings: [{ title: "Designer" }], next: null } as unknown }));
vi.mock("@/lib/posting-searches", () => ({
  runSearch: async (query: unknown) => (kept.ran.push(query), kept.outcome),
  loadSearch: async () => kept.stored,
  showMoreFor: async () => ({ ok: true, postings: [], next: null }),
}));

import { runJobSearch, searchQueryFrom } from "./searches";

const db = {} as never; // the actor in these tests is the owner, so no run is reported and the client is never touched
const basics = { city: "Berlin", country: "Germany" };

beforeEach(() => {
  kept.ran = [];
  kept.outcome = { ok: true, id: "s1" };
  kept.stored = { id: "s1", postings: [{ title: "Designer" }], next: null };
});

describe("searchQueryFrom", () => {
  it("searches the profile's city and country unless told otherwise", () => {
    expect(searchQueryFrom({ keywords: "product designer" }, basics)).toEqual({ keywords: "product designer", place: "Berlin", country: "de", radiusKm: 25, remoteOnly: false, postedWithin: "month" });
  });

  it("takes a country as a name or a two-letter code, and ignores the place for a remote-only search", () => {
    expect(searchQueryFrom({ keywords: "x", country: "France", place: "Lyon" }, basics)).toMatchObject({ country: "fr", place: "Lyon" });
    expect(searchQueryFrom({ keywords: "x", country: "NL", remoteOnly: true, place: "Utrecht" }, basics)).toMatchObject({ country: "nl", place: "", remoteOnly: true });
  });

  it("asks which country when it cannot tell", () => {
    expect(() => searchQueryFrom({ keywords: "x" }, { city: "", country: "" })).toThrowError(/Say which country/);
  });
});

describe("runJobSearch", () => {
  it("runs the search and reads back what was kept", async () => {
    const result = await runJobSearch(db, { keywords: "designer" }, basics);
    expect(kept.ran).toHaveLength(1);
    expect(result.search).toMatchObject({ id: "s1" });
    expect(result.query.keywords).toBe("designer");
  });

  it("turns a source's problem into a plain error, with a code the doors can map", async () => {
    kept.outcome = { ok: false, problem: "quota", message: "Out of searches this month." };
    await expect(runJobSearch(db, { keywords: "designer" }, basics)).rejects.toMatchObject({ code: "conflict", message: "Out of searches this month." });
    kept.outcome = { ok: false, problem: "no-key", message: "Add a key in Settings." };
    await expect(runJobSearch(db, { keywords: "designer" }, basics)).rejects.toMatchObject({ code: "bad_request" });
  });
});
