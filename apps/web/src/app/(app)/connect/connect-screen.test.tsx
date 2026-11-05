import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConnectedAssistant } from "@/lib/connect/assistants";
import { copyText } from "@/lib/copy-text";

import { createToken, revokeToken } from "../settings/actions";

import { checkConnection, prepareOpenCode, refreshAssistants } from "./actions";
import { ConnectScreen } from "./connect-screen";

vi.mock("next/navigation", () => ({ usePathname: () => "/connect", useRouter: () => ({}), useSearchParams: () => new URLSearchParams() }));
vi.mock("../settings/actions", () => ({
  createToken: vi.fn(async () => ({ ok: true, data: { token: "cp_NEW-SECRET-TOKEN", tokens: [] } })),
  revokeToken: vi.fn(async () => ({ ok: true, data: { tokens: [] } })),
}));
vi.mock("./actions", () => ({
  prepareOpenCode: vi.fn(async () => ({ ok: true, data: { connectorOn: true, redirectAllowed: true } })),
  checkConnection: vi.fn(async () => ({ ok: true, data: { seen: [] } })),
  refreshAssistants: vi.fn(async () => ({ ok: true, data: { assistants: [] } })),
}));
vi.mock("@/components/toast", () => ({ toast: vi.fn(), toastResult: (result: unknown) => result }));
vi.mock("@/lib/copy-text", () => ({ copyText: vi.fn(async () => true) }));

const ORIGIN = "https://cp.example.com";
const assistant = (overrides: Partial<ConnectedAssistant>): ConnectedAssistant => ({
  key: "token:t1",
  via: "token",
  id: "t1",
  name: "claude-code",
  scope: "WRITE",
  lastSeenAt: "2026-11-02T10:00:00.000Z",
  callsToday: 3,
  runs: 2,
  revokable: true,
  ...overrides,
});

const show = (props: Partial<Parameters<typeof ConnectScreen>[0]> = {}) =>
  render(<ConnectScreen origin={ORIGIN} assistants={[]} connector={{ on: true, openCodeAllowed: true }} {...props} />);

beforeEach(() => vi.clearAllMocks());
afterEach(() => vi.useRealTimers());

describe("Connect: the tools", () => {
  it("shows the Claude Code commands filled in with this server's address", () => {
    show();
    expect(screen.getByLabelText("Add CareerPilot to Claude Code")).toHaveTextContent("claude mcp add --transport http careerpilot https://cp.example.com/api/mcp");
    expect(screen.getByText(/Checked with Claude Code 2\.1\.316 on 2026-11-02/)).toBeInTheDocument();
  });

  it("shows the OpenCode commands and an opencode.json, and says which sign-in address it uses", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("tab", { name: "OpenCode" }));
    expect(screen.getByLabelText("Add CareerPilot to OpenCode")).toHaveTextContent("opencode mcp add careerpilot --url https://cp.example.com/api/mcp");
    expect(screen.getByLabelText("Or put this in opencode.json in your project")).toHaveTextContent('"type": "remote"');
    expect(screen.getByText(/http:\/\/127\.0\.0\.1:19876\/mcp\/oauth\/callback/)).toBeInTheDocument();
    expect(screen.getByText(/Checked with OpenCode 1\.19\.4/)).toBeInTheDocument();
  });

  it("offers the REST and generic route on the third tab", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("tab", { name: /Other/ }));
    expect(screen.getByLabelText("Or call the REST API directly")).toHaveTextContent('curl -H "Authorization: Bearer <your token>" https://cp.example.com/api/v1/status');
  });

  it("copies a block with its button", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("button", { name: "Copy Add CareerPilot to Claude Code" }));
    expect(copyText).toHaveBeenCalledWith("claude mcp add --transport http careerpilot https://cp.example.com/api/mcp");
  });
});

