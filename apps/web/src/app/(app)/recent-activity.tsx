import Link from "next/link";

import type { ActivityEvent } from "@/generated/prisma/client";

const ACTORS: Record<ActivityEvent["actorKind"], string> = {
  USER: "You",
  SCHEDULER: "Schedule",
  CLI: "Command line",
  MCP: "AI assistant",
  SYSTEM: "Background job",
};

const when = (date: Date, timeZone: string | undefined) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(date);

/** "Recent activity": the last few things done in CareerPilot, by you or by an assistant, with a link to all of it. */
export function RecentActivity({ events, timeZone }: { events: ActivityEvent[]; timeZone?: string }) {
  return (
    <section aria-labelledby="recent-heading" className="flex flex-col gap-3 rounded-panel border border-line-card bg-card px-7 pt-[26px] pb-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="recent-heading" className="font-serif text-section">
          Recent activity
        </h2>
        <Link href="/activity" className="text-meta underline">
          All activity
        </Link>
      </div>
      {events.length === 0 ? (
        <p className="text-sm text-muted">Nothing yet. What you and your assistants do will show here.</p>
      ) : (
        <ol className="flex flex-col divide-y divide-line-card">
          {events.map((event) => (
            <li key={event.id} className="flex flex-col gap-0.5 py-2">
              <span className={event.outcome === "ERROR" ? "text-danger" : undefined}>
                {event.outcome === "ERROR" && <span className="sr-only">Failed: </span>}
                {event.summary}
              </span>
              <span className="text-meta text-muted">
                {event.actorName ? `${ACTORS[event.actorKind]} (${event.actorName})` : ACTORS[event.actorKind]} ·{" "}
                <time dateTime={event.at.toISOString()}>{when(event.at, timeZone)}</time>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
