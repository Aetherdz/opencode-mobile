import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { z } from "zod";
import type { BackendAdapter } from "./adapters/BackendAdapter.js";
import type { LoggerLike } from "./log.js";
import type { PushService } from "./push.js";
import type { SessionAccess } from "./sessionAccess.js";
import type { FileRegistry, StoredFile } from "./uploads.js";
import { BRIDGE_VERSION, isInsideWorkdir } from "./config.js";
import { RuntimeState } from "./state.js";
import { mapMessage, mapPermission, mapQuestion, mapSession, toolActivity } from "./mapping.js";
import { fromFileUri, toFileUri } from "./fileUri.js";
import { withReadInstructions } from "./prompt.js";
import type {
  ChatMessage,
  ClientWsEvent,
  MessageFile,
  OpenCodeEvent,
  RawForm,
  RawSession,
  ServerWsEvent,
  SessionSummary,
  Source,
} from "./types.js";

const ClientEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("subscribe"),
    sessionId: z.string().regex(/^[A-Za-z0-9_-]+$/),
    lastEventId: z.string().max(200).optional(),
  }),
  z.object({
    type: z.literal("unsubscribe"),
    sessionId: z.string().regex(/^[A-Za-z0-9_-]+$/),
  }),
  z.object({
    type: z.literal("message.send"),
    sessionId: z.string().regex(/^[A-Za-z0-9_-]+$/),
    text: z.string().min(1).max(100_000),
    fileIds: z.array(z.string().max(100)).max(50).optional(),
    model: z.object({
      providerID: z.string().min(1).max(200),
      modelID: z.string().min(1).max(300),
    }).strict().optional(),
    delivery: z.enum(["steer", "queue"]).optional(),
    requestId: z.string().max(100).optional(),
  }),
  z.object({
    type: z.literal("approval.reply"),
    sessionId: z.string().regex(/^[A-Za-z0-9_-]+$/),
    requestId: z.string().min(1).max(200),
    decision: z.enum(["once", "always", "reject"]),
  }),
  z.object({
    type: z.literal("session.stop"),
    sessionId: z.string().regex(/^[A-Za-z0-9_-]+$/),
  }),
  z.object({ type: z.literal("ping") }),
]);

interface Buffered {
  id: string;
  event: ServerWsEvent;
}

const MAX_BUFFER_PER_SESSION = 500;
const MAX_BUFFERED_SESSIONS = 200;
const MAX_CLIENT_MESSAGES_PER_MINUTE = 300;

export class WsHub {
  private readonly rooms = new Map<string, Set<WebSocket>>();
  private readonly buffers = new Map<string, Buffered[]>();
  private readonly clients = new Set<WebSocket>();
  private readonly socketSubs = new WeakMap<WebSocket, Set<string>>();
  private readonly messageCounts = new WeakMap<WebSocket, { count: number; resetAt: number }>();
  private readonly abort = new AbortController();
  private readonly sessionCache = new Map<string, RawSession>();
  private readonly toolNames = new Map<string, string>();
  private readonly toolInputs = new Map<string, Record<string, unknown>>();
  private readonly maxSubscriptionsPerSocket = 5;
  private readonly maxRooms = 200;
  private stopped = false;
  private loopPromise: Promise<void> | null = null;

  constructor(
    private readonly adapter: BackendAdapter,
    private readonly state: RuntimeState,
    private readonly files: FileRegistry,
    private readonly log: LoggerLike,
    private readonly workdirs: string[],
    private readonly maxUploadBytes: number,
    private readonly maxFiles: number,
    private readonly push?: PushService,
    private readonly access?: SessionAccess,
  ) {}

  start(): void {
    this.loopPromise = this.upstreamLoop();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    this.abort.abort();
    for (const socket of this.clients) {
      try {
        socket.close(1001, "server shutting down");
      } catch {
        // ignore
      }
    }
    await this.loopPromise?.catch(() => undefined);
  }

  attach(socket: WebSocket): void {
    this.clients.add(socket);
    this.socketSubs.set(socket, new Set());
    this.send(socket, {
      type: "hello",
      serverVersion: BRIDGE_VERSION,
      sessions: [...this.rooms.keys()],
    });

    socket.on("message", (raw) => {
      void this.onClientMessage(socket, raw.toString());
    });
    socket.on("close", () => {
      this.clients.delete(socket);
      const subs = this.socketSubs.get(socket);
      if (subs) {
        for (const sessionId of subs) {
          const room = this.rooms.get(sessionId);
          room?.delete(socket);
          if (room && room.size === 0) this.rooms.delete(sessionId);
        }
        subs.clear();
      }
    });
    socket.on("error", (error) => {
      this.log.warn({ err: error }, "websocket client error");
    });
  }

