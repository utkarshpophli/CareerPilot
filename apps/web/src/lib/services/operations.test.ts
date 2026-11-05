import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

import { NOT_OPERATIONS, OPERATIONS, operationTable, TABLE_END, TABLE_START } from "./operations";

// The doors (REST, the pilot CLI, MCP) must all reach the same service for the
// same operation. These tests read the doors' source, so a door that stops
// calling its service, or a new door nobody listed, fails here.

const root = join(__dirname, "..", "..", "..");
const src = join(root, "src");
// Windows checks files out with CRLF line endings; what is compared and scanned here is not about line endings.
const read = (path: string) => readFileSync(path, "utf8").replace(/\r\n/g, "\n");
const tools = read(join(src, "lib", "connector", "tools.ts"));
const pilot = read(join(root, "..", "cli", "pilot.mjs"));
const docs = read(join(root, "..", "..", "docs", "AGENTS.md"));

const routeFile = (path: string) => join(src, "app", path.replace(/\{(\w+)\}/g, "[$1]"), "route.ts");

/** The code of one registered MCP tool, up to the next one. */
function toolBlock(name: string): string {
  const start = tools.indexOf(`registerTool(\n    "${name}"`);
  if (start < 0) return "";
  const next = tools.indexOf("server.registerTool(", start + 10);
  return tools.slice(start, next < 0 ? undefined : next);
}

describe("every operation reaches the same service through each of its doors", () => {
  for (const operation of OPERATIONS) {
    describe(operation.id, () => {
      it("is called by its REST route", () => {
        if (!operation.rest) return;
        const source = read(routeFile(operation.rest.path));
        expect(source, "the route must import the service layer").toMatch(/@\/lib\/services\//);
        expect(source, `the route must call ${operation.service}`).toContain(`${operation.service}(`);
        expect(source).toContain(`export const ${operation.rest.method} =`);
      });

      it("is called by its MCP tool", () => {
        if (!operation.mcp) return;
        const block = toolBlock(operation.mcp);
        expect(block, `tool ${operation.mcp} is not registered`).not.toBe("");
        expect(block, `the tool must call ${operation.mcpCalls ?? operation.service}`).toContain(`${operation.mcpCalls ?? operation.service}(`);
        if (operation.mcpCalls) expect(tools, `${operation.mcpCalls} must reach ${operation.service}`).toContain(`${operation.service}(`);
      });

      it("is reached by its CLI command through the same REST route", () => {
        if (!operation.cli) return;
        expect(operation.rest, "a CLI command goes through REST").toBeTruthy();
        const command = operation.cli.command.split(" ")[0]!;
        expect(pilot).toContain(`command === "${command}"`);
        expect(pilot).toContain(operation.cli.calls);
      });

      it("explains every door it does not have", () => {
        for (const door of ["rest", "cli", "mcp"] as const) {
          if (!operation[door]) expect(operation.gaps?.[door], `${operation.id} has no ${door} door and no reason`).toMatch(/\S+\s+\S+\s+\S+\s+\S+/);
        }
      });
    });
  }
});

describe("nothing is a door that nobody listed", () => {
  const registeredRoutes = new Set(OPERATIONS.flatMap((operation) => (operation.rest ? [`${operation.rest.method} ${operation.rest.path}`] : [])));

  function routes(dir: string): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return routes(path);
      return entry.name === "route.ts" ? [path] : [];
    });
  }

  it("lists every REST route as an operation or as something that is not one", () => {
    const found: string[] = [];
    for (const file of routes(join(src, "app", "api", "v1"))) {
      const path = "/" + relative(src, file).replace(/\\/g, "/").replace(/^app\//, "").replace(/\/route\.ts$/, "").replace(/\[(\w+)\]/g, "{$1}");
      for (const match of read(file).matchAll(/export const (GET|POST|PATCH|PUT|DELETE) =/g)) found.push(`${match[1]} ${path}`);
    }
    const known = new Set([...registeredRoutes, ...NOT_OPERATIONS.rest]);
    expect(found.filter((route) => !known.has(route)), "a REST route that is neither an operation nor listed as not one").toEqual([]);
    expect([...known].filter((route) => !found.includes(route)), "a listed route that does not exist").toEqual([]);
  });

  it("lists every MCP tool as an operation or as something that is not one", () => {
    const registered = [...tools.matchAll(/registerTool\(\n\s+"(\w+)"/g)].map((match) => match[1]!);
    const known = new Set([...OPERATIONS.flatMap((operation) => (operation.mcp ? [operation.mcp] : [])), ...NOT_OPERATIONS.mcp]);
    expect(registered.filter((name) => !known.has(name))).toEqual([]);
    expect([...known].filter((name) => !registered.includes(name))).toEqual([]);
  });
});

describe("the table in docs/AGENTS.md", () => {
  it("is the registry, word for word (run the test with the table's new text to update it)", () => {
    const start = docs.indexOf(TABLE_START);
    const end = docs.indexOf(TABLE_END);
    expect(start, "the table markers are missing from docs/AGENTS.md").toBeGreaterThan(-1);
    expect(docs.slice(start + TABLE_START.length, end).trim()).toBe(operationTable().trim());
  });
});
