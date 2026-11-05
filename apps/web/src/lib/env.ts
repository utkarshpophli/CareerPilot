import "server-only";

import path from "node:path";

import { z } from "zod";

import { isPasswordHash } from "@/lib/auth/password-hash";
import { adoptLegacyEnv } from "@/lib/env-compat";

const SECRET_MIN_LENGTH = 32;
/** A random 32-character secret has about 25 different characters; a repeating one far fewer. */
const SECRET_MIN_DISTINCT = 12;
const GENERATE_SECRET = "for example the output of `openssl rand -base64 32`";
const HASH_PASSWORD = "Make one with `yarn hash-password` (in apps/web), or `docker compose run --rm app yarn hash-password`";

export const AI_PROVIDERS = ["local", "openai", "anthropic", "mistral", "lmstudio"] as const;
export const JOB_SOURCE_NAMES = ["jsearch", "adzuna", "arbeitsagentur", "freehire", "jobdanmark", "off"] as const;
export const SCORER_NAMES = ["ai", "jev"] as const;

// An empty value (`CAREERPILOT_AI_KEY=` in .env) counts as unset.
const unsetIfEmpty = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const required = (name: string, fix: string) =>
  z.preprocess(
    unsetIfEmpty,
    z.string({ error: `${name} is not set. ${fix}` }),
  );

const optional = <T extends z.ZodType>(schema: T) =>
  z.preprocess(unsetIfEmpty, schema.optional());

