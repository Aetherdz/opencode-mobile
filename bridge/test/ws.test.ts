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
import { SessionAccess } from "../src/sessionAccess.js";
import { toFileUri } from "../src/fileUri.js";
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
const promptCalls: Array<Record<string, unknown>> = [];
let modelCatalog = [{ providerId: "provider", modelId: "model", name: "Model", providerName: "Provider" }];
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
    sendPrompt: async (_id, input) => { promptCalls.push(input as unknown as Record<string, unknown>); return { id: "msg_1" }; },
    listModels: async () => modelCatalog,
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

async function makeFixture(options: { sessionDirectory?: string; workdirs?: string[]; access?: SessionAccess } = {}): Promise<{
  socket: FakeSocket;
  state: RuntimeState;
  internals: HubInternals;
}> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-ws-"));
  roots.push(root);
  promptCalls.length = 0;
  modelCatalog = [{ providerId: "provider", modelId: "model", name: "Model", providerName: "Provider" }];

  const state = new RuntimeState();
  const hub = new WsHub(
    fakeAdapter(options.sessionDirectory ?? root),
    state,
    new FileRegistry(path.join(root, "data")),
    logger,
    options.workdirs ?? [root],
    1024,
    10,
    undefined,
    options.access,
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
  it("resolves live attachment files from an explicitly granted outside session only", async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-ws-outside-"));
    roots.push(outside);
    const filePath = path.join(outside, "output.txt");
    fs.writeFileSync(filePath, "agent output");
    const access = new SessionAccess([]);
    expect(access.authorize({
      id: "ses_1",
      projectID: "proj_1",
      time: { created: 1, updated: 2 },
      location: { directory: outside },
    })).not.toBeNull();

    const { socket, internals } = await makeFixture({
      sessionDirectory: outside,
      workdirs: [],
      access,
    });

    internals.onUpstream(event("session.inbox.enqueued", {
      sessionID: "ses_1",
      inboxID: "inbox_outside",
      item: {
        type: "user",
        payload: {
          text: "here is the output",
          files: [{ source: { type: "uri", uri: toFileUri(filePath) } }],
        },
      },
    }));

    expect(sentEvents(socket)).toContainEqual(expect.objectContaining({
      type: "message.created",
      sessionId: "ses_1",
      message: expect.objectContaining({
        id: "inbox_outside",
        files: [expect.objectContaining({ name: "output.txt", url: expect.stringMatching(/^\/files\//) })],
      }),
    }));
  });

  it("passes an enabled model to OpenCode and rejects unavailable model selections", async () => {
    const { socket, internals } = await makeFixture();
    const model = { providerID: "provider", modelID: "model" };
    await internals.onClientMessage(socket as unknown as WebSocket, JSON.stringify({
      type: "message.send", sessionId: "ses_1", text: "hello", model,
    }));
    expect(promptCalls).toHaveLength(1);
    expect(promptCalls[0]?.model).toEqual(model);

    modelCatalog = [];
    socket.sent.length = 0;
    await internals.onClientMessage(socket as unknown as WebSocket, JSON.stringify({
      type: "message.send", sessionId: "ses_1", text: "hello", model, requestId: "req_local_test",
    }));
    expect(promptCalls).toHaveLength(1);
    expect(sentEvents(socket)).toContainEqual(expect.objectContaining({
      type: "error", code: "model_unavailable", requestId: "req_local_test",
    }));

    socket.sent.length = 0;
    await internals.onClientMessage(socket as unknown as WebSocket, JSON.stringify({
      type: "message.send", sessionId: "ses_1", text: "hello", model: { providerID: "", modelID: "model" },
    }));
    expect(promptCalls).toHaveLength(1);
    expect(sentEvents(socket)).toContainEqual(expect.objectContaining({ type: "error", code: "bad_event" }));
  });

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

  it("scopes permission and form requests and their resolutions to their session rooms", async () => {
    const { socket: first, state, internals } = await makeFixture();
    const second = fakeSocket();
    const hub = hubs[hubs.length - 1] as unknown as {
      attach(socket: WebSocket): void;
      onClientMessage(socket: WebSocket, raw: string): Promise<void>;
    };
    hub.attach(second as unknown as WebSocket);
    await hub.onClientMessage(
      second as unknown as WebSocket,
      JSON.stringify({ type: "subscribe", sessionId: "ses_2" }),
    );
    first.sent.length = 0;
    second.sent.length = 0;

    internals.onUpstream(
      event("permission.asked", {
        sessionID: "ses_1",
        id: "per_scoped",
        action: "read",
        resources: ["/tmp/one"],
      }),
    );
    internals.onUpstream(
      event("form.created", {
        sessionID: "ses_2",
        form: {
          id: "frm_scoped",
          sessionID: "ses_2",
          title: "Question",
          metadata: { kind: "question" },
          fields: [{ key: "q0", type: "string", title: "Answer" }],
        },
      }),
    );

    expect(sentEvents(first)).toContainEqual(
      expect.objectContaining({ type: "approval.request", sessionId: "ses_1", request: expect.objectContaining({ id: "per_scoped" }) }),
    );
    expect(sentEvents(first).some((message) => message.type === "question.request")).toBe(false);
    expect(sentEvents(second)).toContainEqual(
      expect.objectContaining({ type: "question.request", sessionId: "ses_2", question: expect.objectContaining({ id: "frm_scoped" }) }),
    );
    expect(sentEvents(second).some((message) => message.type === "approval.request")).toBe(false);
    expect(state.pendingApprovals("ses_1")).toEqual(["per_scoped"]);
    expect(state.pendingApprovals("ses_2")).toEqual([]);
    expect(state.pendingQuestions("ses_1")).toEqual([]);
    expect(state.pendingQuestions("ses_2")).toHaveLength(1);

    first.sent.length = 0;
    second.sent.length = 0;
    internals.onUpstream(event("permission.replied", { sessionID: "ses_1", id: "per_scoped" }));
    internals.onUpstream(event("form.replied", { sessionID: "ses_2", id: "frm_scoped" }));
    expect(sentEvents(first)).toContainEqual(
      expect.objectContaining({ type: "approval.resolved", sessionId: "ses_1", requestId: "per_scoped" }),
    );
    expect(sentEvents(first).some((message) => message.type === "question.resolved")).toBe(false);
    expect(sentEvents(second)).toContainEqual(
      expect.objectContaining({ type: "question.resolved", sessionId: "ses_2", questionId: "frm_scoped", status: "answered" }),
    );
    expect(sentEvents(second).some((message) => message.type === "approval.resolved")).toBe(false);
    expect(state.pendingApprovals("ses_1")).toEqual([]);
    expect(state.pendingQuestions("ses_2")).toEqual([]);
    expect(state.findQuestion("frm_scoped")).toMatchObject({ sessionId: "ses_2", question: null, resolvedStatus: "answered" });
  });
});
