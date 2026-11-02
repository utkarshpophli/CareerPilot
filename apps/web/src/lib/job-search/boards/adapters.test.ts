import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { ashby, parseAshby, parseCompensation } from "./ashby";
import { buildOfficeMap, greenhouse, isWorkModelOnly, parseGreenhouse } from "./greenhouse";
import { lever, parseLever } from "./lever";

// Responses shaped like each source's documented public API and the cases
// career-ops's own providers handle. They are hand-built fixtures, not
// recordings from the live services (the build environment could not reach
// them); a skipped-by-default live test per source checks the real shape.
const fixture = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", name), "utf8")) as unknown;
const reply = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("Greenhouse", () => {
  it("maps a board to postings: plain text, ids kept apart per board, no invented fields", () => {
    const postings = parseGreenhouse(fixture("greenhouse-jobs.json"), { slug: "acme" }, "Acme");
    // A posting with no link, or whose id is not a string or number, is left out: absent beats wrong.
    expect(postings.map((p) => p.title)).toEqual(["Senior Product Designer", "Account Executive"]);
    expect(postings[0]).toEqual({
      source: "GREENHOUSE",
      externalId: "acme:4012345",
      requisitionId: "REQ-77",
      title: "Senior Product Designer",
      company: "Acme",
      location: "Berlin, Germany",
      remote: null,
      url: "https://job-boards.greenhouse.io/acme/jobs/4012345",
      description: "Design & ship Figma systems. 5+ years",
      postedAt: "2026-10-20T12:15:00.000Z",
      salary: null,
    });
    // A date that does not parse is no date.
    expect(postings[1]!.postedAt).toBeNull();
  });

  it("recognises a location that is only a work model, and builds the offices map", () => {
    expect(isWorkModelOnly("Hybrid")).toBe(true);
    expect(isWorkModelOnly("Distributed; Hybrid")).toBe(true);
    expect(isWorkModelOnly("Hybrid - London")).toBe(false);
    expect(isWorkModelOnly(undefined)).toBe(false);
    const map = buildOfficeMap(fixture("greenhouse-offices.json"));
    expect([...map.get(4012346)!].sort()).toEqual(["Amsterdam", "Utrecht", "Zurich"]);
  });

  it("fetches the board, asking for offices only when a location hides its city, and keeps going if offices fail", async () => {
    const calls: string[] = [];
    const fetchImpl = vi.fn(async (url: URL | string) => {
      calls.push(String(url));
      return String(url).includes("/offices") ? reply(fixture("greenhouse-offices.json")) : reply(fixture("greenhouse-jobs.json"));
    }) as unknown as typeof fetch;
    const postings = await greenhouse.fetchBoard({ slug: "acme" }, "Acme", { fetchImpl });
    expect(calls).toEqual(["https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true", "https://boards-api.greenhouse.io/v1/boards/acme/offices"]);
    expect(postings.find((p) => p.title === "Account Executive")!.location).toBe("Hybrid · Amsterdam · Utrecht · Zurich");

    const failing = vi.fn(async (url: URL | string) => (String(url).includes("/offices") ? new Response("", { status: 500 }) : reply(fixture("greenhouse-jobs.json")))) as unknown as typeof fetch;
    const without = await greenhouse.fetchBoard({ slug: "acme" }, "Acme", { fetchImpl: failing, sleep: async () => {} });
    expect(without.find((p) => p.title === "Account Executive")!.location).toBe("Hybrid");
  });

  it("takes a board from a slug or the addresses people paste, and nothing else", () => {
    const ref = greenhouse.refFrom;
    expect(ref("stripe")).toEqual({ slug: "stripe" });
    expect(ref("https://job-boards.greenhouse.io/stripe")).toEqual({ slug: "stripe" });
    expect(ref("https://boards.greenhouse.io/stripe/jobs/123")).toEqual({ slug: "stripe" });
    expect(ref("https://job-boards.eu.greenhouse.io/acme")).toEqual({ slug: "acme" });
    expect(ref("https://boards.greenhouse.io/embed/job_board?for=stripe")).toEqual({ slug: "stripe" });
    expect(ref("https://boards-api.greenhouse.io/v1/boards/stripe/jobs")).toEqual({ slug: "stripe" });
    // Another site that merely mentions a board is not a board.
    expect(ref("https://example.com/redirect?next=https://job-boards.greenhouse.io/othercorp")).toBeNull();
    expect(ref("https://example.com/jobs?for=stripe")).toBeNull();
    expect(ref("javascript:alert(1)")).toBeNull();
    expect(ref("bad/slug")).toBeNull();
    expect(ref("")).toBeNull();
  });

  it("is a board that answers an empty or odd list with no postings", () => {
    expect(parseGreenhouse({}, { slug: "acme" }, "Acme")).toEqual([]);
    expect(parseGreenhouse({ jobs: "no" }, { slug: "acme" }, "Acme")).toEqual([]);
    expect(parseGreenhouse(null, { slug: "acme" }, "Acme")).toEqual([]);
  });
});

