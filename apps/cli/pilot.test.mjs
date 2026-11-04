import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";
import { fileURLToPath } from "node:url";

// pilot end to end against a stand-in server: what it sends, what it prints, what it exits with.

const PILOT = fileURLToPath(new URL("./pilot.mjs", import.meta.url));
let server;
let base;
let seen = [];
let reply = { data: {} };
let status = 200;

before(async () => {
  server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk) => (body += chunk));
    request.on("end", () => {
      seen.push({ method: request.method, url: request.url, headers: request.headers, body: body ? JSON.parse(body) : undefined });
      response.writeHead(status, { "content-type": "application/json" });
      response.end(JSON.stringify(reply));
    });
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => server.close());

function pilot(args, { answer = { data: {} }, httpStatus = 200, env = {} } = {}) {
  seen = [];
  reply = answer;
  status = httpStatus;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [PILOT, ...args], { env: { ...process.env, CAREERPILOT_URL: base, CAREERPILOT_TOKEN: "cp_test", ...env } });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk) => (out += chunk));
    child.stderr.on("data", (chunk) => (err += chunk));
    child.on("close", (code) => resolve({ code, out: out.trim(), err: err.trim() }));
  });
}

test("run start prints only the id, so a script can keep it", async () => {
  const result = await pilot(["run", "start", "scan", "Daily", "scan", "--key", "k1"], { answer: { data: { id: "run123" } } });
  assert.equal(result.code, 0);
  assert.equal(result.out, "run123");
  assert.deepEqual(seen[0].body, { kind: "scan", title: "Daily scan" });
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].url, "/api/v1/runs");
  assert.equal(seen[0].headers.authorization, "Bearer cp_test");
  assert.equal(seen[0].headers["idempotency-key"], "k1");
});

test("run step sends the summary and the data", async () => {
  const result = await pilot(["run", "step", "run123", "Fetched", "boards", "--data", "boards=3"], { answer: { data: { stepCount: 1, lastStep: "Fetched boards" } } });
  assert.equal(result.out, "step 1: Fetched boards");
  assert.equal(seen[0].url, "/api/v1/runs/run123/events");
  assert.deepEqual(seen[0].body, { summary: "Fetched boards", data: { boards: 3 } });
});

test("run finish defaults to ok and can fail with a reason", async () => {
  await pilot(["run", "finish", "run123"], { answer: { data: { id: "run123", status: "OK" } } });
  assert.deepEqual(seen[0].body, { status: "OK" });
  const failed = await pilot(["run", "finish", "run123", "--status", "failed", "Source", "timed", "out"], { answer: { data: { id: "run123", status: "FAILED" } } });
  assert.equal(failed.out, "run123 failed");
  assert.deepEqual(seen[0].body, { status: "FAILED", summary: "Source timed out" });
});

test("apps add and apps status", async () => {
  const added = await pilot(["apps", "add", "--company", "Acme", "--role", "Engineer", "--url", "https://x.example/1"], { answer: { data: { id: "app1", created: true } } });
  assert.equal(added.out, "app1");
  assert.deepEqual(seen[0].body, { company: "Acme", role: "Engineer", postingUrl: "https://x.example/1" });
  const again = await pilot(["apps", "add", "--company", "Acme"], { answer: { data: { id: "app1", created: false } } });
  assert.equal(again.out, "app1 (already tracked)");
  const moved = await pilot(["apps", "status", "app1", "sent"], { answer: { data: { id: "app1", status: "SENT", changed: true } } });
  assert.equal(moved.out, "app1 is now SENT");
  assert.equal(seen[0].method, "PATCH");
  assert.equal(seen[0].url, "/api/v1/applications/app1/status");
  assert.deepEqual(seen[0].body, { status: "SENT" });
});

test("apps propose asks the user to confirm a progress status, and says it is waiting", async () => {
  const result = await pilot(["apps", "propose", "app1", "sent", "--reason", "The user told me they sent it"], { answer: { data: { id: "p1", status: "SENT", state: "PENDING" } } });
  assert.equal(result.out, "Proposed SENT for app1. It waits for the user to confirm it on the dashboard; nothing changed yet.");
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].url, "/api/v1/applications/app1/proposals");
  assert.deepEqual(seen[0].body, { status: "SENT", reason: "The user told me they sent it" });
});

test("proposals lists what waits for the user", async () => {
  const empty = await pilot(["proposals"], { answer: { data: [] } });
  assert.equal(empty.out, "Nothing is waiting for the user.");
  assert.equal(seen[0].url, "/api/v1/proposals");
  const some = await pilot(["proposals"], { answer: { data: [{ id: "p1", status: "SENT", reason: "told me", actorName: "claude-code", application: { title: "Engineer at Acme" } }] } });
  assert.match(some.out, /SENT\s+Engineer at Acme\s+claude-code\s+told me/);
});