  private async sessionAllowed(sessionId: string): Promise<boolean> {
    const cached = this.sessionCache.get(sessionId);
    if (cached?.location?.directory) {
      return Boolean(this.access?.directory(cached) ?? isInsideWorkdir(this.workdirs, cached.location.directory));
    }
    try {
      const session = await this.adapter.getSession(sessionId);
      this.sessionCache.set(sessionId, session);
      const directory = session.location?.directory;
      return Boolean(directory && (this.access?.directory(session) ?? isInsideWorkdir(this.workdirs, directory)));
    } catch {
      return false;
    }
  }

  private async onClientMessage(socket: WebSocket, raw: string): Promise<void> {
    if (raw.length > 1_000_000) {
      this.send(socket, { type: "error", code: "too_large", message: "Message too large." });
      return;
    }
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(raw);
    } catch {
      this.send(socket, { type: "error", code: "bad_json", message: "Invalid JSON." });
      return;
    }
    const parsed = ClientEventSchema.safeParse(parsedJson);
    if (!parsed.success) {
      this.send(socket, { type: "error", code: "bad_event", message: "Invalid event payload." });
      return;
    }
    const event = parsed.data as ClientWsEvent;

    // Keepalives are not application traffic. Counting them makes a healthy
    // long-lived connection look like a flood after a reconnect burst.
    if (event.type !== "ping") {
      const now = Date.now();
      const bucket = this.messageCounts.get(socket);
      if (!bucket || now >= bucket.resetAt) {
        this.messageCounts.set(socket, { count: 1, resetAt: now + 60_000 });
      } else if (bucket.count >= MAX_CLIENT_MESSAGES_PER_MINUTE) {
        this.send(socket, {
          type: "error",
          code: "rate_limited",
          message: "Too many WebSocket messages. Try again later.",
        });
        return;
      } else {
        bucket.count += 1;
      }
    }

