#!/usr/bin/env node
// pilot: a command-line client for CareerPilot's REST API (/api/v1).
// Everything it does appears in the dashboard's Activity page under the
// token's name. No dependencies: Node 20 or later.

import { readFileSync } from "node:fs";

import { formatActivity, formatApplications, formatCheck, formatInsights, parseArgs, serverFrom, tokenFrom, UsageError } from "./lib.mjs";

const HELP = `pilot: CareerPilot from the command line

Usage: pilot <command> [options]

Commands:
  status                       check the token and the server
  apps [--status SENT]         list applications
  activity [--actor MCP]       recent activity (--limit N, --action application.)
  insights                     applications by platform and resume template
  check <file|->               clean a job posting and flag hidden instructions (needs a write token)

Options:
  --json     print the server's answer as JSON
  --help     this text

Environment:
  CAREERPILOT_URL     your server, for example https://careerpilot.example.com
  CAREERPILOT_TOKEN   an API token

Exit codes: 0 done, 1 error, 2 wrong usage, 3 "check" found something that looks like an instruction aimed at an AI.`;

async function request(server, token, path, init = {}) {
  let response;
  try {
    response = await fetch(`${server}${path}`, { ...init, headers: { authorization: `Bearer ${token}`, ...(init.body ? { "content-type": "application/json" } : {}) }, signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    throw new Error(`Could not reach ${server}: ${error.cause?.code ?? error.message}`);
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new Error(`The server answered ${response.status} with something that is not JSON. Is CAREERPILOT_URL right?`);
  }
  if (!response.ok) throw new Error(body?.error?.message ?? `The server answered ${response.status}.`);
  return body.data;
}

const query = (params) => {
  const search = new URLSearchParams(Object.entries(params).filter(([, value]) => value !== undefined && value !== ""));
  return search.size ? `?${search}` : "";
};

async function main(argv, env) {
  const { command, args, flags } = parseArgs(argv);
  if (!command || flags.help || command === "help") {
    console.log(HELP);
    return 0;
  }
  if (!["status", "apps", "activity", "insights", "check"].includes(command)) throw new UsageError(`Unknown command "${command}". Try: pilot --help`);
  const server = serverFrom(env);
  const token = tokenFrom(env);
  const show = (data, text) => console.log(flags.json ? JSON.stringify(data, null, 2) : text);

  if (command === "status") {
    const data = await request(server, token, "/api/v1/status");
    show(data, `OK. CareerPilot ${data.version}, token "${data.token.name}" (${data.token.scope.toLowerCase()}). ${data.applications} applications, ${data.activityEvents} activity events.`);
  } else if (command === "apps") {
    const data = await request(server, token, `/api/v1/applications${query({ status: flags.status?.toUpperCase(), limit: flags.limit })}`);
    show(data, formatApplications(data));
  } else if (command === "activity") {
    const data = await request(server, token, `/api/v1/activity${query({ actor: flags.actor?.toUpperCase(), action: flags.action, limit: flags.limit })}`);
    show(data, formatActivity(data.events));
  } else if (command === "insights") {
    const data = await request(server, token, "/api/v1/insights");
    show(data, formatInsights(data));
  } else if (command === "check") {
    if (args.length !== 1) throw new UsageError("Usage: pilot check <file|->  (use - for standard input)");
    const text = readFileSync(args[0] === "-" ? 0 : args[0], "utf8");
    const data = await request(server, token, "/api/v1/postings/check", { method: "POST", body: JSON.stringify({ text }) });
    show(data, `${formatCheck(data)}\n\n--- cleaned text ---\n${data.text}`);
    return data.alarm ? 3 : 0;
  }
  return 0;
}

main(process.argv.slice(2), process.env).then(
  (code) => process.exit(code),
  (error) => {
    console.error(error instanceof UsageError ? error.message : `pilot: ${error.message}`);
    process.exit(error instanceof UsageError ? 2 : 1);
  },
);
