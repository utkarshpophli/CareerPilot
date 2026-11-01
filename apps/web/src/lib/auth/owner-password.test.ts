import { beforeEach, describe, expect, it, vi } from "vitest";

import { ActionError } from "@/lib/action";
import { globalPressure, loginWaitMs, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/login-throttle";
import { passwordMatches } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { checkOwnerPassword } from "./owner-password";

vi.mock("@/lib/auth/session", () => ({ passwordMatches: vi.fn() }));
vi.mock("@/lib/auth/login-throttle", () => ({ globalPressure: vi.fn(), loginWaitMs: vi.fn(), recordLoginFailure: vi.fn(), recordLoginSuccess: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

// Anything that asks for the owner's password again (signing in, making an API token) goes through
// this one check, so the throttle cannot be dodged by choosing the other door (audit A-20, A-03).

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(passwordMatches).mockImplementation(async (candidate) => candidate === "correct horse");
  vi.mocked(loginWaitMs).mockResolvedValue(0);
  vi.mocked(globalPressure).mockResolvedValue(false);
});

describe("checkOwnerPassword", () => {
  it("accepts the right password and clears the IP's failures", async () => {
    await expect(checkOwnerPassword("correct horse", "203.0.113.7")).resolves.toBeUndefined();
    expect(recordLoginSuccess).toHaveBeenCalledWith(prisma, "203.0.113.7");
    expect(recordLoginFailure).not.toHaveBeenCalled();
  });

  it("refuses a wrong password with a plain message, and counts the failure", async () => {
    await expect(checkOwnerPassword("hunter2", "203.0.113.7")).rejects.toThrow(ActionError);
    await expect(checkOwnerPassword("hunter2", "203.0.113.7")).rejects.toThrow(/not the password/i);
    expect(recordLoginFailure).toHaveBeenCalledWith(prisma, "203.0.113.7");
  });

  it("asks for a password when there is none, without counting a failure", async () => {
    await expect(checkOwnerPassword("", "203.0.113.7")).rejects.toThrow(ActionError);
    expect(passwordMatches).not.toHaveBeenCalled();
    expect(recordLoginFailure).not.toHaveBeenCalled();
  });

  it("does not even check the password while the IP is blocked", async () => {
    vi.mocked(loginWaitMs).mockResolvedValue(29_500);
    await expect(checkOwnerPassword("correct horse", "203.0.113.7")).rejects.toThrow("Too many attempts. Try again in 30 seconds.");
    expect(passwordMatches).not.toHaveBeenCalled();
  });
});