describe("Connect: OpenCode needs the connector ready", () => {
  it("offers one button when the connector is off, and says ready afterwards", async () => {
    const user = userEvent.setup();
    show({ connector: { on: false, openCodeAllowed: false } });
    await user.click(screen.getByRole("tab", { name: "OpenCode" }));
    await user.click(screen.getByRole("button", { name: "Turn on the connector and allow OpenCode" }));
    expect(prepareOpenCode).toHaveBeenCalledOnce();
    expect(screen.getByText(/Ready: the connector is on/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Turn on the connector and allow OpenCode" })).not.toBeInTheDocument();
  });

  it("shows no button when it is ready already", async () => {
    const user = userEvent.setup();
    show();
    await user.click(screen.getByRole("tab", { name: "OpenCode" }));
    expect(screen.queryByRole("button", { name: /Turn on the connector/ })).not.toBeInTheDocument();
  });
});

describe("Connect: making a token", () => {
  it("asks for the password, shows the token once, and fills it into the commands", async () => {
    const user = userEvent.setup();
    show();
    await user.type(screen.getByLabelText("Name"), "claude-code on my laptop");
    await user.type(screen.getByLabelText("Your password"), "hunter2");
    await user.click(screen.getByRole("button", { name: "Make token" }));

    expect(createToken).toHaveBeenCalledWith({ name: "claude-code on my laptop", scope: "WRITE", password: "hunter2" });
    expect(screen.getByLabelText("Your password")).toHaveValue("");
    expect(screen.getByRole("status", { name: "New token" })).toHaveTextContent("it is not shown again");
    expect(screen.getByLabelText("Environment for the pilot command (macOS, Linux)")).toHaveTextContent("export CAREERPILOT_TOKEN='cp_NEW-SECRET-TOKEN'");
    expect(refreshAssistants).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Done, hide it" }));
    expect(document.body).not.toHaveTextContent("cp_NEW-SECRET-TOKEN");
    expect(screen.getByLabelText("Environment for the pilot command (macOS, Linux)")).toHaveTextContent("<your token>");
  });

  it("keeps nothing on the page when the server refuses (wrong password)", async () => {
    const user = userEvent.setup();
    vi.mocked(createToken).mockResolvedValueOnce({ ok: false, error: "That password isn't right." });
    show();
    await user.type(screen.getByLabelText("Name"), "x");
    await user.type(screen.getByLabelText("Your password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Make token" }));
    expect(screen.queryByText(/not shown again/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Your password")).toHaveValue("");
  });

  it("explains each scope in plain words, and that assistants can never send", async () => {
    const user = userEvent.setup();
    show();
    expect(screen.getByText(/It can never send or submit anything/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("It can"), "READ");
    expect(screen.getByText(/It cannot change anything/)).toBeInTheDocument();
  });
});

describe("Connect: test connection", () => {
  it("waits, polls, and shows the assistant that called", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    show();
    await user.click(screen.getByRole("button", { name: "Wait for the first call" }));
    expect(screen.getByText(/Listening. Nothing yet/)).toBeInTheDocument();

    await act(async () => vi.advanceTimersByTime(2100));
    expect(checkConnection).toHaveBeenCalledTimes(1);
    expect(vi.mocked(checkConnection).mock.calls[0]![0].since).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    vi.mocked(checkConnection).mockResolvedValueOnce({ ok: true, data: { seen: [assistant({})] } });
    await act(async () => vi.advanceTimersByTime(2100));
    await waitFor(() => expect(screen.getByText(/Connected: claude-code just called CareerPilot/)).toBeInTheDocument());
    expect(screen.queryByText(/Listening/)).not.toBeInTheDocument();
    // It stops asking once it has an answer.
    const calls = vi.mocked(checkConnection).mock.calls.length;
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(checkConnection).toHaveBeenCalledTimes(calls);
  });

  it("gives up after three minutes and says what to check", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    show();
    await user.click(screen.getByRole("button", { name: "Wait for the first call" }));
    await act(async () => vi.advanceTimersByTime(3 * 60_000 + 4000));
    await waitFor(() => expect(screen.getByText(/Nothing came in for three minutes/)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Wait for the first call" })).toBeEnabled();
  });

  it("stops asking when told to", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    show();
    await user.click(screen.getByRole("button", { name: "Wait for the first call" }));
    await user.click(screen.getByRole("button", { name: "Stop waiting" }));
    await act(async () => vi.advanceTimersByTime(10_000));
    expect(checkConnection).not.toHaveBeenCalled();
  });
});

describe("Connect: connected assistants", () => {
  it("lists tokens and MCP apps with last seen, actions and runs; only tokens can be revoked here", async () => {
    const user = userEvent.setup();
    show({ assistants: [assistant({}), assistant({ key: "mcp:abc", via: "mcp", id: "", name: "OpenCode", scope: null, callsToday: 0, runs: 0, revokable: false })] });
    const list = screen.getByRole("list", { name: "Connected assistants" });
    const [token, app] = within(list).getAllByRole("listitem");
    expect(token).toHaveTextContent("claude-code");
    expect(token).toHaveTextContent("3 actions today");
    expect(token).toHaveTextContent("2 runs");
    expect(app).toHaveTextContent("OpenCode");
    expect(app).toHaveTextContent("MCP");
    expect(within(app!).queryByRole("button", { name: /Revoke/ })).not.toBeInTheDocument();
    expect(app).toHaveTextContent("Sign out in Settings → MCP connector");

    await user.click(within(token!).getByRole("button", { name: "Revoke claude-code" }));
    expect(revokeToken).toHaveBeenCalledWith({ id: "t1" });
    expect(within(list).queryByText("claude-code")).not.toBeInTheDocument();
  });

  it("says 1 action and 1 run, not 1 actions", () => {
    show({ assistants: [assistant({ callsToday: 1, runs: 1 })] });
    const item = screen.getByRole("listitem");
    expect(item).toHaveTextContent("1 action today");
    expect(item).toHaveTextContent("1 run");
    expect(item).not.toHaveTextContent(/1 actions|1 runs/);
  });

  it("says so when there are none", () => {
    show();
    expect(screen.getByText(/None yet. Start with step 1/)).toBeInTheDocument();
  });
});
