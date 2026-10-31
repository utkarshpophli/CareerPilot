import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ActivityEvent } from "@/generated/prisma/client";

import { ActivityFeed } from "./activity-feed";

vi.mock("next/navigation", () => ({ usePathname: () => null, useRouter: () => ({}), useSearchParams: () => new URLSearchParams() }));

const event = (overrides: Partial<ActivityEvent>): ActivityEvent => ({
  id: "e1",
  at: new Date("2026-11-01T12:30:00Z"),
  actorKind: "USER",
  actorName: "",
  action: "application.created",
  targetType: "application",
  targetId: "app1",
  applicationId: "app1",
  platform: "",
  model: "",
  outcome: "OK",
  summary: "Created application: Engineer",
  data: null,
  ...overrides,
});

describe("ActivityFeed", () => {
  it("says so when nothing has happened", () => {
    render(<ActivityFeed events={[]} next={null} view="all" />);
    expect(screen.getByText(/nothing here yet/i)).toBeInTheDocument();
  });

  it("shows who did what, on which platform, and links to the application", () => {
    render(
      <ActivityFeed
        events={[
          event({}),
          event({ id: "e2", actorKind: "MCP", actorName: "claude-code", summary: "Queued refine", applicationId: null, platform: "lever", model: "claude-sonnet" }),
          event({ id: "e3", actorKind: "SYSTEM", outcome: "ERROR", summary: "write-documents failed", applicationId: null }),
        ]}
        next={null}
        view="all"
        timeZone="UTC"
      />,
    );
    const items = screen.getAllByRole("listitem");
    expect(within(items[0]!).getByRole("link", { name: "Created application: Engineer" })).toHaveAttribute("href", "/applications/app1");
    expect(items[0]).toHaveTextContent("You");
    expect(items[1]).toHaveTextContent("AI assistant (claude-code)");
    expect(items[1]).toHaveTextContent("lever");
    expect(items[1]).toHaveTextContent("claude-sonnet");
    expect(items[2]).toHaveTextContent("Failed: write-documents failed");
  });

  it("marks the chosen filter and links to older activity", () => {
    render(<ActivityFeed events={[event({})]} next="e1" view="mcp" />);
    expect(screen.getByRole("link", { name: "AI assistants" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Everything" })).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: "Older activity" })).toHaveAttribute("href", "/activity?actor=mcp&before=e1");
  });
});
