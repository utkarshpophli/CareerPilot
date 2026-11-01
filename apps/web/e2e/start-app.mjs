// Starts the production build for the end-to-end tests, the same on every
// platform: applies the migrations, copies the static files the standalone
// server does not copy itself, then runs the server in this process tree. The
// old one-line shell command needed `yarn` and `cp`, which a Windows shell
// does not have.

import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const migrate = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "migrate", "deploy"], { stdio: "inherit", env: process.env });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

if (!existsSync(".next/standalone/server.js")) {
  console.error("No production build found. Run `yarn build` first.");
  process.exit(1);
}
cpSync("public", ".next/standalone/public", { recursive: true });
cpSync(".next/static", ".next/standalone/.next/static", { recursive: true });

const server = spawn(process.execPath, [".next/standalone/server.js"], { stdio: "inherit", env: process.env });
server.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
