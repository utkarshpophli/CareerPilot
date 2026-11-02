import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Audit A-01: the development compose file published Postgres (default password)
// and the app on every network interface. Both compose files may only publish
// ports on the loopback address, and never carry a default password outside
// the development file.

const read = (name: string) => readFileSync(join(process.cwd(), name), "utf8");

/** Every `- "host:container"` entry that sits under a `ports:` key. */
function publishedPorts(compose: string): string[] {
  const lines = compose.split(/\r?\n/);
  const found: string[] = [];
  let portsIndent = -1;
  for (const line of lines) {
    const indent = line.length - line.trimStart().length;
    if (/^\s*ports:\s*$/.test(line)) {
      portsIndent = indent;
      continue;
    }
    if (portsIndent >= 0) {
      const entry = /^\s*-\s*["']?([^"'#\s]+)["']?/.exec(line);
      if (indent > portsIndent && entry) found.push(entry[1]!);
      else if (line.trim() && indent <= portsIndent) portsIndent = -1;
    }
  }
  return found;
}

describe.each(["compose.yml", "compose.production.yml"])("%s", (file) => {
  it("publishes ports on the loopback address only", () => {
    const ports = publishedPorts(read(file));
    for (const port of ports) expect(port, `${file}: ${port}`).toMatch(/^127\.0\.0\.1:/);
  });
});

describe("the default database password", () => {
  it("exists only in the development file, which says it is for development", () => {
    expect(read("compose.yml")).toMatch(/DEVELOPMENT ONLY/);
    expect(read("compose.production.yml")).not.toMatch(/POSTGRES_PASSWORD:-/);
  });

  it("is required (no fallback) in production", () => {
    expect(read("compose.production.yml")).toMatch(/POSTGRES_PASSWORD:\?/);
  });
});

describe("publishedPorts", () => {
  it("finds ports under a ports key and nothing else", () => {
    const sample = ['services:', '  db:', '    ports:', '      - "5432:5432"', '      - 127.0.0.1:5433:5432', '    volumes:', '      - data:/var/lib', ''].join("\n");
    expect(publishedPorts(sample)).toEqual(["5432:5432", "127.0.0.1:5433:5432"]);
  });
});

// The production image runs ./start.sh as its command. The node base image's entrypoint runs any command that is
// a file without the executable bit as `node ./start.sh`, which reads the shell script as JavaScript and stops with
// a SyntaxError on its first comment line. The first real CI run of the image found this: git had the file as 100644
// and a Windows checkout cannot be relied on to keep the bit, so the Dockerfile sets it itself.
describe("the production image's start script", () => {
  it("is copied in executable, whatever mode the checkout gave it", () => {
    const copy = read("Dockerfile")
      .split(/\r?\n/)
      .find((line) => /^COPY\b.*docker\/start\.sh/.test(line));
    expect(copy, "the Dockerfile copies docker/start.sh").toBeDefined();
    expect(copy).toMatch(/--chmod=0?7[0-7][0-7]/);
  });

  it("is the command, as a path the entrypoint can run", () => {
    expect(read("Dockerfile")).toMatch(/^CMD \["\.\/start\.sh"\]$/m);
  });
});
