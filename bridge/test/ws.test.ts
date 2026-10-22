import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { WebSocket } from "ws";
import { afterEach, describe, expect, it } from "vitest";
import type { BackendAdapter } from "../src/adapters/BackendAdapter.js";
import type { LoggerLike } from "../src/log.js";
import { RuntimeState } from "../src/state.js";
import type { OpenCodeEvent, RawSession, ServerWsEvent } from "../src/types.js";
import { FileRegistry } from "../src/uploads.js";
import { WsHub } from "../src/ws.js";

interface FakeSocket {
  readyState: number;
  sent: string[];
  handlers: Map<string, (...args: unknown[]) => void>;
  send(payload: string): void;
  on(event: string, handler: (...args: unknown[]) => void): void;
  close(): void;
}

interface HubInternals {
  onClientMessage(socket: WebSocket, raw: string): Promise<void>;
  onUpstream(event: OpenCodeEvent): void;
}

const logger: LoggerLike = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const roots: string[] = [];
const hubs: WsHub[] = [];
let sequence = 0;

function event(type: string, data: Record<string, unknown>): OpenCodeEvent {
  sequence += 1;
  return { id: `evt_${sequence}`, type, data };
}

function fakeSocket(): FakeSocket {
  return {
    readyState: 1,
    sent: [],
    handlers: new Map(),
    send(payload: string) {
      this.sent.push(payload);
    },
    on(name: string, handler: (...args: unknown[]) => void) {
      this.handlers.set(name, handler);
    },
    close() {},
  };
}

function fakeAdapter(workdir: string): BackendAdapter {
  const session: RawSession = {
    id: "ses_1",
    projectID: "proj_1",
    title: "Test session",
    time: { created: 1, updated: 2 },
    location: { directory: workdir },
  };

  return {
    serverInfo: async () => ({ version: "test" }),
    listSessions: async () => [],
    getSession: async (id) => ({ ...session, id }),
    createSession: async () => session,
    renameSession: async () => {},
    deleteSession: async () => {},
    listMessages: async () => ({ data: [], cursor: {} }),
    sendPrompt: async () => ({ id: "msg_1" }),
    interrupt: async () => true,
    listPendingPermissions: async () => [],
    listSessionPermissions: async () => [],
    listSessionForms: async () => [],
    replyForm: async () => {},
    cancelForm: async () => {},
    replyPermission: async () => {},
    getDiff: async () => [],
    activeSessions: async () => ({}),
    events: async function* (): AsyncGenerator<OpenCodeEvent> {},
  };
}

function sentEvents(socket: FakeSocket): Array<ServerWsEvent & { eventId?: string }> {
  return socket.sent.map((raw) => JSON.parse(raw) as ServerWsEvent & { eventId?: string });
}

async function makeFixture(): Promise<{
  socket: FakeSocket;
  state: RuntimeState;
  internals: HubInternals;
}> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-ws-"));
  roots.push(root);

  const state = new RuntimeState();
  const hub = new WsHub(
    fakeAdapter(root),
    state,
    new FileRegistry(path.join(root, "data")),
    logger,
    [root],
    1024,
    10,
  );
  hubs.push(hub);

  const socket = fakeSocket();
  hub.attach(socket as unknown as WebSocket);

  const internals = hub as unknown as HubInternals;
  await internals.onClientMessage(
    socket as unknown as WebSocket,
    JSON.stringify({ type: "subscribe", sessionId: "ses_1" }),
  );
  socket.sent.length = 0;

  return { socket, state, internals };
}

