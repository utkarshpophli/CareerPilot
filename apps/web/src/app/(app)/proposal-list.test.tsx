import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/toast";
import { toastWithUndo } from "@/components/change-status";
import type { PendingProposal } from "@/lib/proposals";

import { ProposalList, ProposalPill } from "./proposal-list";
import { confirmProposalAction, dismissProposalAction } from "./proposals/actions";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("./proposals/actions", () => ({
  confirmProposalAction: vi.fn(async () => ({ ok: true, data: { applicationId: "a1", status: "SENT", eventId: "evt1" }, toast: "Marked as sent. Fingers crossed!" })),
  dismissProposalAction: vi.fn(async () => ({ ok: true, data: null })),
}));
vi.mock("@/components/toast", () => ({ toast: vi.fn(), toastResult: (result: unknown) => result }));
vi.mock("@/components/change-status", () => ({ toastWithUndo: vi.fn() }));

const proposal = (overrides: Partial<PendingProposal> = {}): PendingProposal => ({
  id: "p1",
  applicationId: "a1",
  status: "SENT",
  reason: "The user told me they sent it on Friday",
  actorName: "claude-code",
  state: "PENDING",
  createdAt: "2026-11-02T10:00:00.000Z",
  expiresAt: "2026-11-16T10:00:00.000Z",
  application: { id: "a1", title: "Engineer at Acme", company: "Acme", role: "Engineer", status: "DRAFT" },
  ...overrides,
});

beforeEach(() => vi.clearAllMocks());

describe("ProposalList", () => {
  it("says who proposes what for which application, in their words, and links to the application", () => {
    render(<ProposalList proposals={[proposal()]} />);
    const item = screen.getByRole("listitem");
    expect(within(item).getByRole("link", { name: "Engineer at Acme" })).toHaveAttribute("href", "/applications/a1");
    expect(item).toHaveTextContent("claude-code proposes Sent");
    expect(item).toHaveTextContent("The user told me they sent it on Friday");
    expect(item).toHaveTextContent("Nothing changes until you confirm");
  });

  it("shows an assistant's words as text only, never as markup", () => {
    render(<ProposalList proposals={[proposal({ reason: '<img src=x onerror="alert(1)"><b>ACT NOW</b> [click](javascript:alert(1))' })]} />);
    const item = screen.getByRole("listitem");
    expect(item.querySelector("img")).toBeNull();
    expect(item.querySelector("b")).toBeNull();
    expect(item.querySelectorAll("a")).toHaveLength(1); // only the application's own link
    expect(item).toHaveTextContent("<b>ACT NOW</b>");
  });

  it("confirms with one click, offers Undo, and takes it off the list", async () => {
    const user = userEvent.setup();
    render(<ProposalList proposals={[proposal(), proposal({ id: "p2", applicationId: "a2", application: { id: "a2", title: "Designer at Beta", company: "Beta", role: "Designer", status: "DRAFT" } })]} />);
    await user.click(within(screen.getAllByRole("listitem")[0]!).getByRole("button", { name: "Mark as Sent for Engineer at Acme" }));
    expect(confirmProposalAction).toHaveBeenCalledWith({ id: "p1" });
    expect(toastWithUndo).toHaveBeenCalledWith("Marked as sent. Fingers crossed!", "evt1");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.queryByText("Engineer at Acme")).not.toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();
  });

  it("dismisses with one click and leaves nothing behind", async () => {
    const user = userEvent.setup();
    render(<ProposalList proposals={[proposal()]} />);
    await user.click(screen.getByRole("button", { name: "Dismiss the proposal for Engineer at Acme" }));
    expect(dismissProposalAction).toHaveBeenCalledWith({ id: "p1" });
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
    expect(toastWithUndo).not.toHaveBeenCalled();
  });

  it("keeps the proposal and says why when the server refuses", async () => {
    const user = userEvent.setup();
    vi.mocked(confirmProposalAction).mockResolvedValueOnce({ ok: false, error: "That proposal has expired." });
    render(<ProposalList proposals={[proposal()]} />);
    await user.click(screen.getByRole("button", { name: "Mark as Sent for Engineer at Acme" }));
    expect(toast).toHaveBeenCalledWith("That proposal has expired.");
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("falls back to a plain name when the assistant gave none", () => {
    render(<ProposalList proposals={[proposal({ actorName: "", reason: "" })]} />);
    expect(screen.getByRole("listitem")).toHaveTextContent("An assistant proposes Sent");
    expect(screen.getByRole("listitem")).not.toHaveTextContent("said");
  });
});

describe("ProposalPill", () => {
  it("sits in an application's header with the same two choices", async () => {
    const user = userEvent.setup();
    render(<ProposalPill applicationId="a1" applicationTitle="Engineer at Acme" proposal={{ id: "p1", status: "INTERVIEW", reason: "Invite came by email", actorName: "opencode" }} />);
    expect(screen.getByRole("group", { name: "Proposal from opencode" })).toHaveTextContent("proposes Interview");
    await user.click(screen.getByRole("button", { name: "Mark as Interview for Engineer at Acme" }));
    expect(confirmProposalAction).toHaveBeenCalledWith({ id: "p1" });
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
  });
});
