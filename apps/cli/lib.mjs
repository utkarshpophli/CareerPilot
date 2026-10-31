// The parts of the pilot CLI that need no network, so they are tested alone.

/** Splits argv into a command, positional arguments and --flags. `--flag value` and `--flag=value` both work; `--json` and `--help` take none. */
export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  const booleans = new Set(["json", "help"]);
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === "-h") flags.help = true;
    else if (arg.startsWith("--")) {
      const [name, inline] = arg.slice(2).split(/=(.*)/s, 2);
      if (booleans.has(name)) flags[name] = true;
      else if (inline !== undefined) flags[name] = inline;
      else if (index + 1 < argv.length && !argv[index + 1].startsWith("--")) flags[name] = argv[++index];
      else flags[name] = "";
    } else positional.push(arg);
  }
  return { command: positional[0], args: positional.slice(1), flags };
}

/** Plain-text table: left-aligned columns, two spaces apart, no trailing spaces. */
export function table(headers, rows) {
  const cells = [headers, ...rows].map((row) => row.map((cell) => String(cell ?? "").replace(/\s+/g, " ")));
  const widths = headers.map((_, column) => Math.max(...cells.map((row) => row[column].length)));
  return cells.map((row) => row.map((cell, column) => cell.padEnd(widths[column])).join("  ").trimEnd()).join("\n");
}

const day = (value) => (value ? String(value).slice(0, 10) : "");
const time = (value) => (value ? String(value).slice(0, 16).replace("T", " ") : "");

export const formatApplications = (applications) =>
  applications.length === 0
    ? "No applications."
    : table(["STATUS", "PLATFORM", "SENT", "TITLE"], applications.map((a) => [a.status, a.platform || "-", day(a.sentAt) || "-", a.title || "(untitled)"]));

export const formatActivity = (events) =>
  events.length === 0
    ? "No activity."
    : table(["WHEN (UTC)", "WHO", "WHAT"], events.map((e) => [time(e.at), e.actorName ? `${e.actorKind.toLowerCase()}:${e.actorName}` : e.actorKind.toLowerCase(), e.summary]));

const percent = (value) => (value === null || value === undefined ? "-" : `${Math.round(value * 100)}%`);

export function formatInsights(insights) {
  const t = insights.totals;
  const lines = [
    `Applications ${t.applications} (${t.drafts} drafts, ${t.byAgent} from the agent)   Sent ${t.sent}   Heard back ${t.heardBack}   Interviews ${t.interviews}   Offers ${t.offers}   Reply rate ${percent(t.replyRate)}`,
    "",
    "By platform",
    table(["PLATFORM", "APPS", "SENT", "REPLIED", "RATE"], insights.byPlatform.map((r) => [r.key, r.applications, r.sent, r.heardBack, percent(r.replyRate)])),
    "",
    "By resume template",
    table(["TEMPLATE", "APPS", "SENT", "REPLIED", "RATE"], insights.byTemplate.map((r) => [r.key, r.applications, r.sent, r.heardBack, percent(r.replyRate)])),
    "",
    `Resume revisions: ${insights.resume.revisions} (${insights.resume.perApplication.toFixed(1)} per application)`,
  ];
  return lines.join("\n");
}

export function formatCheck(result) {
  const { findings } = result;
  const lines = [findings.verdict];
  for (const [label, items] of [["Instruction-like lines", findings.instruction_like], ["Hidden blocks removed", findings.hidden_blocks], ["Text spelled in invisible characters", findings.invisible_text], ["Mixed-script words", findings.homoglyph_runs]]) {
    if (items.length > 0) lines.push("", `${label}:`, ...items.map((item) => `  - ${JSON.stringify(item)}`));
  }
  return lines.join("\n");
}

/** Where the server is, from the environment: no trailing slash, and https unless it is this machine. */
export function serverFrom(env) {
  const raw = (env.CAREERPILOT_URL ?? "").trim().replace(/\/+$/, "");
  if (!raw) throw new UsageError("Set CAREERPILOT_URL to your server's address, for example https://careerpilot.example.com");
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new UsageError(`CAREERPILOT_URL is not a web address: ${raw}`);
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) throw new UsageError("CAREERPILOT_URL must start with https:// (http:// is only accepted for localhost), or the token would travel unprotected.");
  return `${url.origin}${url.pathname === "/" ? "" : url.pathname}`;
}

export function tokenFrom(env) {
  const token = (env.CAREERPILOT_TOKEN ?? "").trim();
  if (!token) throw new UsageError("Set CAREERPILOT_TOKEN to an API token (make one in Settings, or with `yarn create-token`).");
  return token;
}

export class UsageError extends Error {}
