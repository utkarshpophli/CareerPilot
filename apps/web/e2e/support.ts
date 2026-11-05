import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { crc32, deflateSync } from "node:zlib";

import { expect, type Locator, type Page } from "@playwright/test";
import { Pool, types } from "pg";

// Playwright runs this file as CommonJS, so no import.meta: resolve from the app folder it is run in.
const require = createRequire(path.join(process.cwd(), "package.json"));

// What the end-to-end tests (E11-2) run against: a production build on its
// own port, with its own database and a fake AI server, so a run never
// touches development data.

export const APP_PORT = 3100;
export const FAKE_AI_PORT = 3999;
export const FAKE_JOBS_PORT = 3998;
export const FAKE_GOOGLE_PORT = 3997;
export const PASSWORD = "e2e-password";
/** CAREERPILOT_PASSWORD for the run: `printf 'e2e-password' | yarn hash-password`. */
const PASSWORD_HASH = "argon2id:m=19456,t=2,p=1:wk-0a22NLDwpNVDMxLY9rw:x4bAXEh9EtlaTIqLiHwF_omyDOpcPtwPrV0_SJx_y2c";
export const STORAGE_STATE = "e2e/.auth/state.json";

/**
 * DATABASE_URL with "_e2e" added to the database name (or E2E_DATABASE_URL).
 * Refuses any other name, so the tests can never wipe real data.
 */
export function e2eDatabaseUrl(): string {
  const explicit = process.env.E2E_DATABASE_URL;
  const base = process.env.DATABASE_URL;
  if (!explicit && !base) throw new Error("End-to-end tests need DATABASE_URL or E2E_DATABASE_URL.");
  const url = new URL(explicit ?? base!);
  if (!explicit) url.pathname = `${url.pathname}_e2e`;
  if (!url.pathname.endsWith("_e2e")) {
    throw new Error(`Refusing to run end-to-end tests against "${url.pathname.slice(1)}": its name must end in "_e2e".`);
  }
  return url.toString();
}

/** The app's environment for a run. */
export function appEnv(): Record<string, string> {
  return {
    DATABASE_URL: e2eDatabaseUrl(),
    CAREERPILOT_PASSWORD: PASSWORD_HASH,
    // Random-looking on purpose: a repeating secret is refused at startup (audit A-19).
    CAREERPILOT_SECRET: "e2eK7qZp-9XvLm3Rt8WyBn5HcJd2SfG4aU",
    CAREERPILOT_DATA_DIR: path.join(tmpdir(), "careerpilot-e2e"),
    CAREERPILOT_AI_PROVIDER: "openai",
    CAREERPILOT_AI_URL: `http://localhost:${FAKE_AI_PORT}/v1`,
    CAREERPILOT_AI_MODEL: "fake-model",
    CAREERPILOT_AI_KEY: "e2e-fake-key",
    // Find jobs searches the fake job sources (E14-9).
    CAREERPILOT_JOBS_SOURCE: "jsearch",
    CAREERPILOT_JSEARCH_KEY: "e2e-jsearch-key",
    CAREERPILOT_JOBS_TEST_BASE_URL: `http://localhost:${FAKE_JOBS_PORT}`,
    // Google's sign-in, Gmail and Calendar are the fake Google's (E15). It's
    // only used once a spec enters an OAuth client in Settings → Google.
    CAREERPILOT_GOOGLE_TEST_BASE_URL: `http://localhost:${FAKE_GOOGLE_PORT}`,
    // The daily update check is off by default; if a spec turns it on, it asks this fake, never GitHub.
    CAREERPILOT_UPDATES_TEST_BASE_URL: `http://localhost:${FAKE_JOBS_PORT}/github`,
    // Jev is the fake job sources' too, once a spec chooses it in Settings → Scoring (#274).
    CAREERPILOT_TYPESAFE_TEST_BASE_URL: `http://localhost:${FAKE_JOBS_PORT}/typesafe`,
    // The specs expect one fixed zone: the demo data puts interviews at noon UTC, and "today" and "tomorrow" are the
    // zone's days. Pinned so the result does not depend on the machine (the owner's is UTC+5:30).
    TZ: "UTC",
    PORT: String(APP_PORT),
  };
}

// The app stores times as UTC in `timestamp` columns (Prisma), but node-pg reads that type in the machine's own
// zone by default, so on a machine that is not on UTC every time read here was off by its offset. Read them as UTC.
const TIMESTAMP_WITHOUT_TIME_ZONE = 1114;
types.setTypeParser(TIMESTAMP_WITHOUT_TIME_ZONE, (value) => new Date(`${value.replace(" ", "T")}Z`));

let pool: Pool | undefined;

/** Runs SQL against the test database, for setting up and checking data. */
/**
 * Waits until React has taken over an element (it puts its props on the DOM node when it does). A page
 * is visible and focusable before that, and a key pressed or a click made in between reaches nothing:
 * on a busy machine that is the difference between a test that passes and one that fails one run in thirty.
 */
export async function hydrated(locator: Locator): Promise<void> {
  await expect.poll(() => locator.evaluate((element) => Object.keys(element).some((key) => key.startsWith("__reactProps$"))), { message: "React has not taken over this element yet" }).toBe(true);
}

