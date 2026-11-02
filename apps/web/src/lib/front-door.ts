import type { ConnectedAssistant } from "./connect/assistants";
import type { InsightRow, Insights } from "./insights";
import type { RunView } from "./runs-view";

// What the dashboard's front-door cards show: how many applications, where
// they go, the resume's versions and templates, what the assistants are doing,
// and what needs the person. Pure: it arranges figures that already exist
// (Insights, connected assistants, running runs), so it is tested on empty,
// one and many without a database.

const WEEKS_SHOWN = 8;
const PLATFORMS_SHOWN = 5;
const TEMPLATES_SHOWN = 3;
const ASSISTANTS_SHOWN = 3;

export type Trend = "up" | "down" | "flat";

export type FrontDoor = {
  applications: {
    total: number;
    drafts: number;
    sent: number;
    thisWeek: { started: number; sent: number };
    /** This week's sent against last week's. */
    trend: Trend;
    /** The last weeks, oldest first, for a small chart. */
    weeks: { weekStart: string; started: number; sent: number }[];
  };
  where: { rows: InsightRow[]; more: number };
  resume: {
    resumes: number;
    /** Every saved version, first drafts included. */
    versions: number;
    /** Versions after the first draft. */
    revisions: number;
    perApplication: number;
    templates: InsightRow[];
    moreTemplates: number;
    /** The template that got the most replies; null while none did. Look at `sent` before reading much into it. */
    bestTemplate: InsightRow | null;
  };
  assistants: {
    connected: number;
    shown: ConnectedAssistant[];
    more: number;
    running: RunningNow[];
    callsToday: number;
    runs: number;
  };
  needsYou: { agentDrafts: number; attention: number; total: number };
};

export type RunningNow = Pick<RunView, "id" | "title" | "actorName" | "lastStep" | "stalled">;

export type FrontDoorInput = {
  insights: Insights;
  assistants: ConnectedAssistant[];
  /** Runs that are going now. */
  running: RunningNow[];
  /** Applications an agent drafted that wait for the person's review. */
  agentDrafts: number;
  /** The things "Worth a look" lists. */
  attention: number;
};

const trendOf = (thisWeek: number, lastWeek: number): Trend => (thisWeek > lastWeek ? "up" : thisWeek < lastWeek ? "down" : "flat");

/** Most replies first; the better reply rate, then more sent, break a tie. Only templates that were answered at all. */
function bestTemplate(rows: InsightRow[]): InsightRow | null {
  const answered = rows.filter((row) => row.heardBack > 0);
  answered.sort((a, b) => b.heardBack - a.heardBack || (b.replyRate ?? 0) - (a.replyRate ?? 0) || b.sent - a.sent || a.key.localeCompare(b.key));
  return answered[0] ?? null;
}

export function computeFrontDoor({ insights, assistants, running, agentDrafts, attention }: FrontDoorInput): FrontDoor {
  const weeks = insights.weekly.slice(-WEEKS_SHOWN).map((week) => ({ weekStart: week.weekStart, started: week.created, sent: week.sent }));
  const thisWeek = weeks.at(-1) ?? { started: 0, sent: 0 };
  const lastWeek = weeks.at(-2) ?? { started: 0, sent: 0 };

  const seenNewestFirst = [...assistants].sort((a, b) => (b.lastSeenAt ?? "").localeCompare(a.lastSeenAt ?? "") || a.name.localeCompare(b.name));

  return {
    applications: {
      total: insights.totals.applications,
      drafts: insights.totals.drafts,
      sent: insights.totals.sent,
      thisWeek: { started: thisWeek.started, sent: thisWeek.sent },
      trend: trendOf(thisWeek.sent, lastWeek.sent),
      weeks,
    },
    where: { rows: insights.byPlatform.slice(0, PLATFORMS_SHOWN), more: Math.max(0, insights.byPlatform.length - PLATFORMS_SHOWN) },
    resume: {
      resumes: insights.resume.resumes,
      versions: insights.resume.versions,
      revisions: insights.resume.revisions,
      perApplication: insights.resume.perApplication,
      templates: insights.byTemplate.slice(0, TEMPLATES_SHOWN),
      moreTemplates: Math.max(0, insights.byTemplate.length - TEMPLATES_SHOWN),
      bestTemplate: bestTemplate(insights.byTemplate),
    },
    assistants: {
      connected: assistants.length,
      shown: seenNewestFirst.slice(0, ASSISTANTS_SHOWN),
      more: Math.max(0, assistants.length - ASSISTANTS_SHOWN),
      running: running.map(({ id, title, actorName, lastStep, stalled }) => ({ id, title, actorName, lastStep, stalled })),
      callsToday: assistants.reduce((sum, assistant) => sum + assistant.callsToday, 0),
      runs: assistants.reduce((sum, assistant) => sum + assistant.runs, 0),
    },
    needsYou: { agentDrafts, attention, total: agentDrafts + attention },
  };
}