    try {
      switch (event.type) {
        case "subscribe": {
          if (!(await this.sessionAllowed(event.sessionId))) {
            this.send(socket, {
              type: "error",
              code: "outside_workdir",
              message: "Session directory is outside ALLOWED_WORKDIRS.",
            });
            return;
          }
          const subs = this.socketSubs.get(socket) ?? new Set<string>();
          if (!subs.has(event.sessionId)) {
            if (subs.size >= this.maxSubscriptionsPerSocket) {
              this.send(socket, {
                type: "error",
                code: "too_many_subscriptions",
                message: `At most ${this.maxSubscriptionsPerSocket} sessions per connection.`,
              });
              return;
            }
            if (!this.rooms.has(event.sessionId) && this.rooms.size >= this.maxRooms) {
              this.send(socket, {
                type: "error",
                code: "server_busy",
                message: "Too many active subscriptions. Try again later.",
              });
              return;
            }
            subs.add(event.sessionId);
            this.socketSubs.set(socket, subs);
          }
          const room = this.rooms.get(event.sessionId) ?? new Set<WebSocket>();
          room.add(socket);
          this.rooms.set(event.sessionId, room);
          this.send(socket, { type: "resume", sessionId: event.sessionId, replayed: 0 });
          if (event.lastEventId) this.replay(socket, event.sessionId, event.lastEventId);
          break;
        }
        case "unsubscribe": {
          this.rooms.get(event.sessionId)?.delete(socket);
          const room = this.rooms.get(event.sessionId);
          if (room && room.size === 0) this.rooms.delete(event.sessionId);
          this.socketSubs.get(socket)?.delete(event.sessionId);
          break;
        }
        case "message.send": {
          if (!(await this.sessionAllowed(event.sessionId))) {
            this.send(socket, {
              type: "error",
              code: "outside_workdir",
              message: "Session directory is outside ALLOWED_WORKDIRS.",
            });
            return;
          }
          const runtime = this.state.statusOf(event.sessionId);
          if (runtime.status === "running" && !event.delivery) {
            this.send(socket, {
              type: "error",
              code: "busy",
              message: runtime.busyOrigin
                ? `Busy (started from ${runtime.busyOrigin})`
                : "Session is busy",
            });
            return;
          }
          const fileIds = event.fileIds ?? [];
          if (fileIds.length > this.maxFiles) {
            this.send(socket, {
              type: "error",
              code: "too_many_files",
              message: `At most ${this.maxFiles} files per message.`,
            });
            return;
          }
          const records: StoredFile[] = [];
          for (const fileId of fileIds) {
            const record = this.files.get(fileId);
            if (!record || record.sessionId !== event.sessionId) {
              this.send(socket, { type: "error", code: "file_not_found", message: "Unknown attachment." });
              return;
            }
            records.push(record);
          }
          const fileRefs = records.map((record) => ({
            uri: toFileUri(record.path),
            name: record.name,
          }));
          if (event.model) {
            const available = await this.adapter.listModels();
            if (!available.some((model) =>
              model.providerId === event.model?.providerID && model.modelId === event.model?.modelID
            )) {
              this.send(socket, {
                type: "error",
                code: "model_unavailable",
                message: "The selected model is not enabled or is no longer available.",
                ...(event.requestId ? { requestId: event.requestId } : {}),
              });
              return;
            }
          }
          await this.adapter.sendPrompt(event.sessionId, {
            text: withReadInstructions(event.text, records),
            ...(fileRefs.length > 0 ? { files: fileRefs } : {}),
            metadata: { source: "app" },
            delivery: event.delivery ?? "queue",
            ...(event.model ? { model: event.model } : {}),
          });
          if (event.requestId) {
            this.send(socket, {
              type: "ack",
              sessionId: event.sessionId,
              requestId: event.requestId,
            });
          }
          break;
        }
        case "approval.reply": {
          if (!(await this.sessionAllowed(event.sessionId))) {
            this.send(socket, {
              type: "error",
              code: "outside_workdir",
              message: "Session directory is outside ALLOWED_WORKDIRS.",
            });
            return;
          }
          await this.adapter.replyPermission(event.sessionId, event.requestId, event.decision);
          this.broadcast(event.sessionId, {
            type: "approval.resolved",
            sessionId: event.sessionId,
            requestId: event.requestId,
            decision: event.decision,
          });
          break;
        }
        case "session.stop": {
          if (!(await this.sessionAllowed(event.sessionId))) {
            this.send(socket, {
              type: "error",
              code: "outside_workdir",
              message: "Session directory is outside ALLOWED_WORKDIRS.",
            });
            return;
          }
          await this.adapter.interrupt(event.sessionId);
          this.broadcast(event.sessionId, {
            type: "status",
            sessionId: event.sessionId,
            status: "idle",
          });
          break;
        }
        case "ping":
          this.send(socket, { type: "pong", t: Date.now() });
          break;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed";
      this.log.warn({ err: error, event: event.type }, "websocket request failed");
      this.send(socket, { type: "error", code: "request_failed", message: message.slice(0, 300) });
    }
  }

  private async upstreamLoop(): Promise<void> {
    let backoff = 500;
    while (!this.stopped) {
      try {
        for await (const event of this.adapter.events(this.abort.signal)) {
          backoff = 500;
          this.onUpstream(event);
        }
      } catch (error) {
        if (this.stopped) return;
        this.log.warn({ err: error }, "opencode event stream disconnected");
      }
      if (this.stopped) return;
      this.broadcastAll({
        type: "error",
        code: "upstream_disconnected",
        message: "Lost connection to OpenCode. Reconnecting.",
      });
      await sleep(backoff);
      backoff = Math.min(backoff * 2, 15_000);
      this.reconcileSubscribed();
    }
  }

  private reconcileSubscribed(): void {
    for (const sessionId of this.rooms.keys()) {
      this.broadcast(sessionId, { type: "resume", sessionId, replayed: 0 });
    }
  }

