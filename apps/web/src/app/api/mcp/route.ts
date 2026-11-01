import { createMcpHandler } from "@modelcontextprotocol/server";

import { ActivityActor } from "@/generated/prisma/enums";
import { connectorLimits, MAX_MCP_BODY_BYTES } from "@/lib/connector/limits";
import { connectorSince, mcpUrl, readClient, SCOPE, verifyAccessToken } from "@/lib/connector/oauth";
import { toolCallsIn } from "@/lib/connector/tool-calls";
import { createDossierServer } from "@/lib/connector/tools";
import { publicOrigin } from "@/lib/google/origin";
import { ACTIONS, recordActivitySafe, runAsActor } from "@/lib/ledger";
import { logServerError } from "@/lib/log";
import { prisma } from "@/lib/prisma";
import { BodyTooLarge, readLimitedText } from "@/lib/read-limited";

// The Claude connector (#221): CareerPilot as a remote MCP server (Streamable
// HTTP) at /api/mcp, for Claude's custom connectors. Each request gets a
// server of its own, without an MCP session, for the 2025 protocol Claude
// speaks today and the 2026-07-28 one. It answers 404 while the connector is
// off in Settings, and needs an access token from CareerPilot's own sign-in
// (src/lib/connector/oauth.ts); the proxy lets it through without a session.

// The address links in answers point to comes along with the token's details.
const handler = createMcpHandler(({ authInfo }) => createDossierServer(typeof authInfo?.extra?.origin === "string" ? authInfo.extra.origin : ""), {
  onerror: (error) => logServerError("MCP connector", error),
});

/** "Sign in first", with where Claude finds out how (RFC 9728). */
function unauthorized(origin: string): Response {
  return Response.json(
    { error: "invalid_token", error_description: "Connect Claude to CareerPilot first." },
    { status: 401, headers: { "www-authenticate": `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/api/mcp", scope="${SCOPE}"` } },
  );
}

/** A refusal Claude can read: a JSON-RPC error with the HTTP status that says why. */
function refuse(status: number, message: string, headers: Record<string, string> = {}): Response {
  return Response.json({ jsonrpc: "2.0", error: { code: -32000, message }, id: null }, { status, headers });
}

async function handle(request: Request): Promise<Response> {
  if (!(await connectorSince())) return new Response(null, { status: 404 });
  const origin = publicOrigin(request);
  const token = /^Bearer\s+(\S.*)$/i.exec(request.headers.get("authorization") ?? "")?.[1];
  const access = await verifyAccessToken(token);
  if (!access) return unauthorized(origin);
  const name = (await readClient(access.clientId))?.name ?? "Claude";
  const actor = { kind: ActivityActor.MCP, name };

  // Read the body once, within a size limit, to see which tools it calls (audit A-06, B-20).
  let tools: string[] = [];
  if (request.method === "POST") {
    try {
      tools = toolCallsIn(JSON.parse(await readLimitedText(request.clone(), MAX_MCP_BODY_BYTES)) as unknown);
    } catch (error) {
      if (error instanceof BodyTooLarge) return refuse(413, "The request is too large.");
      tools = []; // not JSON: the MCP handler answers that itself
    }
  }
  const verdict = connectorLimits.check(access.clientId, tools);
  if (!verdict.ok) return refuse(429, `Too many requests. Try again in ${verdict.retryAfterSeconds} seconds.`, { "retry-after": String(verdict.retryAfterSeconds) });

  try {
    // Everything this request does is recorded as done by that client (Activity Ledger).
    return await runAsActor(actor, async () => {
      for (const tool of tools) await recordActivitySafe(prisma, { action: ACTIONS.mcpToolCalled, summary: `${name} used ${tool}`, targetType: "tool", data: { tool } });
      return handler.fetch(request, { authInfo: { token: token!, clientId: access.clientId, scopes: [SCOPE], extra: { origin } } });
    });
  } catch (error) {
    logServerError(`MCP connector ${mcpUrl(origin)}`, error);
    return Response.json({ jsonrpc: "2.0", error: { code: -32603, message: "CareerPilot couldn't answer that." }, id: null }, { status: 500 });
  }
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
