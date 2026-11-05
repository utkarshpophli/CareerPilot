import { AiError } from "./errors";
import type { Budget, BudgetState } from "./budget";
import type { AIProvider, CompletionRequest, JsonCompletionRequest } from "./provider";

// Holds an AI provider to the owner's monthly budget (M5.5). Before each call it looks at how far this month has got: at a
// cap it refuses with a message that says why, or answers with a cheaper model the owner named. A connection test is never
// held back (it is how the owner checks Settings), and a warning blocks nothing.

const CACHE_MS = 10_000;

type Dependencies = {
  budget: () => Promise<{ budget: Budget; state: BudgetState }>;
  /** A provider for the cheaper model on the same provider; null when there is none to build. */
  fallback: (model: string) => AIProvider | null;
  now?: () => number;
};

const amount = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 2 });

export class BudgetedProvider implements AIProvider {
  private cached: { at: number; value: { budget: Budget; state: BudgetState } } | null = null;

  constructor(
    private readonly inner: AIProvider,
    private readonly deps: Dependencies,
  ) {}

  get kind() {
    return this.inner.kind;
  }
  get model() {
    return this.inner.model;
  }

  complete(request: CompletionRequest): Promise<string>;
  complete<T>(request: JsonCompletionRequest<T>): Promise<T>;
  async complete<T>(request: CompletionRequest | JsonCompletionRequest<T>): Promise<string | T> {
    const { budget, state } = await this.look();
    if (state.state !== "over") return this.inner.complete(request as JsonCompletionRequest<T>);
    if (budget.atLimit === "fallback" && budget.fallbackModel && budget.fallbackModel !== this.inner.model) {
      const cheaper = this.deps.fallback(budget.fallbackModel);
      if (cheaper) return cheaper.complete(request as JsonCompletionRequest<T>);
    }
    throw AiError.config(`Your monthly AI budget is used up (${used(budget, state)}). Raise the cap in Settings → Budget, or wait until next month.`);
  }

  listModels(signal?: AbortSignal) {
    return this.inner.listModels(signal);
  }

  test(signal?: AbortSignal) {
    return this.inner.test(signal);
  }

  private async look() {
    const now = (this.deps.now ?? Date.now)();
    if (!this.cached || now - this.cached.at >= CACHE_MS) this.cached = { at: now, value: await this.deps.budget() };
    return this.cached.value;
  }
}

/** The cap that was reached, in the words it was set in; the money cap first when both are over. */
function used(budget: Budget, state: BudgetState): string {
  const money = budget.monthlyLimit && state.spent ? state.spent.amount / budget.monthlyLimit.amount : 0;
  const tokens = budget.monthlyTokens ? state.tokens / budget.monthlyTokens : 0;
  if (budget.monthlyLimit && state.spent && money >= tokens) return `${amount(state.spent.amount)} ${state.spent.currency} of ${amount(budget.monthlyLimit.amount)} ${budget.monthlyLimit.currency}`;
  return `${state.tokens.toLocaleString("en-US")} of ${(budget.monthlyTokens ?? 0).toLocaleString("en-US")} tokens`;
}
