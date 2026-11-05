import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { toast } from "@/components/toast";
import { DEFAULT_BUDGET } from "@/lib/ai/budget";

import { saveBudget } from "./actions";
import { BudgetSection, type BudgetView } from "./budget-section";

vi.mock("./actions", () => ({ saveBudget: vi.fn() }));
vi.mock("@/components/toast", () => {
  const toast = vi.fn();
  return { toast, toastResult: (result: { ok: boolean; error?: string }) => (result.ok ? result : (toast(result.error), result)) };
});

const view = (over: Partial<BudgetView> = {}): BudgetView => ({
  prices: [],
  budget: DEFAULT_BUDGET,
  state: { state: "off", percent: null, spent: null, tokens: 0, unpriced: 0, otherCurrency: 0 },
  ...over,
});

beforeEach(() => {
  vi.mocked(saveBudget).mockReset().mockResolvedValue({ ok: true, data: null, toast: "Saved." } as never);
  vi.mocked(toast).mockReset();
});

describe("BudgetSection", () => {
  it("says nothing is capped yet, and that no prices are built in", () => {
    render(<BudgetSection initial={view()} />);
    expect(screen.getByRole("heading", { name: "Budget" })).toBeInTheDocument();
    expect(screen.getByText("No cap is set, so nothing limits your AI calls.")).toBeInTheDocument();
    expect(screen.getByText(/CareerPilot has no prices built in/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /^Stop/ })).toBeChecked();
  });

  it("shows the saved prices one per line, the caps, and how far this month has got", () => {
    render(
      <BudgetSection
        initial={view({
          prices: [{ model: "claude-sonnet-5", currency: "EUR", inputPerMillion: 3, outputPerMillion: 15 }],
          budget: { ...DEFAULT_BUDGET, monthlyLimit: { amount: 5, currency: "EUR" }, monthlyTokens: 2_000_000, atLimit: "fallback", fallbackModel: "claude-haiku-5" },
          state: { state: "warn", percent: 85, spent: { amount: 4.25, currency: "EUR" }, tokens: 1_700_000, unpriced: 2, otherCurrency: 0 },
        })}
      />,
    );
    expect(screen.getByLabelText("Prices you pay")).toHaveValue("claude-sonnet-5, EUR, 3, 15");
    expect(screen.getByLabelText("Money cap per month")).toHaveValue(5);
    expect(screen.getByLabelText("Token cap per month")).toHaveValue(2000000);
    expect(screen.getByRole("radio", { name: /^Switch to/ })).toBeChecked();
    expect(screen.getByLabelText("Cheaper model to switch to")).toHaveValue("claude-haiku-5");
    expect(screen.getByText("This month: 85% of the cap used (4.25 EUR spent, 1,700,000 tokens). Warning level reached.")).toBeInTheDocument();
    expect(screen.getByText(/2 calls to a hosted model have no price, so they are not in the money total/)).toBeInTheDocument();
  });

  it("saves prices and caps when a field is left, parsed from what was typed", async () => {
    render(<BudgetSection initial={view()} />);
    await userEvent.type(screen.getByLabelText("Prices you pay"), "claude-sonnet-5, eur, 3, 15{Enter}gpt-x, USD, 0.5, 1.5");
    await userEvent.tab();
    await waitFor(() => expect(saveBudget).toHaveBeenCalled());
    expect(vi.mocked(saveBudget).mock.calls.at(-1)![0]).toMatchObject({
      prices: [
        { model: "claude-sonnet-5", currency: "EUR", inputPerMillion: 3, outputPerMillion: 15 },
        { model: "gpt-x", currency: "USD", inputPerMillion: 0.5, outputPerMillion: 1.5 },
      ],
    });
    await userEvent.type(screen.getByLabelText("Money cap per month"), "5");
    await userEvent.type(screen.getByLabelText("Currency of the money cap"), "eur");
    await userEvent.tab();
    await waitFor(() => expect(vi.mocked(saveBudget).mock.calls.at(-1)![0].budget.monthlyLimit).toEqual({ amount: 5, currency: "EUR" }));
  });

  it("names the line it cannot read and saves nothing", async () => {
    render(<BudgetSection initial={view()} />);
    await userEvent.type(screen.getByLabelText("Prices you pay"), "claude-sonnet-5, EUR, three, 15");
    await userEvent.tab();
    expect(await screen.findByText("Line 1: give the model, the currency and two prices, like claude-sonnet-5, EUR, 3, 15.")).toBeInTheDocument();
    expect(saveBudget).not.toHaveBeenCalled();
  });

  it("asks for a money cap's currency, and for a model to switch to", async () => {
    render(<BudgetSection initial={view()} />);
    await userEvent.type(screen.getByLabelText("Money cap per month"), "5");
    await userEvent.tab();
    expect(await screen.findByText("Give the money cap's currency as three letters, such as EUR.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: /^Switch to/ }));
    expect(await screen.findByText("Name the cheaper model to switch to.")).toBeInTheDocument();
    expect(saveBudget).not.toHaveBeenCalled();
  });
});
