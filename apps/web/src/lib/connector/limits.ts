import { createLimiter, type Verdict } from "@/lib/rate-limit";

// Limits for the Claude connector (audit A-06). Claude in a conversation makes
// a few calls a minute. A runaway loop, or a stolen access token, makes
// thousands, and some tools spend things that are not free: job-source quota
// (search_jobs, more_jobs) and AI money (draft_application).

/** The largest request body the connector reads, in bytes. Postings and resumes are far smaller. */
export const MAX_MCP_BODY_BYTES = 1_000_000;

/** Tools that spend job-source quota or start an AI job. */
export const COSTLY_TOOLS: ReadonlySet<string> = new Set(["search_jobs", "more_jobs", "draft_application"]);

export function createConnectorLimits({ now }: { now?: () => number } = {}) {
  // Every call: a burst of 60, then one a second. Costly tools: a burst of 10, then one every 6 seconds.
  const calls = createLimiter({ capacity: 60, refillPerSecond: 1, now });
  const costly = createLimiter({ capacity: 10, refillPerSecond: 1 / 6, now });
  return {
    /** Spends what a request needs: one call, plus one per costly tool in it. `clientId` is the OAuth client that holds the token. */
    check(clientId: string, tools: readonly string[]): Verdict {
      const general = calls.take(clientId);
      if (!general.ok) return general;
      for (const tool of tools) {
        if (!COSTLY_TOOLS.has(tool)) continue;
        const verdict = costly.take(clientId);
        if (!verdict.ok) return verdict;
      }
      return { ok: true };
    },
  };
}

// One set of counters for the whole process, kept on globalThis so a development reload does not reset them.
const shared = globalThis as { __careerpilotConnectorLimits?: ReturnType<typeof createConnectorLimits> };
export const connectorLimits = (shared.__careerpilotConnectorLimits ??= createConnectorLimits());
