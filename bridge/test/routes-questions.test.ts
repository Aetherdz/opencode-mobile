import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { BackendAdapter } from "../src/adapters/BackendAdapter.js";
import type { Config } from "../src/config.js";
import type { LoggerLike } from "../src/log.js";
import { OpenCodeError } from "../src/opencode/client.js";
import { PushService } from "../src/push.js";
import { registerRoutes } from "../src/routes/index.js";
import { SourceResolver } from "../src/sources.js";
import { RuntimeState } from "../src/state.js";
import type { OpenCodeEvent, RawForm } from "../src/types.js";
import { FileRegistry } from "../src/uploads.js";

const logger: LoggerLike = {
  info() {},
  warn() {},
  error() {},
  debug() {},
};

const roots: string[] = [];
const apps: FastifyInstance[] = [];
let sequence = 0;

function event(type: string, data: Record<string, unknown>): OpenCodeEvent {
  sequence += 1;
  return { id: `evt_${sequence}`, type, data };
}

function questionForm(id = "frm_1", sessionID = "ses_1"): RawForm {
  return {
    id,
    sessionID,
    title: "Implementation plan",
    metadata: { kind: "question" },
    fields: [
      {
        key: "q0",
        type: "string",
        title: "Approach",
        description: "How should I proceed?",
        options: [
          { value: "build", label: "Build" },
          { value: "test", label: "Test" },
        ],
      },
      {
        key: "q1",
        type: "multiselect",
        title: "Checks",
        required: false,
        options: [
          { value: "tests", label: "Tests" },
          { value: "lint", label: "Lint" },
        ],
      },
    ],
  };
}

interface Fixture {
  app: FastifyInstance;
  state: RuntimeState;
  adapter: {
    listSessions: ReturnType<typeof vi.fn>;
    listMessages: ReturnType<typeof vi.fn>;
    listModels: ReturnType<typeof vi.fn>;
    listSessionForms: ReturnType<typeof vi.fn>;
    replyForm: ReturnType<typeof vi.fn>;
    cancelForm: ReturnType<typeof vi.fn>;
    listPendingPermissions: ReturnType<typeof vi.fn>;
    replyPermission: ReturnType<typeof vi.fn>;
  };
}

async function makeFixture(): Promise<Fixture> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-routes-"));
  roots.push(root);
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-outside-"));
  roots.push(outside);

  const adapterMethods = {
    listSessions: vi.fn(async () => []),
    listMessages: vi.fn(async () => ({ data: [], cursor: {} })),
    listModels: vi.fn(async () => [
      { providerId: "p1", modelId: "m1", name: "Model One", providerName: "Provider One" },
    ]),
    listSessionForms: vi.fn(async () => [questionForm()]),
    replyForm: vi.fn(async () => undefined),
    cancelForm: vi.fn(async () => undefined),
    listPendingPermissions: vi.fn(async () => []),
    replyPermission: vi.fn(async () => undefined),
  };

  const adapter = {
    serverInfo: async () => ({ version: "test" }),
    getSession: async (id: string) => ({
      id,
      projectID: "proj_1",
      title: "Test",
      time: { created: 1, updated: 2 },
      location: { directory: id === "outside" ? outside : root },
    }),
    createSession: async () => {
      throw new Error("not used");
    },
    renameSession: async () => {},
    deleteSession: async () => {},
    sendPrompt: async () => ({ id: "msg_1" }),
    interrupt: async () => true,
    listSessionPermissions: async () => [],
    getDiff: async () => [],
    activeSessions: async () => ({}),
    events: async function* (): AsyncGenerator<OpenCodeEvent> {},
    ...adapterMethods,
  } as unknown as BackendAdapter;

  const config = {
    port: 0,
    host: "127.0.0.1",
    authToken: "t".repeat(64),
    opencode: { url: "http://127.0.0.1:1", password: "x" },
    allowedWorkdirs: [root],
    maxUploadBytes: 1024,
    maxUploadTotalBytes: 2048,
    maxFilesPerMessage: 2,
    allowedTypes: { mimes: new Set<string>(), extensions: new Set<string>() },
    dataDir: root,
    banAfter: 5,
    banMs: 1000,
    rateLimitPerMinute: 100,
    logLevel: "silent",
    pushEnabled: false,
  } as Config;

  const state = new RuntimeState();
  const files = new FileRegistry(path.join(root, "data"));
  const sources = new SourceResolver(adapter, state);
  const push = new PushService(root, logger, false);

  const app = Fastify();
  registerRoutes(app, { config, adapter, state, files, sources, push });
  apps.push(app);

  return { app, state, adapter: adapterMethods };
}

