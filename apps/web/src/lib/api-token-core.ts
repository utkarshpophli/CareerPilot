import { createHash, randomBytes } from "node:crypto";

// Making and hashing API tokens. No database and no server-only import, so
// the create-token script can use it too.

export const TOKEN_PREFIX = "cp_";
/** 32 random bytes: 256 bits, so a plain SHA-256 is enough to store (no password-style stretching needed). */
const TOKEN_BYTES = 32;

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function generateToken(): { token: string; hash: string; prefix: string } {
  const token = `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString("base64url")}`;
  return { token, hash: hashToken(token), prefix: token.slice(0, TOKEN_PREFIX.length + 6) };
}

/** The token from an "Authorization: Bearer …" header, if it looks like one of ours. */
export function bearerToken(header: string | null | undefined): string | null {
  const token = /^Bearer\s+(\S+)$/i.exec(header ?? "")?.[1];
  return token && token.startsWith(TOKEN_PREFIX) && token.length <= 200 ? token : null;
}

/** A token's name as shown and recorded: one short, printable line. */
export function cleanTokenName(name: string): string {
  return name.replace(/[^\p{L}\p{N} ._@/-]/gu, "").trim().slice(0, 60);
}
