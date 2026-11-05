// Smoke test for the production image: it starts against a database, answers /api/health, and the owner can sign in.
//
//   node scripts/smoke-image.mjs --image careerpilot:ci --database-url postgresql://postgres:postgres@localhost:5432/careerpilot
//   node scripts/smoke-image.mjs --image careerpilot:ci --database-url ... --worker      (also starts the worker and queues a scan)
//   node scripts/smoke-image.mjs --url http://127.0.0.1:3100 --password <the password>      (a server that is already running)
//
// With --image it runs the container on the host network (Linux), waits for it, signs in with a real browser
// (playwright-core: run `yarn playwright install chromium` first), and removes the container. It exits 0 when
// everything worked, 1 when something did not, with the container's log in the output. Node only, so it runs
// on Windows too (the --image mode needs Docker with host networking, which is Linux).

import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";

import { chromium } from "playwright-core";

// The hash of "e2e-password", as the end-to-end suite uses (`printf 'e2e-password' | yarn hash-password`).
const E2E_PASSWORD = "e2e-password";
const E2E_PASSWORD_HASH = "argon2id:m=19456,t=2,p=1:wk-0a22NLDwpNVDMxLY9rw:x4bAXEh9EtlaTIqLiHwF_omyDOpcPtwPrV0_SJx_y2c";
const CONTAINER = "careerpilot-smoke";
const WORKER_CONTAINER = "careerpilot-smoke-worker";

function argument(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}

const image = argument("image");
const port = argument("port", "3199");
const base = argument("url", `http://127.0.0.1:${port}`);
const password = argument("password", E2E_PASSWORD);
const databaseUrl = argument("database-url", process.env.DATABASE_URL);
const withWorker = process.argv.includes("--worker");

const docker = (...args) => spawnSync("docker", args, { encoding: "utf8" });

const secret = randomBytes(36).toString("base64url");

/** The same settings for the web container and the worker, as compose.production.yml gives both. */
const environment = () => [
  "--env", `DATABASE_URL=${databaseUrl}`,
  "--env", `CAREERPILOT_PASSWORD=${E2E_PASSWORD_HASH}`,
  "--env", `CAREERPILOT_SECRET=${secret}`,
  "--env", `PORT=${port}`,
  "--env", "HOSTNAME=127.0.0.1",
  ...(withWorker ? ["--env", "CAREERPILOT_WORKER=on"] : []),
];

function startContainer() {
  if (!databaseUrl) throw new Error("--image needs --database-url (or DATABASE_URL).");
  docker("rm", "-f", CONTAINER, WORKER_CONTAINER);
  const run = docker("run", "--detach", "--name", CONTAINER, "--network", "host", ...environment(), image);
  if (run.status !== 0) throw new Error(`docker run failed: ${run.stderr.trim()}`);
  if (withWorker) {
    // The second container is the same image with the worker's command, as the compose file runs it.
    const worker = docker("run", "--detach", "--name", WORKER_CONTAINER, "--network", "host", ...environment(), image, "node", "/app/tools/worker.mjs");
    if (worker.status !== 0) throw new Error(`docker run (worker) failed: ${worker.stderr.trim()}`);
  }
}

async function waitForHealth(timeoutMs) {
  const until = Date.now() + timeoutMs;
  let last = "no answer";
  while (Date.now() < until) {
    try {
      const response = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(3000) });
      const body = await response.json();
      last = `${response.status} ${JSON.stringify(body)}`;
      if (response.ok && body.status === "ok" && body.db === "ok") return body;
    } catch (error) {
      last = error.cause?.code ?? error.message;
    }
    if (image) {
      const state = docker("inspect", "--format", "{{.State.Status}} {{.State.ExitCode}}", CONTAINER).stdout.trim();
      if (state.startsWith("exited")) throw new Error(`the container stopped (${state}) before it answered`);
    }
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }
  throw new Error(`/api/health did not answer ok within ${timeoutMs / 1000}s (last: ${last})`);
}

