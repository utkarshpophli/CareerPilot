import { beforeEach, describe, expect, it, vi } from "vitest";

import { env } from "@/lib/env";

import { encodeSession, endSession, getSession, SESSION_COOKIE, SESSION_LIFETIME, sessionTokenOptions, startSession, verifySession } from "./session";

const jar = vi.hoisted(() => ({ values: new Map<string, string>(), set: vi.fn(), remove: vi.fn(), proto: null as string | null, epoch: 0 }));
vi.mock("./session-epoch", () => ({ currentEpoch: async () => jar.epoch }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name)! } : undefined),
    set: (name: string, value: string, options: object) => {
      jar.values.set(name, value);
      jar.set(name, value, options);
    },
    delete: (name: string) => {
      jar.values.delete(name);
      jar.remove(name);
    },
  }),
  headers: async () => new Headers(jar.proto ? { "x-forwarded-proto": jar.proto } : {}),
}));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));
vi.mock("@/lib/env", () => ({ env: { DOSSIER_SECRET: "s".repeat(32), DOSSIER_PASSWORD: "correct horse" } }));
// React's per-request cache would keep the first answer across tests.
vi.mock("react", async (importOriginal) => ({ ...(await importOriginal<typeof import("react")>()), cache: <T,>(fn: T) => fn }));

beforeEach(() => {
  jar.values.clear();
  jar.set.mockClear();
  jar.remove.mockClear();
  jar.proto = null;
  jar.epoch = 0;
});

describe("the session cookie (E3-1)", () => {
  it("starts a browser session: an HTTP-only, same-site cookie without an expiry", async () => {
    await startSession({ persistent: false });
    expect(jar.set).toHaveBeenCalledWith(SESSION_COOKIE, expect.any(String), { httpOnly: true, sameSite: "lax", path: "/", secure: false });
    expect(await getSession()).toMatchObject({ persistent: false });
  });

  it("keeps a remembered session for 30 days, secure behind an HTTPS proxy", async () => {
    jar.proto = "https, http";
    await startSession({ persistent: true });
    expect(jar.set).toHaveBeenCalledWith(SESSION_COOKIE, expect.any(String), expect.objectContaining({ secure: true, maxAge: SESSION_LIFETIME.persistent }));
  });

  // Audit A-13: a proxy that forgets X-Forwarded-Proto must not turn an HTTPS site's cookie into a cleartext one.
  it("is secure whenever the public address is https, even if the proxy says nothing", async () => {
    const settings = env as { DOSSIER_PUBLIC_URL?: string };
    settings.DOSSIER_PUBLIC_URL = "https://careerpilot.example.com";
    try {
      await startSession({ persistent: false });
      expect(jar.set).toHaveBeenCalledWith(SESSION_COOKIE, expect.any(String), expect.objectContaining({ secure: true }));
      settings.DOSSIER_PUBLIC_URL = "http://192.168.1.20:3000";
      await startSession({ persistent: false });
      expect(jar.set).toHaveBeenLastCalledWith(SESSION_COOKIE, expect.any(String), expect.objectContaining({ secure: false }));
    } finally {
      delete settings.DOSSIER_PUBLIC_URL;
    }
  });

  // Audit A-04: a copied cookie must stop working when the owner signs out everywhere.
  it("stops accepting a session once the epoch has moved on, and accepts a new one made after", async () => {
    await startSession({ persistent: true });
    expect(await getSession()).toMatchObject({ persistent: true });
    jar.epoch = 1; // "sign out everywhere"
    expect(await getSession()).toBeNull();
    await expect(verifySession()).rejects.toThrow("redirect /login");
    await startSession({ persistent: true });
    expect(await getSession()).toMatchObject({ persistent: true });
  });

  it("still accepts a session made before epochs existed while the epoch is 0", async () => {
    const stale = await encodeSession({ persistent: false }, sessionTokenOptions()); // no epoch claim, as before
    jar.values.set(SESSION_COOKIE, stale);
    expect(await getSession()).toMatchObject({ persistent: false });
    jar.epoch = 1;
    expect(await getSession()).toBeNull();
  });

  it("reads no session from a missing or forged cookie", async () => {
    expect(await getSession()).toBeNull();
    jar.values.set(SESSION_COOKIE, "not-a-token");
    expect(await getSession()).toBeNull();
  });

  it("sends visitors without a session to the sign-in page", async () => {
    await expect(verifySession()).rejects.toThrow("redirect /login");
    await startSession({ persistent: false });
    await expect(verifySession()).resolves.toMatchObject({ persistent: false });
  });

  it("ends the session by deleting the cookie", async () => {
    await startSession({ persistent: false });
    await endSession();
    expect(jar.remove).toHaveBeenCalledWith(SESSION_COOKIE);
    expect(await getSession()).toBeNull();
  });
});