  private onUpstream(event: OpenCodeEvent): void {
    this.state.apply(event);
    const data = (event.data ?? {}) as Record<string, unknown>;
    const form = data.form as RawForm | undefined;
    const sessionId =
      (typeof data.sessionID === "string" && data.sessionID) ||
      (typeof form?.sessionID === "string" && form.sessionID) ||
      (event.durable?.aggregateID?.startsWith("ses") ? event.durable.aggregateID : "");
    if (!sessionId) {
      if (event.type === "session.created" || event.type === "session.deleted") {
        this.broadcastAll({ type: "error", code: "session_changed", message: event.type });
      }
      return;
    }

    const status = this.state.statusOf(sessionId);
    const emitStatus = (): void => {
      this.broadcast(sessionId, {
        type: "status",
        sessionId,
        status: status.status,
        ...(status.busyOrigin ? { busyOrigin: status.busyOrigin } : {}),
      });
    };

    switch (event.type) {
      case "session.execution.started":
      case "session.execution.succeeded":
      case "session.execution.failed":
      case "session.execution.interrupted":
      case "session.idle":
      case "permission.asked":
      case "permission.replied":
      case "form.created":
      case "form.replied":
      case "form.cancelled": {
        emitStatus();
        if (event.type === "session.execution.started") {
          this.broadcast(sessionId, { type: "diff", sessionId, files: [] });
        }
        if (event.type === "session.execution.succeeded") {
          void this.emitDiff(sessionId);
          void this.push?.send(
            `done:${sessionId}`,
            "Task finished",
            "OpenCode finished the turn. Open the app to see the result.",
            { sessionId, kind: "done" },
          );
        }
        if (event.type === "session.execution.failed") {
          void this.emitFailedMessage(sessionId);
          void this.push?.send(
            `failed:${sessionId}`,
            "Task failed",
            "Open the app for details.",
            { sessionId, kind: "failed" },
          );
        }
        if (event.type === "permission.asked") {
          const request = requestFromEvent(event);
          if (request) {
            this.broadcast(sessionId, { type: "approval.request", sessionId, request });
            void this.push?.send(
              `approval:${sessionId}`,
              "Approval needed",
              "The agent is waiting for your decision.",
              { sessionId, kind: "approval", requestId: request.id },
            );
          }
        }
        if (event.type === "permission.replied") {
          const requestId =
            (typeof data.id === "string" && data.id) ||
            (typeof data.requestID === "string" && data.requestID) ||
            "";
          if (requestId) {
            this.broadcast(sessionId, {
              type: "approval.resolved",
              sessionId,
              requestId,
              decision: "once",
            });
          }
        }
        if (event.type === "form.created") {
          const question = form ? mapQuestion(form, event.created) : null;
          if (question) {
            this.broadcast(sessionId, { type: "question.request", sessionId, question });
            void this.push?.send(
              `question:${sessionId}`,
              "Input needed",
              "The agent is waiting for your answer.",
              { sessionId, kind: "question", questionId: question.id },
            );
          }
        }
        if (event.type === "form.replied" || event.type === "form.cancelled") {
          const questionId =
            (typeof data.id === "string" && data.id) ||
            (typeof form?.id === "string" && form.id) ||
            "";
          if (questionId) {
            this.broadcast(sessionId, {
              type: "question.resolved",
              sessionId,
              questionId,
              status: event.type === "form.replied" ? "answered" : "rejected",
            });
          }
        }
        break;
      }
      case "session.inbox.enqueued": {
        const item = data.item as
          | { type?: string; payload?: { text?: string; metadata?: Record<string, unknown>; files?: unknown[] } }
          | undefined;
        if (item?.type === "user" && item.payload) {
          const source = metadataSource(item.payload.metadata);
          const cachedSession = this.sessionCache.get(sessionId);
          const scopedWorkdir = cachedSession ? this.access?.directory(cachedSession) : null;
          const eventFiles = resolveEventFiles(
            item.payload.files,
            sessionId,
            this.files,
            scopedWorkdir ? [scopedWorkdir] : this.workdirs,
            this.maxUploadBytes,
          );
          const message: ChatMessage = {
            id: typeof data.inboxID === "string" ? data.inboxID : `local_${Date.now()}`,
            sessionId,
            role: "user",
            text: item.payload.text ?? "",
            createdAt: event.created ?? Date.now(),
            ...(source ? { source } : {}),
            ...(eventFiles.length > 0 ? { files: eventFiles } : {}),
            status: "done",
          };
          this.broadcast(sessionId, { type: "message.created", sessionId, message });
          this.broadcastSessionUpdated(sessionId);
        }
        break;
      }
      case "session.step.started": {
        const messageId =
          (typeof data.assistantMessageID === "string" && data.assistantMessageID) || "";
        if (messageId) {
          this.broadcast(sessionId, {
            type: "message.created",
            sessionId,
            message: {
              id: messageId,
              sessionId,
              role: "assistant",
              text: "",
              createdAt: event.created ?? Date.now(),
              status: "streaming",
            },
          });
        }
        break;
      }
      case "session.text.delta": {
        const messageId =
          (typeof data.assistantMessageID === "string" && data.assistantMessageID) || "";
        const delta = typeof data.delta === "string" ? data.delta : "";
        if (messageId && delta) {
          this.broadcast(sessionId, {
            type: "output.chunk",
            sessionId,
            messageId,
            ordinal: Number(data.ordinal ?? 0),
            delta,
            channel: "text",
          });
        }
        break;
      }
      case "session.reasoning.delta": {
        const messageId =
          (typeof data.assistantMessageID === "string" && data.assistantMessageID) || "";
        const delta = typeof data.delta === "string" ? data.delta : "";
        if (messageId && delta) {
          this.broadcast(sessionId, {
            type: "output.chunk",
            sessionId,
            messageId,
            ordinal: Number(data.ordinal ?? 0),
            delta,
            channel: "reasoning",
          });
        }
        break;
      }
      case "session.text.ended": {
        const messageId =
          (typeof data.assistantMessageID === "string" && data.assistantMessageID) || "";
        if (messageId) {
          this.broadcast(sessionId, {
            type: "message.completed",
            sessionId,
            messageId,
            text: typeof data.text === "string" ? data.text : "",
          });
        }
        break;
      }
      case "session.tool.input.started": {
        const id = typeof data.id === "string" ? data.id : "";
        const name = typeof data.name === "string" ? data.name : "";
        if (id && name) this.toolNames.set(id, name);
        break;
      }
      case "session.tool.called":
      case "session.tool.success":
      case "session.tool.failed": {
        const id = typeof data.id === "string" ? data.id : `tool_${Date.now()}`;
        const name =
          this.toolNames.get(id) ??
          (typeof data.name === "string" ? data.name : "tool");
        const input = (data.input ??
          this.toolInputs.get(id) ??
          {}) as Record<string, unknown>;
        if (event.type === "session.tool.called") this.toolInputs.set(id, input);

        const metadata = (data.metadata ?? {}) as Record<string, unknown>;
        const failed = event.type === "session.tool.failed" || metadata.error === true;
        const status =
          event.type === "session.tool.success"
            ? failed
              ? "error"
              : "completed"
            : event.type === "session.tool.failed"
              ? "error"
              : "running";
        const contentText = Array.isArray(data.content)
          ? data.content
              .filter(
                (part): part is { type: "text"; text: string } =>
                  Boolean(part) &&
                  typeof part === "object" &&
                  (part as { type?: string }).type === "text" &&
                  typeof (part as { text?: unknown }).text === "string",
              )
              .map((part) => part.text)
              .join("\n")
          : "";

        const activity = toolActivity({
          id,
          name,
          state: { status, input, metadata },
        });
        if (contentText) activity.detail = contentText.slice(0, 1200);

        if (status !== "running") {
          this.toolNames.delete(id);
          this.toolInputs.delete(id);
        }

        const messageId =
          (typeof data.assistantMessageID === "string" && data.assistantMessageID) || "";
        this.broadcast(sessionId, {
          type: "tool.summary",
          sessionId,
          messageId,
          activity,
        });
        break;
      }
      case "session.renamed":
      case "session.metadata.updated": {
        this.broadcastSessionUpdated(sessionId);
        break;
      }
      case "session.step.ended": {
        this.broadcastSessionUpdated(sessionId);
        break;
      }
      default:
        break;
    }
  }