/** Waits for /api/health to report the worker, then queues a scan of a board that does not exist and waits for the worker to record it. */
async function checkWorker() {
  const until = Date.now() + 90_000;
  let last = "no answer";
  for (;;) {
    try {
      const body = await (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(3000) })).json();
      last = JSON.stringify(body);
      if (body.worker === "ok") break;
    } catch (error) {
      last = error.cause?.code ?? error.message;
    }
    if (Date.now() > until) throw new Error(`/api/health never reported the worker (last: ${last})`);
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // A real round trip through the image's own queue: a watched board, a job from a client (as the web process queues it),
  // and the worker reading it. The board does not exist, so the answer is an error the worker records; that proves the job
  // was taken and the scan code ran, whether or not the runner can reach the internet.
  const { default: pg } = await import("pg");
  const { PgBoss } = await import("pg-boss");
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
  const boss = new PgBoss({ connectionString: databaseUrl, schema: "queue", max: 2, migrate: false, supervise: false, schedule: false });
  try {
    const slug = `careerpilot-smoke-${randomBytes(4).toString("hex")}`;
    const id = `smoke_${randomBytes(6).toString("hex")}`;
    await pool.query(`INSERT INTO "TrackedCompany" (id, source, slug, name) VALUES ($1, 'GREENHOUSE', $2, 'Smoke test')`, [id, slug]);
    await boss.start();
    const job = await boss.send("board-scan", { companyId: id }, { singletonKey: id });
    if (!job) throw new Error("the queue refused the scan job");
    const stop = Date.now() + 90_000;
    for (;;) {
      const { rows } = await pool.query(`SELECT "lastScanAt", "lastError" FROM "TrackedCompany" WHERE id = $1`, [id]);
      if (rows[0]?.lastScanAt) return `the worker read the board (it recorded: ${rows[0].lastError || "no error"})`;
      if (Date.now() > stop) throw new Error("the worker did not read the queued board within 90s");
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  } finally {
    await boss.stop({ graceful: true, timeout: 2000 }).catch(() => {});
    await pool.query(`DELETE FROM "TrackedCompany" WHERE slug LIKE 'careerpilot-smoke-%'`).catch(() => {});
    await pool.end();
  }
}

async function signIn() {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/login`);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL(`${base}/`, { timeout: 20_000 });
    const heading = await page.getByRole("heading", { level: 1 }).first().textContent();
    if (!heading?.trim()) throw new Error("signed in, but the dashboard has no heading");
    // The new screens load too, not only the front page.
    for (const path of ["/connect", "/activity"]) {
      const response = await page.goto(`${base}${path}`);
      if (!response?.ok()) throw new Error(`${path} answered ${response?.status()}`);
    }
    return heading.trim();
  } finally {
    await browser.close();
  }
}

let failed = false;
try {
  if (image) startContainer();
  const health = await waitForHealth(image ? 120_000 : 30_000);
  console.log(`health ok: version ${health.version}`);
  console.log(`signed in; the dashboard says "${await signIn()}"; /connect and /activity load`);
  if (withWorker) console.log(`worker ok: ${await checkWorker()}`);
} catch (error) {
  failed = true;
  console.error(`SMOKE TEST FAILED: ${error.message}`);
  if (image) {
    // A container writes its errors to stderr, so both streams are the log.
    const logs = docker("logs", "--tail", "80", CONTAINER);
    console.error(`--- container log ---\n${logs.stdout}${logs.stderr}`);
    if (withWorker) {
      const workerLogs = docker("logs", "--tail", "80", WORKER_CONTAINER);
      console.error(`--- worker log ---\n${workerLogs.stdout}${workerLogs.stderr}`);
    }
  }
} finally {
  if (image) execFileSync("docker", ["rm", "-f", CONTAINER, WORKER_CONTAINER], { stdio: "ignore" });
}
process.exitCode = failed ? 1 : 0;
