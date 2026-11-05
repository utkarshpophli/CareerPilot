// What an AI call costs (M5.4): tokens times a price per million, by the model's exact name. The price is a fact about a
// provider's page on a day, so nothing is built in that has not been read there and dated; the owner enters the prices
// they pay in Settings → Budget. A model that runs on the owner's own machine costs nothing in money (electricity is theirs).

import type { TokenUsage } from "./usage";

/** The day the built-in list below was last checked against the providers' pages. */
export const PRICING_AS_OF = "2026-11-05";

export type ModelPrice = {
  /** The model's name exactly as the provider reports it, e.g. "claude-sonnet-5". */
  model: string;
  /** ISO 4217, e.g. "USD". Prices in different currencies are never added together. */
  currency: string;
  /** Per million tokens, in `currency`. */
  inputPerMillion: number;
  outputPerMillion: number;
};

/**
 * Figures read from a provider's own price page, each with its address in `source`. Empty on 2026-11-05: this build
 * environment cannot read those pages, and a number from memory is not a fact. Add entries only with a source.
 */
export const BUILT_IN_PRICES: (ModelPrice & { source: string })[] = [];

/** Providers whose models run on the owner's machine. */
const OWN_MACHINE = new Set(["LOCAL", "LMSTUDIO"]);

export const isHosted = (provider: string): boolean => !OWN_MACHINE.has(provider);

/** The price for a call: "free" for a model on the owner's machine, the owner's entry first, else a built-in one, else null (unknown). */
export function priceOf(call: { provider: string; model: string }, owner: ModelPrice[]): ModelPrice | "free" | null {
  if (!isHosted(call.provider)) return "free";
  return owner.find((entry) => entry.model === call.model) ?? BUILT_IN_PRICES.find((entry) => entry.model === call.model) ?? null;
}

/** Money for these tokens at this price, in the price's currency. */
export function costOf(usage: TokenUsage, price: ModelPrice): number {
  return (usage.inputTokens * price.inputPerMillion + usage.outputTokens * price.outputPerMillion) / 1_000_000;
}
