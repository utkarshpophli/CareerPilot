import { beforeEach, describe, expect, it, vi } from "vitest";

import { globalPressure, loginWaitMs, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/login-throttle";
import { passwordMatches, startSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { loadProfileName } from "@/lib/profile-data";

import { signIn, signInWithForm } from "./actions";
import { loginMessages } from "./messages";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "10.0.0.1, 203.0.113.7" }),
}));
vi.mock("next/navigation", () => ({
  unstable_rethrow: () => {},
  redirect: (to: string) => {
    throw new Error(`redirect ${to}`);
  },
}));
vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
  passwordMatches: vi.fn(),
  startSession: vi.fn(),
}));
vi.mock("@/lib/auth/login-throttle", () => ({
  globalPressure: vi.fn(),
  loginWaitMs: vi.fn(),
  recordLoginFailure: vi.fn(),
  recordLoginSuccess: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/profile-data", () => ({ loadProfileName: vi.fn() }));

describe("signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(passwordMatches).mockImplementation(async (candidate) => candidate === "correct horse");
    vi.mocked(loginWaitMs).mockResolvedValue(0);
    vi.mocked(globalPressure).mockResolvedValue(false);
    vi.mocked(loadProfileName).mockResolvedValue("Jane Doe");
  });

  // Audit A-02: failures from many IPs slow sign-in down; they never lock the owner out.
  it("still accepts the right password when failures from many IPs have put the server under pressure, after a pause", async () => {
    vi.useFakeTimers();
    try {
      vi.mocked(globalPressure).mockResolvedValue(true);
      const attempt = signIn({ password: "correct horse", remember: false });
      await vi.advanceTimersByTimeAsync(2_900);
      expect(passwordMatches).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(200);
      await expect(attempt).resolves.toMatchObject({ ok: true });
      expect(startSession).toHaveBeenCalledWith({ persistent: false });
    } finally {
      vi.useRealTimers();
    }
  });

  // Audit A-03: guesses are checked one at a time, and the block is tested again inside the queue.
  it("checks passwords one at a time, so a burst cannot all pass the block test before the first failure counts", async () => {
    let running = 0;
    let most = 0;
    vi.mocked(passwordMatches).mockImplementation(async () => {
      running++;
      most = Math.max(most, running);
      await new Promise((resolve) => setTimeout(resolve, 5));
      running--;
      return false;
    });
    await Promise.all(Array.from({ length: 6 }, () => signIn({ password: "guess", remember: false })));
    expect(most).toBe(1);
    expect(recordLoginFailure).toHaveBeenCalledTimes(6);
  });

  it("refuses a queued guess without checking it once an earlier one has blocked the IP", async () => {
    vi.mocked(passwordMatches).mockResolvedValue(false);
    // Free for the first guess; blocked by the time the second one is at the front of the queue.
    vi.mocked(loginWaitMs).mockResolvedValueOnce(0).mockResolvedValue(30_000);
    const [first, second] = await Promise.all([signIn({ password: "one", remember: false }), signIn({ password: "two", remember: false })]);
    expect(first).toEqual({ ok: false, error: loginMessages.wrong });
    expect(second).toEqual({ ok: false, error: "Too many attempts. Try again in 30 seconds." });
    expect(passwordMatches).toHaveBeenCalledTimes(1);
  });

  it("turns away a password longer than 256 characters without hashing it", async () => {
    const result = await signIn({ password: "x".repeat(257), remember: false });
    expect(result.ok).toBe(false);
    expect(passwordMatches).not.toHaveBeenCalled();
  });

  it("asks for a password when none was entered, without counting it as a failure", async () => {
    await expect(signIn({ password: "", remember: false })).resolves.toEqual({
      ok: false,
      error: loginMessages.empty,
    });
    expect(startSession).not.toHaveBeenCalled();
    expect(recordLoginFailure).not.toHaveBeenCalled();
  });

  it("refuses a wrong password and counts the failure for the client's IP", async () => {
    await expect(signIn({ password: "hunter2", remember: false })).resolves.toEqual({
      ok: false,
      error: loginMessages.wrong,
    });
    expect(recordLoginFailure).toHaveBeenCalledWith(prisma, "203.0.113.7");
    expect(startSession).not.toHaveBeenCalled();
  });

  it("refuses to even check the password while the IP is blocked", async () => {
    vi.mocked(loginWaitMs).mockResolvedValue(29_500);
    await expect(signIn({ password: "correct horse", remember: false })).resolves.toEqual({
      ok: false,
      error: "Too many attempts. Try again in 30 seconds.",
    });
    expect(passwordMatches).not.toHaveBeenCalled();
    expect(startSession).not.toHaveBeenCalled();
  });

  it("starts a session, resets the IP's counter and welcomes the user by first name", async () => {
    await expect(
      signIn({ password: "correct horse", remember: true, next: "/applications/abc" }),
    ).resolves.toEqual({
      ok: true,
      data: { redirectTo: "/applications/abc" },
      toast: "Welcome back, Jane.",
    });
    expect(recordLoginSuccess).toHaveBeenCalledWith(prisma, "203.0.113.7");
    expect(startSession).toHaveBeenCalledWith({ persistent: true });
  });

  it("says 'there' before the profile has a name, and ignores unsafe redirects", async () => {
    vi.mocked(loadProfileName).mockResolvedValue("");
    await expect(
      signIn({ password: "correct horse", remember: false, next: "https://evil.example" }),
    ).resolves.toMatchObject({ data: { redirectTo: "/" }, toast: "Welcome back, there." });
    expect(startSession).toHaveBeenCalledWith({ persistent: false });
  });
});

describe("signInWithForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(passwordMatches).mockImplementation(async (candidate) => candidate === "correct horse");
    vi.mocked(loginWaitMs).mockResolvedValue(0);
    vi.mocked(loadProfileName).mockResolvedValue("Jane Doe");
  });

  function form(fields: Record<string, string>): FormData {
    const data = new FormData();
    for (const [name, value] of Object.entries(fields)) data.set(name, value);
    return data;
  }

  it("returns the error for the page to show", async () => {
    await expect(signInWithForm(null, form({ password: "hunter2" }))).resolves.toEqual({ error: loginMessages.wrong });
    await expect(signInWithForm(null, form({}))).resolves.toEqual({ error: loginMessages.empty });
    expect(startSession).not.toHaveBeenCalled();
  });

  it("signs in and goes on to the next page", async () => {
    await expect(
      signInWithForm(null, form({ password: "correct horse", remember: "on", next: "/profile" })),
    ).rejects.toThrow("redirect /profile");
    expect(startSession).toHaveBeenCalledWith({ persistent: true });
  });

  it("goes to the dashboard when there's no next page, and remembers only when ticked", async () => {
    await expect(signInWithForm({ error: loginMessages.wrong }, form({ password: "correct horse" }))).rejects.toThrow(
      /^redirect \/$/,
    );
    expect(startSession).toHaveBeenCalledWith({ persistent: false });
  });
});
