import { act, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RunView } from "@/lib/runs-view";

import { RunningNow } from "./running-now";
import { RunsList } from "./runs-list";

vi.mock("next/link", async () => {
  const { createElement } = await import("react");
  return { default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => createElement("a", { href, ...rest }, children) };
});

class FakeEventSource {
  static last: FakeEventSource | undefined;
  onmessage: ((event: MessageEvent<string>) => void) | null = null;
  closed = false;
  constructor(readonly url: string) {
    FakeEventSource.last = this;
  }
  close() {
    this.closed = true;
  }
  emit(runs: RunView[]) {
    this.onmessage?.({ data: JSON.stringify({ runs }) } as MessageEvent<string>);
  }
}

beforeEach(() => vi.stubGlobal("EventSource", FakeEventSource));
afterEach(() => {
  vi.unstubAllGlobals();
  FakeEventSource.last = undefined;
});

const run = (overrides: Partial<RunView> = {}): RunView => ({
  id: "r1",
  kind: "scan",
  title: "Daily scan",
  actorKind: "CLI",
  actorName: "claude-code",
  status: "RUNNING",
  startedAt: "2026-11-01T12:00:00.000Z",
  lastActivityAt: "2026-11-01T12:05:00.000Z",
  finishedAt: null,
  stepCount: 2,
  lastStep: "Scored 12 postings",
  summary: "",
  applicationId: null,
  stalled: false,
  ...overrides,
});

describe("RunsList", () => {
  it("shows a run with who is doing it, how far it got and what it did last", () => {
    render(<RunsList initial={[run()]} timeZone="UTC" />);
    const row = screen.getByRole("listitem");
    expect(within(row).getByRole("link", { name: "Daily scan" })).toHaveAttribute("href", "/runs/r1");
    expect(row).toHaveTextContent("Running");
    expect(row).toHaveTextContent("Command line (claude-code)");
    expect(row).toHaveTextContent("2 steps. Now: Scored 12 postings");
  });

  it("says how to start one when there are none", () => {
    render(<RunsList initial={[]} timeZone="UTC" />);
    expect(screen.getByText(/No runs yet/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute("href", "/settings");
  });

  it("updates when the stream sends a new step, and closes the stream when it goes away", () => {
    const { unmount } = render(<RunsList initial={[run()]} timeZone="UTC" />);
    const source = FakeEventSource.last!;
    expect(source.url).toBe("/api/runs/stream");
    act(() => source.emit([run({ stepCount: 3, lastStep: "Wrote 2 drafts" })]));
    expect(screen.getByRole("listitem")).toHaveTextContent("3 steps. Now: Wrote 2 drafts");
    unmount();
    expect(source.closed).toBe(true);
  });

  it("uses words for failed and stalled runs, not colour alone", () => {
    render(<RunsList initial={[run({ id: "a", status: "FAILED", summary: "Source timed out" }), run({ id: "b", stalled: true })]} timeZone="UTC" />);
    const [failed, stalled] = screen.getAllByRole("listitem");
    expect(failed).toHaveTextContent("Failed");
    expect(failed).toHaveTextContent("Source timed out");
    expect(stalled).toHaveTextContent("Stalled");
  });
});

describe("RunningNow", () => {
  it("lists only runs that are going, and says so when none are", () => {
    render(<RunningNow initial={[run({ id: "a", title: "Going" }), run({ id: "b", title: "Done", status: "OK" })]} timeZone="UTC" />);
    expect(screen.getByRole("link", { name: "Going" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Done" })).not.toBeInTheDocument();
    act(() => FakeEventSource.last!.emit([run({ id: "a", title: "Going", status: "OK" })]));
    expect(screen.getByText(/Nothing is running/)).toBeInTheDocument();
  });
});
