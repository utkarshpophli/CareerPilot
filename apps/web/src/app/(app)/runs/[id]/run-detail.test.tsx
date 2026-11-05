import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ActivityEvent } from "@/generated/prisma/client";
import type { RunView } from "@/lib/runs-view";

import { RunDetail } from "./run-detail";

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement("a", { href, ...rest }, children) };
});

const run: RunView = {
  id: "r1", kind: "companies.scan", title: "Scan watched boards", actorKind: "CLI", actorName: "claude-code", status: "OK",
  startedAt: "2026-11-05T08:00:00.000Z", lastActivityAt: "2026-11-05T08:00:05.000Z", finishedAt: "2026-11-05T08:00:06.000Z", stepCount: 2, lastStep: "Done", summary: "Scanned 1 board", applicationId: null, stalled: false,
};
const event = (over: Partial<ActivityEvent>): ActivityEvent => ({
  id: "e", at: new Date("2026-11-05T08:00:01Z"), actorKind: "CLI", actorName: "claude-code", action: "run.step", targetType: "", targetId: null, applicationId: null, platform: "", model: "", outcome: "OK", summary: "A step", data: null, runId: "r1", ...over,
});

describe("RunDetail", () => {
  it("shows, for each step, where it came from, which prompt or scorer judged, and what was decided, before the counts", () => {
    render(
      <RunDetail
        run={run}
        events={[
          event({ id: "a", summary: "Acme: 2 postings (2 new, 0 closed)", data: { source: "Greenhouse · acme", decision: "kept 2 new, closed 0, scored 2", scorerVersion: "board-score@1", promptVersion: "extract-posting@1", found: 2, added: 2 } }),
          event({ id: "b", summary: "No details here", data: { found: 3 } }),
          event({ id: "c", summary: "Nothing at all" }),
        ]}
      />,
    );
    const steps = screen.getAllByRole("listitem");
    const first = within(steps[0]);
    expect(first.getByText("Source")).toBeInTheDocument();
    expect(first.getByText("Greenhouse · acme")).toBeInTheDocument();
    expect(first.getByText("Prompt")).toBeInTheDocument();
    expect(first.getByText("extract-posting@1")).toBeInTheDocument();
    expect(first.getByText("Scorer")).toBeInTheDocument();
    expect(first.getByText("board-score@1")).toBeInTheDocument();
    expect(first.getByText("Decision")).toBeInTheDocument();
    expect(first.getByText("kept 2 new, closed 0, scored 2")).toBeInTheDocument();
    // The counts that remain are still there, as before, but the replay fields are not repeated in them.
    expect(first.getByText('{"found":2,"added":2}')).toBeInTheDocument();
    // A step with only counts shows them and no replay labels; one with no data shows nothing extra.
    expect(within(steps[1]).queryByText("Source")).toBeNull();
    expect(within(steps[1]).getByText('{"found":3}')).toBeInTheDocument();
    expect(within(steps[2]).queryByRole("term")).toBeNull();
  });

  it("shows the text of a step as text, whatever it says", () => {
    render(<RunDetail run={run} events={[event({ summary: "x", data: { decision: "<script>alert(1)</script> kept" } })]} />);
    expect(screen.getByText("<script>alert(1)</script> kept")).toBeInTheDocument();
  });
});