  private async emitDiff(sessionId: string): Promise<void> {
    try {
      const files = await this.adapter.getDiff(sessionId);
      if (files.length > 0) {
        this.broadcast(sessionId, { type: "diff", sessionId, files });
      }
    } catch (error) {
      this.log.debug({ err: error, sessionId }, "failed to load session diff");
    }
  }

  private async emitFailedMessage(sessionId: string): Promise<void> {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const page = await this.adapter.listMessages(sessionId, { limit: 5, order: "desc" });
        const failed = page.data
          .map((raw) => mapMessage(raw, sessionId, () => null))
          .find(
            (message): message is ChatMessage =>
              Boolean(message && message.role === "assistant" && message.error),
          );
        if (failed) {
          this.broadcast(sessionId, { type: "message.created", sessionId, message: failed });
          return;
        }
      } catch (error) {
        this.log.debug({ err: error, sessionId }, "failed to load the agent error message");
        return;
      }
      await sleep(250);
    }
  }

  private broadcastSessionUpdated(sessionId: string): void {    void (async () => {
      try {
        const raw = await this.adapter.getSession(sessionId);
        this.sessionCache.set(sessionId, raw);
        const runtime = this.state.statusOf(sessionId);
        this.broadcast(sessionId, {
          type: "session.updated",
          session: mapSession(raw, {
            status: runtime.status,
            ...(runtime.busyOrigin ? { busyOrigin: runtime.busyOrigin } : {}),
            source: this.state.sourceOf(sessionId),
          }),
        });
      } catch {
        // session may be deleted; ignore
      }
    })();
  }

  sessionView(raw: RawSession): SessionSummary {
    const runtime = this.state.statusOf(raw.id);
    return mapSession(raw, {
      status: runtime.status,
      ...(runtime.busyOrigin ? { busyOrigin: runtime.busyOrigin } : {}),
      source: this.state.sourceOf(raw.id),
    });
  }

  private broadcast(sessionId: string, event: ServerWsEvent): void {
    const eventId = cryptoRandomId();
    const wrapped = { ...event, eventId };
    const room = this.rooms.get(sessionId);
    if (room) {
      for (const socket of room) this.send(socket, wrapped);
    }
    this.buffer(sessionId, eventId, wrapped);
  }

  private broadcastAll(event: ServerWsEvent): void {
    for (const socket of this.clients) this.send(socket, event);
  }

  private buffer(sessionId: string, id: string, event: ServerWsEvent & { eventId?: string }): void {
    const list = this.buffers.get(sessionId) ?? [];
    list.push({ id, event });
    while (list.length > MAX_BUFFER_PER_SESSION) list.shift();
    this.buffers.set(sessionId, list);
    if (this.buffers.size > MAX_BUFFERED_SESSIONS) {
      const oldest = this.buffers.keys().next().value;
      if (oldest) this.buffers.delete(oldest);
    }
  }

  private replay(socket: WebSocket, sessionId: string, lastEventId: string): void {
    const list = this.buffers.get(sessionId);
    if (!list) return;
    const index = list.findIndex((entry) => entry.id === lastEventId);
    const events = index >= 0 ? list.slice(index + 1) : list;
    for (const entry of events) this.send(socket, entry.event);
    this.send(socket, { type: "resume", sessionId, replayed: events.length });
  }

  private send(socket: WebSocket, event: ServerWsEvent & { eventId?: string }): void {
    if (socket.readyState !== 1) return;
    try {
      socket.send(JSON.stringify(event));
    } catch (error) {
      this.log.debug({ err: error }, "failed to send websocket event");
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

let counter = 0;
function cryptoRandomId(): string {
  counter += 1;
  return `buf_${Date.now().toString(36)}_${counter.toString(36)}`;
}

function metadataSource(metadata: Record<string, unknown> | undefined): Source | undefined {
  const source = metadata?.source;
  return source === "telegram" || source === "app" ? source : undefined;
}

function resolveEventFiles(
  files: unknown,
  sessionId: string,
  registry: FileRegistry,
  workdirs: string[],
  maxBytes: number,
): MessageFile[] {
  if (!Array.isArray(files)) return [];
  const out: MessageFile[] = [];
  for (const file of files) {
    if (!file || typeof file !== "object") continue;
    const source = (file as { source?: { type?: string; uri?: string } }).source;
    if (source?.type !== "uri" || !source.uri) continue;
    const filePath = fromFileUri(source.uri);
    if (!filePath) continue;
    try {
      const record = registry.registerWorkdirFile({ sessionId, workdirs, filePath, maxBytes });
      out.push({
        id: record.id,
        name: record.name,
        mime: record.mime,
        size: record.size,
        url: `/files/${record.id}`,
      });
    } catch {
      // ignore files outside the allowed workdirs
    }
  }
  return out;
}

function requestFromEvent(event: OpenCodeEvent): ReturnType<typeof mapPermission> | null {
  const data = (event.data ?? {}) as Record<string, unknown>;
  const raw = (data.request ?? data) as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.sessionID !== "string" || typeof raw.action !== "string") {
    return null;
  }
  return mapPermission({
    id: raw.id,
    sessionID: raw.sessionID,
    action: raw.action,
    resources: Array.isArray(raw.resources) ? raw.resources.map(String) : [],
    ...(typeof raw.message === "string" ? { message: raw.message } : {}),
    ...(raw.metadata && typeof raw.metadata === "object" ? { metadata: raw.metadata as Record<string, unknown> } : {}),
  });
}
