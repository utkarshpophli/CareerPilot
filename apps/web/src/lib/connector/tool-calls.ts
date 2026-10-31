// Which tools an MCP request calls, for the Activity Ledger. Only the tool's
// name is kept: arguments can hold profile details or whole postings.

const NAME = /^[A-Za-z0-9_.-]{1,64}$/;

/** The names of the tools called by a JSON-RPC body (one message or a batch); anything else gives none. */
export function toolCallsIn(body: unknown): string[] {
  const messages = Array.isArray(body) ? body : [body];
  const names: string[] = [];
  for (const message of messages) {
    if (typeof message !== "object" || message === null) continue;
    const { method, params } = message as { method?: unknown; params?: unknown };
    if (method !== "tools/call" || typeof params !== "object" || params === null) continue;
    const name = (params as { name?: unknown }).name;
    if (typeof name === "string" && NAME.test(name)) names.push(name);
  }
  return names;
}
