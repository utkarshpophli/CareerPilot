import Link from "next/link";
import type { ReactNode } from "react";

import type { FrontDoor, Trend } from "@/lib/front-door";
import type { InsightRow } from "@/lib/insights";

// The five cards at the top of the dashboard: how many applications, where
// they go, the resume's versions and templates, what the assistants are doing,
// and what needs you. Each links to the page with the detail.

const card = "flex flex-col gap-3 rounded-panel border border-line-card bg-card px-6 py-5";
const heading = "text-label font-medium text-muted";
const link = "text-meta underline underline-offset-2";
const big = "font-serif text-title tabular-nums leading-none";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const percent = (rate: number | null) => (rate === null ? "no replies yet" : `${Math.round(rate * 100)}% replied`);

const TREND: Record<Trend, string> = { up: "up on last week", down: "down on last week", flat: "same as last week" };
const TREND_MARK: Record<Trend, string> = { up: "↑", down: "↓", flat: "→" };

function Card({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={card}>
      <h2 id={id} className={heading}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Bars for the last weeks. Decoration: the numbers are in the text beside it. */
function Sparkline({ weeks }: { weeks: FrontDoor["applications"]["weeks"] }) {
  const max = Math.max(1, ...weeks.map((week) => Math.max(week.started, week.sent)));
  return (
    <div aria-hidden="true" className="flex h-10 items-end gap-1">
      {weeks.map((week) => (
        <div key={week.weekStart} className="flex h-full flex-1 items-end gap-px" title={`Week of ${week.weekStart}: ${week.started} started, ${week.sent} sent`}>
          <div className="w-1/2 rounded-t-[1px] bg-line-strong" style={{ height: `${(week.started / max) * 100}%` }} />
          <div className="w-1/2 rounded-t-[1px] bg-primary" style={{ height: `${(week.sent / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
}

function Rows({ rows, label }: { rows: InsightRow[]; label: string }) {
  return (
    <ul aria-label={label} className="flex flex-col gap-1.5 text-sm">
      {rows.map((row) => (
        <li key={row.key} className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">{row.key}</span>
          <span className="shrink-0 text-meta text-muted tabular-nums">
            {row.applications} · {percent(row.replyRate)}
          </span>
        </li>
      ))}
    </ul>
  );
}

const seen = (iso: string | null, timeZone?: string) =>
  iso ? new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", ...(timeZone ? { timeZone } : {}) }).format(new Date(iso)) : "not yet";

export function FrontDoorCards({ door, timeZone }: { door: FrontDoor; timeZone?: string }) {
  const { applications, where, resume, assistants, needsYou } = door;
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,270px),1fr))] items-start gap-5">
      <Card id="fd-applications" title="Applications">
        <p className={big}>{applications.total}</p>
        <p className="text-sm">
          {plural(applications.drafts, "draft", "drafts")} · {applications.sent} sent
        </p>
        <p className="text-sm text-muted">
          This week: {applications.thisWeek.started} started, {applications.thisWeek.sent} sent{" "}
          <span aria-label={TREND[applications.trend]}>
            <span aria-hidden="true">{TREND_MARK[applications.trend]}</span>
            <span className="sr-only">{TREND[applications.trend]}</span>
          </span>
        </p>
        <Sparkline weeks={applications.weeks} />
        <Link href="/applications" className={link}>
          All applications
        </Link>
      </Card>

      <Card id="fd-where" title="Where you apply">
        {where.rows.length === 0 ? <p className="text-sm text-muted">Nothing yet. Platforms appear as you add applications.</p> : <Rows rows={where.rows} label="Platforms" />}
        <Link href="/insights" className={link}>
          {where.more > 0 ? `${where.more} more, and the detail` : "Detail on Insights"}
        </Link>
      </Card>

      <Card id="fd-resume" title="Your resume">
        {resume.resumes === 0 ? (
          <p className="text-sm text-muted">No tailored resumes yet.</p>
        ) : (
          <>
            <p className="text-sm">
              <span className="font-serif text-section tabular-nums">{resume.versions}</span> {resume.versions === 1 ? "version" : "versions"} across {plural(resume.resumes, "resume", "resumes")}
            </p>
            <p className="text-sm text-muted">
              {plural(resume.revisions, "revision", "revisions")} after the first drafts, {resume.perApplication.toFixed(1)} per application
            </p>
            <Rows rows={resume.templates} label="Templates used" />
            {resume.bestTemplate && (
              <p className="text-meta text-muted">
                Most replies: <strong className="text-ink">{resume.bestTemplate.key}</strong> ({resume.bestTemplate.heardBack} of {resume.bestTemplate.sent} sent). Small numbers, so read it lightly.
              </p>
            )}
          </>
        )}
        <Link href="/insights" className={link}>
          {resume.moreTemplates > 0 ? `${resume.moreTemplates} more templates, and the detail` : "Detail on Insights"}
        </Link>
      </Card>

      <Card id="fd-assistants" title="Your assistants">
        {assistants.connected === 0 ? (
          <p className="text-sm text-muted">No assistant is connected yet.</p>
        ) : (
          <>
            <p className="text-sm">
              {plural(assistants.connected, "assistant", "assistants")} connected · {plural(assistants.callsToday, "action", "actions")} today · {plural(assistants.runs, "run", "runs")}
            </p>
            <ul aria-label="Connected assistants" className="flex flex-col gap-1 text-sm">
              {assistants.shown.map((assistant) => (
                <li key={assistant.key} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate">{assistant.name}</span>
                  <span className="shrink-0 text-meta text-muted">seen {seen(assistant.lastSeenAt, timeZone)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {assistants.running.length > 0 ? (
          <ul aria-label="Running now" className="flex flex-col gap-1 rounded-card bg-selected px-3 py-2 text-sm">
            {assistants.running.map((run) => (
              <li key={run.id}>
                <Link href={`/runs/${run.id}`} className="underline underline-offset-2">
                  {run.title}
                </Link>{" "}
                <span className="text-meta text-muted">
                  {run.actorName || "app"}
                  {run.stalled ? ", stalled" : run.lastStep ? `: ${run.lastStep}` : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          assistants.connected > 0 && <p className="text-meta text-muted">Nothing running right now.</p>
        )}
        <Link href="/connect" className={link}>
          {assistants.connected === 0 ? "Connect an assistant" : assistants.more > 0 ? `${assistants.more} more, and Connect` : "Connect another"}
        </Link>
      </Card>

      <Card id="fd-needs" title="Needs you">
        {needsYou.total === 0 ? (
          <p className="text-sm text-muted">Nothing is waiting for you.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 text-sm">
            {needsYou.agentDrafts > 0 && (
              <li>
                <Link href="/agent" className="underline underline-offset-2">
                  {plural(needsYou.agentDrafts, "draft", "drafts")} from your assistant{needsYou.agentDrafts === 1 ? "" : "s"}
                </Link>{" "}
                waiting for your review
              </li>
            )}
            {needsYou.attention > 0 && (
              <li>
                <a href="#attention-heading" className="underline underline-offset-2">
                  {plural(needsYou.attention, "thing", "things")}
                </a>{" "}
                worth a look: interviews, offers, follow-ups
              </li>
            )}
          </ul>
        )}
      </Card>
    </div>
  );
}