test("errors from the server are shown plainly with exit code 1", async () => {
  const result = await pilot(["run", "step", "nope", "x"], { answer: { error: { code: "not_found", message: "No such run." } }, httpStatus: 404 });
  assert.equal(result.code, 1);
  assert.equal(result.err, "pilot: No such run.");
});

test("wrong usage exits with 2 before touching the network", async () => {
  for (const args of [["run"], ["run", "start", "scan"], ["run", "finish", "r", "--status", "maybe"], ["run", "step", "r", "x", "--data", "[1]"], ["apps", "status", "only-id"], ["apps", "status", "app1", "flying"], ["apps", "propose", "app1"], ["apps", "propose", "app1", "flying"], ["apps", "propose", "app1", "rejected"], ["nonsense"]]) {
    const result = await pilot(args);
    assert.equal(result.code, 2, args.join(" "));
    assert.equal(seen.length, 0, args.join(" "));
  }
});

test("skills export writes the files, and will not overwrite them without --force", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-skills-"));
  try {
    const first = await pilot(["skills", "export", "--dir", dir], { env: { CAREERPILOT_URL: "", CAREERPILOT_TOKEN: "" } });
    assert.equal(first.code, 0, first.err);
    const file = join(dir, ".claude/skills/careerpilot/SKILL.md");
    assert.ok(existsSync(file));
    assert.match(readFileSync(file, "utf8"), /Never submit, send or apply/);
    const second = await pilot(["skills", "export", "--dir", dir], { env: { CAREERPILOT_URL: "", CAREERPILOT_TOKEN: "" } });
    assert.equal(second.code, 2);
    assert.match(second.err, /already exists/);
    const forced = await pilot(["skills", "export", "--dir", dir, "--force"]);
    assert.equal(forced.code, 0);
    const printed = await pilot(["skills", "export", "--target", "generic", "--stdout"]);
    assert.match(printed.out, /CareerPilot instructions for AI assistants/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("skills export --target opencode never overwrites the user's own opencode.json, even with --force", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-opencode-"));
  try {
    const first = await pilot(["skills", "export", "--target", "opencode", "--dir", dir], { env: { CAREERPILOT_URL: "http://localhost:3100", CAREERPILOT_TOKEN: "" } });
    assert.equal(first.code, 0, first.err);
    const config = join(dir, "opencode.json");
    assert.deepEqual(JSON.parse(readFileSync(config, "utf8")).mcp, { careerpilot: { type: "remote", url: "http://localhost:3100/api/mcp" } });
    assert.ok(existsSync(join(dir, ".opencode/careerpilot.md")));

    // The user now has their own settings in it.
    const theirs = JSON.stringify({ theme: "tokyonight", model: "x/y" });
    writeFileSync(config, theirs);
    const again = await pilot(["skills", "export", "--target", "opencode", "--dir", dir, "--force"], { env: { CAREERPILOT_URL: "", CAREERPILOT_TOKEN: "" } });
    assert.equal(again.code, 0, again.err);
    assert.equal(readFileSync(config, "utf8"), theirs, "opencode.json must be left alone");
    assert.match(again.out, /opencode\.json already exists; left as it is/);
    assert.match(again.out, /"instructions"/, "tells them what to merge");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("search sends the query and prints numbered postings", async () => {
  const result = await pilot(["search", "product", "designer", "--place", "Berlin", "--country", "de", "--remote", "--within", "week"], {
    answer: { data: { id: "s1", searched: "product designer (remote only)", found: 1, moreAvailable: false, postings: [{ number: 1, title: "Product Designer", company: "Acme", place: "Berlin" }] } },
  });
  assert.equal(result.code, 0);
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].url, "/api/v1/searches");
  assert.deepEqual(seen[0].body, { keywords: "product designer", place: "Berlin", country: "de", remoteOnly: true, postedWithin: "week" });
  assert.match(result.out, /Product Designer\s+Acme/);
  assert.match(result.out, /s1/);
});

test("search show reads, search more asks for the next page", async () => {
  const shown = await pilot(["search", "show", "s1"], { answer: { data: { id: "s1", searched: "x", found: 0, moreAvailable: false, postings: [] } } });
  assert.equal(shown.code, 0);
  assert.equal(seen[0].method, "GET");
  assert.equal(seen[0].url, "/api/v1/searches/s1");
  const more = await pilot(["search", "more", "s1"], { answer: { data: { id: "s1", added: 0, moreAvailable: false, postings: [] } } });
  assert.equal(more.code, 0);
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].url, "/api/v1/searches/s1/more");
});

test("search without keywords is a usage error and sends nothing", async () => {
  const result = await pilot(["search"]);
  assert.equal(result.code, 2);
  assert.equal(seen.length, 0);
});

test("scores save sends the file's scores and says what was kept", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pilot-"));
  try {
    const file = join(dir, "scores.json");
    writeFileSync(file, JSON.stringify({ searchId: "s1", scores: [{ number: 1, score: 80, reasons: ["Figma"] }, { number: 9, score: 5, reasons: ["?"] }] }));
    const result = await pilot(["scores", "save", file], { answer: { data: { saved: [{ number: 1, title: "Designer", score: 80, band: "good" }], notFound: [9] } } });
    assert.equal(result.code, 0);
    assert.equal(seen[0].url, "/api/v1/postings/scores");
    assert.equal(seen[0].body.searchId, "s1");
    assert.match(result.out, /Saved 1 score/);
    assert.match(result.out, /not found: 9/i);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("apps show reads one application", async () => {
  const result = await pilot(["apps", "show", "a1"], { answer: { data: { id: "a1", title: "Engineer at Acme", company: "Acme", role: "Engineer", location: "", status: "DRAFT", postingUrl: "", posting: "Text", resume: "", coverLetter: "", match: null } } });
  assert.equal(result.code, 0);
  assert.equal(seen[0].method, "GET");
  assert.equal(seen[0].url, "/api/v1/applications/a1");
  assert.match(result.out, /Engineer at Acme/);
  assert.equal((await pilot(["apps", "show"])).code, 2);
});

test("companies lists, adds and scans through the API", async () => {
  const listed = await pilot(["companies"], { answer: { data: [{ id: "c1", name: "Acme", source: "GREENHOUSE", slug: "acme", enabled: true, lastOkAt: null, lastError: "", lastFound: 0 }] } });
  assert.equal(listed.code, 0);
  assert.equal(seen[0].method, "GET");
  assert.equal(seen[0].url, "/api/v1/companies");

  const added = await pilot(["companies", "add", "https://job-boards.greenhouse.io/acme", "--name", "Acme Corp"], { answer: { data: { id: "c1", name: "Acme Corp", source: "GREENHOUSE", slug: "acme", created: true } } });
  assert.equal(added.code, 0);
  assert.deepEqual(seen[0].body, { board: "https://job-boards.greenhouse.io/acme", name: "Acme Corp" });
  assert.match(added.out, /Now watching Acme Corp/);
  const withSource = await pilot(["companies", "add", "stripe", "--source", "greenhouse"], { answer: { data: { id: "c2", name: "stripe", created: false } } });
  assert.deepEqual(seen[0].body, { board: "stripe", source: "GREENHOUSE" });
  assert.match(withSource.out, /Already watching stripe/);

  const scanned = await pilot(["companies", "scan", "product", "designer", "--place", "Berlin", "--limit", "10"], {
    answer: { data: { scanned: 1, skipped: 0, matched: 0, companies: [{ id: "c1", name: "Acme", found: 3 }], postings: [] } },
  });
  assert.equal(scanned.code, 0);
  assert.equal(seen[0].url, "/api/v1/companies/scan");
  assert.deepEqual(seen[0].body, { keywords: "product designer", place: "Berlin", limit: 10 });
});

test("companies add without a board, or an unknown source, is a usage error and sends nothing", async () => {
  assert.equal((await pilot(["companies", "add"])).code, 2);
  assert.equal(seen.length, 0);
  const result = await pilot(["companies", "add", "stripe", "--source", "workday"]);
  assert.equal(result.code, 2);
  assert.match(result.err, /GREENHOUSE, LEVER, ASHBY, WORKABLE, RECRUITEE, TEAMTAILOR or ATLASSIAN/);
  assert.equal(seen.length, 0);
  assert.equal((await pilot(["companies", "remove", "c1"])).code, 2);
});

test("postings reads the kept postings with the filters given", async () => {
  const result = await pilot(["postings", "--min-score", "70", "--state", "saved", "--limit", "5"], { answer: { data: [{ title: "Designer", company: "Acme", url: "https://example.test/1", score: 91, band: "excellent" }] } });
  assert.equal(result.code, 0);
  assert.equal(seen[0].method, "GET");
  assert.equal(seen[0].url, "/api/v1/postings/scanned?state=SAVED&minScore=70&limit=5");
  assert.match(result.out, /91\s+excellent\s+Designer/);
  assert.equal((await pilot(["postings", "--min-score", "high"])).code, 2);
  assert.equal((await pilot(["postings", "--state", "nope"])).code, 2);
});
