#!/usr/bin/env node
// pilot: a command-line client for CareerPilot's REST API (/api/v1).
// Everything it does appears in the dashboard (Runs and Activity) under the
// token's name. No dependencies: Node 20 or later.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  applicationStatus,
  boardSource,
  finishStatus,
  formatActivity,
  formatApplication,
  formatApplications,
  formatCheck,
  formatCompanies,
  formatInsights,
  formatPostings,
  formatProposals,
  formatRun,
  formatRuns,
  formatScan,
  formatSearch,
  parseArgs,
  parseData,
  parseScores,
  plain,
  proposableStatus,
  serverFrom,
  skillFiles,
  tokenFrom,
  UsageError,
} from "./lib.mjs";

const HELP = `pilot: CareerPilot from the command line

Usage: pilot <command> [options]

Commands:
  status                              check the token and the server
  apps [--status SENT]                list applications
  apps add --company C --role R       track an application as a draft (--url, --location, --file posting.txt)
  apps show <id>                      one application with its documents and posting as text
  apps status <id> <STATUS>           DRAFT, REJECTED or DECLINED (SENT and later are the user's to set in the dashboard)
  apps propose <id> <STATUS>          ask the user to confirm SENT, SCREENING, INTERVIEW, OFFER or ACCEPTED (--reason "..."); changes nothing
  proposals                           what is waiting for the user to confirm
  postings                            the kept postings, best score first (--min-score N, --state NEW|SAVED|DISMISSED, --limit N)
  companies                           the watched employer job boards and how each last scan went
  companies add <board>               watch a board (--source GREENHOUSE|LEVER|ASHBY|WORKABLE|RECRUITEE|TEAMTAILOR|ATLASSIAN, or paste its careers link; --name "Acme")
  companies scan [keywords]           read the watched boards (--place P, --limit N); postings come back as snippets with links
  search <keywords>                   run a job search (--place, --country, --remote, --within day|3days|week|month|any, --radius KM)
  search show <id>                    a kept search with its numbered postings (costs no search)
  search more <id>                    the next page of a kept search
  scores save <file|->                keep fit scores you worked out (JSON list of { number, score, reasons })
  activity [--actor MCP]              recent activity (--limit N, --action application.)
  insights                            applications by platform and resume template
  check <file|->                      clean a job posting and flag hidden instructions (needs a write token)
  runs [--status RUNNING]             list runs
  run start <kind> <title>            open a run; prints its id (--app ID, --key IDEMPOTENCY_KEY)
  run step <id> <summary>             add a step (--data found=12,boards=3)
  run finish <id> [summary]           close a run (--status ok|failed|cancelled, default ok)
  run show <id>                       a run with its steps
  skills export                       write instructions for an AI assistant (--target claude-code|opencode|generic, --dir PATH, --stdout, --force)

Options:
  --json     print the server's answer as JSON
  --help     this text

Environment:
  CAREERPILOT_URL     your server, for example https://careerpilot.example.com
  CAREERPILOT_TOKEN   an API token

Exit codes: 0 done, 1 error, 2 wrong usage, 3 "check" found something that looks like an instruction aimed at an AI.`;

const COMMANDS = new Set(["status", "apps", "proposals", "companies", "postings", "search", "scores", "activity", "insights", "check", "runs", "run", "skills"]);

async function request(server, token, path, { method = "GET", body, headers = {} } = {}) {
  let response;
  try {
    response = await fetch(`${server}${path}`, {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    throw new Error(`Could not reach ${server}: ${error.cause?.code ?? error.message}`);
  }
  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`The server answered ${response.status} with something that is not JSON. Is CAREERPILOT_URL right?`);
  }
  if (!response.ok) throw new Error(json?.error?.message ?? `The server answered ${response.status}.`);
  return json.data;
}

const query = (params) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ""));
  return search.size ? `?${search}` : "";
};

const need = (args, count, usage) => {
  if (args.length < count) throw new UsageError(`Usage: pilot ${usage}`);
};

/** `pilot skills export`: writes the instruction files, or prints them. Never overwrites without --force, and never overwrites a tool's own config. */
function exportSkills(flags, env) {
  let server;
  try {
    server = env.CAREERPILOT_URL?.trim() ? serverFrom(env) : undefined;
  } catch {
    server = undefined; // a bad address only means the config will not name the server
  }
  const files = skillFiles(flags.target || "claude-code", { server });
  const dir = flags.dir || ".";
  if (flags.stdout) {
    for (const file of files) console.log(file.content);
    return;
  }
  for (const file of files) {
    const path = join(dir, file.path);
    if (!file.createOnly && existsSync(path) && !flags.force) throw new UsageError(`${path} already exists. Use --force to replace it, or --stdout to print instead.`);
  }
  for (const file of files) {
    const path = join(dir, file.path);
    if (file.createOnly && existsSync(path)) {
      console.log(`${path} already exists; left as it is. Merge this into it yourself:\n\n${file.content}`);
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, file.content);
    console.log(`Wrote ${path}`);
  }
}

