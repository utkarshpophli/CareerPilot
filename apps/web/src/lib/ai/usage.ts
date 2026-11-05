// What an AI call used (docs/roadmap M5.4). Providers report here after each call that answered; whoever wants to keep
// or total the numbers listens. This file has no database, so the providers stay free of one.

export type TokenUsage = { inputTokens: number; outputTokens: number };

export type AiCall = {
  /** The provider kind, e.g. "ANTHROPIC", "OLLAMA", "MOCK". */
  provider: string;
  model: string;
  /** The schema's name for a structured call (the task, e.g. "extracted_posting"), "text" for a plain one. */
  task: string;
  /** Null when the server gave no numbers: a call is still a call, and nothing is estimated. */
  usage: TokenUsage | null;
  at: Date;
};

type Listener = (call: AiCall) => void;
const listeners = new Set<Listener>();

/** Listens to every call; returns the way to stop. */
export function onAiCall(listener: Listener): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Tells the listeners. A listener that throws never affects the call. */
export function emitAiCall(call: AiCall): void {
  for (const listener of listeners) {
    try {
      listener(call);
    } catch {
      // Counting must not break the answer.
    }
  }
}

/** A count from a provider's response, or undefined when it isn't a usable number. */
export function tokenCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined;
}

/** Usage from the two numbers a provider gave; null unless both are real. */
export function usageOf(input: unknown, output: unknown): TokenUsage | null {
  const inputTokens = tokenCount(input);
  const outputTokens = tokenCount(output);
  return inputTokens === undefined || outputTokens === undefined ? null : { inputTokens, outputTokens };
}
