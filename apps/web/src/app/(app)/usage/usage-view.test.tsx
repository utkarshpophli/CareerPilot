import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { BudgetState } from "@/lib/ai/budget";
import { summarizeUsage } from "@/lib/usage-summary";

import { UsageView } from "./usage-view";

const row = (over: Record<string, unknown> = {}) => ({ at: new Date("2026-11-03T10:00:00Z"), provider: "ANTHROPIC", model: "claude-sonnet-5", task: "extracted_posting", inputTokens: 1200, outputTokens: 300, actorKind: "USER", actorName: "", ...over });
const sonnet = { model: "claude-sonnet-5", currency: "EUR", inputPerMillion: 3, outputPerMillion: 15 };
const off: BudgetState = { state: "off", percent: null, spent: null, tokens: 0, unpriced: 0, otherCurrency: 0 };

describe("UsageView", () => {
  it("says plainly that nothing has been called yet", () => {
    render(<UsageView summary={summarizeUsage([], "UTC", [])} days={30} budget={off} />);
    expect(screen.getByText("No AI calls in the last 30 days.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows the totals and a table each by day, model, task and who asked, with the numbers as the servers reported them", () => {
    const summary = summarizeUsage([row(), row({ model: "qwen", provider: "LOCAL", task: "text", inputTokens: null, outputTokens: null, actorKind: "CLI", actorName: "claude-code" })], "UTC", [sonnet]);
    render(<UsageView summary={summary} days={30} budget={off} />);
    expect(screen.getByText("2 calls in the last 30 days: 1,200 tokens in, 300 out.")).toBeInTheDocument();
    expect(screen.getByText("1 call came back without token numbers; those are counted as calls and add nothing to the totals.")).toBeInTheDocument();
    for (const name of ["By day", "By model", "By task", "Who asked"]) expect(screen.getByRole("table", { name })).toBeInTheDocument();
    const models = screen.getByRole("table", { name: "By model" });
    expect(within(models).getByRole("row", { name: /claude-sonnet-5 1 1,200 300 0\.0081 EUR/ })).toBeInTheDocument();
    expect(within(screen.getByRole("table", { name: "Who asked" })).getByText("claude-code (assistant)")).toBeInTheDocument();
  });

  it("shows money only where a price is known, adds nothing across currencies, and says what has no price", () => {
    const summary = summarizeUsage([row(), row({ model: "mystery" }), row({ model: "dollar" })], "UTC", [sonnet, { model: "dollar", currency: "USD", inputPerMillion: 1, outputPerMillion: 1 }]);
    render(<UsageView summary={summary} days={30} budget={off} />);
    expect(screen.getByText("Money: 0.0081 EUR, 0.0015 USD.")).toBeInTheDocument();
    expect(screen.getByText(/1 call to a hosted model has no price, so it is not in the money total/)).toBeInTheDocument();
    const models = screen.getByRole("table", { name: "By model" });
    expect(within(models).getByRole("row", { name: /^mystery 1 1,200 300 no price$/ })).toBeInTheDocument();
  });

  it("says a model on your own machine is free, and that prices are the owner's own", () => {
    const summary = summarizeUsage([row({ provider: "LOCAL", model: "qwen" })], "UTC", []);
    render(<UsageView summary={summary} days={30} budget={off} />);
    expect(within(screen.getByRole("table", { name: "By model" })).getByRole("row", { name: /^qwen 1 1,200 300 free$/ })).toBeInTheDocument();
    expect(screen.getByText(/The prices are the ones you entered under Settings → Budget; none are built in/)).toBeInTheDocument();
  });

  it("shows how far this month has got against the caps, and links to the settings", () => {
    const budget: BudgetState = { state: "warn", percent: 85, spent: { amount: 4.25, currency: "EUR" }, tokens: 1_700_000, unpriced: 0, otherCurrency: 0 };
    render(<UsageView summary={summarizeUsage([row()], "UTC", [sonnet])} days={30} budget={budget} />);
    expect(screen.getByText("This month: 85% of the cap used (4.25 EUR spent, 1,700,000 tokens). Warning level reached.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Budget settings" })).toHaveAttribute("href", "/settings?section=budget");
  });
});
