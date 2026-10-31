import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import type { ActivityEvent } from "@/generated/prisma/client";

export type ActivityView = "all" | "you" | "mcp" | "cli" | "scheduler" | "system";

const VIEWS: { value: ActivityView; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "you", label: "You" },
  { value: "mcp", label: "AI assistants" },
  { value: "cli", label: "Command line" },
  { value: "scheduler", label: "Schedules" },
  { value: "system", label: "Background jobs" },
];

const ACTOR_LABELS: Record<ActivityEvent["actorKind"], string> = {
  USER: "You",
  SCHEDULER: "Schedule",
  CLI: "Command line",
  MCP: "AI assistant",
  SYSTEM: "Background job",
};

const href = (view: ActivityView, before?: string) => {
  const query = new URLSearchParams();
  if (view !== "all") query.set("actor", view);
  if (before) query.set("before", before);
  const text = query.toString();
  return text ? `/activity?${text}` : "/activity";
};

function when(date: Date, timeZone: string | undefined): string {
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", ...(timeZone ? { timeZone } : {}) }).format(date);
}

/** The Activity screen: the ledger as a plain feed with links to filter and page back. */
export function ActivityFeed({
  events,
  next,
  view,
  timeZone,
}: {
  events: ActivityEvent[];
  next: string | null;
  view: ActivityView;
  timeZone?: string;
}) {
  return (
    <>
      <PageHeader title="Activity" description="Everything done in CareerPilot, by you, an AI assistant, a schedule or a background job." />
      <div className="flex flex-col gap-4 px-10 pb-10">
        <nav aria-label="Who did it" className="flex flex-wrap gap-2">
          {VIEWS.map((entry) => (
            <Link
              key={entry.value}
              href={href(entry.value)}
              aria-current={entry.value === view ? "page" : undefined}
              className={`rounded-full border px-3 py-1.5 text-meta ${
                entry.value === view ? "border-primary bg-selected font-medium text-primary-text" : "border-line-field bg-input hover:border-line-strong hover:bg-hover"
              }`}
            >
              {entry.label}
            </Link>
          ))}
        </nav>

        {events.length === 0 ? (
          <p className="text-muted">Nothing here yet. Actions will appear as they happen.</p>
        ) : (
          <ol className="flex flex-col divide-y divide-line-card rounded-panel border border-line-card bg-card">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 py-3">
                <time dateTime={event.at.toISOString()} className="w-40 shrink-0 text-meta text-muted tabular-nums">
                  {when(event.at, timeZone)}
                </time>
                <span className="text-meta text-muted">
                  {event.actorName ? `${ACTOR_LABELS[event.actorKind]} (${event.actorName})` : ACTOR_LABELS[event.actorKind]}
                </span>
                <span className={event.outcome === "ERROR" ? "text-danger" : undefined}>
                  {event.outcome === "ERROR" && <span className="sr-only">Failed: </span>}
                  {event.applicationId ? (
                    <Link className="underline" href={`/applications/${event.applicationId}`}>
                      {event.summary}
                    </Link>
                  ) : (
                    event.summary
                  )}
                </span>
                {event.platform && <span className="rounded-full border border-line-field px-2 text-meta text-muted">{event.platform}</span>}
                {event.model && <span className="text-meta text-muted">{event.model}</span>}
              </li>
            ))}
          </ol>
        )}

        {next && (
          <Link href={href(view, next)} className="self-start text-meta underline">
            Older activity
          </Link>
        )}
      </div>
    </>
  );
}
