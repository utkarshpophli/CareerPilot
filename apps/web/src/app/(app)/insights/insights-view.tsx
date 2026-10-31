import type { ReactNode } from "react";

import { PageHeader } from "@/components/page-header";
import type { VersionCause } from "@/generated/prisma/enums";
import type { InsightRow, Insights } from "@/lib/insights";

const card = "flex flex-col gap-4 rounded-panel border border-line-card bg-card p-6";
const th = "py-2 pr-4 text-left text-meta font-medium text-muted";
const td = "py-2 pr-4 tabular-nums";

const CAUSES: Record<VersionCause, string> = {
  WRITTEN: "First draft",
  TRIMMED: "Trimmed to fit",
  REGENERATED: "Part rewritten",
  REFINED: "Changed in chat",
  UNDONE: "Change undone",
  BEFORE_RESTORE: "Saved before a restore",
  RESTORED: "Earlier version restored",
};

const percent = (value: number | null) => (value === null ? "–" : `${Math.round(value * 100)}%`);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function Stat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className={card}>
      <p className="text-meta text-muted">{label}</p>
      <p className="font-serif text-section tabular-nums">{value}</p>
      {note && <p className="text-meta text-muted">{note}</p>}
    </div>
  );
}

/** One row per platform or template: how many, how many sent, how many replied. */
function BreakdownTable({ title, caption, keyLabel, rows }: { title: string; caption: string; keyLabel: string; rows: InsightRow[] }) {
  return (
    <section className={card} aria-labelledby={`${keyLabel}-heading`}>
      <div>
        <h2 id={`${keyLabel}-heading`} className="font-serif text-section">
          {title}
        </h2>
        <p className="text-meta text-muted">{caption}</p>
      </div>
      {rows.length === 0 ? (
        <p className="text-muted">Nothing here yet.</p>
      ) : (
        <table className="w-full text-field">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col" className={th}>
                {keyLabel}
              </th>
              <th scope="col" className={th}>
                Applications
              </th>
              <th scope="col" className={th}>
                Sent
              </th>
              <th scope="col" className={th}>
                Heard back
              </th>
              <th scope="col" className={th}>
                Interviews
              </th>
              <th scope="col" className={th}>
                Offers
              </th>
              <th scope="col" className={th}>
                Reply rate
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-line-card">
                <th scope="row" className="py-2 pr-4 text-left font-medium">
                  {row.key}
                </th>
                <td className={td}>{row.applications}</td>
                <td className={td}>{row.sent}</td>
                <td className={td}>{row.heardBack}</td>
                <td className={td}>{row.interviews}</td>
                <td className={td}>{row.offers}</td>
                <td className={td}>{percent(row.replyRate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** Bars for the last twelve weeks. The table under it holds every number, for screen readers. */
function WeeklyBars({ weekly }: { weekly: Insights["weekly"] }) {
  const max = Math.max(1, ...weekly.map((week) => Math.max(week.created, week.sent)));
  return (
    <section className={card} aria-labelledby="weekly-heading">
      <div>
        <h2 id="weekly-heading" className="font-serif text-section">
          Per week
        </h2>
        <p className="text-meta text-muted">Applications started and sent over the last twelve weeks.</p>
      </div>
      <div aria-hidden="true" className="flex h-32 items-end gap-2">
        {weekly.map((week) => (
          <div key={week.weekStart} className="flex h-full flex-1 items-end gap-0.5" title={`Week of ${week.weekStart}: ${week.created} started, ${week.sent} sent`}>
            <div className="w-1/2 rounded-t bg-line-strong" style={{ height: `${(week.created / max) * 100}%` }} />
            <div className="w-1/2 rounded-t bg-primary" style={{ height: `${(week.sent / max) * 100}%` }} />
          </div>
        ))}
      </div>
      <p aria-hidden="true" className="flex gap-4 text-meta text-muted">
        <span>
          <span className="mr-1 inline-block size-2 rounded-sm bg-line-strong" />
          Started
        </span>
        <span>
          <span className="mr-1 inline-block size-2 rounded-sm bg-primary" />
          Sent
        </span>
      </p>
      <table className="sr-only">
        <caption>Applications per week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Started</th>
            <th scope="col">Sent</th>
          </tr>
        </thead>
        <tbody>
          {weekly.map((week) => (
            <tr key={week.weekStart}>
              <th scope="row">{week.weekStart}</th>
              <td>{week.created}</td>
              <td>{week.sent}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** The Insights screen: figures from `computeInsights`, laid out. */
export function InsightsView({ insights }: { insights: Insights }) {
  const { totals, resume } = insights;
  const causes = Object.entries(resume.byCause) as [VersionCause, number][];
  return (
    <>
      <PageHeader
        title="Insights"
        description="Where you apply, which resume template you use, how often you revise it, and what gets replies."
      />
      <div className="flex flex-col gap-6 px-10 pb-10">
        {totals.applications === 0 ? (
          <p className="text-muted">Nothing to count yet. Once you have applications, their numbers appear here.</p>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Applications" value={totals.applications} note={`${plural(totals.drafts, "draft", "drafts")}, ${totals.byAgent} from the agent`} />
              <Stat label="Sent" value={totals.sent} />
              <Stat label="Heard back" value={totals.heardBack} note={`Reply rate ${percent(totals.replyRate)}`} />
              <Stat label="Interviews / offers" value={`${totals.interviews} / ${totals.offers}`} />
            </div>

            <WeeklyBars weekly={insights.weekly} />

            <BreakdownTable
              title="By platform"
              caption="The site each posting came from. Applications without a link are grouped together."
              keyLabel="Platform"
              rows={insights.byPlatform}
            />
            <BreakdownTable
              title="By resume template"
              caption="The theme each resume was made with. Compare reply rates before reading much into small numbers."
              keyLabel="Template"
              rows={insights.byTemplate}
            />

            <section className={card} aria-labelledby="revisions-heading">
              <div>
                <h2 id="revisions-heading" className="font-serif text-section">
                  Resume revisions
                </h2>
                <p className="text-meta text-muted">Versions saved after each first draft: rewrites, chat changes, restores.</p>
              </div>
              <p>
                <span className="font-serif text-section tabular-nums">{resume.revisions}</span> in total, {resume.perApplication.toFixed(1)} per application.
              </p>
              {causes.length > 0 && (
                <ul className="flex flex-wrap gap-2 text-meta">
                  {causes.map(([cause, count]) => (
                    <li key={cause} className="rounded-full border border-line-field bg-input px-3 py-1.5">
                      {CAUSES[cause]}: {count}
                    </li>
                  ))}
                </ul>
              )}
              {resume.mostRevised.length > 0 && (
                <div>
                  <h3 className="mb-1 text-meta font-medium text-muted">Most revised</h3>
                  <ol className="list-decimal pl-5">
                    {resume.mostRevised.map((entry) => (
                      <li key={entry.applicationId}>
                        <a className="underline" href={`/applications/${entry.applicationId}`}>
                          {entry.title || "Untitled application"}
                        </a>{" "}
                        ({entry.revisions})
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
