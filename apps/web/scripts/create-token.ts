// Makes an API token for the REST API and the pilot CLI, and prints it once.
//
//   yarn create-token "claude-code on my laptop" [read|write]
//
// The name is what the Activity page shows for everything the token does.
// Only a hash of the token is stored, so it can't be shown again: revoke it
// and make another if it is lost. Needs DATABASE_URL, as the app does.

import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";
import { cleanTokenName, generateToken } from "../src/lib/api-token-core";

const [nameArg, scopeArg = "read"] = process.argv.slice(2);
const name = cleanTokenName(nameArg ?? "");
const scope = scopeArg.toLowerCase() === "write" ? "WRITE" : scopeArg.toLowerCase() === "read" ? "READ" : null;
if (!name || !scope) {
  console.error('Usage: yarn create-token "<name>" [read|write]');
  process.exit(2);
}
if (!process.env.DATABASE_URL) {
  console.error("Set DATABASE_URL.");
  process.exit(2);
}

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const { token, hash, prefix } = generateToken();
  try {
    await db.apiToken.create({ data: { name, tokenHash: hash, prefix, scope: scope! } });
  } finally {
    await db.$disconnect();
  }
  console.error(`Made a ${scope!.toLowerCase()} token named "${name}". Keep it safe; it is shown only now:`);
  console.log(token);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message.split("\n", 1)[0] : "Could not make the token.");
  process.exit(1);
});
