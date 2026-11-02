// The operations an assistant can do in CareerPilot, and the doors each is
// reachable through. One service function does the work; REST, the pilot CLI
// and MCP are only ways in. This list is the single source for the table in
// docs/AGENTS.md, and operations.test.ts reads the doors' source to check that
// every door really calls the service it is listed against.
//
// Not imported by the app: it is documentation that is tested, not behaviour.

type Door = { method: "GET" | "POST" | "PATCH"; path: string };

export type Operation = {
  id: string;
  /** What it does, in the table's words. */
  does: string;
  /** The service function every door calls (in lib/services/). */
  service: string;
  rest?: Door;
  /** `command` is what the user types; `calls` is the text in pilot.mjs that makes its REST request. */
  cli?: { command: string; calls: string };
  /** The MCP tool's name, and (when it reaches the service through a helper in tools.ts) the helper's name. */
  mcp?: string;
  mcpCalls?: string;
  /** Why a door is missing, for each one that is. */
  gaps?: { rest?: string; cli?: string; mcp?: string };
};

export const OPERATIONS: readonly Operation[] = [
  {
    id: "applications.list",
    does: "List applications, newest first",
    service: "listApplications",
    rest: { method: "GET", path: "/api/v1/applications" },
    cli: { command: "apps", calls: "/api/v1/applications${query(" },
    mcp: "list_applications",
  },
  {
    id: "applications.read",
    does: "Read one application with its posting and documents' text",
    service: "readApplication",
    rest: { method: "GET", path: "/api/v1/applications/{id}" },
    cli: { command: "apps show", calls: "/api/v1/applications/${encodeURIComponent(args[1])}`)" },
    mcp: "get_application",
  },
  {
    id: "applications.track",
    does: "Track an application as a draft",
    service: "trackApplication",
    rest: { method: "POST", path: "/api/v1/applications" },
    cli: { command: "apps add", calls: '"/api/v1/applications", {\n        method: "POST"' },
    gaps: { mcp: "An MCP assistant saves the application it wrote with save_application, which also keeps the resume and letter." },
  },
  {
    id: "applications.move",
    does: "Put an application back to draft, or mark it rejected or declined",
    service: "moveApplication",
    rest: { method: "PATCH", path: "/api/v1/applications/{id}/status" },
    cli: { command: "apps status", calls: "/status`, { method: \"PATCH\"" },
    mcp: "set_application_status",
  },
  {
    id: "proposals.propose",
    does: "Ask the owner to confirm sent, screening, interview, offer or accepted",
    service: "proposeStatus",
    rest: { method: "POST", path: "/api/v1/applications/{id}/proposals" },
    cli: { command: "apps propose", calls: "/proposals`, { method: \"POST\"" },
    mcp: "propose_status",
  },
  {
    id: "proposals.list",
    does: "List what is waiting for the owner to confirm",
    service: "listPendingProposals",
    rest: { method: "GET", path: "/api/v1/proposals" },
    cli: { command: "proposals", calls: '"/api/v1/proposals"' },
    gaps: { mcp: "An MCP assistant is told what it proposed in the answer to propose_status; the owner answers in the dashboard." },
  },
  {
    id: "postings.check",
    does: "Clean a posting of hidden text and flag lines that instruct an AI",
    service: "checkPostingText",
    rest: { method: "POST", path: "/api/v1/postings/check" },
    cli: { command: "check", calls: '"/api/v1/postings/check"' },
    mcp: "get_posting",
    mcpCalls: "resolvePosting",
  },
  {
    id: "postings.score",
    does: "Keep fit scores the assistant worked out for postings",
    service: "saveFitScores",
    rest: { method: "POST", path: "/api/v1/postings/scores" },
    cli: { command: "scores save", calls: '"/api/v1/postings/scores"' },
    mcp: "save_job_scores",
  },
  {
    id: "searches.run",
    does: "Run a job search on the chosen source and keep it",
    service: "runJobSearch",
    rest: { method: "POST", path: "/api/v1/searches" },
    cli: { command: "search", calls: '"/api/v1/searches", {' },
    mcp: "search_jobs",
  },
  {
    id: "searches.read",
    does: "Read a kept search again (uses no searches from the plan)",
    service: "readSearch",
    rest: { method: "GET", path: "/api/v1/searches/{id}" },
    cli: { command: "search show", calls: "const path = `/api/v1/searches/${encodeURIComponent(args[1])}`" },
    gaps: { mcp: "search_jobs and more_jobs already answer with the postings; a kept search is read in the dashboard." },
  },
  {
    id: "searches.more",
    does: "Show the next page of a kept search (uses one more search from the plan)",
    service: "moreJobs",
    rest: { method: "POST", path: "/api/v1/searches/{id}/more" },
    cli: { command: "search more", calls: "${path}/more`" },
    mcp: "more_jobs",
  },
  {
    id: "companies.list",
    does: "List the employers whose job boards are watched, with how each last scan went",
    service: "listCompanies",
    rest: { method: "GET", path: "/api/v1/companies" },
    cli: { command: "companies", calls: 'call("/api/v1/companies");' },
    gaps: { mcp: "scan_companies reports how each board went, and the owner manages the list in Settings." },
  },
  {
    id: "companies.add",
    does: "Watch an employer's own job board (Greenhouse, Lever or Ashby)",
    service: "addCompany",
    rest: { method: "POST", path: "/api/v1/companies" },
    cli: { command: "companies add", calls: '"/api/v1/companies", { method: "POST"' },
    mcp: "add_company",
  },
  {
    id: "companies.scan",
    does: "Read the watched boards and return the postings that match",
    service: "scanCompanies",
    rest: { method: "POST", path: "/api/v1/companies/scan" },
    cli: { command: "companies scan", calls: '"/api/v1/companies/scan"' },
    mcp: "scan_companies",
  },
  {
    id: "runs.list",
    does: "List runs",
    service: "listRuns",
    rest: { method: "GET", path: "/api/v1/runs" },
    cli: { command: "runs", calls: "/api/v1/runs${query(" },
    gaps: { mcp: "Every MCP call is recorded as a run by the service it reaches; an MCP assistant has no run of its own to manage." },
  },
  {
    id: "runs.start",
    does: "Open a run to report work on while it happens",
    service: "startRun",
    rest: { method: "POST", path: "/api/v1/runs" },
    cli: { command: "run start", calls: '"/api/v1/runs", {' },
    gaps: { mcp: "Every MCP call is recorded as a run by the service it reaches; an MCP assistant has no run of its own to manage." },
  },
  {
    id: "runs.step",
    does: "Add a step to a running run",
    service: "addRunStep",
    rest: { method: "POST", path: "/api/v1/runs/{id}/events" },
    cli: { command: "run step", calls: "/events`" },
    gaps: { mcp: "Every MCP call is recorded as a run by the service it reaches; an MCP assistant has no run of its own to manage." },
  },
  {
    id: "runs.finish",
    does: "Close a run as ok, failed or cancelled",
    service: "finishRun",
    rest: { method: "POST", path: "/api/v1/runs/{id}/finish" },
    cli: { command: "run finish", calls: "/finish`" },
    gaps: { mcp: "Every MCP call is recorded as a run by the service it reaches; an MCP assistant has no run of its own to manage." },
  },
  {
    id: "runs.read",
    does: "Read a run with its steps",
    service: "getRun",
    rest: { method: "GET", path: "/api/v1/runs/{id}" },
    cli: { command: "run show", calls: "/api/v1/runs/${encodeURIComponent(rest[0])}" },
    gaps: { mcp: "Every MCP call is recorded as a run by the service it reaches; an MCP assistant has no run of its own to manage." },
  },
];

/** Doors that are not operations over a service: status, activity and insights read what the dashboard already shows, and the MCP tools below are specific to a connected chat assistant. */
export const NOT_OPERATIONS = {
  rest: ["GET /api/v1/status", "GET /api/v1/activity", "GET /api/v1/insights"],
  mcp: ["get_profile", "save_application", "draft_application", "check_draft"],
} as const;

export const TABLE_START = "<!-- operations:start (generated from lib/services/operations.ts; edit that file) -->";
export const TABLE_END = "<!-- operations:end -->";

/** The Markdown table for docs/AGENTS.md. */
export function operationTable(): string {
  const cell = (value: string | undefined) => (value ? `\`${value}\`` : "none");
  const rows = OPERATIONS.map((operation) => {
    const notes = Object.values(operation.gaps ?? {}).join(" ");
    return `| ${operation.does} | \`${operation.service}\` | ${cell(operation.rest && `${operation.rest.method} ${operation.rest.path}`)} | ${cell(operation.cli && `pilot ${operation.cli.command}`)} | ${cell(operation.mcp)} | ${notes} |`;
  });
  return ["| What it does | Service | REST | Command line | MCP tool | Why a door is missing |", "| --- | --- | --- | --- | --- | --- |", ...rows].join("\n");
}