async function main(argv, env) {
  const { command, args, flags } = parseArgs(argv);
  if (!command || flags.help || command === "help") {
    console.log(HELP);
    return 0;
  }
  if (!COMMANDS.has(command)) throw new UsageError(`Unknown command "${command}". Try: pilot --help`);
  if (command === "skills") {
    if (args[0] !== "export") throw new UsageError("Usage: pilot skills export [--target claude-code|opencode|generic] [--dir PATH] [--stdout] [--force]");
    exportSkills(flags, env);
    return 0;
  }

  const server = serverFrom(env);
  const token = tokenFrom(env);
  const call = (path, options) => request(server, token, path, options);
  // Whatever the server sent is cleaned of control characters before it reaches the terminal (audit A-22).
  const show = (data, text) => console.log(flags.json ? JSON.stringify(data, null, 2) : plain(text));

  if (command === "status") {
    const data = await call("/api/v1/status");
    show(data, `OK. CareerPilot ${data.version}, token "${data.token.name}" (${data.token.scope.toLowerCase()}). ${data.applications} applications, ${data.activityEvents} activity events.`);
  } else if (command === "apps") {
    if (args[0] === "add") {
      const postingText = flags.file ? readFileSync(flags.file === "-" ? 0 : flags.file, "utf8") : undefined;
      const data = await call("/api/v1/applications", {
        method: "POST",
        body: { company: flags.company, role: flags.role, title: flags.title, location: flags.location, postingUrl: flags.url, postingText },
      });
      show(data, data.created ? data.id : `${data.id} (already tracked)`);
      for (const note of data.notes ?? []) process.stderr.write(`Heads up, you already have: ${note}
`);
    } else if (args[0] === "show") {
      need(args, 2, "apps show <id>");
      const data = await call(`/api/v1/applications/${encodeURIComponent(args[1])}`);
      show(data, formatApplication(data));
    } else if (args[0] === "status") {
      need(args, 3, "apps status <id> <STATUS>");
      const data = await call(`/api/v1/applications/${encodeURIComponent(args[1])}/status`, { method: "PATCH", body: { status: applicationStatus(args[2]) } });
      show(data, data.changed ? `${data.id} is now ${data.status}` : `${data.id} was already ${data.status}`);
    } else if (args[0] === "propose") {
      need(args, 3, 'apps propose <id> <STATUS> [--reason "..."]');
      const status = proposableStatus(args[2]);
      await call(`/api/v1/applications/${encodeURIComponent(args[1])}/proposals`, { method: "POST", body: { status, reason: flags.reason || undefined } });
      show({ id: args[1], status, state: "PENDING" }, `Proposed ${status} for ${args[1]}. It waits for the user to confirm it on the dashboard; nothing changed yet.`);
    } else {
      const data = await call(`/api/v1/applications${query({ status: flags.status?.toUpperCase(), limit: flags.limit })}`);
      show(data, formatApplications(data));
    }
  } else if (command === "proposals") {
    const data = await call("/api/v1/proposals");
    show(data, formatProposals(data));
  } else if (command === "companies") {
    if (args[0] === "add") {
      if (args.length < 2) throw new UsageError('Usage: pilot companies add <board> [--source GREENHOUSE|LEVER|ASHBY|WORKABLE|RECRUITEE|TEAMTAILOR|ATLASSIAN] [--name "Acme"]');
      const data = await call("/api/v1/companies", { method: "POST", body: { board: args[1], source: flags.source ? boardSource(flags.source) : undefined, name: flags.name || undefined } });
      show(data, data.created ? `Now watching ${data.name} (${data.source} ${data.slug}).` : `Already watching ${data.name}.`);
    } else if (args[0] === "scan") {
      const limit = flags.limit === undefined ? undefined : Number(flags.limit);
      if (limit !== undefined && !Number.isInteger(limit)) throw new UsageError("--limit is a number of postings.");
      const data = await call("/api/v1/companies/scan", { method: "POST", body: { keywords: args.slice(1).join(" ") || undefined, place: flags.place || undefined, limit } });
      show(data, formatScan(data));
    } else if (args.length === 0) {
      const data = await call("/api/v1/companies");
      show(data, formatCompanies(data));
    } else {
      throw new UsageError("Usage: pilot companies [add <board> | scan [keywords]]  (removing a company is done in Settings)");
    }
  } else if (command === "postings") {
    const minScore = flags["min-score"] === undefined ? undefined : Number(flags["min-score"]);
    if (minScore !== undefined && (!Number.isInteger(minScore) || minScore < 0 || minScore > 100)) throw new UsageError("--min-score is a number from 0 to 100.");
    const state = flags.state === undefined ? undefined : String(flags.state).toUpperCase();
    if (state !== undefined && !["NEW", "SAVED", "DISMISSED"].includes(state)) throw new UsageError("--state is NEW, SAVED or DISMISSED.");
    const data = await call(`/api/v1/postings/scanned${query({ state, minScore, limit: flags.limit })}`);
    show(data, formatPostings(data));
  } else if (command === "search") {
    if (args[0] === "show" || args[0] === "more") {
      need(args, 2, `search ${args[0]} <id>`);
      const path = `/api/v1/searches/${encodeURIComponent(args[1])}`;
      if (args[0] === "show") {
        const data = await call(path);
        show(data, formatSearch(data));
      } else {
        const data = await call(`${path}/more`, { method: "POST", body: {} });
        show(data, `${formatSearch({ ...data, searched: "more results" })}`);
      }
    } else {
      if (args.length === 0) throw new UsageError('Usage: pilot search "<keywords>" [--place P] [--country C] [--remote] [--within week] [--radius 25]');
      const radius = flags.radius === undefined ? undefined : Number(flags.radius);
      if (radius !== undefined && !Number.isInteger(radius)) throw new UsageError("--radius is a number of kilometres: 10, 25, 50, 100 or 200.");
      const data = await call("/api/v1/searches", {
        method: "POST",
        body: { keywords: args.join(" "), place: flags.place, country: flags.country, remoteOnly: flags.remote ? true : undefined, radiusKm: radius, postedWithin: flags.within },
      });
      show(data, formatSearch(data));
    }
  } else if (command === "scores") {
    if (args[0] !== "save" || args.length !== 2) throw new UsageError("Usage: pilot scores save <file|->  (use - for standard input)");
    const body = parseScores(readFileSync(args[1] === "-" ? 0 : args[1], "utf8"));
    const data = await call("/api/v1/postings/scores", { method: "POST", body });
    const missing = data.notFound?.length ? `\nNot found: ${data.notFound.join(", ")}` : "";
    show(data, `Saved ${data.saved.length} score${data.saved.length === 1 ? "" : "s"}.${missing}`);
  } else if (command === "activity") {
    const data = await call(`/api/v1/activity${query({ actor: flags.actor?.toUpperCase(), action: flags.action, limit: flags.limit })}`);
    show(data, formatActivity(data.events));
  } else if (command === "insights") {
    const data = await call("/api/v1/insights");
    show(data, formatInsights(data));
  } else if (command === "check") {
    if (args.length !== 1) throw new UsageError("Usage: pilot check <file|->  (use - for standard input)");
    const text = readFileSync(args[0] === "-" ? 0 : args[0], "utf8");
    const data = await call("/api/v1/postings/check", { method: "POST", body: { text } });
    show(data, `${formatCheck(data)}\n\n--- cleaned text ---\n${data.text}`);
    return data.alarm ? 3 : 0;
  } else if (command === "runs") {
    const data = await call(`/api/v1/runs${query({ status: flags.status?.toUpperCase(), limit: flags.limit })}`);
    show(data, formatRuns(data.runs));
  } else if (command === "run") {
    const [action, ...rest] = args;
    if (action === "start") {
      need(rest, 2, 'run start <kind> "<title>"');
      const [kind, ...title] = rest;
      const data = await call("/api/v1/runs", {
        method: "POST",
        body: { kind, title: title.join(" "), applicationId: flags.app || undefined },
        headers: flags.key ? { "idempotency-key": flags.key } : {},
      });
      show(data, data.id);
    } else if (action === "step") {
      need(rest, 2, 'run step <id> "<summary>" [--data found=12,boards=3]');
      const [id, ...summary] = rest;
      const data = await call(`/api/v1/runs/${encodeURIComponent(id)}/events`, { method: "POST", body: { summary: summary.join(" "), data: parseData(flags.data) } });
      show(data, `step ${data.stepCount}: ${data.lastStep}`);
    } else if (action === "finish") {
      need(rest, 1, 'run finish <id> [--status ok|failed|cancelled] ["<summary>"]');
      const [id, ...summary] = rest;
      const data = await call(`/api/v1/runs/${encodeURIComponent(id)}/finish`, { method: "POST", body: { status: finishStatus(flags.status), summary: summary.join(" ") || undefined } });
      show(data, `${data.id} ${data.status.toLowerCase()}`);
    } else if (action === "show") {
      need(rest, 1, "run show <id>");
      const data = await call(`/api/v1/runs/${encodeURIComponent(rest[0])}`);
      show(data, formatRun(data));
    } else {
      throw new UsageError("Usage: pilot run start|step|finish|show ...  (try: pilot --help)");
    }
  }
  return 0;
}

// Set the exit code and let Node finish by itself: calling process.exit() right after fetch() can abort with a libuv assertion on Windows.
main(process.argv.slice(2), process.env).then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(error instanceof UsageError ? error.message : `pilot: ${error.message}`);
    process.exitCode = error instanceof UsageError ? 2 : 1;
  },
);
