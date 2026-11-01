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

test("errors from the server are shown plainly with exit code 1", async () => {
  const result = await pilot(["run", "step", "nope", "x"], { answer: { error: { code: "not_found", message: "No such run." } }, httpStatus: 404 });
  assert.equal(result.code, 1);
  assert.equal(result.err, "pilot: No such run.");
});

test("wrong usage exits with 2 before touching the network", async () => {
  for (const args of [["run"], ["run", "start", "scan"], ["run", "finish", "r", "--status", "maybe"], ["run", "step", "r", "x", "--data", "[1]"], ["apps", "status", "only-id"], ["apps", "status", "app1", "flying"], ["nonsense"]]) {
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
