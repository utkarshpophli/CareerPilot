import type { RunView } from "@/lib/runs-view";

export const ACTOR_LABELS: Record<RunView["actorKind"], string> = {
  USER: "You",
  SCHEDULER: "Schedule",
  CLI: "Command line",
  MCP: "AI assistant",
  SYSTEM: "Background job",
};

/** Who did it: the kind of client, and its name when it gave one ("Command line (claude-code)"). */
export const actorLabel = (run: Pick<RunView, "actorKind" | "actorName">) =>
  run.actorName ? `${ACTOR_LABELS[run.actorKind]} (${run.actorName})` : ACTOR_LABELS[run.actorKind];

/** Words for the state, so it never relies on colour alone. */
export function statusLabel(run: Pick<RunView, "status" | "stalled">): string {
  if (run.stalled) return "Stalled";
  return { RUNNING: "Running", OK: "Done", FAILED: "Failed", CANCELLED: "Cancelled" }[run.status];
}

export function when(iso: string, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(new Date(iso));
}