afterEach(async () => {
  while (hubs.length > 0) {
    const hub = hubs.pop();
    if (hub) await hub.stop();
  }
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("WsHub upstream mapping", () => {
  it("emits status and message.created for execution and inbox events", async () => {
    const { socket, state, internals } = await makeFixture();

    internals.onUpstream(event("session.execution.started", { sessionID: "ses_1" }));
    const started = sentEvents(socket);
    expect(started).toContainEqual(
      expect.objectContaining({ type: "status", sessionId: "ses_1", status: "running" }),
    );
    expect(started.every((entry) => typeof entry.eventId === "string")).toBe(true);

    socket.sent.length = 0;
    internals.onUpstream(
      event("session.inbox.enqueued", {
        sessionID: "ses_1",
        inboxID: "inbox_1",
        item: {
          type: "user",
          payload: { text: "hello from telegram", metadata: { source: "telegram" } },
        },
      }),
    );

    expect(sentEvents(socket)).toContainEqual(
      expect.objectContaining({
        type: "message.created",
        sessionId: "ses_1",
        message: expect.objectContaining({
          id: "inbox_1",
          role: "user",
          text: "hello from telegram",
          source: "telegram",
        }),
      }),
    );
    expect(state.sourceOf("ses_1")).toBe("telegram");
    expect(state.statusOf("ses_1")).toMatchObject({
      status: "running",
      busyOrigin: "telegram",
    });
  });

  it("emits output.chunk and tool.summary for text and tool events", async () => {
    const { socket, internals } = await makeFixture();

    internals.onUpstream(
      event("session.text.delta", {
        sessionID: "ses_1",
        assistantMessageID: "msg_a",
        delta: "Hi",
        ordinal: 2,
      }),
    );
    expect(sentEvents(socket)).toContainEqual(
      expect.objectContaining({
        type: "output.chunk",
        sessionId: "ses_1",
        messageId: "msg_a",
        ordinal: 2,
        delta: "Hi",
        channel: "text",
      }),
    );

    socket.sent.length = 0;
    internals.onUpstream(
      event("session.tool.success", {
        sessionID: "ses_1",
        assistantMessageID: "msg_a",
        id: "tool_1",
        name: "bash",
        input: { command: "npm test" },
        metadata: { title: "Run tests" },
      }),
    );
    expect(sentEvents(socket)).toContainEqual(
      expect.objectContaining({
        type: "tool.summary",
        sessionId: "ses_1",
        messageId: "msg_a",
        activity: {
          id: "tool_1",
          name: "bash",
          title: "Run tests",
          status: "done",
          detail: "npm test",
        },
      }),
    );
  });

  it("emits approval.request, status transitions and approval.resolved", async () => {
    const { socket, state, internals } = await makeFixture();

    internals.onUpstream(
      event("permission.asked", {
        sessionID: "ses_1",
        id: "per_1",
        action: "read",
        resources: ["/tmp/file"],
      }),
    );

    let sent = sentEvents(socket);
    expect(sent).toContainEqual(
      expect.objectContaining({ type: "status", sessionId: "ses_1", status: "needs_approval" }),
    );
    expect(sent).toContainEqual(
      expect.objectContaining({
        type: "approval.request",
        sessionId: "ses_1",
        request: {
          id: "per_1",
          sessionId: "ses_1",
          action: "read",
          resources: ["/tmp/file"],
        },
      }),
    );
    expect(state.pendingApprovals("ses_1")).toEqual(["per_1"]);

    socket.sent.length = 0;
    internals.onUpstream(
      event("permission.replied", {
        sessionID: "ses_1",
        id: "per_1",
        decision: "once",
      }),
    );

    sent = sentEvents(socket);
    expect(sent).toContainEqual(
      expect.objectContaining({ type: "status", sessionId: "ses_1", status: "running" }),
    );
    expect(sent).toContainEqual(
      expect.objectContaining({
        type: "approval.resolved",
        sessionId: "ses_1",
        requestId: "per_1",
        decision: "once",
      }),
    );
    expect(state.pendingApprovals("ses_1")).toEqual([]);
  });

  it("broadcasts question.request, waiting_input, and question.resolved", async () => {
    const { socket, state, internals } = await makeFixture();

    internals.onUpstream(
      event("form.created", {
        sessionID: "ses_1",
        form: {
          id: "frm_1",
          sessionID: "ses_1",
          title: "Plan",
          metadata: { kind: "question" },
          fields: [
            {
              key: "q0",
              type: "string",
              title: "Approach",
              description: "How should I proceed?",
              options: [{ value: "build", label: "Build" }],
            },
          ],
        },
      }),
    );

    let sent = sentEvents(socket);
    expect(sent).toContainEqual(
      expect.objectContaining({ type: "status", sessionId: "ses_1", status: "waiting_input" }),
    );
    expect(sent).toContainEqual(
      expect.objectContaining({
        type: "question.request",
        sessionId: "ses_1",
        question: expect.objectContaining({
          id: "frm_1",
          title: "Plan",
          questions: [
            expect.objectContaining({
              id: "q0",
              header: "Approach",
              question: "How should I proceed?",
              multiple: false,
              allowCustom: false,
            }),
          ],
        }),
      }),
    );
    expect(state.pendingQuestions("ses_1")).toHaveLength(1);

    socket.sent.length = 0;
    internals.onUpstream(event("form.replied", { sessionID: "ses_1", id: "frm_1" }));

    sent = sentEvents(socket);
    expect(sent).toContainEqual(
      expect.objectContaining({ type: "status", sessionId: "ses_1", status: "running" }),
    );
    expect(sent).toContainEqual(
      expect.objectContaining({
        type: "question.resolved",
        sessionId: "ses_1",
        questionId: "frm_1",
        status: "answered",
      }),
    );
    expect(state.pendingQuestions("ses_1")).toEqual([]);
  });

  it("broadcasts a rejected question when the form is cancelled", async () => {
    const { socket, internals } = await makeFixture();

    internals.onUpstream(
      event("form.cancelled", {
        sessionID: "ses_1",
        form: {
          id: "frm_2",
          sessionID: "ses_1",
          title: "Plan",
          metadata: { kind: "question" },
          fields: [{ key: "q0", type: "string", title: "Approach" }],
        },
      }),
    );

    expect(sentEvents(socket)).toContainEqual(
      expect.objectContaining({
        type: "question.resolved",
        sessionId: "ses_1",
        questionId: "frm_2",
        status: "rejected",
      }),
    );
  });
});
