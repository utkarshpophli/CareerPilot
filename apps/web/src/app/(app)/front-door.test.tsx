import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { computeFrontDoor } from "@/lib/front-door";
import { computeInsights, type InsightApplication } from "@/lib/insights";

import { FrontDoorCards } from "./front-door";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }), usePathname: () => "/", useSearchParams: () => new URLSearchParams() }));
vi.mock("./proposals/actions", () => ({ confirmProposalAction: vi.fn(), dismissProposalAction: vi.fn() }));
vi.mock("@/components/change-status", () => ({ toastWithUndo: vi.fn() }));
vi.mock("@/components/toast", () => ({ toast: vi.fn(), toastResult: (result: unknown) => result }));

const now = new Date("2026-11-04T10:00:00Z");

const emptyDoor = () => computeFrontDoor({ insights: computeInsights([], now), assistants: [], running: [], agentDrafts: 0, attention: 0, proposals: [], newPostings: 0 });

function app(overrides: Partial<InsightApplication> & { id: string }): InsightApplication {
  return {
    title: overrides.id,
    createdAt: new Date("2026-11-03T09:00:00Z"),
    sentAt: new Date("2026-11-03T10:00:00Z"),
    status: "SCREENING",
    furthestStage: "SCREENING",
    origin: "MANUAL",
    postingUrl: "https://jobs.lever.co/acme/1",
    postingSource: null,
    documents: [{ kind: "RESUME", themeName: "Ledger", versionCauses: ["WRITTEN", "REFINED"] }],
    ...overrides,
  };
}

const fullDoor = () =>
  computeFrontDoor({
    insights: computeInsights([app({ id: "a" }), app({ id: "b", status: "DRAFT", furthestStage: null, sentAt: null, postingUrl: "" })], now),
    assistants: [{ key: "token:1", via: "token", id: "1", name: "claude-code", scope: "WRITE", lastSeenAt: "2026-11-04T09:00:00.000Z", callsToday: 4, runs: 2, revokable: true }],
    running: [{ id: "r1", title: "Scan Berlin", actorName: "claude-code", lastStep: "Fetched 3 boards", stalled: false }],
    agentDrafts: 2,
    attention: 3,
    newPostings: 7,
    proposals: [
      {
        id: "p1", applicationId: "a1", status: "SENT", reason: "The user told me", actorName: "claude-code", state: "PENDING",
        createdAt: "2026-11-02T10:00:00.000Z", expiresAt: "2026-11-16T10:00:00.000Z",
        application: { id: "a1", title: "Engineer at Acme", company: "Acme", role: "Engineer", status: "DRAFT" },
      },
    ],
  });

describe("FrontDoorCards when there is nothing yet", () => {
  it("shows five labelled cards, each saying what will appear, and a way to connect", () => {
    render(<FrontDoorCards door={emptyDoor()} />);
    for (const name of ["Applications", "Where you apply", "Your resume", "Your assistants", "Needs you"]) {
      expect(screen.getByRole("region", { name })).toBeInTheDocument();
    }
    expect(screen.getByRole("region", { name: "Where you apply" })).toHaveTextContent("Nothing yet");
    expect(screen.getByRole("region", { name: "Your resume" })).toHaveTextContent("No tailored resumes yet");
    expect(within(screen.getByRole("region", { name: "Your assistants" })).getByRole("link", { name: "Connect an assistant" })).toHaveAttribute("href", "/connect");
    expect(screen.getByRole("region", { name: "Needs you" })).toHaveTextContent("Nothing is waiting for you");
    expect(document.body).not.toHaveTextContent(/NaN|undefined/);
  });
});