describe("Lever", () => {
  it("maps postings with the whole description (intro, lists, closing) and every location", () => {
    const postings = parseLever(fixture("lever-postings.json"), { slug: "acme" }, "Acme");
    expect(postings.map((p) => p.title)).toEqual(["Backend Engineer", "Remote Support Lead"]);
    expect(postings[0]).toMatchObject({
      source: "LEVER",
      externalId: "acme:5a1f0c2e-1111-4a5b-9c3d-000000000001",
      location: "Barcelona; montevideo",
      remote: false,
      postedAt: new Date(1760000000000).toISOString(),
      description: "Build APIs in Go.\n\nRequirements\nGo SQL\n\nWe are an equal opportunity employer.",
      salary: null,
    });
    expect(postings[1]).toMatchObject({ remote: true, postedAt: null, description: "Lead support.", location: "" });
  });

  it("fetches from the right host for a region, and refuses a slug that could change the address", async () => {
    const seen: string[] = [];
    const fetchImpl = (async (url: URL | string) => (seen.push(String(url)), reply([]))) as unknown as typeof fetch;
    await lever.fetchBoard({ slug: "acme" }, "Acme", { fetchImpl });
    await lever.fetchBoard({ slug: "acme", region: "eu" }, "Acme", { fetchImpl });
    expect(seen).toEqual(["https://api.lever.co/v0/postings/acme", "https://api.eu.lever.co/v0/postings/acme"]);
    await expect(lever.fetchBoard({ slug: "a/../b" }, "Acme", { fetchImpl })).rejects.toMatchObject({ problem: "bad-slug" });
    expect(seen).toHaveLength(2);
  });

  it("takes a board from a slug or a careers address, remembering the EU region", () => {
    expect(lever.refFrom("acme")).toEqual({ slug: "acme" });
    expect(lever.refFrom("https://jobs.lever.co/acme/5a1f0c2e")).toEqual({ slug: "acme" });
    expect(lever.refFrom("https://jobs.eu.lever.co/acme")).toEqual({ slug: "acme", region: "eu" });
    expect(lever.refFrom("https://api.lever.co/v0/postings/acme?mode=json")).toEqual({ slug: "acme" });
    expect(lever.refFrom("https://evil.example/jobs.lever.co/acme")).toBeNull();
  });

  it("treats a list that is not a list as an empty board", () => {
    expect(parseLever({ error: "x" }, { slug: "acme" }, "Acme")).toEqual([]);
  });
});

describe("Ashby", () => {
  it("maps postings: every location, the work model, and pay only from a real salary component", () => {
    const postings = parseAshby(fixture("ashby-board.json"), { slug: "acme" }, "Acme");
    // A posting the board marks as not publicly listed (isListed: false) is not taken.
    expect(postings.map((p) => p.title)).toEqual(["Staff Engineer", "Contractor", "Unreadable pay"]);
    expect(postings[0]).toMatchObject({
      source: "ASHBY",
      externalId: "acme:d0a4e1c2-0000-4000-8000-0000000000a1",
      location: "England · London · United Kingdom · New York · United States",
      // workplaceType wins over isRemote when both are present.
      remote: false,
      salary: { min: 150000, max: 190000, currency: "USD" },
      postedAt: "2026-10-25T10:00:00.000Z",
      description: "Own the platform.",
    });
    expect(postings[1]).toMatchObject({ location: "Remote", remote: true, salary: { min: 104000, max: 145600, currency: "EUR" } });
    // A salary with no stated interval is not guessed at.
    expect(postings[2]!.salary).toBeNull();
  });

  it("reads pay only from a salary component with a readable interval", () => {
    expect(parseCompensation({})).toBeNull();
    expect(parseCompensation({ compensation: { compensationTiers: [{ components: [{ compensationType: "EquityPercentage", minValue: 1, maxValue: 2, interval: "1 YEAR" }] }] } })).toBeNull();
    // A wider component with no usable interval does not hide a narrower readable one.
    expect(
      parseCompensation({
        compensation: {
          compensationTiers: [
            {
              components: [
                { compensationType: "Salary", minValue: 1, maxValue: 999999, currencyCode: "EUR" },
                { compensationType: "Salary", interval: "1 MONTH", minValue: 4000, maxValue: 5000, currencyCode: "eur" },
              ],
            },
          ],
        },
      }),
    ).toEqual({ min: 48000, max: 60000, currency: "EUR" });
    // The older flat shape is still read, with a yearly default.
    expect(parseCompensation({ compensation: { minValue: 90000, maxValue: 80000, currency: "gbp" } })).toEqual({ min: 80000, max: 90000, currency: "GBP" });
    expect(parseCompensation({ compensation: { minValue: -5, maxValue: "x" } })).toBeNull();
  });

  it("asks for compensation, waits and retries because the source is slow, and takes a board from its address", async () => {
    const seen: string[] = [];
    const fetchImpl = (async (url: URL | string) => (seen.push(String(url)), reply({ jobs: [] }))) as unknown as typeof fetch;
    expect(await ashby.fetchBoard({ slug: "acme" }, "Acme", { fetchImpl })).toEqual([]);
    expect(seen).toEqual(["https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=true"]);
    expect(ashby.refFrom("https://jobs.ashbyhq.com/acme")).toEqual({ slug: "acme" });
    expect(ashby.refFrom("https://jobs.ashbyhq.com/acme/d0a4e1c2")).toEqual({ slug: "acme" });
    expect(ashby.refFrom("https://api.ashbyhq.com/posting-api/job-board/acme?includeCompensation=true")).toEqual({ slug: "acme" });
    expect(ashby.refFrom("https://example.com/jobs.ashbyhq.com/acme")).toBeNull();
  });
});

