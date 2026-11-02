import { BoardError } from "./types";

// The one place board sources touch the network (ADR 0003). A slug comes from
// the owner or an assistant, so it is input: the address is built from a fixed
// host list and a validated, encoded slug, redirects are refused, and time and
// size are limited. That is what keeps a slug from pointing the server at an
// internal address.

const DEFAULT_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
const MAX_RETRY_WAIT_MS = 10_000;

/** A board slug: letters, digits, dot, underscore and hyphen, starting with a letter or digit. */
export const validSlug = (slug: string) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(slug);

export type BoardRequest = {
  /** The only hosts that may be requested. */
  hosts: readonly string[];
  timeoutMs?: number;
  maxBytes?: number;
  /** Extra tries after a timeout, a busy answer (429) or a server error (5xx). A missing board or a bad key is never retried. */
  retries?: number;
  backoffMs?: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** The URL if it is https on an allowed host with no credentials; else a "refused" error before anything is sent. */
function allowed(address: string, hosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    throw new BoardError("refused", "That is not a web address this source can read.", `bad url`);
  }
  if (url.protocol !== "https:" || url.username || url.password || !hosts.includes(url.hostname)) {
    throw new BoardError("refused", "That address is not on this source's own site.", `refused ${url.protocol}//${url.hostname}`);
  }
  return url;
}

async function readLimited(response: Response, limit: number): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** GETs JSON from an allowed host. Every failure is a BoardError whose message is safe to show. */
export async function requestBoardJson(address: string, options: BoardRequest): Promise<unknown> {
  const url = allowed(address, options.hosts);
  const { timeoutMs = DEFAULT_TIMEOUT_MS, maxBytes = DEFAULT_MAX_BYTES, retries = 0, backoffMs = 500, signal, fetchImpl = fetch, sleep = wait } = options;

  for (let attempt = 0; ; attempt++) {
    const timeout = AbortSignal.timeout(timeoutMs);
    let response: Response | undefined;
    let failure: BoardError | undefined;
    let retryAfterMs: number | undefined;
    try {
      response = await fetchImpl(url, { headers: { accept: "application/json" }, redirect: "error", cache: "no-store", signal: signal ? AbortSignal.any([signal, timeout]) : timeout });
    } catch (error) {
      const reason = timeout.aborted ? "timed out" : ((error as { cause?: { code?: string } }).cause?.code ?? "request failed");
      failure = new BoardError("unavailable", "The source did not answer. Try again later.", `${url.pathname}: ${reason}`);
    }

    if (response) {
      const detail = `${url.pathname}: HTTP ${response.status}`;
      if (response.status === 404 || response.status === 410) throw new BoardError("not-found", "The source has no such board. Check the name.", detail);
      if (response.status === 401 || response.status === 403) throw new BoardError("refused", "The source does not let this board be read.", detail);
      if (response.status === 429) {
        const header = Number(response.headers.get("retry-after"));
        retryAfterMs = Number.isFinite(header) && header > 0 ? Math.min(header * 1000, MAX_RETRY_WAIT_MS) : undefined;
        failure = new BoardError("quota", "The source is asking us to slow down. Try again in a few minutes.", detail);
      } else if (response.status >= 500) {
        failure = new BoardError("unavailable", "The source is having trouble. Try again later.", detail);
      } else if (!response.ok) {
        throw new BoardError("changed", "The source answered in a way this version does not understand.", detail);
      } else {
        const text = await readLimited(response, maxBytes);
        if (text === null) throw new BoardError("changed", "The board is larger than this version reads.", `${url.pathname}: over ${maxBytes} bytes`);
        try {
          return JSON.parse(text) as unknown;
        } catch {
          throw new BoardError("changed", "The source answered with something that is not a job list.", `${url.pathname}: not JSON`);
        }
      }
    }

    if (attempt >= retries || signal?.aborted) throw failure!;
    await sleep(retryAfterMs ?? backoffMs * 2 ** attempt);
  }
}