afterEach(async () => {
  while (apps.length > 0) {
    const app = apps.pop();
    if (app) await app.close();
  }
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("question routes", () => {
  it("requires explicit grant before opening an outside session and then allows chat history", async () => {
    const { app } = await makeFixture();

    const denied = await app.inject({ method: "GET", url: "/sessions/outside/messages" });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().code).toBe("outside_workdir");

    const grant = await app.inject({ method: "POST", url: "/sessions/outside/access", payload: {} });
    expect(grant.statusCode).toBe(200);
    expect(grant.json().data.sessionId).toBe("outside");
    expect(grant.json().data.limitation).toContain("not OS-sandboxed");

    const allowed = await app.inject({ method: "GET", url: "/sessions/outside/messages" });
    expect(allowed.statusCode).toBe(200);
  });

  it("omits archived sessions from the sessions list", async () => {
    const { app, adapter } = await makeFixture();
    adapter.listSessions.mockResolvedValue([
      {
        id: "active",
        projectID: "proj_1",
        title: "Active session",
        time: { created: 1, updated: 2 },
        location: { directory: "/workspace" },
      },
      {
        id: "archived",
        projectID: "proj_1",
        title: "Archived session",
        time: { created: 1, updated: 2, archived: 3 },
        location: { directory: "/workspace" },
      },
    ]);

    const response = await app.inject({ method: "GET", url: "/sessions" });
    expect(response.statusCode).toBe(200);
    expect(adapter.listSessions).toHaveBeenCalledWith({ limit: 200 });
    expect(response.json().data.map((session: { id: string }) => session.id)).toEqual(["active"]);
  });

  it("serves only safe model catalog fields", async () => {
    const { app } = await makeFixture();
    const response = await app.inject({ method: "GET", url: "/models" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ data: [
      { providerId: "p1", modelId: "m1", name: "Model One", providerName: "Provider One" },
    ] });
    expect(response.body).not.toContain("password");
    expect(response.body).not.toContain("headers");
  });

  it("lists pending question forms and records them in state", async () => {
    const { app, state } = await makeFixture();

    const response = await app.inject({ method: "GET", url: "/sessions/ses_1/questions" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      data: [
        {
          id: "frm_1",
          sessionId: "ses_1",
          title: "Implementation plan",
          questions: [
            { id: "q0", header: "Approach", multiple: false, required: true },
            { id: "q1", header: "Checks", multiple: true, required: false },
          ],
        },
      ],
    });
    expect(state.pendingQuestions("ses_1")).toHaveLength(1);
    expect(state.statusOf("ses_1").status).toBe("waiting_input");
  });

  it("validates answers before replying", async () => {
    const { app, adapter } = await makeFixture();
    await app.inject({ method: "GET", url: "/sessions/ses_1/questions" });

    const missing = await app.inject({
      method: "POST",
      url: "/questions/frm_1/reply",
      payload: { answers: [["build"]] },
    });
    expect(missing.statusCode).toBe(400);
    expect(missing.json()).toMatchObject({ error: "bad_request" });

    const tooMany = await app.inject({
      method: "POST",
      url: "/questions/frm_1/reply",
      payload: { answers: [["build", "test"], []] },
    });
    expect(tooMany.statusCode).toBe(400);

    const emptyRequired = await app.inject({
      method: "POST",
      url: "/questions/frm_1/reply",
      payload: { answers: [[], []] },
    });
    expect(emptyRequired.statusCode).toBe(400);
    expect(adapter.replyForm).not.toHaveBeenCalled();
  });

  it("replies with the mapped form answer and makes a repeat call idempotent", async () => {
    const { app, state, adapter } = await makeFixture();
    await app.inject({ method: "GET", url: "/sessions/ses_1/questions" });

    const first = await app.inject({
      method: "POST",
      url: "/questions/frm_1/reply",
      payload: { answers: [["build"], ["tests", "lint"]] },
    });
    expect(first.statusCode).toBe(200);
    expect(first.json()).toEqual({ ok: true });
    expect(adapter.replyForm).toHaveBeenCalledWith("ses_1", "frm_1", {
      q0: "build",
      q1: ["tests", "lint"],
    });
    expect(state.statusOf("ses_1").status).toBe("running");

    const second = await app.inject({
      method: "POST",
      url: "/questions/frm_1/reply",
      payload: { answers: [["build"], []] },
    });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ ok: true, alreadyResolved: true, status: "answered" });
    expect(adapter.replyForm).toHaveBeenCalledTimes(1);
  });

  it("treats an upstream 409 as already answered", async () => {
    const { app, state, adapter } = await makeFixture();
    await app.inject({ method: "GET", url: "/sessions/ses_1/questions" });
    adapter.replyForm.mockRejectedValueOnce(
      new OpenCodeError(409, "FormAlreadySettledError", "POST", "/form/frm_1/reply"),
    );

    const response = await app.inject({
      method: "POST",
      url: "/questions/frm_1/reply",
      payload: { answers: [["build"], []] },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, alreadyResolved: true });
    expect(state.findQuestion("frm_1")?.resolvedStatus).toBe("answered");
  });

  it("rejects a question and makes a repeat call idempotent", async () => {
    const { app, state, adapter } = await makeFixture();
    await app.inject({ method: "GET", url: "/sessions/ses_1/questions" });

    const first = await app.inject({
      method: "POST",
      url: "/questions/frm_1/reject",
      payload: { message: "Not now" },
    });
    expect(first.statusCode).toBe(200);
    expect(adapter.cancelForm).toHaveBeenCalledWith("ses_1", "frm_1", "Not now");
    expect(state.findQuestion("frm_1")?.resolvedStatus).toBe("rejected");

    const second = await app.inject({ method: "POST", url: "/questions/frm_1/reject" });
    expect(second.statusCode).toBe(200);
    expect(second.json()).toEqual({ ok: true, alreadyResolved: true, status: "rejected" });
    expect(adapter.cancelForm).toHaveBeenCalledTimes(1);
  });

  it("returns 404 for an unknown question", async () => {
    const { app } = await makeFixture();
    const response = await app.inject({
      method: "POST",
      url: "/questions/frm_missing/reply",
      payload: { answers: [["build"], []] },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "not_found" });
  });
});

