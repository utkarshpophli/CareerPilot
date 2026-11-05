import type { Metadata } from "next";

import { listConnectedAssistants } from "@/lib/connect/assistants";
import { startOfDay } from "@/lib/connect/day";
import { OPENCODE_REDIRECT_URI, safeOrigin } from "@/lib/connect/instructions";
import { prisma } from "@/lib/prisma";
import { serverAddress } from "@/lib/request-origin";
import { loadSettings } from "@/lib/settings-data";
import { lastKnownTimeZone } from "@/lib/time-zone";

import { ConnectScreen } from "./connect-screen";

export const metadata: Metadata = { title: "Connect an assistant" };

/** One place to connect Claude Code, OpenCode or any other assistant, and to see that it works. */
export default async function ConnectPage() {
  const [settings, address, zone] = await Promise.all([loadSettings(), serverAddress(), lastKnownTimeZone()]);
  return (
    <ConnectScreen
      origin={safeOrigin(address)}
      assistants={await listConnectedAssistants(prisma, startOfDay(new Date(), zone))}
      connector={{ on: settings.connectorEnabledAt !== null, openCodeAllowed: settings.connectorRedirects.includes(OPENCODE_REDIRECT_URI) }}
    />
  );
}