const schema = z.object({
  // Never echo the value: it may be the password itself, set by mistake.
  CAREERPILOT_PASSWORD: required(
    "CAREERPILOT_PASSWORD",
    `Set it to a hash of the password you want to sign in with. ${HASH_PASSWORD}.`,
  ).pipe(
    z.string().trim().refine(isPasswordHash, {
      error: `CAREERPILOT_PASSWORD must be a hash of your password, not the password itself. ${HASH_PASSWORD} and set CAREERPILOT_PASSWORD to what it prints.`,
    }),
  ),
  CAREERPILOT_SECRET: required(
    "CAREERPILOT_SECRET",
    `Set it to a random string of at least ${SECRET_MIN_LENGTH} characters, ${GENERATE_SECRET}.`,
  ).pipe(
    z
      .string()
      .min(SECRET_MIN_LENGTH, {
        error: (issue) =>
          `CAREERPILOT_SECRET is too short (${String(issue.input).length} characters). Use at least ${SECRET_MIN_LENGTH} random characters, ${GENERATE_SECRET}.`,
      })
      // It signs sessions and encrypts stored keys. Random text uses many different characters; a repeated
      // word or pattern does not, whatever its length (audit A-19). The message never shows the value.
      .refine((secret) => secret.length < SECRET_MIN_LENGTH || new Set(secret).size >= SECRET_MIN_DISTINCT, {
        error: `CAREERPILOT_SECRET looks guessable (it repeats a few characters). Use random characters, ${GENERATE_SECRET}.`,
      }),
  ),
  DATABASE_URL: required(
    "DATABASE_URL",
    "Set it to your PostgreSQL connection string, e.g. postgresql://user:password@host:5432/dossier.",
  ).pipe(
    // Never echo the value: it contains the database password.
    z.string().regex(/^postgres(ql)?:\/\//, {
      error:
        "DATABASE_URL must be a PostgreSQL connection string starting with postgresql://.",
    }),
  ),
  CAREERPILOT_DATA_DIR: z
    .preprocess(unsetIfEmpty, z.string().default("/data"))
    .transform((dir) => path.resolve(dir)),
  CAREERPILOT_BACKUP_RETENTION_DAYS: z
    .preprocess(unsetIfEmpty, z.string().trim().default("14"))
    .pipe(
      z.string().regex(/^\d+$/, {
        error: (issue) =>
          `CAREERPILOT_BACKUP_RETENTION_DAYS must be a whole number of days (got "${String(issue.input)}").`,
      }),
    )
    .transform(Number)
    .pipe(
      z.number().min(1, {
        error: "CAREERPILOT_BACKUP_RETENTION_DAYS must be at least 1.",
      }),
    ),
  CAREERPILOT_AI_PROVIDER: optional(
    z.enum(AI_PROVIDERS, {
      error: (issue) =>
        `CAREERPILOT_AI_PROVIDER must be one of ${AI_PROVIDERS.join(", ")} (got "${String(issue.input)}").`,
    }),
  ),
  CAREERPILOT_AI_URL: optional(
    z.url({
      protocol: /^https?$/,
      error: "CAREERPILOT_AI_URL must be an http:// or https:// URL.",
    }),
  ),
  CAREERPILOT_AI_MODEL: optional(z.string()),
  // Never echo the value: it's an API key.
  CAREERPILOT_AI_KEY: optional(z.string()),
  CAREERPILOT_AI_TIMEOUT_SECONDS: optional(
    z
      .string()
      .trim()
      .regex(/^\d+$/, {
        error: (issue) =>
          `CAREERPILOT_AI_TIMEOUT_SECONDS must be a whole number of seconds (got "${String(issue.input)}").`,
      })
      .transform(Number)
      .pipe(z.number().min(5, { error: "CAREERPILOT_AI_TIMEOUT_SECONDS must be at least 5." })),
  ),
  // Defaults for Settings → Job search (E14-4), until a choice is saved there.
  CAREERPILOT_JOBS_SOURCE: optional(
    z.enum(JOB_SOURCE_NAMES, {
      error: (issue) => `CAREERPILOT_JOBS_SOURCE must be one of ${JOB_SOURCE_NAMES.join(", ")} (got "${String(issue.input)}").`,
    }),
  ),
  // Never echo the values: they're API keys.
  CAREERPILOT_JSEARCH_KEY: optional(z.string()),
  CAREERPILOT_JSEARCH_HOST: optional(
    z.enum(["openwebninja", "rapidapi"], {
      error: (issue) => `CAREERPILOT_JSEARCH_HOST must be openwebninja or rapidapi (got "${String(issue.input)}").`,
    }),
  ),
  CAREERPILOT_ADZUNA_APP_ID: optional(z.string()),
  CAREERPILOT_ADZUNA_KEY: optional(z.string()),
  // FreeHire origin; unset uses https://freehire.me. Point at a self-hosted
  // FreeHire, or leave unset for the public catalogue.
  CAREERPILOT_FREEHIRE_URL: optional(
    z.url({ protocol: /^https?$/, error: "CAREERPILOT_FREEHIRE_URL must be an http:// or https:// URL." }).transform((url) => url.replace(/\/+$/, "")),
  ),
  // On sends the owner's "Scan now" and the schedule to the worker process (docs/adr/0004) instead of running a scan in the
  // web process. Off (or unset) keeps everything in the web process, with no worker needed.
  CAREERPILOT_WORKER: optional(
    z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(["on", "off"], { error: (issue) => `CAREERPILOT_WORKER must be on or off (got "${String(issue.input)}").` })),
  ),
  // A cron expression (five fields, in the server's time zone) for a scan of every watched board by the worker, for example
  // "0 6 * * *" for six every morning. Unset means no scheduled scan. Only used by the worker.
  CAREERPILOT_SCAN_SCHEDULE: optional(
    z
      .string()
      .trim()
      .regex(/^\S+(\s+\S+){4}$/, { error: "CAREERPILOT_SCAN_SCHEDULE must be a cron expression with five fields, for example 0 6 * * *." }),
  ),
  // A cron expression (five fields) for the worker to check whether the jobs your drafts are for are still open, once a day at most
  // per draft. Unset means no scheduled checks; the button on the Job posting tab always works.
  CAREERPILOT_LIVENESS_SCHEDULE: optional(
    z
      .string()
      .trim()
      .regex(/^\S+(\s+\S+){4}$/, { error: "CAREERPILOT_LIVENESS_SCHEDULE must be a cron expression with five fields, for example 30 5 * * *." }),
  ),
  // Off takes the Bundesagentur für Arbeit out everywhere (#223): it isn't an
  // official API, so a server can choose not to offer it. Unset means on.
  CAREERPILOT_JOBS_ARBEITSAGENTUR: optional(
    z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(["on", "off"], { error: (issue) => `CAREERPILOT_JOBS_ARBEITSAGENTUR must be on or off (got "${String(issue.input)}").` })),
  ),
  // Defaults for Settings → Scoring (#274), until a choice is saved there:
  // ai scores postings with the AI provider, jev with TypeSafe's Jev.
  CAREERPILOT_SCORER: optional(
    z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.enum(SCORER_NAMES, { error: (issue) => `CAREERPILOT_SCORER must be one of ${SCORER_NAMES.join(", ")} (got "${String(issue.input)}").` })),
  ),
  // Never echo the value: it's an API key.
  CAREERPILOT_TYPESAFE_KEY: optional(z.string().trim()),
  // Google sign-in for Gmail and Calendar (E15-1): an OAuth client of type
  // "Web application". Settings → Google can save one instead, which wins.
  // Never echo the secret.
  CAREERPILOT_GOOGLE_CLIENT_ID: optional(z.string().trim()),
  CAREERPILOT_GOOGLE_CLIENT_SECRET: optional(z.string().trim()),
  // The address CareerPilot is reached at, e.g. https://dossier.example.com, for
  // Google's redirect. Defaults to the address of the request that connects.
  CAREERPILOT_PUBLIC_URL: optional(
    z.url({ protocol: /^https?$/, error: "CAREERPILOT_PUBLIC_URL must be an http:// or https:// URL." }).transform((url) => url.replace(/\/+$/, "")),
  ),
  // For the end-to-end tests only: sends every job source's requests to
  // <url>/<source> instead, where a fake source answers (e2e/fake-jobs.mts).
  CAREERPILOT_JOBS_TEST_BASE_URL: optional(
    z.url({ protocol: /^https?$/, error: "CAREERPILOT_JOBS_TEST_BASE_URL must be an http:// or https:// URL." }),
  ),
  // For the end-to-end tests only: sends Google's sign-in, Gmail and Calendar
  // requests to <url>/<host> instead, where a fake Google answers
  // (e2e/fake-google.mts).
  CAREERPILOT_GOOGLE_TEST_BASE_URL: optional(
    z.url({ protocol: /^https?$/, error: "CAREERPILOT_GOOGLE_TEST_BASE_URL must be an http:// or https:// URL." }),
  ),
  // For the end-to-end tests only: asks <url> for the latest release instead
  // of GitHub's API (e2e/fake-jobs.mts answers).
  CAREERPILOT_UPDATES_TEST_BASE_URL: optional(
    z.url({ protocol: /^https?$/, error: "CAREERPILOT_UPDATES_TEST_BASE_URL must be an http:// or https:// URL." }),
  ),
  // For the end-to-end tests only: sends Jev's requests to <url> instead of
  // TypeSafe's API (e2e/fake-jobs.mts answers).
  CAREERPILOT_TYPESAFE_TEST_BASE_URL: optional(
    z.url({ protocol: /^https?$/, error: "CAREERPILOT_TYPESAFE_TEST_BASE_URL must be an http:// or https:// URL." }),
  ),
}).check((context) => {
  if (context.value.CAREERPILOT_JOBS_SOURCE === "arbeitsagentur" && context.value.CAREERPILOT_JOBS_ARBEITSAGENTUR === "off") {
    context.issues.push({
      code: "custom",
      input: context.value,
      message: "CAREERPILOT_JOBS_SOURCE is arbeitsagentur, but CAREERPILOT_JOBS_ARBEITSAGENTUR is off. Choose another source, or remove one of the two.",
    });
  }
});

