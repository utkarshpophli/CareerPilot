import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { summarizeUsage } from "@/lib/usage-summary";

import { UsageView } from "./usage-view";

const row = (over: Record<string, unknown> = {}) => ({ at: new Date("2026-11-03T10:00:00Z"), provider: "ANTHROPIC", model: "claude-sonnet-5", task: "extracted_posting", inputTokens: 1200, outputTokens: 300, actorKind: "USER", actorName: "", ...over });

describe("UsageView", () => {
  it("says plainly that nothing has been called yet", () => {
    render(<UsageView summary={summarizeUsage([], "UTC")} days={30} />);
    expect(screen.getByText("No AI calls in the last 30 days.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the totals and a table each by day, model, task and who asked, with the numbers as the servers reported them", () => {
    const summary = summarizeUsage([row(), row({ model: "qwen", provider: "LOCAL", task: "text", inputTokens: null, outputTokens: null, actorKind: "CLI", actorName: "claude-code" })], "UTC");
    render(<UsageView summary={summary} days={30} />);
    expect(screen.getByText("2 calls in the last 30 days: 1,200 tokens in, 300 out.")).toBeInTheDocument();
    expect(screen.getByText("1 call came back without token numbers; those are counted as calls and add nothing to the totals.")).toBeInTheDocument();
    for (const name of ["By day", "By model", "By task", "Who asked"]) expect(screen.getByRole("table", { name })).toBeInTheDocument();
    const models = screen.getByRole("table", { name: "By model" });
    expect(within(models).getByRole("row", { name: /claude-sonnet-5 1 1,200 300/ })).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Who asked" })).getByText("claude-code (assistant)")).toBeInTheDocument();
  });

  it("does not show a price: none is built in, and the page says so", () => {
    render(<UsageView summary={summarizeUsage([row()], "UTC")} days={30} />);
    expect(screen.getByText(/CareerPilot does not know what your provider charges/)).toBeInTheDocument();
    expect(screen.queryByText(/\$|€/)).toBeNull();
  });
});