export async function sql<Row extends object = Record<string, unknown>>(text: string, values: unknown[] = []): Promise<Row[]> {
  pool ??= new Pool({ connectionString: e2eDatabaseUrl(), max: 2 });
  return (await pool.query<Row>(text, values)).rows;
}

/** Empties every table, then loads the built-in themes and the demo data. */
export async function resetData(): Promise<void> {
  const tables = await sql<{ tablename: string }>(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'",
  );
  await sql(`TRUNCATE TABLE ${tables.map(({ tablename }) => `"${tablename}"`).join(", ")} RESTART IDENTITY CASCADE`);
  // Prisma's own entry point through this Node, so it works where `yarn` is not on the PATH (Windows).
  execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "db", "seed", "--", "--demo"], {
    env: { ...process.env, DATABASE_URL: e2eDatabaseUrl() },
    stdio: "pipe",
  });
}

/** The startups' pages the app asked the fake sites for (#222), with its user agent. */
export async function fakeStartupRequests(): Promise<{ url: string; userAgent: string }[]> {
  const response = await fetch(`http://localhost:${FAKE_JOBS_PORT}/startup-requests`);
  return ((await response.json()) as { requests: { url: string; userAgent: string }[] }).requests;
}

/** How many searches the fake JSearch has answered so far (E14-10). */
export async function fakeJobSearches(): Promise<number> {
  const response = await fetch(`http://localhost:${FAKE_JOBS_PORT}/searches`);
  return ((await response.json()) as { searches: number }).searches;
}

export type FakeEvent = {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  extendedProperties?: { private?: Record<string, string> };
  htmlLink: string;
};
export type FakeGoogleState = { sent: { id: string; threadId: string; raw: string; text: string; attachments: string[] }[]; events: FakeEvent[]; revoked: number; granted: string };

/** What the fake Google has been sent so far (E15). */
export async function fakeGoogle(): Promise<FakeGoogleState> {
  const response = await fetch(`http://localhost:${FAKE_GOOGLE_PORT}/state`);
  return (await response.json()) as FakeGoogleState;
}

/** What the fake AI was last asked, as one text (GET /last), to check what a prompt carried. */
export async function lastPrompt(): Promise<string> {
  const response = await fetch(`http://localhost:${FAKE_AI_PORT}/last`);
  const { messages } = (await response.json()) as { messages: { content: string }[] };
  return messages.map((message) => message.content).join("\n\n");
}

/** Changes the fake Google's calendar as if in Google Calendar (E15-6): adds an event, or changes or deletes one by its id. */
export async function inFakeCalendar(method: "POST" | "PATCH" | "DELETE", id?: string, body?: Partial<FakeEvent>): Promise<FakeEvent> {
  const response = await fetch(`http://localhost:${FAKE_GOOGLE_PORT}/test/events${id ? `/${id}` : ""}`, { method, body: body && JSON.stringify(body) });
  return (await response.json()) as FakeEvent;
}

/** Enters the fake Google's OAuth client in Settings → Google and connects (E15). */
export async function connectFakeGoogle(page: Page): Promise<void> {
  await page.goto("/settings?section=google");
  await page.getByLabel("Client ID").fill("e2e-google-client.apps.googleusercontent.com");
  await page.getByLabel("Client ID").press("Enter");
  await page.getByLabel("Client secret").fill("e2e-google-secret");
  await page.getByLabel("Client secret").press("Enter");
  await page.getByRole("link", { name: "Connect Google account" }).click();
  await page.getByRole("status").filter({ hasText: "Connected as" }).waitFor();
}

/** Disconnects Google and forgets its mail and client, so other specs see it not set up. */
export async function forgetGoogle(): Promise<void> {
  await sql(`DELETE FROM "EmailMessage"`);
  await sql(`DELETE FROM "GoogleAccount"`);
  await sql(`DELETE FROM "Setting" WHERE key IN ('googleClientId', 'googleClientSecretEnc')`);
  await sql(`UPDATE "Application" SET "interviewEventId" = NULL, "interviewCalendarId" = NULL`);
}

/**
 * A made-up portrait as a PNG, for the photo (#224): a head and shoulders on
 * a blue background, wider than 3:4 so the crop has something to cut.
 */
export function portraitPng(width = 900, height = 800): Buffer {
  const pixel = (x: number, y: number): [number, number, number] => {
    const head = (x - width / 2) ** 2 + (y - height * 0.4) ** 2 < (height * 0.17) ** 2;
    const shoulders = ((x - width / 2) / (width * 0.3)) ** 2 + ((y - height) / (height * 0.3)) ** 2 < 1;
    if (head) return [224, 182, 150];
    if (shoulders) return [60, 70, 90];
    return [120, 150 + Math.round((y / height) * 60), 200];
  };
  const rows = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const start = y * (width * 3 + 1);
    for (let x = 0; x < width; x++) rows.set(pixel(x, y), start + 1 + x * 3);
  }
  const chunk = (type: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const check = Buffer.alloc(4);
    check.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, check]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
