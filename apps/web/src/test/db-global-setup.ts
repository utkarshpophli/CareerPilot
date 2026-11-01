import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";

import { testDatabaseUrl } from "./db";

const require = createRequire(import.meta.url);

/** Creates the test database if needed and applies all migrations, once per test run. */
export default function setup() {
  // Run Prisma's own entry point with this Node, so it works where `yarn` isn't on PATH (Windows).
  execFileSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
    stdio: "pipe",
  });
}
