"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { PageHeader } from "@/components/page-header";
import { toast, toastResult } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ConnectedAssistant } from "@/lib/connect/assistants";
import { CHECKED, claudeCodeInstructions, cliEnvironment, openCodeInstructions } from "@/lib/connect/instructions";
import { copyText } from "@/lib/copy-text";

import { createToken, revokeToken } from "../settings/actions";

import { checkConnection, prepareOpenCode, refreshAssistants } from "./actions";

type Tool = "claude-code" | "opencode" | "other";

/** How often "Test connection" asks, and how long it keeps asking. */
const POLL_MS = 2000;
const GIVE_UP_MS = 3 * 60_000;

const SCOPES = {
  READ: { label: "Read only", detail: "It can look at your applications, runs and activity. It cannot change anything." },
  WRITE: { label: "Read, track applications, report runs", detail: "It can also add applications, put them back to draft, mark them rejected or declined, and report its work as runs. It can never send or submit anything, and it cannot mark progress such as sent or interview: you do that." },
} as const;

const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "not yet");

/** A block of text to copy, with its Copy button. */
function Code({ label, text }: { label: string; text: string }) {
  const copy = async () => toast((await copyText(text)) ? "Copied." : "Couldn't copy it. Select it and copy it instead.");
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-label text-muted">{label}</span>
        <Button variant="secondary" size="sm" onClick={() => void copy()}>
          Copy <span className="sr-only">{label}</span>
        </Button>
      </div>
      <pre aria-label={label} tabIndex={0} className="overflow-x-auto rounded-control border border-line-input bg-input px-3 py-2 font-mono text-[13px] whitespace-pre-wrap [overflow-wrap:anywhere]">
        {text}
      </pre>
    </div>
  );
}

function Verified({ tool }: { tool: "claudeCode" | "openCode" }) {
  const checked = CHECKED[tool];
  return (
    <p className="text-meta text-muted">
      Checked with {tool === "claudeCode" ? "Claude Code" : "OpenCode"} {checked.version} on {CHECKED.on}. Tools change their commands; if one no longer works, the tool&apos;s own help is the
      authority.
    </p>
  );
}