export type Env = z.infer<typeof schema>;

/** Thrown when the environment is invalid; `problems` has one message per variable. */
export class EnvError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment:\n${problems.join("\n")}`);
    this.name = "EnvError";
  }
}

/** Validates the environment. Messages name the variable and how to fix it, never its value. */
export function parseEnv(source: Record<string, string | undefined>): Env {
  const result = schema.safeParse(source);
  if (!result.success) {
    throw new EnvError(result.error.issues.map((issue) => issue.message));
  }
  return result.data;
}

let cached: Env | undefined;

function load(): Env {
  if (!cached) {
    adoptLegacyEnv(); // settings still named DOSSIER_* keep working (see env-compat.ts)
    cached = parseEnv(process.env);
  }
  return cached;
}

/**
 * The validated environment. It's parsed on first use rather than on import,
 * so `next build` works without the secrets; `checkEnvOnStartup()` makes sure
 * a running server has them.
 */
export const env: Readonly<Env> = new Proxy({} as Env, {
  get: (_, key) => load()[key as keyof Env],
});

/** Called once from `register()` in instrumentation.ts: stops the server if the environment is invalid. */
export function checkEnvOnStartup(): void {
  try {
    load();
  } catch (error) {
    if (!(error instanceof EnvError)) throw error;
    for (const problem of error.problems) {
      console.error(`CareerPilot can't start: ${problem}`);
    }
    process.exit(1);
  }
}
