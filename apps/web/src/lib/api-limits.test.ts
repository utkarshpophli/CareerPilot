import { describe, expect, it } from "vitest";

import { jsonBody } from "./api-v1";
import { checkDetails, MAX_DETAILS_CHARACTERS, MAX_DETAILS_DEPTH } from "./api-runs";

// Audit A-06, B-20: small structured details only, and a request body is
// refused before it is read in full when it announces itself as too large.

describe("checkDetails", () => {
  it("accepts small flat and nested objects", () => {
    expect(checkDetails({ found: 12, boards: ["a", "b"], nested: { ok: true } })).toEqual({ found: 12, boards: ["a", "b"], nested: { ok: true } });
  });

  it("refuses details that are too long once written out", () => {
    expect(() => checkDetails({ text: "x".repeat(MAX_DETAILS_CHARACTERS) })).toThrow(/at most/);
  });

  it("refuses details nested deeper than allowed", () => {
    let deep: unknown = "leaf";
    for (let level = 0; level < MAX_DETAILS_DEPTH + 1; level++) deep = { next: deep };
    expect(() => checkDetails(deep as Record<string, unknown>)).toThrow(/nested/);
  });
});

const post = (body: string, headers: Record<string, string> = {}) => new Request("http://localhost/api/v1/x", { method: "POST", body, headers });

describe("jsonBody", () => {
  it("reads a JSON object", async () => {
    expect(await jsonBody(post('{"a":1}'))).toEqual({ a: 1 });
  });

  it("refuses a body that announces itself as too large without reading it", async () => {
    const request = post("{}", { "content-length": "999999999" });
    let read = false;
    request.text = async () => {
      read = true;
      return "{}";
    };
    await expect(jsonBody(request, 1000)).rejects.toMatchObject({ status: 413 });
    expect(read).toBe(false);
  });

  it("refuses a body that turns out too large, and arrays and scalars", async () => {
    await expect(jsonBody(post(JSON.stringify({ text: "x".repeat(2000) })), 1000)).rejects.toMatchObject({ status: 413 });
    await expect(jsonBody(post("[1]"))).rejects.toMatchObject({ status: 400 });
    await expect(jsonBody(post("nope"))).rejects.toMatchObject({ status: 400 });
  });
});