describe("FrontDoorCards with a few applications", () => {
  it("answers how many, where, which resume and template, what the assistants do, and what needs you", () => {
    render(<FrontDoorCards door={fullDoor()} timeZone="UTC" />);

    const applications = screen.getByRole("region", { name: "Applications" });
    expect(applications).toHaveTextContent("2");
    expect(applications).toHaveTextContent("1 draft · 1 sent");
    expect(applications).toHaveTextContent("This week: 2 started, 1 sent");
    expect(within(applications).getByRole("link", { name: "All applications" })).toHaveAttribute("href", "/applications");

    const where = screen.getByRole("region", { name: "Where you apply" });
    expect(within(where).getByRole("list", { name: "Platforms" })).toHaveTextContent("lever");
    expect(within(where).getByRole("link", { name: "Detail on Insights" })).toHaveAttribute("href", "/insights");

    const resume = screen.getByRole("region", { name: "Your resume" });
    expect(resume).toHaveTextContent("4 versions across 2 resumes");
    expect(resume).toHaveTextContent("2 revisions after the first drafts");
    expect(within(resume).getByRole("list", { name: "Templates used" })).toHaveTextContent("Ledger");
    expect(resume).toHaveTextContent("Most replies: Ledger (1 of 1 sent)");

    const assistants = screen.getByRole("region", { name: "Your assistants" });
    expect(assistants).toHaveTextContent("1 assistant connected · 4 actions today · 2 runs");
    expect(within(assistants).getByRole("list", { name: "Connected assistants" })).toHaveTextContent("claude-code");
    expect(within(within(assistants).getByRole("list", { name: "Running now" })).getByRole("link", { name: "Scan Berlin" })).toHaveAttribute("href", "/runs/r1");

    const needs = screen.getByRole("region", { name: "Needs you" });
    // What an assistant proposed is right there, with its answer buttons.
    expect(within(needs).getByRole("list", { name: "Proposals from your assistants" })).toHaveTextContent("claude-code proposes Sent");
    expect(within(needs).getByRole("button", { name: "Mark as Sent for Engineer at Acme" })).toBeInTheDocument();
    expect(within(needs).getByRole("link", { name: /2 drafts from your assistants/ })).toHaveAttribute("href", "/agent");
    expect(within(needs).getByRole("link", { name: "3 things" })).toHaveAttribute("href", "#attention-heading");
    expect(within(needs).getByRole("link", { name: "7 new postings" })).toHaveAttribute("href", "/review");
  });

  it("says 'new posting' for one, and nothing about postings when there are none", () => {
    const one = fullDoor();
    one.needsYou.newPostings = 1;
    const { unmount } = render(<FrontDoorCards door={one} />);
    expect(screen.getByRole("link", { name: "1 new posting" })).toHaveAttribute("href", "/review");
    unmount();
    const none = fullDoor();
    none.needsYou.newPostings = 0;
    render(<FrontDoorCards door={none} />);
    expect(screen.queryByRole("link", { name: /new posting/ })).toBeNull();
  });

  it("says the trend in words for a screen reader, and keeps singular and plural right", () => {
    render(<FrontDoorCards door={fullDoor()} />);
    expect(screen.getByText("up on last week")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Your assistants" })).not.toHaveTextContent(/1 assistants|1 actions/);
  });

  it("marks a stalled run, and says when nothing is running", () => {
    const stalled = fullDoor();
    stalled.assistants.running = [{ id: "r2", title: "Old scan", actorName: "opencode", lastStep: "", stalled: true }];
    const { unmount } = render(<FrontDoorCards door={stalled} />);
    expect(screen.getByRole("list", { name: "Running now" })).toHaveTextContent("opencode, stalled");
    unmount();

    const idle = fullDoor();
    idle.assistants.running = [];
    render(<FrontDoorCards door={idle} />);
    expect(screen.getByText("Nothing running right now.")).toBeInTheDocument();
  });

  it("points to the rest when there are more platforms, templates or assistants than fit", () => {
    const door = fullDoor();
    door.where.more = 3;
    door.resume.moreTemplates = 2;
    door.assistants.more = 4;
    render(<FrontDoorCards door={door} />);
    expect(screen.getByRole("link", { name: "3 more, and the detail" })).toHaveAttribute("href", "/insights");
    expect(screen.getByRole("link", { name: "2 more templates, and the detail" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "4 more, and Connect" })).toHaveAttribute("href", "/connect");
  });
});