export function ConnectScreen({
  origin,
  assistants: initial,
  connector: initialConnector,
}: {
  origin: string;
  assistants: ConnectedAssistant[];
  connector: { on: boolean; openCodeAllowed: boolean };
}) {
  const [tool, setTool] = useState<Tool>("claude-code");
  const [assistants, setAssistants] = useState(initial);
  const [connector, setConnector] = useState(initialConnector);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState<"READ" | "WRITE">("WRITE");
  const [fresh, setFresh] = useState<{ name: string; token: string } | null>(null);
  const [waiting, setWaiting] = useState<{ since: string } | null>(null);
  const [arrived, setArrived] = useState<ConnectedAssistant[]>([]);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef(0);

  const claude = claudeCodeInstructions(origin);
  const opencode = openCodeInstructions(origin);
  const env = cliEnvironment(origin, fresh?.token);

  const make = async () => {
    const attempt = password;
    setPassword(""); // never kept on the page, whether or not it was right
    const result = toastResult(await createToken({ name, scope, password: attempt }));
    if (!result.ok) return;
    setFresh({ name: name.trim(), token: result.data.token });
    setName("");
    const list = await refreshAssistants({});
    if (list.ok) setAssistants(list.data.assistants);
  };

  const revoke = async (assistant: ConnectedAssistant) => {
    const result = toastResult(await revokeToken({ id: assistant.id }));
    if (!result.ok) return;
    setAssistants((current) => current.filter((entry) => entry.key !== assistant.key));
    if (fresh?.name === assistant.name) setFresh(null);
  };

  const prepare = async () => {
    const result = toastResult(await prepareOpenCode({}));
    if (result.ok) setConnector({ on: true, openCodeAllowed: true });
  };

  const startWaiting = () => {
    setArrived([]);
    setTimedOut(false);
    startedAt.current = Date.now();
    setWaiting({ since: new Date().toISOString() });
  };

  const poll = useCallback(async (since: string) => {
    const result = await checkConnection({ since });
    if (!result.ok) return;
    if (result.data.seen.length > 0) {
      setArrived(result.data.seen);
      setWaiting(null);
      const list = await refreshAssistants({});
      if (list.ok) setAssistants(list.data.assistants);
    } else if (Date.now() - startedAt.current > GIVE_UP_MS) {
      setWaiting(null);
      setTimedOut(true);
    }
  }, []);

  useEffect(() => {
    if (!waiting) return;
    const timer = setInterval(() => void poll(waiting.since), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, poll]);

  const tokenCard = (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-section">1. Make a token</h2>
        <p className="text-sm text-muted">
          A token lets a command line or an assistant working in a shell use CareerPilot. Everything it does shows under its name on the Activity page. Assistants that connect through MCP (the
          next step) sign in with their own browser window instead, and don&apos;t need one.
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Input label="Name" className="min-w-0 flex-1" placeholder="claude-code on my laptop" maxLength={60} autoComplete="off" value={name} onChange={(event) => setName(event.target.value)} />
        <Select label="It can" value={scope} onChange={(event) => setScope(event.target.value === "READ" ? "READ" : "WRITE")}>
          <option value="WRITE">{SCOPES.WRITE.label}</option>
          <option value="READ">{SCOPES.READ.label}</option>
        </Select>
        <Input label="Your password" type="password" autoComplete="current-password" className="w-56" value={password} onChange={(event) => setPassword(event.target.value)} hint="Asked again, because a token is a lasting way in." />
        <Button onClick={() => void make()}>Make token</Button>
      </div>
      <p className="text-meta text-muted">{SCOPES[scope].detail}</p>
      {fresh && (
        <div role="status" aria-label="New token" className="flex flex-col gap-2 rounded-card bg-warning-surface px-4 py-3 text-meta text-warning">
          <p>
            Token for <strong>{fresh.name}</strong>. Copy it now: it is not shown again, and CareerPilot keeps only a hash of it. The commands below are filled in with it.
          </p>
          <Code label="Token" text={fresh.token} />
          <div>
            <Button variant="text" size="sm" onClick={() => setFresh(null)}>
              Done, hide it
            </Button>
          </div>
        </div>
      )}
    </Card>
  );

  const toolsCard = (
    <Card className="flex flex-col gap-4">
      <div>
        <h2 className="font-serif text-section">2. Pick your tool</h2>
        <p className="text-sm text-muted">Each tab has what to copy, filled in with this server&apos;s address ({origin}).</p>
      </div>
      <Tabs value={tool} onValueChange={(value) => setTool(value as Tool)}>
        <TabsList aria-label="Tool">
          <TabsTrigger value="claude-code">Claude Code</TabsTrigger>
          <TabsTrigger value="opencode">OpenCode</TabsTrigger>
          <TabsTrigger value="other">Other (Codex, Gemini CLI, scripts)</TabsTrigger>
        </TabsList>

        <TabsContent value="claude-code" className="flex flex-col gap-4 pt-4">
          <Code label="Add CareerPilot to Claude Code" text={claude.add} />
          <p className="text-sm">
            Then, inside Claude Code, run <code className="font-mono text-label">{claude.signIn}</code>, choose <strong>careerpilot</strong> and sign in. Your browser opens CareerPilot to ask whether to allow it.
          </p>
          <Code label="Teach Claude Code the commands and the safety rules (run in your project)" text={claude.skills} />
          <Code label="Environment for the pilot command (macOS, Linux)" text={env.posix} />
          <Code label="Environment for the pilot command (Windows PowerShell)" text={env.powershell} />
          <Verified tool="claudeCode" />
        </TabsContent>

        <TabsContent value="opencode" className="flex flex-col gap-4 pt-4">
          <div role="group" aria-label="Get CareerPilot ready for OpenCode" className="flex flex-wrap items-center gap-3 rounded-card border border-line-card px-4 py-3">
            <p className="min-w-0 flex-1 text-sm">
              {connector.on && connector.openCodeAllowed
                ? "Ready: the connector is on and OpenCode's sign-in address is allowed."
                : "OpenCode signs in through a local address that CareerPilot has to allow, and the MCP connector has to be on."}
            </p>
            {!(connector.on && connector.openCodeAllowed) && (
              <Button variant="secondary" onClick={() => void prepare()}>
                Turn on the connector and allow OpenCode
              </Button>
            )}
          </div>
          <Code label="Add CareerPilot to OpenCode" text={opencode.add} />
          <Code label="Sign in (opens your browser)" text={opencode.auth} />
          <Code label="Or put this in opencode.json in your project" text={opencode.config} />
          <Code label="Teach OpenCode the commands and the safety rules (writes .opencode/careerpilot.md, and opencode.json if you have none)" text={opencode.skills} />
          <Code label="Environment for the pilot command (macOS, Linux)" text={env.posix} />
          <Code label="Environment for the pilot command (Windows PowerShell)" text={env.powershell} />
          <p className="text-meta text-muted">The sign-in address OpenCode uses is {opencode.redirectUri}.</p>
          <Verified tool="openCode" />
        </TabsContent>

        <TabsContent value="other" className="flex flex-col gap-4 pt-4">
          <Code label="Environment (macOS, Linux)" text={env.posix} />
          <Code label="Environment (Windows PowerShell)" text={env.powershell} />
          <Code label="Check it works" text="node apps/cli/pilot.mjs status" />
          <Code label="Instructions for Codex (AGENTS.md) or Gemini CLI (GEMINI.md)" text="node apps/cli/pilot.mjs skills export --target generic --stdout >> AGENTS.md" />
          <Code label="Or call the REST API directly" text={`curl -H "Authorization: Bearer ${fresh?.token ?? "<your token>"}" ${origin}/api/v1/status`} />
        </TabsContent>
      </Tabs>
    </Card>
  );

  const testCard = (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-serif text-section">3. Test the connection</h2>
        <p className="text-sm text-muted">Press the button, then make your assistant call CareerPilot: ask it to list your applications, or run <code className="font-mono text-label">pilot status</code>. The first call shows up here.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={startWaiting} disabled={waiting !== null}>
          {waiting ? "Waiting for a call…" : "Wait for the first call"}
        </Button>
        {waiting && (
          <Button variant="text" size="sm" onClick={() => setWaiting(null)}>
            Stop waiting
          </Button>
        )}
      </div>
      <div role="status" aria-live="polite" className="text-sm">
        {waiting && <p className="text-muted">Listening. Nothing yet.</p>}
        {arrived.length > 0 && (
          <p className="font-medium">
            Connected: {arrived.map((assistant) => assistant.name).join(", ")} just called CareerPilot.
          </p>
        )}
        {timedOut && <p className="text-muted">Nothing came in for three minutes. Check the commands above, and that your assistant can reach {origin}. Then try again.</p>}
      </div>
    </Card>
  );

  const listCard = (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-serif text-section">Connected assistants</h2>
        <p className="text-sm text-muted">Everyone who has a token or has signed in through MCP. &quot;Actions today&quot; counts what an assistant changed or ran, which the Activity page lists in full.</p>
      </div>
      {assistants.length === 0 ? (
        <p className="text-sm text-muted">None yet. Start with step 1.</p>
      ) : (
        <ul aria-label="Connected assistants" className="flex flex-col divide-y divide-line-card">
          {assistants.map((assistant) => (
            <li key={assistant.key} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="font-medium">{assistant.name}</span>{" "}
                <span className="text-meta text-muted">{assistant.via === "mcp" ? "MCP" : assistant.scope === "WRITE" ? "token, read and track" : "token, read only"}</span>
                <span className="block text-meta text-muted">
                  last seen {when(assistant.lastSeenAt)} · {count(assistant.callsToday, "action", "actions")} today · {count(assistant.runs, "run", "runs")}
                </span>
              </span>
              {assistant.revokable ? (
                <Button variant="text" size="sm" onClick={() => void revoke(assistant)}>
                  Revoke <span className="sr-only">{assistant.name}</span>
                </Button>
              ) : (
                <span className="text-meta text-muted">Sign out in Settings → MCP connector</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  return (
    <>
      <PageHeader title="Connect an assistant" description="Let Claude Code, OpenCode or any other assistant work on your job search, and watch every step on the dashboard. Nothing it does is sent or submitted without your click." />
      <div className="flex max-w-[860px] flex-col gap-5 px-10 pb-16">
        {tokenCard}
        {toolsCard}
        {testCard}
        {listCard}
      </div>
    </>
  );
}
