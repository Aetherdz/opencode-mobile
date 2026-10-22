import Fastify, { type FastifyError, type FastifyInstance } from "fastify";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import { pinoOptions } from "./log.js";
import type { Config } from "./config.js";
import { OpenCodeAdapter } from "./adapters/OpenCodeAdapter.js";
import { AuthGuard, bearerFromRequest, registerAuth } from "./auth.js";
import { registerCors } from "./cors.js";
import { FileRegistry } from "./uploads.js";
import { RuntimeState } from "./state.js";
import { SourceResolver } from "./sources.js";
import { WsHub } from "./ws.js";
import { registerRoutes } from "./routes/index.js";
import { PushService } from "./push.js";
import { mapQuestion } from "./mapping.js";
import type { QuestionRequest } from "./types.js";

export interface BuiltServer {
  app: FastifyInstance;
  hub: WsHub;
  close(): Promise<void>;
}

export async function buildServer(config: Config): Promise<BuiltServer> {
  const app = Fastify({
    logger: pinoOptions(config.logLevel),
    bodyLimit: 1_000_000,
    trustProxy: false,
    disableRequestLogging: true,
  });

  const guard = new AuthGuard(config.authToken, config.banAfter, config.banMs);
  await app.register(rateLimit, {
    max: config.rateLimitPerMinute,
    timeWindow: "1 minute",
    // Never let an unauthenticated flood produce 429s for a valid owner.
    allowList: (request) => guard.check(bearerFromRequest(request)),
  });
  await app.register(multipart, {
    limits: {
      fileSize: config.maxUploadBytes,
      files: config.maxFilesPerMessage,
      fields: 10,
    },
  });
  await app.register(websocket, {
    options: { maxPayload: 1_000_000 },
  });

  const adapter = OpenCodeAdapter.fromService(config.opencode);
  const state = new RuntimeState();
  const files = new FileRegistry(config.dataDir);
  const sources = new SourceResolver(adapter, state);
  const push = new PushService(config.dataDir, app.log, config.pushEnabled);
  const hub = new WsHub(
    adapter,
    state,
    files,
    app.log,
    config.allowedWorkdirs,
    config.maxUploadBytes * 4,
    config.maxFilesPerMessage,
    push,
  );

  registerCors(app, config.corsOrigins);

  const authenticate = registerAuth(app, guard, config.corsOrigins);

  // Authenticate before body parsing. The WebSocket route keeps its
  // preValidation hook because it authenticates a short-lived, one-time
  // ticket (browsers and React Native cannot attach headers to the upgrade).
  app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS") return;
    if (request.routeOptions.url === "/health") return;
    if (request.routeOptions.url === "/ws") return;
    await authenticate(request, reply);
  });

  registerRoutes(app, { config, adapter, state, files, sources, push });

  app.post("/ws-ticket", async () => guard.issueWsTicket());

  app.get("/ws", { websocket: true, preValidation: authenticate }, (socket) => {
    hub.attach(socket);
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.statusCode && error.statusCode < 500) {
      reply.code(error.statusCode).send({
        code: "bad_request",
        error: "bad_request",
        message: error.message,
      });
      return;
    }
    request.log.error({ err: error }, "request failed");
    reply.code(500).send({
      code: "internal_error",
      error: "internal_error",
      message: "Internal server error.",
    });
  });

  app.setNotFoundHandler((request, reply) => {
    // Never log the raw URL here: a stray ?token= on an unknown path must not
    // end up in the bridge log.
    request.log.warn({ method: request.method }, "route not found");
    reply.code(404).send({ code: "not_found", error: "not_found", message: "Not found." });
  });

  app.addHook("onSend", async (_request, reply, payload) => {
    reply.header("x-content-type-options", "nosniff");
    reply.header("referrer-policy", "no-referrer");
    reply.header("x-frame-options", "DENY");
    return payload;
  });

  const info = await adapter.serverInfo().catch(() => null);
  if (!info) {
    app.log.warn("OpenCode service is not reachable; bridge will keep retrying on requests");
  } else {
    app.log.info({ version: info.version }, "connected to OpenCode");
  }

  hub.start();

  const reconcileInputs = async (): Promise<void> => {
    const active = await adapter.activeSessions().catch(() => null);
    if (!active) return;
    const ids = Object.keys(active);
    const pending = await adapter.listPendingPermissions().catch(() => null);
    if (pending) state.notePermissions(pending);
    await Promise.all(
      ids.slice(0, 20).map(async (id) => {
        const forms = await adapter.listSessionForms(id).catch(() => null);
        if (!forms) return;
        const questions = forms
          .map((form) => mapQuestion(form))
          .filter((question): question is QuestionRequest => Boolean(question));
        state.replaceQuestions(id, questions);
      }),
    );
    state.syncActive(new Set(ids));
  };

  const statusPoll = setInterval(() => {
    void reconcileInputs().catch(() => undefined);
  }, 5_000);
  statusPoll.unref();

  return {
    app,
    hub,
    async close() {
      clearInterval(statusPoll);
      await hub.stop();
      await app.close();
    },
  };
}
