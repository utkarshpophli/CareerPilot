import { describe, expect, it } from "vitest";

import { toolCallsIn } from "./tool-calls";

describe("toolCallsIn", () => {
  it("finds a tool call, keeping only its name", () => {
    expect(toolCallsIn({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search_jobs", arguments: { query: "secret" } } })).toEqual(["search_jobs"]);
  });

  it("finds each call in a batch and ignores other messages", () => {
    expect(
      toolCallsIn([
        { method: "initialize", params: {} },
        { method: "tools/call", params: { name: "a" } },
        { method: "tools/list" },
        { method: "tools/call", params: { name: "b" } },
      ]),
    ).toEqual(["a", "b"]);
  });

  it("ignores anything that is not a well-formed call", () => {
    expect(toolCallsIn(null)).toEqual([]);
    expect(toolCallsIn("tools/call")).toEqual([]);
    expect(toolCallsIn({ method: "tools/call" })).toEqual([]);
    expect(toolCallsIn({ method: "tools/call", params: { name: 5 } })).toEqual([]);
    expect(toolCallsIn({ method: "tools/call", params: { name: "x".repeat(200) } })).toEqual([]);
    expect(toolCallsIn({ method: "tools/call", params: { name: "has space\nnewline" } })).toEqual([]);
  });
});
