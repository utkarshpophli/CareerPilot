import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ActivityEvent } from "@/generated/prisma/client";

import { RecentActivity } from "./recent-activity";

const event = (overrides: Partial<ActivityEvent>): ActivityEvent => ({
  id: "e1",
  at: new Date("2026-11-01T12:30:00Z"),
  actorKind: "USER",
  actorName: "",
  action: "application.created",
  targetType: "",
  targetId: null,
  applicationId: null,
  platform: "",
  model: "",
  outcome: "OK",
  summary: "Created application: Engineer",
  data: null,
  runId: null,
  ...overrides,
});

describe("RecentActivity", () => {
  it("invites you to come back when there is nothing yet", () => {
    render(<RecentActivity events={[]} />);
    expect(screen.getByText(/Nothing yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "All activity" })).toHaveAttribute("href", "/activity");
  });

  it("lists what happened and who did it, marking failures", () => {
    render(
      <RecentActivity
        timeZone="UTC"
        events={[event({}), event({ id: "e2", actorKind: "MCP", actorName: "claude-code", summary: "Claude used search_jobs" }), event({ id: "e3", actorKind: "SYSTEM", outcome: "ERROR", summary: "refine failed" })]}
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Created application: Engineer");
    expect(items[0]).toHaveTextContent("You · 1 Nov, 12:30");
    expect(items[1]).toHaveTextContent("AI assistant (claude-code)");
    expect(within(items[2]!).getByText("Failed:")).toBeInTheDocument();
  });
});
