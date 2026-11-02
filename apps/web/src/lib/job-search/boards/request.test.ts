import { describe, expect, it, vi } from "vitest";

import { requestBoardJson, validSlug } from "./request";
import { BoardError } from "./types";

const HOSTS = ["api.example.test"] as const;
const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), { status: 200, ...init });
const noSleep = async () => {};

describe("validSlug", () => {
  it("accepts the slugs boards use and nothing that could change the address", () => {
    for (const ok of ["stripe", "Acme-Corp", "a.b_c-1", "x".repeat(100)]) expect(validSlug(ok)).toBe(true);
    for (const bad of ["", "-lead", ".dot", "a/b", "a b", "a?x=1", "a#b", "a%2f", "a@evil", "../x", "x".repeat(101), "é"]) expect(validSlug(bad), bad).toBe(false);
  });
});

describe("requestBoardJson", () => {
  it("reads JSON from an allowed https host, refusing redirects", async () => {
    const fetchImpl = vi.fn(async () => json({ ok: 1 }));
    expect(await requestBoardJson("https://api.example.test/x", { hosts: HOSTS, fetchImpl, sleep: noSleep })).toEqual({ ok: 1 });
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ redirect: "error", cache: "no-store" }));
  });

  it("never requests a host that is not on the list, or anything but https", async () => {
    const fetchImpl = vi.fn(async () => json({}));
    for (const url of ["https://evil.test/x", "http://api.example.test/x", "https://api.example.test.evil.test/x", "https://user@api.example.test@evil.test/x", "https://127.0.0.1/x", "file:///etc/passwd", "not a url"]) {
      await expect(requestBoardJson(url, { hosts: HOSTS, fetchImpl, sleep: noSleep }), url).rejects.toMatchObject({ problem: "refused" });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("says a missing board is not found and does not retry it", async () => {
    const fetchImpl = vi.fn(async () => new Response("", { status: 404 }));
    await expect(requestBoardJson("https://api.example.test/x", { hosts: HOSTS, fetchImpl, sleep: noSleep, retries: 2 })).rejects.toMatchObject({ problem: "not-found" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a busy or failing source with a growing wait, then gives up with the right problem", async () => {
    const waits: number[] = [];
    const fetchImpl = vi.fn(async () => new Response("", { status: 503 }));
    await expect(
      requestBoardJson("https://api.example.test/x", { hosts: HOSTS, fetchImpl, sleep: async (ms) => void waits.push(ms), retries: 2, backoffMs: 1000 }),
    ).rejects.toMatchObject({ problem: "unavailable" });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(waits).toEqual([1000, 2000]);
  });

  it("honours Retry-After on a 429 but never waits more than ten seconds", async () => {
    const waits: number[] = [];
    let calls = 0;
    const fetchImpl = vi.fn(async () => (++calls === 1 ? new Response("", { status: 429, headers: { "retry-after": "86400" } }) : json({ ok: true })));
    expect(await requestBoardJson("https://api.example.test/x", { hosts: HOSTS, fetchImpl, sleep: async (ms) => void waits.push(ms), retries: 1 })).toEqual({ ok: true });
    expect(waits).toEqual([10_000]);
    const quota = vi.fn(async () => new Response("", { status: 429 }));
    await expect(requestBoardJson("https://api.example.test/x", { hosts: HOSTS, fetchImpl: quota, sleep: noSleep })).rejects.toMatchObject({ problem: "quota" });
  });

  it("refuses an answer that is too big or not JSON, and a redirect, without leaking the body", async () => {
    await expect(requestBoardJson("https://api.example.test/x", { hosts: HOSTS, fetchImpl: async () => new Response("x".repeat(2000)), maxBytes: 1000, sleep: noSleep })).rejects.toMatchObject({ problem: "changed" });
    await expect(requestBoardJson("https://api.example.test/x", { hosts: HOSTS, fetchImpl: async () => new Response("<html>secret</html>"), sleep: noSleep })).rejects.toSatisfy((error: BoardError) => error.problem === "changed" && !error.message.includes("secret"));
    const redirect = async () => {
      throw new TypeError("fetch failed", { cause: { code: "ERR_REDIRECT" } });
    };
    await expect(requestBoardJson("https://api.example.test/x", { hosts: HOSTS, fetchImpl: redirect, sleep: noSleep })).rejects.toMatchObject({ problem: "unavailable" });
  });

  it("times out", async () => {
    const hang = (_url: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted"))));
    await expect(requestBoardJson("https://api.example.test/x", { hosts: HOSTS, fetchImpl: hang as typeof fetch, timeoutMs: 20, sleep: noSleep })).rejects.toMatchObject({ problem: "unavailable" });
  });
});
