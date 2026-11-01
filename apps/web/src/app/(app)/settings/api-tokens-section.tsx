"use client";

import { useState } from "react";

import { useTrackSave } from "@/components/save-tracker";
import { toast, toastResult } from "@/components/toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { TokenRow } from "@/lib/api-tokens";
import { copyText } from "@/lib/copy-text";

import { createToken, revokeToken } from "./actions";
import { SettingsSectionIntro } from "./settings-screen";

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "never");

/**
 * Settings → API tokens: for the pilot command line, scripts and AI assistants
 * that work through a shell. A token is shown once, when it is made; only its
 * hash is kept. Everything a token does appears on Activity under its name.
 */
export function ApiTokensSection({ initial, address }: { initial: TokenRow[]; address: string }) {
  const track = useTrackSave();
  const [tokens, setTokens] = useState(initial);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [scope, setScope] = useState<"READ" | "WRITE">("READ");
  const [fresh, setFresh] = useState<{ name: string; token: string } | null>(null);

  const make = async () => {
    const attempt = password;
    setPassword(""); // never kept on the page, whether or not it was right
    const result = toastResult(await track(createToken({ name, scope, password: attempt })));
    if (!result.ok) return;
    setFresh({ name: name.trim(), token: result.data.token });
    setTokens(result.data.tokens);
    setName("");
  };

  const revoke = async (row: TokenRow) => {
    const result = toastResult(await track(revokeToken({ id: row.id })));
    if (!result.ok) return;
    setTokens(result.data.tokens);
    if (fresh?.name === row.name) setFresh(null);
  };

  const copy = async (text: string) => toast((await copyText(text)) ? "Copied." : "Couldn't copy it. Select it and copy it instead.");
  const active = tokens.filter((row) => !row.revokedAt);

  return (
    <>
      <SettingsSectionIntro title="API tokens">
        Let the <code className="font-mono text-label">pilot</code> command line, scripts and AI assistants that work in a shell, such as Claude Code or Codex, read
        your applications and activity. The name you give a token is what Activity shows for everything it does. A read token can only look. A write token can
        also track applications, report runs and run the posting check, and can mark an application rejected or declined; it cannot say that one was sent or
        that an interview or offer happened, because only you know that.
      </SettingsSectionIntro>

      <Card className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <Input
            label="Name"
            className="min-w-0 flex-1"
            placeholder="claude-code on my laptop"
            maxLength={60}
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void make();
              }
            }}
          />
          <Select label="Can" value={scope} onChange={(event) => setScope(event.target.value === "WRITE" ? "WRITE" : "READ")}>
            <option value="READ">Read only</option>
            <option value="WRITE">Read, track applications, report runs</option>
          </Select>
          <Input
            label="Your password"
            type="password"
            className="min-w-0 flex-1"
            autoComplete="current-password"
            maxLength={256}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void make();
              }
            }}
          />
          <Button variant="primary" onClick={() => void make()}>
            Make token
          </Button>
        </div>

        {fresh && (
          <div role="status" className="flex flex-col gap-2 rounded-card bg-warning-surface px-4 py-3 text-meta text-warning">
            <p>
              Token for <strong>{fresh.name}</strong>. Copy it now: it is not shown again, and CareerPilot keeps only a hash of it.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <code className="min-w-0 flex-1 rounded-control border border-line-input bg-input px-3 py-2 font-mono text-[13px] text-ink [overflow-wrap:anywhere]">{fresh.token}</code>
              <Button variant="secondary" size="sm" onClick={() => void copy(fresh.token)}>
                Copy
              </Button>
              <Button variant="text" size="sm" onClick={() => setFresh(null)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3">
        <h3 className="text-control font-medium">Your tokens</h3>
        {tokens.length === 0 ? (
          <p className="text-sm text-muted">None yet.</p>
        ) : (
          <ul aria-label="API tokens" className="flex flex-col divide-y divide-line-card">
            {tokens.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{row.name}</span>{" "}
                  <span className="font-mono text-label text-muted">{row.prefix}…</span>
                  <span className="block text-meta text-muted">
                    {row.scope === "WRITE" ? "Read and posting check" : "Read only"} · made {when(row.createdAt)} · last used {when(row.lastUsedAt)}
                    {row.revokedAt ? ` · revoked ${when(row.revokedAt)}` : ""}
                  </span>
                </span>
                {row.revokedAt ? (
                  <span className="text-meta text-muted">Revoked</span>
                ) : (
                  <Button variant="text" size="sm" onClick={() => void revoke(row)}>
                    Revoke <span className="sr-only">{row.name}</span>
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="flex flex-col gap-3 text-sm text-pretty">
        <h3 className="text-control font-medium">Use a token</h3>
        <pre className="overflow-x-auto rounded-control border border-line-input bg-input px-3 py-2 font-mono text-[13px]">
          {`export CAREERPILOT_URL=${address}\nexport CAREERPILOT_TOKEN=<the token>\nnode apps/cli/pilot.mjs status`}
        </pre>
        <p className="text-muted">
          {active.length === 0 ? "No active tokens." : `${active.length} active.`} Revoking a token stops it working at once. Keep tokens out of shared files and chats: anyone who has one can read your
          applications.
        </p>
      </Card>
    </>
  );
}
