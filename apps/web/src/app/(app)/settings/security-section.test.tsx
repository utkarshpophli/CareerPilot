import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SecuritySection } from "./security-section";

const signOutEverywhere = vi.hoisted(() => vi.fn());
vi.mock("./actions", () => ({ signOutEverywhere }));
const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/toast", () => ({ toast }));

beforeEach(() => vi.clearAllMocks());

describe("Settings → Security", () => {
  it("explains what signing out everywhere does, including that API tokens are not affected", () => {
    render(<SecuritySection />);
    expect(screen.getByText(/every browser that is signed in, including this one/)).toBeInTheDocument();
    expect(screen.getByText(/API tokens keep working/)).toBeInTheDocument();
  });

  it("asks the server to sign out everywhere when the button is pressed", async () => {
    signOutEverywhere.mockResolvedValue(undefined); // on success the server redirects, so nothing comes back
    render(<SecuritySection />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    expect(signOutEverywhere).toHaveBeenCalledWith({});
  });

  it("shows why it failed, and lets the user try again", async () => {
    signOutEverywhere.mockResolvedValue({ ok: false, error: "Your session has ended." });
    render(<SecuritySection />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out everywhere" }));
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Your session has ended."));
    expect(screen.getByRole("button", { name: "Sign out everywhere" })).toBeEnabled();
  });
});
