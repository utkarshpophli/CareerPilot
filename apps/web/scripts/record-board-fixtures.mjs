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
};

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
for (const [name, { url, pick }] of Object.entries(BOARDS)) {
  try {
    const response = await fetch(url, { headers: { accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const json = JSON.parse(text);
    console.log(`RECORDED ${name}: HTTP ${response.status}, ${text.length} bytes`);
    console.log(`BEGIN ${name}`);
    // One line each: a CI log is read from the end, and a long pretty-printed block can fall off the start of what is returned.
    console.log(JSON.stringify(shorten(pick(json))));
    console.log(`END ${name}`);
  } catch (error) {
    failed++;
    console.log(`FAILED ${name} (${url}): ${error.message}`);
  }
}
process.exitCode = failed ? 1 : 0;
