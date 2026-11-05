import "server-only";

import { headers } from "next/headers";

import { env } from "@/lib/env";

/** The address this request came to (behind a reverse proxy, the forwarded one). */
export async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim() || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() || (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

/** The address to show for commands that reach this server: CAREERPILOT_PUBLIC_URL when set, else the address this request came to. */
export async function serverAddress(): Promise<string> {
  return env.CAREERPILOT_PUBLIC_URL ?? (await requestOrigin());
}