describe("global permission route", () => {
  it("replies using the session tracked from permission.asked", async () => {
    const { app, state, adapter } = await makeFixture();
    state.apply(
      event("permission.asked", {
        sessionID: "ses_1",
        id: "per_1",
        action: "read",
        resources: ["/tmp/file"],
      }),
    );

    const response = await app.inject({
      method: "POST",
      url: "/permissions/per_1/reply",
      payload: { decision: "once" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    expect(adapter.replyPermission).toHaveBeenCalledWith("ses_1", "per_1", "once", undefined);
    expect(state.pendingApprovals("ses_1")).toEqual([]);
  });

  it("treats an upstream 404 as already resolved and a missing id as 404", async () => {
    const { app, state, adapter } = await makeFixture();
    state.apply(
      event("permission.asked", {
        sessionID: "ses_1",
        id: "per_2",
        action: "write",
        resources: ["/tmp/file"],
      }),
    );
    adapter.replyPermission.mockRejectedValueOnce(
      new OpenCodeError(404, "PermissionNotFoundError", "POST", "/permission/per_2/reply"),
    );

    const settled = await app.inject({
      method: "POST",
      url: "/permissions/per_2/reply",
      payload: { decision: "reject" },
    });
    expect(settled.statusCode).toBe(200);
    expect(settled.json()).toEqual({ ok: true, alreadyResolved: true });

    const missing = await app.inject({
      method: "POST",
      url: "/permissions/per_unknown/reply",
      payload: { decision: "once" },
    });
    expect(missing.statusCode).toBe(404);
  });
});
