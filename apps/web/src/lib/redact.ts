// Keeping secrets out of the Activity Ledger. Assistants describe what they
// did in their own words, and sometimes paste a key or a token with it. The
// ledger is shown to people and kept in backups, so anything that looks like a
// credential is masked before it is written. This is best effort, not a
// guarantee: it catches the common shapes, and leaves ordinary text, URLs and
// commit ids alone.

const MASK = "[redacted]";

const PATTERNS: RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g, // PEM private keys
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g, // JWTs
  /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/gi, // bearer credentials
  /\bsk-[A-Za-z0-9_-]{16,}/g, // OpenAI- and Anthropic-style keys
  /\bcp_[A-Za-z0-9_-]{20,}/g, // CareerPilot API tokens
];

// name=value, name: value, "name": "value" where the name says it is a credential and the value is long enough to be one.
const NAMED = /\b((?:api[_-]?key|secret|token|passwd|password|authorization)["']?\s*[:=]\s*["']?)([^\s"',;)}\]]{8,})/gi;

const MAX_DEPTH = 8;

/** `text` with anything that looks like a credential replaced by "[redacted]". */
export function redactSecrets(text: string): string {
  let out = text;
  for (const pattern of PATTERNS) out = out.replace(pattern, MASK);
  return out.replace(NAMED, (_whole, name: string) => `${name}${MASK}`);
}

/** The same for every string inside a JSON value; numbers, booleans and structure are unchanged. Stops at a fixed depth. */
export function redactJson<T>(value: T, depth = 0): T {
  if (typeof value === "string") return redactSecrets(value) as T;
  if (depth >= MAX_DEPTH || value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map((item) => redactJson(item, depth + 1)) as T;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactJson(item, depth + 1)])) as T;
}
