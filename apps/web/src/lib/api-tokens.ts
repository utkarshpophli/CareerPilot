import "server-only";

import { ApiScope } from "@/generated/prisma/enums";

import { bearerToken, cleanTokenName, generateToken, hashToken } from "./api-token-core";
import { prisma } from "./prisma";

// API tokens for the REST API and the pilot CLI. Only a hash is stored.

export type TokenPrincipal = { id: string; name: string; scope: ApiScope };

/** How often a token's "last used" time is rewritten, so a busy client doesn't write on every request. */
const TOUCH_EVERY_MS = 60_000;

/** Makes a token. The token is returned once and cannot be read back. */
export async function createApiToken(name: string, scope: ApiScope): Promise<{ id: string; token: string }> {
  const cleaned = cleanTokenName(name);
  if (!cleaned) throw new Error("A token needs a name.");
  const { token, hash, prefix } = generateToken();
  const { id } = await prisma.apiToken.create({ data: { name: cleaned, tokenHash: hash, prefix, scope }, select: { id: true } });
  return { id, token };
}

/** The token's owner, or null when it is unknown or revoked. */
export async function verifyApiToken(header: string | null | undefined, now = new Date()): Promise<TokenPrincipal | null> {
  const token = bearerToken(header);
  if (!token) return null;
  const row = await prisma.apiToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!row || row.revokedAt) return null;
  if (!row.lastUsedAt || now.getTime() - row.lastUsedAt.getTime() > TOUCH_EVERY_MS) {
    await prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: now } }).catch(() => undefined);
  }
  return { id: row.id, name: row.name, scope: row.scope };
}

export const listApiTokens = () =>
  prisma.apiToken.findMany({
    select: { id: true, name: true, prefix: true, scope: true, createdAt: true, lastUsedAt: true, revokedAt: true },
    orderBy: { createdAt: "desc" },
  });

/** Stops a token working. Revoking twice is fine. */
export async function revokeApiToken(id: string, now = new Date()): Promise<boolean> {
  const { count } = await prisma.apiToken.updateMany({ where: { id, revokedAt: null }, data: { revokedAt: now } });
  return count > 0;
}

/** Whether a token's scope allows what a route needs. */
export const allows = (principal: TokenPrincipal, needed: ApiScope) => needed === ApiScope.READ || principal.scope === ApiScope.WRITE;

export type TokenRow = {
  id: string;
  name: string;
  prefix: string;
  scope: ApiScope;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

/** The tokens as plain data for the Settings page: no hash, times as ISO text. */
export async function apiTokenRows(): Promise<TokenRow[]> {
  return (await listApiTokens()).map((row) => ({ ...row, createdAt: row.createdAt.toISOString(), lastUsedAt: row.lastUsedAt?.toISOString() ?? null, revokedAt: row.revokedAt?.toISOString() ?? null }));
}
