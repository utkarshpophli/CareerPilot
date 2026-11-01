import { describe, expect, it } from "vitest";

import { redactJson, redactSecrets } from "./redact";

// Best effort: assistants write what they did in their own words, and sometimes paste a key
// or a token with it. The ledger is read by people and kept in backups, so those never get in.

describe("redactSecrets", () => {
  it("masks CareerPilot API tokens, provider keys, bearer tokens, JWTs and private keys", () => {
    const secrets = [
      "cp_qH383abcdefghijklmnopqrstuvwxyz0123",
      "sk-proj-AbCdEfGhIjKlMnOpQrStUvWx1234",
      "sk-ant-api03-AbCdEfGhIjKlMnOpQrStUv",
      "Bearer abcdef0123456789ABCDEF0123456789",
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk",
      "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBg\n-----END PRIVATE KEY-----",
    ];
    for (const secret of secrets) {
      const out = redactSecrets(`Used ${secret} to call the API`);
      expect(out, secret).toContain("[redacted]");
      expect(out, secret).not.toContain(secret.slice(8, 30));
    }
  });

  it("masks the value of a key, secret, token or password written as name=value or name: value", () => {
    expect(redactSecrets("api_key=Zx9Qw3Er7Ty1Ui5Op")).toBe("api_key=[redacted]");
    expect(redactSecrets('Set "password": "correct-horse-battery" in the file')).toContain("[redacted]");
    expect(redactSecrets("token: abcd1234efgh5678")).toBe("token: [redacted]");
    expect(redactSecrets("password: correct-horse-battery-staple")).not.toContain("correct-horse");
  });

  it("leaves ordinary text, URLs, commit ids and short values alone", () => {
    const fine = [
      "Fetched 3 boards and scored 12 postings",
      "Opened https://boards.greenhouse.io/acme/jobs/12345?gh_src=abc",
      "Built from commit 0123456789abcdef0123456789abcdef01234567",
      "The token limit is 4000 and the password policy is documented",
      "key=7",
      "Scored 87 of 100",
    ];
    for (const text of fine) expect(redactSecrets(text), text).toBe(text);
  });
});

describe("redactJson", () => {
  it("masks secrets inside nested strings and leaves numbers, booleans and structure alone", () => {
    const out = redactJson({ found: 12, ok: true, note: "used sk-proj-AbCdEfGhIjKlMnOpQrStUvWx1234", nested: { list: ["fine", "Bearer abcdef0123456789ABCDEF0123456789"] } });
    expect(out).toEqual({ found: 12, ok: true, note: "used [redacted]", nested: { list: ["fine", "[redacted]"] } });
  });

  it("passes null and undefined through, and stops at a safe depth", () => {
    expect(redactJson(null)).toBeNull();
    expect(redactJson(undefined)).toBeUndefined();
    let deep: unknown = "sk-proj-AbCdEfGhIjKlMnOpQrStUvWx1234";
    for (let level = 0; level < 20; level++) deep = { next: deep };
    expect(() => redactJson(deep)).not.toThrow();
  });
});