// Real recordings (taken by CI from the live services, trimmed to a few postings; see scripts/record-board-fixtures.mjs).
// They check the parsers against what the services actually send, which the hand-built fixtures above cannot.
const real = (name: string) => JSON.parse(readFileSync(join(__dirname, "fixtures", "real", name), "utf8")) as unknown;

describe("against real recordings", () => {
  it("Lever: every posting has a title, an https link, an id under its board, and plain text", () => {
    const json = real("lever-postings.json");
    const postings = parseLever(json, { slug: "palantir" }, "Palantir");
    expect(postings.length).toBe((json as unknown[]).length);
    for (const posting of postings) {
      expect(posting.title).not.toBe("");
      expect(posting.url).toMatch(/^https:\/\/jobs\.lever\.co\//);
      expect(posting.externalId).toMatch(/^palantir:[0-9a-f-]{36}$/);
      expect(posting.description).not.toMatch(/<\/?[a-z][^>]*>/i);
      expect(posting.description.length).toBeGreaterThan(0);
      expect(posting.postedAt === null || !Number.isNaN(Date.parse(posting.postedAt))).toBe(true);
    }
  });

  it("Ashby: every posting has a title, an https link, an id under its board, and a location", () => {
    const json = real("ashby-board.json");
    const postings = parseAshby(json, { slug: "openai" }, "OpenAI");
    expect(postings.length).toBe((json as { jobs: unknown[] }).jobs.length);
    for (const posting of postings) {
      expect(posting.title).not.toBe("");
      expect(posting.url).toMatch(/^https:\/\/jobs\.ashbyhq\.com\//);
      expect(posting.externalId).toMatch(/^openai:[0-9a-f-]{36}$/);
      expect(posting.location).not.toBe("");
      expect(posting.postedAt === null || !Number.isNaN(Date.parse(posting.postedAt))).toBe(true);
      if (posting.salary) expect(posting.salary.min).toBeLessThanOrEqual(posting.salary.max);
    }
  });
});

describe("Greenhouse against real recordings", () => {
  it("every posting has a title, an https link, a numeric id under its board, and plain text with no markup left", () => {
    const json = real("greenhouse-jobs.json");
    const postings = parseGreenhouse(json, { slug: "stripe" }, "Stripe");
    expect(postings.length).toBe((json as { jobs: unknown[] }).jobs.length);
    for (const posting of postings) {
      expect(posting.title).not.toBe("");
      expect(posting.url).toMatch(/^https:\/\//);
      expect(posting.externalId).toMatch(/^stripe:\d+$/);
      expect(posting.description.length).toBeGreaterThan(0);
      expect(posting.description).not.toMatch(/<\/?[a-z][^>]*>/i);
      expect(posting.description).not.toMatch(/&(?:lt|gt|amp|nbsp|#\d+);/);
      expect(posting.postedAt === null || !Number.isNaN(Date.parse(posting.postedAt))).toBe(true);
    }
  });
});
