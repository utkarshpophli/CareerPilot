import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { atlassian, parseAtlassian } from "./atlassian";

// A real recording (GitHub Actions, 2026-11-04) of Atlassian's careers listings, cut to three postings. See docs/sources/atlassian.md.
const real = () => JSON.parse(readFileSync(join(__dirname, "fixtures/real/atlassian-listings.json"), "utf8")) as unknown;
const urls = (seen: string[]) => (async (url: URL | string) => (seen.push(String(url)), new Response("[]", { status: 200 }))) as unknown as typeof fetch;

describe("Atlassian against a real recording", () => {
  const postings = parseAtlassian(real(), { slug: "atlassian" }, "Atlassian");

  it("maps every listing: id under the board, the posting's own page, plain text, no invented date or pay", () => {
    expect(postings).toHaveLength(3);
    expect(postings[0]).toMatchObject({
      source: "ATLASSIAN",
      externalId: "atlassian:27339",
      title: "Account Executive",
      company: "Atlassian",
      location: "Manila, Philippines",
      remote: null,
      postedAt: null,
      salary: null,
    });
    // The page to read, not the apply form (`mode=apply`).
    for (const posting of postings) {
      expect(posting.url).toMatch(/^https:\/\/careers-[a-z]+-atlassian\.icims\.com\/jobs\/\d+\//);
      expect(posting.url).not.toContain("mode=apply");
      expect(posting.description).not.toMatch(/<\/?[a-z][^>]*>/i);
      expect(posting.description.length).toBeGreaterThan(200);
    }
  });

  it("cleans the places it lists, and says remote only where every place is remote", () => {
    expect(postings[1].location).toBe("Remote, India; Remote");
    expect(postings[1].remote).toBe(true);
    // Sydney, Auckland and Remote: remote is one option among several, which the listing does not make a yes or a no.
    expect(postings[2].location).toContain("Sydney, Australia");
    expect(postings[2].location).toContain("Remote");
    expect(postings[2].remote).toBeNull();
  });

  it("keeps the pay statement as text in the description, never as figures", () => {
    expect(postings[2].description).toMatch(/equitable/i);
    expect(postings[2].salary).toBeNull();
  });

  it("asks the one careers address on its fixed host, for the one board it has", async () => {
    const seen: string[] = [];
    await atlassian.fetchBoard({ slug: "atlassian" }, "Atlassian", { fetchImpl: urls(seen) });
    expect(seen).toEqual(["https://www.atlassian.com/endpoint/careers/listings"]);
    await expect(atlassian.fetchBoard({ slug: "someone-else" }, "x", { fetchImpl: urls(seen) })).rejects.toMatchObject({ problem: "bad-slug" });
    expect(seen).toHaveLength(1);
    expect(atlassian.refFrom("atlassian")).toEqual({ slug: "atlassian" });
    expect(atlassian.refFrom("https://www.atlassian.com/company/careers/all-jobs")).toEqual({ slug: "atlassian" });
    expect(atlassian.refFrom("https://www.atlassian.com/endpoint/careers/listings")).toEqual({ slug: "atlassian" });
    expect(atlassian.refFrom("https://www.atlassian.com/software/jira")).toBeNull();
    expect(atlassian.refFrom("https://evil.test/www.atlassian.com/company/careers")).toBeNull();
    expect(atlassian.refFrom("stripe")).toBeNull();
  });

  it("drops a listing without an id or a link we can use, and reads a non-list as an empty board", () => {
    const listing = (over: Record<string, unknown>) => ({ id: "1", title: "T", locations: [], overview: "o", applyUrl: "https://careers.example.icims.com/jobs/1/t/job?mode=apply", ...over });
    const parsed = parseAtlassian([listing({ id: undefined }), listing({ applyUrl: "javascript:alert(1)", portalJobPost: {} }), listing({ id: "2" })], { slug: "atlassian" }, "Atlassian");
    expect(parsed.map((p) => p.externalId)).toEqual(["atlassian:2"]);
    expect(parseAtlassian({ error: 1 }, { slug: "atlassian" }, "A")).toEqual([]);
  });
});
