import { costOf, isHosted, priceOf, type ModelPrice } from "./pricing";

// The owner's monthly AI budget (M5.5): a cap in money, a cap in tokens, or both. Only calls to hosted providers count;
// a model on the owner's machine costs nothing. A money cap needs prices (Settings → Budget), and a hosted call with no
// price cannot be counted in money, so it is reported rather than guessed. A token cap needs no prices.

export type Budget = {
  /** Money per month in one currency, or null for no money cap. */
  monthlyLimit: { amount: number; currency: string } | null;
  /** Tokens (in plus out, hosted calls only) per month, or null for no token cap. */
  monthlyTokens: number | null;
  /** The share of a cap at which a warning shows. */
  warnPercent: number;
  /** What happens at a cap: refuse the call, or answer with `fallbackModel` instead. */
  atLimit: "stop" | "fallback";
  /** A cheaper model of the same provider, used at the cap when `atLimit` is "fallback". */
  fallbackModel: string | null;
};

export const DEFAULT_BUDGET: Budget = { monthlyLimit: null, monthlyTokens: null, warnPercent: 80, atLimit: "stop", fallbackModel: null };

export type BudgetState = {
  state: "off" | "ok" | "warn" | "over";
  /** The larger of the shares used of the caps that are set; null while none is. */
  percent: number | null;
  /** Spent so far in the money cap's currency; null without a money cap. */
  spent: { amount: number; currency: string } | null;
  /** Hosted tokens this month. */
  tokens: number;
  /** Hosted calls with no price: not in `spent`. */
  unpriced: number;
  /** Hosted calls priced in another currency than the cap: not in `spent`. */
  otherCurrency: number;
};

type CallRow = { provider: string; model: string; inputTokens: number | null; outputTokens: number | null };

export function evaluateBudget(rows: CallRow[], prices: ModelPrice[], budget: Budget): BudgetState {
  let tokens = 0;
  let amount = 0;
  let unpriced = 0;
  let otherCurrency = 0;
  for (const row of rows) {
    if (!isHosted(row.provider) || row.inputTokens === null || row.outputTokens === null) continue;
    const usage = { inputTokens: row.inputTokens, outputTokens: row.outputTokens };
    tokens += usage.inputTokens + usage.outputTokens;
    const price = priceOf(row, prices);
    if (price === null) unpriced++;
    else if (price !== "free") {
      if (budget.monthlyLimit && price.currency === budget.monthlyLimit.currency) amount += costOf(usage, price);
      else otherCurrency++;
    }
  }
  const shares = [budget.monthlyLimit ? (amount / budget.monthlyLimit.amount) * 100 : null, budget.monthlyTokens ? (tokens / budget.monthlyTokens) * 100 : null].filter((share): share is number => share !== null);
  const percent = shares.length ? Math.max(...shares) : null;
  return {
    state: percent === null ? "off" : percent >= 100 ? "over" : percent >= budget.warnPercent ? "warn" : "ok",
    percent,
    spent: budget.monthlyLimit ? { amount: Math.round(amount * 1e6) / 1e6, currency: budget.monthlyLimit.currency } : null,
    tokens,
    unpriced,
    otherCurrency,
  };
}

const count = (value: number) => value.toLocaleString("en-US");

/** How far this month has got, in a sentence. */
export function describeBudget(state: BudgetState): string {
  if (state.state === "off") return "No cap is set, so nothing limits your AI calls.";
  const parts = [state.spent ? `${state.spent.amount} ${state.spent.currency} spent` : "", `${count(state.tokens)} tokens`].filter(Boolean).join(", ");
  const level = state.state === "over" ? " The cap is reached." : state.state === "warn" ? " Warning level reached." : "";
  return `This month: ${Math.round(state.percent ?? 0)}% of the cap used (${parts}).${level}`;
}
