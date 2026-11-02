// Smoke test for the production image: it starts against a database, answers /api/health, and the owner can sign in.
//
//   node scripts/smoke-image.mjs --image careerpilot:ci --database-url postgresql://postgres:postgres@localhost:5432/careerpilot
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

function argument(name, fallback) {
  const at = process.argv.indexOf(`--${name}`);
  return at >= 0 && process.argv[at + 1] ? process.argv[at + 1] : fallback;
}

const image = argument("image");
const port = argument("port", "3199");
const base = argument("url", `http://127.0.0.1:${port}`);
const password = argument("password", E2E_PASSWORD);
const databaseUrl = argument("database-url", process.env.DATABASE_URL);

const docker = (...args) => spawnSync("docker", args, { encoding: "utf8" });

function startContainer() {
  if (!databaseUrl) throw new Error("--image needs --database-url (or DATABASE_URL).");
  docker("rm", "-f", CONTAINER);
  const run = docker(
    "run", "--detach", "--name", CONTAINER, "--network", "host",
    "--env", `DATABASE_URL=${databaseUrl}`,
    "--env", `CAREERPILOT_PASSWORD=${E2E_PASSWORD_HASH}`,
    "--env", `CAREERPILOT_SECRET=${randomBytes(36).toString("base64url")}`,
    "--env", `PORT=${port}`,
    "--env", "HOSTNAME=127.0.0.1",
    image,
  );
  if (run.status !== 0) throw new Error(`docker run failed: ${run.stderr.trim()}`);
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
} catch (error) {
  failed = true;
  console.error(`SMOKE TEST FAILED: ${error.message}`);
  if (image) {
    // A container writes its errors to stderr, so both streams are the log.
    const logs = docker("logs", "--tail", "80", CONTAINER);
    console.error(`--- container log ---\n${logs.stdout}${logs.stderr}`);
  }
} finally {
  if (image) execFileSync("docker", ["rm", "-f", CONTAINER], { stdio: "ignore" });
}
process.exitCode = failed ? 1 : 0;
