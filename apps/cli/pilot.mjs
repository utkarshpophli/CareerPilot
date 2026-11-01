#!/usr/bin/env node
// pilot: a command-line client for CareerPilot's REST API (/api/v1).
// Everything it does appears in the dashboard (Runs and Activity) under the
// token's name. No dependencies: Node 20 or later.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

import {
  applicationStatus,
  finishStatus,
  formatActivity,
  formatApplications,
  formatCheck,
  formatInsights,
  formatRun,
  formatRuns,
  parseArgs,
  parseData,
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
  apps status <id> <STATUS>           move an application (DRAFT SENT SCREENING INTERVIEW OFFER ACCEPTED REJECTED DECLINED)
  activity [--actor MCP]              recent activity (--limit N, --action application.)
  insights                            applications by platform and resume template
  check <file|->                      clean a job posting and flag hidden instructions (needs a write token)
  runs [--status RUNNING]             list runs
  run start <kind> <title>            open a run; prints its id (--app ID, --key IDEMPOTENCY_KEY)
  run step <id> <summary>             add a step (--data found=12,boards=3)
  run finish <id> [summary]           close a run (--status ok|failed|cancelled, default ok)
  run show <id>                       a run with its steps
  skills export                       write instructions for an AI assistant (--target claude-code|generic, --dir PATH, --stdout, --force)

Options:
  --json     print the server's answer as JSON
  --help     this text

Environment:
  CAREERPILOT_URL     your server, for example https://careerpilot.example.com
  CAREERPILOT_TOKEN   an API token

Exit codes: 0 done, 1 error, 2 wrong usage, 3 "check" found something that looks like an instruction aimed at an AI.`;

const COMMANDS = new Set(["status", "apps", "activity", "insights", "check", "runs", "run", "skills"]);

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

/** `pilot skills export`: writes the instruction files, or prints them. Never overwrites without --force. */
function exportSkills(flags) {
  const files = skillFiles(flags.target || "claude-code");
  const dir = flags.dir || ".";
  if (flags.stdout) {
    for (const file of files) console.log(file.content);
    return;
  }
  for (const file of files) {
    const path = join(dir, file.path);
    if (existsSync(path) && !flags.force) throw new UsageError(`${path} already exists. Use --force to replace it, or --stdout to print instead.`);
  }
  for (const file of files) {
    const path = join(dir, file.path);
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
    if (args[0] !== "export") throw new UsageError("Usage: pilot skills export [--target claude-code|generic] [--dir PATH] [--stdout] [--force]");
    exportSkills(flags);
    return 0;
  }

  const server = serverFrom(env);
  const token = tokenFrom(env);
  const call = (path, options) => request(server, token, path, options);
  const show = (data, text) => console.log(flags.json ? JSON.stringify(data, null, 2) : text);

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
    } else if (args[0] === "status") {
      need(args, 3, "apps status <id> <STATUS>");
      const data = await call(`/api/v1/applications/${encodeURIComponent(args[1])}/status`, { method: "PATCH", body: { status: applicationStatus(args[2]) } });
      show(data, data.changed ? `${data.id} is now ${data.status}` : `${data.id} was already ${data.status}`);
    } else {
      const data = await call(`/api/v1/applications${query({ status: flags.status?.toUpperCase(), limit: flags.limit })}`);
      show(data, formatApplications(data));
    }
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
