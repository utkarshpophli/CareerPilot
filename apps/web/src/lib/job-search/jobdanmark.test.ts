import { afterEach, describe, expect, it, vi } from "vitest";

import { json, stubFetch } from "@/lib/ai/test-http";
import { jobdanmarkLastPage, jobdanmarkPage } from "@/test/job-search-fixtures";

import { jobdanmark, placeOf, publishedOn } from "./jobdanmark";
import { EMPTY_QUERY } from "./search";

const query = { ...EMPTY_QUERY, keywords: "automation engineer", place: "Esbjerg", country: "dk", radiusKm: 50 as const };

afterEach(() => vi.unstubAllGlobals());

describe("Jobdanmark search", () => {
  it("posts the site's own search call, once, with an honest user agent", async () => {
    const requests = stubFetch(() => json(jobdanmarkPage));
    await jobdanmark.search(query, {}, null);
    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request.method).toBe("POST");
    expect(request.url.href).toBe("https://jobdanmark.dk/api/jobsearch/search/1");
    expect(request.headers.get("user-agent")).toMatch(/^CareerPilot\/\S+ \(\+https:\/\/github\.com\/utkarshpophli\/CareerPilot\)$/);
    expect(request.body).toEqual({
      jobTypes: [],
      filters: [
        { type: "freetext", value: "automation engineer", displayText: "automation engineer" },
        { type: "municipality", value: "Esbjerg", displayText: "Esbjerg" },
      ],
      locationMode: "Text",
      distance: 50,
    });
  });

  it("leaves out the filters nobody asked for, and asks for the next page", async () => {
    const requests = stubFetch(() => json(jobdanmarkPage));
    await jobdanmark.search({ ...query, keywords: "", place: "" }, {}, "page:3", { baseUrl: "http://127.0.0.1:3998/jobdanmark" });
    expect(requests[0].url.href).toBe("http://127.0.0.1:3998/jobdanmark/api/jobsearch/search/3");
    expect((requests[0].body as { filters: unknown[] }).filters).toEqual([]);
  });

  it("maps listings to the shared shape: listing data only, never marked complete", async () => {
    stubFetch(() => json(jobdanmarkPage));
    const page = await jobdanmark.search(query, {}, null);
    expect(page.next).toBe("page:2");
    expect(page.postings).toHaveLength(5);
    expect(page.postings[3]).toEqual({
      source: "JOBDANMARK",
      externalId: "senior-automation-engineer",
      title: "Senior Automation Engineer",
      company: "Semco Maritime",
      place: "Esbjerg",
      remote: null,
      salary: "",
      postedAt: "2026-10-30T00:00:00.000Z",
      url: "https://jobdanmark.dk/job/senior-automation-engineer",
      via: "",
      description: "Job type: fuldtid. Apply by 13-11-2026.",
      complete: false,
    });
  });

  it("keeps a posting whose address has a postcode and no city, with the place left empty", async () => {
    stubFetch(() => json(jobdanmarkPage));
    const page = await jobdanmark.search(query, {}, null);
    expect(page.postings[4].company).toBe("Job Team Vestsjælland v/ Bo Bødker");
    expect(page.postings[4].place).toBe("");
  });

  it("stops after the last page", async () => {
    stubFetch(() => json(jobdanmarkLastPage));
    expect((await jobdanmark.search(query, {}, "page:4")).next).toBeNull();
  });

  it("drops what the answer doesn't describe properly and says nothing of other web addresses", async () => {
    stubFetch(() =>
      json({
        ...jobdanmarkPage,
        items: [{ title: "No link" }, { ...jobdanmarkPage.items[0], url: "javascript:alert(1)" }, { ...jobdanmarkPage.items[0], url: "https://evil.example/job/x" }, jobdanmarkPage.items[0], jobdanmarkPage.items[0]],
      }),
    );
    const page = await jobdanmark.search(query, {}, null);
    // The relative ad address only; a copy of the same ad is listed once.
    expect(page.postings.map((posting) => posting.externalId)).toEqual([jobdanmarkPage.items[0].url.replace("/job/", "")]);
    expect(page.postings[0].url.startsWith("https://jobdanmark.dk/job/")).toBe(true);
  });

  it("leaves out postings older than the chosen time, by the date the site states", async () => {
    stubFetch(() => json(jobdanmarkPage));
    const now = Date.parse("2026-11-02T12:00:00Z");
    vi.useFakeTimers({ now, toFake: ["Date"] });
    try {
      const page = await jobdanmark.search({ ...query, postedWithin: "week" }, {}, null);
      // Four of the five were published 30-10-2026; the one from 16-10 is older than a week.
      expect(page.postings.map((posting) => posting.title)).toEqual(jobdanmarkPage.items.filter((item) => item.publishedDate === "30-10-2026").map((item) => item.title));
    } finally {
      vi.useRealTimers();
    }
  });

  it("says the source changed when the answer has no list of items", async () => {
    stubFetch(() => json({ error: "gone" }));
    await expect(jobdanmark.search(query, {}, null)).rejects.toMatchObject({ problem: "changed" });
  });

  it("does not fetch ad pages: details are never read", async () => {
    const requests = stubFetch(() => json({}));
    expect(await jobdanmark.details({ source: "JOBDANMARK", externalId: "x", title: "", company: "", place: "", remote: null, salary: "", postedAt: null, url: "https://jobdanmark.dk/job/x", via: "", description: "", complete: false }, {})).toBeNull();
    expect(requests).toHaveLength(0);
  });

  it("tests with the smallest search", async () => {
    const requests = stubFetch(() => json(jobdanmarkPage));
    await jobdanmark.test({});
    expect(requests).toHaveLength(1);
  });
});

describe("helpers", () => {
  it("finds the city after the postcode, in both spellings the site uses", () => {
    expect(placeOf("Lautruphoej 2, 2750 Ballerup")).toBe("Ballerup");
    expect(placeOf("2670, Greve")).toBe("Greve");
    expect(placeOf("Vejlevej 1234, 7100 Vejle")).toBe("Vejle");
    expect(placeOf("4100 ")).toBe("");
    expect(placeOf(null)).toBe("");
  });

  it("reads the site's day-month-year dates and nothing else", () => {
    expect(publishedOn("30-10-2026")).toBe("2026-10-30T00:00:00.000Z");
    expect(publishedOn("31-02-2026")).toBeNull();
    expect(publishedOn("2026-10-30")).toBeNull();
    expect(publishedOn(null)).toBeNull();
  });
});
