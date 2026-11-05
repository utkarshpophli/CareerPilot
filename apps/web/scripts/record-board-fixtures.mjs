// Records a few real postings from each job-board source so the adapters' tests can use the real shape.
//
//   node scripts/record-board-fixtures.mjs            (needs internet; run by .github/workflows/record-board-fixtures.yml)
//
// Prints each response (on one line) between BEGIN/END lines, cut down to a few postings and with very long strings shortened
// (a marker says where), so it can be read from a CI log and saved under src/lib/job-search/boards/fixtures/real/.
// The structure, field names and types are untouched: that is what a fixture is for. Boards are public job
// boards of public employers; nothing here is private.

const BOARDS = {
  "greenhouse-jobs": { url: "https://boards-api.greenhouse.io/v1/boards/stripe/jobs?content=true", pick: (json) => ({ ...json, jobs: json.jobs.slice(0, 3) }) },
  // Most of a big board's offices hold no postings, so take the first few that do (anywhere in the tree), flattened.
  "greenhouse-offices": { url: "https://boards-api.greenhouse.io/v1/boards/stripe/offices", pick: (json) => ({ offices: officesWithJobs(json.offices).slice(0, 3) }) },
  "lever-postings": { url: "https://api.lever.co/v0/postings/palantir", pick: (json) => json.slice(0, 3) },
  "ashby-board": { url: "https://api.ashbyhq.com/posting-api/job-board/openai?includeCompensation=true", pick: (json) => ({ ...json, jobs: json.jobs.slice(0, 3) }) },
  // Batch 1 (M4c). Real tenants named in career-ops's own examples.
  // Batch 2 (M4c): a single employer's own careers JSON. First three postings of about 2.5 MB.
  "atlassian-listings": { url: "https://www.atlassian.com/endpoint/careers/listings", pick: (json) => json.slice(0, 3) },
  "workable-widget": { url: "https://apply.workable.com/api/v1/widget/accounts/huggingface?details=true", pick: (json) => ({ ...json, jobs: json.jobs.slice(0, 3) }) },
  "recruitee-offers": { url: "https://channable.recruitee.com/api/offers/", pick: (json) => ({ ...json, offers: json.offers.slice(0, 3) }) },
  // A feed, not JSON: the channel's start and its first three items, as text.
  "teamtailor-feed": { url: "https://podimo.teamtailor.com/jobs.rss", accept: "application/rss+xml", text: (body) => firstItems(body, 3) },
};

/** An RSS feed cut down to its head and the first `count` items, with the rest of the markup untouched. */
function firstItems(xml, count) {
  const items = [...xml.matchAll(/<item>[\s\S]*?<\/item>/g)].slice(0, count).map((match) => match[0]);
  const head = xml.slice(0, xml.indexOf("<item>"));
  return `${head}${items.join("\n")}\n  </channel>\n</rss>\n`;
}

const MAX_STRING = 2000;

/** Offices (at any depth) that list at least one job, cut down to a few departments and jobs each, without their children. */
function officesWithJobs(offices) {
  const found = [];
  const walk = (list) => {
    for (const office of list ?? []) {
      const departments = (office.departments ?? []).filter((department) => department.jobs?.length);
      if (departments.length > 0) {
        found.push({
          ...office,
          child_ids: (office.child_ids ?? []).slice(0, 5),
          children: [],
          departments: departments.slice(0, 2).map((department) => ({ ...department, child_ids: (department.child_ids ?? []).slice(0, 5), jobs: department.jobs.slice(0, 3) })),
        });
      }
      walk(office.children);
    }
  };
  walk(offices);
  return found;
}

/** Shortens long strings anywhere in a value, leaving everything else as it is. */
function shorten(value) {
  if (typeof value === "string") return value.length > MAX_STRING ? `${value.slice(0, MAX_STRING)}[... ${value.length - MAX_STRING} characters cut]` : value;
  if (Array.isArray(value)) return value.map(shorten);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, inner]) => [key, shorten(inner)]));
  return value;
}

let failed = 0;
for (const [name, { url, pick, text: pickText, accept }] of Object.entries(BOARDS)) {
  try {
    const response = await fetch(url, { headers: { accept: accept ?? "application/json", "user-agent": "CareerPilot-source-check/1.0 (+https://github.com/utkarshpophli/CareerPilot; one request per fixture)" }, redirect: "error", signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    console.log(`RECORDED ${name}: HTTP ${response.status}, ${text.length} bytes`);
    console.log(`BEGIN ${name}`);
    // One line each: a CI log is read from the end, and a long pretty-printed block can fall off the start of what is returned.
    // A feed is text: its line breaks are written as \n inside a JSON string, so it stays on one line too.
    console.log(pickText ? JSON.stringify({ text: pickText(text) }) : JSON.stringify(shorten(pick(JSON.parse(text)))));
    console.log(`END ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAILED ${name} (${url}): ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
