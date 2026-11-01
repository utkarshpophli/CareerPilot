import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/toast";
import type { TokenRow } from "@/lib/api-tokens";
import { copyText } from "@/lib/copy-text";

import { createToken, revokeToken } from "./actions";
import { ApiTokensSection } from "./api-tokens-section";

const existing: TokenRow = { id: "t1", name: "laptop", prefix: "cp_AbCdEf", scope: "READ", createdAt: "2026-11-01T10:00:00.000Z", lastUsedAt: null, revokedAt: null };
const made: TokenRow = { id: "t2", name: "claude-code", prefix: "cp_ZzZzZz", scope: "WRITE", createdAt: "2026-11-01T11:00:00.000Z", lastUsedAt: null, revokedAt: null };

vi.mock("./actions", () => ({
  createToken: vi.fn(async () => ({ ok: true, data: { token: "cp_SECRET-TOKEN-VALUE", tokens: [made, existing] } })),
  revokeToken: vi.fn(async () => ({ ok: true, data: { tokens: [{ ...existing, revokedAt: "2026-11-01T12:00:00.000Z" }] } })),
}));
vi.mock("@/components/toast", () => ({ toast: vi.fn(), toastResult: (result: unknown) => result }));
vi.mock("@/lib/copy-text", () => ({ copyText: vi.fn(async () => true) }));

beforeEach(() => vi.clearAllMocks());

describe("Settings → API tokens", () => {
  it("lists tokens with their scope and use, never a secret", () => {
    render(<ApiTokensSection initial={[existing]} address="https://careerpilot.example" />);
    const list = screen.getByRole("list", { name: "API tokens" });
    expect(list).toHaveTextContent("laptop");
    expect(list).toHaveTextContent("Read only");
    expect(list).toHaveTextContent("last used never");
    expect(screen.getByText(/CAREERPILOT_URL=https:\/\/careerpilot\.example/)).toBeInTheDocument();
  });

  it("makes a token, shows it once to copy, and updates the list", async () => {
    const user = userEvent.setup();
    render(<ApiTokensSection initial={[existing]} address="https://careerpilot.example" />);
    await user.type(screen.getByLabelText("Name"), "claude-code");
    await user.selectOptions(screen.getByLabelText("Can"), "WRITE");
    await user.click(screen.getByRole("button", { name: "Make token" }));

    expect(createToken).toHaveBeenCalledWith({ name: "claude-code", scope: "WRITE" });
    expect(screen.getByRole("status")).toHaveTextContent("it is not shown again");
    expect(screen.getByText("cp_SECRET-TOKEN-VALUE")).toBeInTheDocument();
    expect(within(screen.getByRole("list", { name: "API tokens" })).getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByLabelText("Name")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "Copy" }));
    expect(copyText).toHaveBeenCalledWith("cp_SECRET-TOKEN-VALUE");
    expect(toast).toHaveBeenCalledWith("Copied.");

    await user.click(screen.getByRole("button", { name: "Done" }));
    expect(screen.queryByText("cp_SECRET-TOKEN-VALUE")).not.toBeInTheDocument();
  });

  it("revokes a token, and the list shows it as revoked with no button", async () => {
    const user = userEvent.setup();
    render(<ApiTokensSection initial={[existing]} address="https://careerpilot.example" />);
    await user.click(screen.getByRole("button", { name: "Revoke laptop" }));
    expect(revokeToken).toHaveBeenCalledWith({ id: "t1" });
    expect(screen.getByText("Revoked")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Revoke/ })).not.toBeInTheDocument();
  });

  it("keeps the secret out of the page when the server refuses", async () => {
    const user = userEvent.setup();
    vi.mocked(createToken).mockResolvedValueOnce({ ok: false, error: "Give the token a name." });
    render(<ApiTokensSection initial={[]} address="https://careerpilot.example" />);
    await user.click(screen.getByRole("button", { name: "Make token" }));
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByText("None yet.")).toBeInTheDocument();
  });
});
