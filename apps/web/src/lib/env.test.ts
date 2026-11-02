import path from "node:path";

import { describe, expect, it } from "vitest";

import { EnvError, parseEnv } from "./env";

// A hash of "correct horse" (scripts/hash-password.ts).
const PASSWORD_HASH = "argon2id:m=19456,t=2,p=1:CLZW5wQoCjh3Q9CHBp_JWw:Ak2xS7TYlYYrhemlgBkVxFmWXfcMq_rjd0mJGZcZFfA";

const valid = {
  CAREERPILOT_PASSWORD: PASSWORD_HASH,
  CAREERPILOT_SECRET: "k3Zq9vPxR2mWc7YtLd5HfJb8NaGs1UeO4",
  DATABASE_URL: "postgresql://postgres:postgres@db:5432/dossier",
};

function problems(source: Record<string, string | undefined>): string[] {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error.problems;
    throw error;
  }
  throw new Error("Expected parseEnv to throw");
}

describe("parseEnv", () => {
  it("accepts the required variables and fills in defaults", () => {
    expect(parseEnv(valid)).toEqual({
      ...valid,
      CAREERPILOT_DATA_DIR: path.resolve("/data"),
      CAREERPILOT_BACKUP_RETENTION_DAYS: 14,
    });
  });

  it("no longer reads CAREERPILOT_TELEMETRY: the usage ping is gone, so a leftover value is ignored", () => {
    expect(parseEnv({ ...valid, CAREERPILOT_TELEMETRY: "on" })).not.toHaveProperty("CAREERPILOT_TELEMETRY");
    expect(() => parseEnv({ ...valid, CAREERPILOT_TELEMETRY: "false" })).not.toThrow();
  });

  it("reads the optional variables", () => {
    const env = parseEnv({
      ...valid,
      CAREERPILOT_DATA_DIR: "/srv/dossier",
      CAREERPILOT_BACKUP_RETENTION_DAYS: "30",
      CAREERPILOT_AI_PROVIDER: "local",
      CAREERPILOT_AI_URL: "http://ollama:11434",
      CAREERPILOT_AI_MODEL: "llama3.1:8b",
      CAREERPILOT_AI_KEY: "sk-test",
    });
    expect(env).toMatchObject({
      CAREERPILOT_DATA_DIR: path.resolve("/srv/dossier"),
      CAREERPILOT_BACKUP_RETENTION_DAYS: 30,
      CAREERPILOT_AI_PROVIDER: "local",
      CAREERPILOT_AI_URL: "http://ollama:11434",
      CAREERPILOT_AI_MODEL: "llama3.1:8b",
      CAREERPILOT_AI_KEY: "sk-test",
    });
  });

  // Audit A-19: the secret signs sessions and encrypts stored keys, so a long but guessable one is no better than a short one.
  it("rejects a secret that is long but repeats a few characters", () => {
    for (const weak of ["a".repeat(40), "ab".repeat(20), "abc123".repeat(8), "password".repeat(6)]) {
      expect(problems({ ...valid, CAREERPILOT_SECRET: weak }), weak).toEqual([expect.stringMatching(/^CAREERPILOT_SECRET looks guessable/)]);
    }
  });

  it("accepts a random secret such as `openssl rand -base64 32` makes", () => {
    const random = "q8W1yT0b6mE5uVx2nZ9kRc4J7sLhPaDf3gA+Oi=";
    expect(parseEnv({ ...valid, CAREERPILOT_SECRET: random }).CAREERPILOT_SECRET).toBe(random);
  });

  it("reads the AI timeout in seconds", () => {
    expect(parseEnv({ ...valid, CAREERPILOT_AI_TIMEOUT_SECONDS: " 300 " }).CAREERPILOT_AI_TIMEOUT_SECONDS).toBe(300);
    expect(() => parseEnv({ ...valid, CAREERPILOT_AI_TIMEOUT_SECONDS: "5m" })).toThrow(/whole number of seconds/);
    expect(() => parseEnv({ ...valid, CAREERPILOT_AI_TIMEOUT_SECONDS: "1" })).toThrow(/at least 5/);
  });

  it("resolves a relative data directory", () => {
    const env = parseEnv({ ...valid, CAREERPILOT_DATA_DIR: "./data" });
    expect(env.CAREERPILOT_DATA_DIR).toBe(path.resolve("data"));
  });

  it("treats empty values as unset", () => {
    const env = parseEnv({ ...valid, CAREERPILOT_AI_KEY: "", CAREERPILOT_DATA_DIR: " " });
    expect(env.CAREERPILOT_AI_KEY).toBeUndefined();
    expect(env.CAREERPILOT_DATA_DIR).toBe(path.resolve("/data"));
    expect(problems({ ...valid, CAREERPILOT_PASSWORD: "" })).toEqual([
      expect.stringMatching(/^CAREERPILOT_PASSWORD is not set\./),
    ]);
  });

  it("names every missing required variable", () => {
    expect(problems({})).toEqual([
      expect.stringMatching(/^CAREERPILOT_PASSWORD is not set\. Set it to/),
      expect.stringMatching(/^CAREERPILOT_SECRET is not set\. .*openssl rand/),
      expect.stringMatching(/^DATABASE_URL is not set\. /),
    ]);
  });

  it("wants a hash of the password, not the password itself", () => {
    expect(problems({ ...valid, CAREERPILOT_PASSWORD: "correct horse" })).toEqual([
      expect.stringMatching(/^CAREERPILOT_PASSWORD must be a hash of your password, not the password itself\. .*hash-password/),
    ]);
    expect(parseEnv({ ...valid, CAREERPILOT_PASSWORD: ` ${PASSWORD_HASH}\n` }).CAREERPILOT_PASSWORD).toBe(PASSWORD_HASH);
  });

  it("rejects a secret shorter than 32 characters", () => {
    expect(problems({ ...valid, CAREERPILOT_SECRET: "short" })).toEqual([
      expect.stringMatching(/^CAREERPILOT_SECRET is too short \(5 characters\)\./),
    ]);
  });

  it("never echoes secret values", () => {
    const messages = problems({
      CAREERPILOT_PASSWORD: "hunter2",
      CAREERPILOT_SECRET: "tiny-secret",
      DATABASE_URL: "mysql://root:db-password@db/dossier",
    }).join("\n");
    expect(messages).not.toContain("hunter2");
    expect(messages).not.toContain("tiny-secret");
    expect(messages).not.toContain("db-password");
    expect(messages).toMatch(/DATABASE_URL must be a PostgreSQL connection string/);
  });

  it("rejects invalid optional values", () => {
    expect(
      problems({
        ...valid,
        CAREERPILOT_BACKUP_RETENTION_DAYS: "two weeks",
        CAREERPILOT_AI_PROVIDER: "gemini",
        CAREERPILOT_AI_URL: "ftp://example.com",
      }),
    ).toEqual([
      'CAREERPILOT_BACKUP_RETENTION_DAYS must be a whole number of days (got "two weeks").',
      'CAREERPILOT_AI_PROVIDER must be one of local, openai, anthropic, mistral, lmstudio (got "gemini").',
      "CAREERPILOT_AI_URL must be an http:// or https:// URL.",
    ]);
    expect(problems({ ...valid, CAREERPILOT_BACKUP_RETENTION_DAYS: "0" })).toEqual([
      "CAREERPILOT_BACKUP_RETENTION_DAYS must be at least 1.",
    ]);
  });
});

describe("job search variables (E14-4)", () => {
  it("reads the source and its keys", () => {
    expect(
      parseEnv({
        ...valid,
        CAREERPILOT_JOBS_SOURCE: "jsearch",
        CAREERPILOT_JSEARCH_KEY: "ak_test",
        CAREERPILOT_JSEARCH_HOST: "rapidapi",
        CAREERPILOT_ADZUNA_APP_ID: "app",
        CAREERPILOT_ADZUNA_KEY: "adz",
        CAREERPILOT_FREEHIRE_URL: "https://jobs.example/",
      }),
    ).toMatchObject({
      CAREERPILOT_JOBS_SOURCE: "jsearch",
      CAREERPILOT_JSEARCH_KEY: "ak_test",
      CAREERPILOT_JSEARCH_HOST: "rapidapi",
      CAREERPILOT_ADZUNA_APP_ID: "app",
      CAREERPILOT_ADZUNA_KEY: "adz",
      CAREERPILOT_FREEHIRE_URL: "https://jobs.example",
    });
    expect(parseEnv({ ...valid, CAREERPILOT_JOBS_SOURCE: "freehire" }).CAREERPILOT_JOBS_SOURCE).toBe("freehire");
  });

  it("reads whether the Bundesagentur für Arbeit is offered, and refuses choosing it while it's off (#223)", () => {
    expect(parseEnv(valid).CAREERPILOT_JOBS_ARBEITSAGENTUR).toBeUndefined();
    expect(parseEnv({ ...valid, CAREERPILOT_JOBS_ARBEITSAGENTUR: " OFF " }).CAREERPILOT_JOBS_ARBEITSAGENTUR).toBe("off");
    expect(problems({ ...valid, CAREERPILOT_JOBS_ARBEITSAGENTUR: "no" })).toEqual(['CAREERPILOT_JOBS_ARBEITSAGENTUR must be on or off (got "no").']);
    expect(problems({ ...valid, CAREERPILOT_JOBS_SOURCE: "arbeitsagentur", CAREERPILOT_JOBS_ARBEITSAGENTUR: "off" })).toEqual([
      "CAREERPILOT_JOBS_SOURCE is arbeitsagentur, but CAREERPILOT_JOBS_ARBEITSAGENTUR is off. Choose another source, or remove one of the two.",
    ]);
  });

  it("rejects sources and hosts it doesn't know, without echoing keys", () => {
    expect(problems({ ...valid, CAREERPILOT_JOBS_SOURCE: "linkedin", CAREERPILOT_JSEARCH_HOST: "google", CAREERPILOT_JSEARCH_KEY: "ak_secret" })).toEqual([
      'CAREERPILOT_JOBS_SOURCE must be one of jsearch, adzuna, arbeitsagentur, freehire, jobdanmark, off (got "linkedin").',
      'CAREERPILOT_JSEARCH_HOST must be openwebninja or rapidapi (got "google").',
    ]);
  });
});
