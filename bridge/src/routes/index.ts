import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance, FastifyReply } from "fastify";
import { z } from "zod";
import type { BackendAdapter } from "../adapters/BackendAdapter.js";
import { OpenCodeError } from "../opencode/client.js";
import type { FileRegistry } from "../uploads.js";
import { UploadError, sanitizeFilename, type StoredFile } from "../uploads.js";
import { withReadInstructions } from "../prompt.js";
import { toFileUri } from "../fileUri.js";
import { BRIDGE_VERSION, isInsideWorkdir, type Config } from "../config.js";
import type { RuntimeState } from "../state.js";
import type { SourceResolver } from "../sources.js";
import {
  buildFormAnswer,
  mapMessage,
  mapSession,
  mapPermission,
  mapQuestion,
} from "../mapping.js";
import type { ChatMessage, MessageFile, QuestionRequest, RawSession } from "../types.js";
import { mapLimit } from "../util.js";
import type { PushService } from "../push.js";
import { SessionAccess } from "../sessionAccess.js";

const IdParams = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]+$/) });
const FileParams = z.object({ fileId: z.string().regex(/^[A-Za-z0-9_-]+$/) });
const PermissionParams = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]+$/),
  requestId: z.string().min(1).max(200),
});
const QuestionParams = z.object({
  id: z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/),
});
const PermissionByIdParams = z.object({
  id: z.string().min(1).max(200).regex(/^[A-Za-z0-9_-]+$/),
});

const CreateSessionBody = z.object({
  directory: z.string().min(1).max(4096),
  title: z.string().min(1).max(200).optional(),
});

const RenameBody = z.object({ title: z.string().min(1).max(200) });

const SendBody = z.object({
  text: z.string().max(100_000).default(""),
  fileIds: z.array(z.string().max(100)).max(50).optional(),
  delivery: z.enum(["steer", "queue"]).optional(),
});

const ReplyBody = z.object({
  decision: z.enum(["once", "always", "reject"]),
  message: z.string().max(2000).optional(),
});

const QuestionReplyBody = z.object({
  answers: z
    .array(z.array(z.string().max(4000)).max(50))
    .min(1)
    .max(50),
});

const QuestionRejectBody = z.object({
  message: z.string().max(2000).optional(),
});

function validateAnswers(question: QuestionRequest, answers: string[][]): string | null {
  if (answers.length !== question.questions.length) {
    return "Provide one answer array per question.";
  }
  for (let index = 0; index < question.questions.length; index += 1) {
    const item = question.questions[index];
    const values = answers[index] ?? [];
    const filled = values.filter((value) => value.trim().length > 0);
    if (!item) continue;
    if (item.required && filled.length === 0) {
      return `An answer is required for: ${item.header}`;
    }
    if (!item.multiple && filled.length > 1) {
      return `Only one answer is allowed for: ${item.header}`;
    }
    if (typeof item.minItems === "number" && filled.length < item.minItems) {
      return `Select at least ${item.minItems} options for: ${item.header}`;
    }
    if (typeof item.maxItems === "number" && filled.length > item.maxItems) {
      return `Select at most ${item.maxItems} options for: ${item.header}`;
    }
  }
  return null;
}

function alreadySettled(error: unknown): boolean {
  return error instanceof OpenCodeError && (error.status === 404 || error.status === 409);
}

interface Deps {
  config: Config;
  adapter: BackendAdapter;
  state: RuntimeState;
  files: FileRegistry;
  sources: SourceResolver;
  push: PushService;
  access?: SessionAccess;
}

function fail(reply: FastifyReply, status: number, error: string, message: string): FastifyReply {
  // `error` stays for older clients; `code` is the canonical field.
  return reply.code(status).send({ code: error, error, message });
}

function parse<T>(schema: z.ZodType<T>, value: unknown):
  | { ok: true; value: T }
  | { ok: false; message: string } {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues.map((issue) => issue.message).join("; ") };
  }
  return { ok: true, value: parsed.data };
}

async function requireSessionWorkdir(
  adapter: BackendAdapter,
  config: Config,
  sessionId: string,
  access: SessionAccess,
): Promise<{ session: RawSession; workdir: string } | null> {
  const session = await adapter.getSession(sessionId);
  const directory = session.location?.directory;
  const workdir = access.directory(session);
  return workdir ? { session, workdir } : null;
}

export function registerRoutes(app: FastifyInstance, deps: Deps): void {
  const { config, adapter, state, files, sources, push } = deps;
  const access = deps.access ?? new SessionAccess(config.allowedWorkdirs);

  // Explicitly consent to one existing session only. OpenCode has no per-session
  // filesystem sandbox; this grants mobile bridge access, not OS-level isolation.
  app.post("/sessions/:id/access", async (request, reply) => {
    const params = parse(IdParams, request.params);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    try {
      const session = await adapter.getSession(params.value.id);
      if (!access.authorize(session)) return fail(reply, 403, "outside_workdir", "Could not authorize this session directory.");
      return reply.send({ data: { sessionId: session.id, directory: session.location?.directory, limitation: "OpenCode runs with the bridge process permissions; other paths are not OS-sandboxed." } });
    } catch (error) { return handleError(reply, error); }
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/models", async (_request, reply) => {
    try {
      return { data: await adapter.listModels() };
    } catch {
      return fail(reply, 502, "models_unavailable", "Could not load the enabled OpenCode models.");
    }
  });

  app.get("/sessions", async (request, reply) => {
    try {
      const raw = (await adapter.listSessions({ limit: 200 })).filter(
        (session) => session.time.archived == null,
      );
      const sessions = await mapLimit(raw.slice(0, 30), 4, async (session: RawSession) => {
        const source = await sources.resolve(session.id);
        const runtime = state.statusOf(session.id);
        return mapSession(session, {
          source,
          status: runtime.status,
          ...(runtime.busyOrigin ? { busyOrigin: runtime.busyOrigin } : {}),
        });
      });
      const rest = raw.slice(30).map((session) => {
        const runtime = state.statusOf(session.id);
        return mapSession(session, {
          source: state.sourceOf(session.id),
          status: runtime.status,
          ...(runtime.busyOrigin ? { busyOrigin: runtime.busyOrigin } : {}),
        });
      });
      return reply.send({ data: [...sessions, ...rest] });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.post("/sessions", async (request, reply) => {
    const body = parse(CreateSessionBody, request.body);
    if (!body.ok) return fail(reply, 400, "bad_request", body.message);
    const requested = path.resolve(body.value.directory);
    let stat: fs.Stats;
    try {
      stat = fs.statSync(requested);
    } catch {
      return fail(reply, 400, "directory_not_found", "Directory does not exist.");
    }
    if (!stat.isDirectory()) {
      return fail(reply, 400, "not_a_directory", "Path is not a directory.");
    }
    const workdir = isInsideWorkdir(config.allowedWorkdirs, requested);
    if (!workdir) {
      return fail(reply, 403, "outside_workdir", "Directory is outside ALLOWED_WORKDIRS.");
    }
    try {
      const session = await adapter.createSession(workdir, body.value.title);
      const runtime = state.statusOf(session.id);
      return reply.code(201).send({
        data: mapSession(session, {
          source: "app",
          status: runtime.status,
        }),
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.get("/workdirs", async (_request, reply) => {
    return reply.send({ data: config.allowedWorkdirs });
  });

  app.post("/push/register", async (request, reply) => {
    const body = parse(
      z.object({
        token: z.string().min(10).max(300).regex(/^[A-Za-z0-9_\-\[\]]+$/),
        platform: z.enum(["ios", "android", "web", "unknown"]).default("unknown"),
      }),
      request.body,
    );
    if (!body.ok) return fail(reply, 400, "bad_request", body.message);
    if (!push.register(body.value.token, body.value.platform ?? "unknown")) {
      return fail(reply, 409, "push_limit", "At most 20 push targets can be registered.");
    }
    return reply.code(201).send({ ok: true });
  });

  app.post("/push/unregister", async (request, reply) => {
    const body = parse(z.object({ token: z.string().min(10).max(300) }), request.body);
    if (!body.ok) return fail(reply, 400, "bad_request", body.message);
    push.unregister(body.value.token);
    return reply.code(204).send();
  });

  app.post("/push/test", async (_request, reply) => {
    const result = await push.send(
      "test",
      "OpenCode Mobile",
      "Push notifications are working.",
      { kind: "test" },
    );
    return reply.send({ data: result });
  });

  app.get("/config", async (_request, reply) => {
    return reply.send({
      data: {
        version: BRIDGE_VERSION,
        workdirs: config.allowedWorkdirs,
        maxUploadMB: Math.floor(config.maxUploadBytes / 1024 / 1024),
        maxUploadTotalMB: Math.floor(config.maxUploadTotalBytes / 1024 / 1024),
        maxFilesPerMessage: config.maxFilesPerMessage,
      },
    });
  });

  app.get("/sessions/:id", async (request, reply) => {
    const params = parse(IdParams, request.params);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    try {
      const scoped = await requireSessionWorkdir(adapter, config, params.value.id, access);
      if (!scoped) {
        return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
      }
      const session = scoped.session;
      const source = await sources.resolve(session.id);
      const runtime = state.statusOf(session.id);
      return reply.send({
        data: mapSession(session, {
          source,
          status: runtime.status,
          ...(runtime.busyOrigin ? { busyOrigin: runtime.busyOrigin } : {}),
        }),
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.patch("/sessions/:id", async (request, reply) => {
    const params = parse(IdParams, request.params);
    const body = parse(RenameBody, request.body);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    if (!body.ok) return fail(reply, 400, "bad_request", body.message);
    try {
      const scoped = await requireSessionWorkdir(adapter, config, params.value.id, access);
      if (!scoped) {
        return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
      }
      await adapter.renameSession(params.value.id, body.value.title);
      return reply.send({ ok: true });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.delete("/sessions/:id", async (request, reply) => {
    const params = parse(IdParams, request.params);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    const query = request.query as { confirm?: string };
    if (query.confirm !== "true") {
      return fail(reply, 400, "confirmation_required", "Pass ?confirm=true to delete a session.");
    }
    try {
      const scoped = await requireSessionWorkdir(adapter, config, params.value.id, access);
      if (!scoped) {
        return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
      }
      await adapter.deleteSession(params.value.id);
      return reply.code(204).send();
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.get("/sessions/:id/messages", async (request, reply) => {
    const params = parse(IdParams, request.params);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    const query = request.query as { limit?: string; order?: string; cursor?: string };
    const limit = Math.min(Math.max(Number(query.limit ?? 100) || 100, 1), 300);
    const order = query.order === "desc" ? "desc" : "asc";
    try {
      const scoped = await requireSessionWorkdir(adapter, config, params.value.id, access);
      if (!scoped) {
        return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
      }
      const page = await adapter.listMessages(params.value.id, {
        limit,
        order,
        ...(query.cursor ? { cursor: query.cursor } : {}),
      });
      state.noteFromMessages(
        params.value.id,
        page.data as Array<{ metadata?: Record<string, unknown> }>,
      );
      const resolveFile = (filePath: string, name: string, mime: string): MessageFile | null => {
        try {
          const record = files.registerWorkdirFile({
            sessionId: params.value.id,
            workdirs: [scoped.workdir],
            filePath,
            maxBytes: config.maxUploadBytes * 4,
          });
          return {
            id: record.id,
            name: record.name || name,
            mime: record.mime || mime,
            size: record.size,
            url: `/files/${record.id}`,
          };
        } catch {
          return null;
        }
      };
      const messages = page.data
        .map((message) => mapMessage(message, params.value.id, resolveFile))
        .filter((message): message is ChatMessage => Boolean(message));
      return reply.send({ data: messages, cursor: page.cursor });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.post("/sessions/:id/messages", async (request, reply) => {
    const params = parse(IdParams, request.params);
    const body = parse(SendBody, request.body);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    if (!body.ok) return fail(reply, 400, "bad_request", body.message);

    const text = body.value.text ?? "";
    const fileIds = body.value.fileIds ?? [];
    if (text.trim().length === 0 && fileIds.length === 0) {
      return fail(reply, 400, "empty_message", "Message text or a file is required.");
    }
    if (fileIds.length > config.maxFilesPerMessage) {
      return fail(reply, 413, "too_many_files", `At most ${config.maxFilesPerMessage} files per message.`);
    }

    let scoped: { session: RawSession; workdir: string } | null;
    try {
      scoped = await requireSessionWorkdir(adapter, config, params.value.id, access);
    } catch (error) {
      return handleError(reply, error);
    }
    if (!scoped) {
      return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
    }

    const runtime = state.statusOf(params.value.id);
    if (runtime.status === "running" && !body.value.delivery) {
      return reply.code(409).send({
        error: "busy",
        message: runtime.busyOrigin
          ? `Busy (started from ${runtime.busyOrigin})`
          : "Session is busy",
        ...(runtime.busyOrigin ? { origin: runtime.busyOrigin } : {}),
      });
    }

    const records: StoredFile[] = [];
    for (const fileId of fileIds) {
      const record = files.get(fileId);
      if (!record || record.sessionId !== params.value.id) {
        return fail(reply, 404, "file_not_found", "Unknown attachment.");
      }
      records.push(record);
    }
    const attachments = records.map((record) => ({
      uri: toFileUri(record.path),
      name: record.name,
    }));

    try {
      const result = await adapter.sendPrompt(params.value.id, {
        text: withReadInstructions(text, records),
        ...(attachments.length > 0 ? { files: attachments } : {}),
        metadata: { source: "app" },
        delivery: body.value.delivery ?? "queue",
      });
      return reply.code(202).send({ ok: true, id: result.id });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.post("/sessions/:id/uploads", async (request, reply) => {
    const params = parse(IdParams, request.params);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    if (!request.isMultipart()) {
      return fail(reply, 400, "not_multipart", "Expected multipart/form-data.");
    }

    let scoped: { session: RawSession; workdir: string } | null;
    try {
      scoped = await requireSessionWorkdir(adapter, config, params.value.id, access);
    } catch (error) {
      return handleError(reply, error);
    }
    if (!scoped) {
      return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
    }
    const workdir = scoped.workdir;

    const stored: Array<{ id: string; name: string; mime: string; size: number; url: string }> = [];
    let totalBytes = 0;
    try {
      const parts = request.parts();
      for await (const part of parts) {
        if (part.type !== "file") continue;
        if (stored.length >= config.maxFilesPerMessage) {
          throw new UploadError(
            "too_many_files",
            `At most ${config.maxFilesPerMessage} files per message.`,
            413,
          );
        }
        const buffer = await part.toBuffer();
        totalBytes += buffer.length;
        if (totalBytes > config.maxUploadTotalBytes) {
          throw new UploadError(
            "total_size_exceeded",
            `Upload exceeds the ${Math.floor(config.maxUploadTotalBytes / 1024 / 1024)} MB request limit.`,
            413,
          );
        }
        if (files.totalBytesForSession(params.value.id) + totalBytes > config.maxSessionUploadBytes) {
          throw new UploadError(
            "session_quota_exceeded",
            `Session uploads exceed the ${Math.floor(config.maxSessionUploadBytes / 1024 / 1024)} MB quota.`,
            413,
          );
        }
        const record = await files.saveUpload({
          sessionId: params.value.id,
          workdir,
          filename: part.filename || "file",
          mime: part.mimetype || "application/octet-stream",
          buffer,
          allowed: config.allowedTypes,
          maxBytes: config.maxUploadBytes,
        });
        stored.push({
          id: record.id,
          name: record.name,
          mime: record.mime,
          size: record.size,
          url: `/files/${record.id}`,
        });
      }
      if (stored.length === 0) {
        throw new UploadError("no_files", "No files were uploaded.");
      }
      return reply.code(201).send({ files: stored });
    } catch (error) {
      await Promise.all(stored.map((file) => files.remove(file.id)));
      return handleError(reply, error);
    }
  });

  app.get("/sessions/:id/diff", async (request, reply) => {
    const params = parse(IdParams, request.params);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    const query = request.query as { from?: string; to?: string };
    try {
      const scoped = await requireSessionWorkdir(adapter, config, params.value.id, access);
      if (!scoped) {
        return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
      }
      const diff = await adapter.getDiff(params.value.id, query.from, query.to);
      return reply.send({ data: diff });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.post("/sessions/:id/stop", async (request, reply) => {
    const params = parse(IdParams, request.params);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    try {
      const scoped = await requireSessionWorkdir(adapter, config, params.value.id, access);
      if (!scoped) {
        return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
      }
      const interrupted = await adapter.interrupt(params.value.id);
      return reply.send({ interrupted });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.get("/permissions", async (_request, reply) => {
    try {
      const pending = await adapter.listPendingPermissions();
      state.notePermissions(pending);
      const visible = await mapLimit(pending, 8, async (request) => {
        try {
          const scoped = await requireSessionWorkdir(adapter, config, request.sessionID, access);
          return scoped ? mapPermission(request) : null;
        } catch {
          return null;
        }
      });
      return reply.send({ data: visible.filter((request): request is NonNullable<typeof request> => request !== null) });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.post("/permissions/:id/reply", async (request, reply) => {
    const params = parse(PermissionByIdParams, request.params);
    const body = parse(ReplyBody, request.body);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    if (!body.ok) return fail(reply, 400, "bad_request", body.message);

    try {
      let sessionId = state.permissionSession(params.value.id);
      if (!sessionId) {
        const pending = await adapter.listPendingPermissions();
        state.notePermissions(pending);
        sessionId = pending.find((item) => item.id === params.value.id)?.sessionID;
      }
      if (!sessionId) {
        if (state.wasPermissionResolved(params.value.id)) {
          return reply.send({ ok: true, alreadyResolved: true });
        }
        return fail(reply, 404, "not_found", "Approval request not found.");
      }
      const scoped = await requireSessionWorkdir(adapter, config, sessionId, access);
      if (!scoped) {
        return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
      }
      await adapter.replyPermission(
        sessionId,
        params.value.id,
        body.value.decision,
        body.value.message,
      );
      state.resolvePermission(sessionId, params.value.id);
      return reply.send({ ok: true });
    } catch (error) {
      if (alreadySettled(error)) {
        return reply.send({ ok: true, alreadyResolved: true });
      }
      return handleError(reply, error);
    }
  });

  app.post("/sessions/:id/permissions/:requestId/reply", async (request, reply) => {
    const params = parse(PermissionParams, request.params);
    const body = parse(ReplyBody, request.body);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    if (!body.ok) return fail(reply, 400, "bad_request", body.message);
    try {
      const scoped = await requireSessionWorkdir(adapter, config, params.value.id, access);
      if (!scoped) {
        return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
      }
      await adapter.replyPermission(
        params.value.id,
        params.value.requestId,
        body.value.decision,
        body.value.message,
      );
      state.resolvePermission(params.value.id, params.value.requestId);
      return reply.code(204).send();
    } catch (error) {
      if (alreadySettled(error)) {
        state.resolvePermission(params.value.id, params.value.requestId);
        return reply.code(200).send({ ok: true, alreadyResolved: true });
      }
      return handleError(reply, error);
    }
  });

  app.get("/sessions/:id/questions", async (request, reply) => {
    const params = parse(IdParams, request.params);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    try {
      const scoped = await requireSessionWorkdir(adapter, config, params.value.id, access);
      if (!scoped) {
        return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
      }
      const forms = await adapter.listSessionForms(params.value.id);
      const questions = forms
        .map((form) => mapQuestion(form))
        .filter((question): question is QuestionRequest => Boolean(question));
      state.replaceQuestions(params.value.id, questions);
      return reply.send({ data: questions });
    } catch (error) {
      return handleError(reply, error);
    }
  });

  app.post("/questions/:id/reply", async (request, reply) => {
    const params = parse(QuestionParams, request.params);
    const body = parse(QuestionReplyBody, request.body);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    if (!body.ok) return fail(reply, 400, "bad_request", body.message);

    const found = state.findQuestion(params.value.id);
    if (!found) return fail(reply, 404, "not_found", "Question not found.");
    if (!found.question) {
      return reply.send({ ok: true, alreadyResolved: true, status: found.resolvedStatus });
    }
    const validation = validateAnswers(found.question, body.value.answers);
    if (validation) return fail(reply, 400, "bad_request", validation);

    try {
      const scoped = await requireSessionWorkdir(adapter, config, found.sessionId, access);
      if (!scoped) {
        return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
      }
      await adapter.replyForm(
        found.sessionId,
        params.value.id,
        buildFormAnswer(found.question, body.value.answers),
      );
      state.resolveQuestion(found.sessionId, params.value.id, "answered");
      return reply.send({ ok: true });
    } catch (error) {
      if (alreadySettled(error)) {
        state.resolveQuestion(found.sessionId, params.value.id, "answered");
        return reply.send({ ok: true, alreadyResolved: true });
      }
      return handleError(reply, error);
    }
  });

  app.post("/questions/:id/reject", async (request, reply) => {
    const params = parse(QuestionParams, request.params);
    const body = parse(QuestionRejectBody, request.body ?? {});
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    if (!body.ok) return fail(reply, 400, "bad_request", body.message);

    const found = state.findQuestion(params.value.id);
    if (!found) return fail(reply, 404, "not_found", "Question not found.");
    if (!found.question) {
      return reply.send({ ok: true, alreadyResolved: true, status: found.resolvedStatus });
    }

    try {
      const scoped = await requireSessionWorkdir(adapter, config, found.sessionId, access);
      if (!scoped) {
        return fail(reply, 403, "outside_workdir", "Session directory is outside ALLOWED_WORKDIRS.");
      }
      await adapter.cancelForm(found.sessionId, params.value.id, body.value.message);
      state.resolveQuestion(found.sessionId, params.value.id, "rejected");
      return reply.send({ ok: true });
    } catch (error) {
      if (alreadySettled(error)) {
        state.resolveQuestion(found.sessionId, params.value.id, "rejected");
        return reply.send({ ok: true, alreadyResolved: true });
      }
      return handleError(reply, error);
    }
  });

  app.get("/files/:fileId", async (request, reply) => {
    const params = parse(FileParams, request.params);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    const record = files.get(params.value.fileId);
    if (!record) return fail(reply, 404, "not_found", "File not found.");
    let resolved: string | null = null;
    try {
      const scoped = await requireSessionWorkdir(adapter, config, record.sessionId, access);
      if (scoped) resolved = isInsideWorkdir([scoped.workdir], record.path);
    } catch {
      return fail(reply, 404, "not_found", "File not found.");
    }
    if (!resolved) return fail(reply, 403, "outside_workdir", "File is outside the allowed workdirs.");
    let stat: fs.Stats;
    try {
      stat = fs.statSync(resolved);
    } catch {
      return fail(reply, 404, "not_found", "File not found.");
    }
    if (!stat.isFile()) return fail(reply, 404, "not_found", "File not found.");

    const inline = record.mime.startsWith("image/") || record.mime === "application/pdf";
    reply
      .type(record.mime)
      .header("x-content-type-options", "nosniff")
      .header("content-security-policy", "sandbox")
      .header("cache-control", "private, max-age=60")
      .header(
        "content-disposition",
        `${inline ? "inline" : "attachment"}; filename="${sanitizeFilename(record.name)}"`,
      );
    return reply.send(fs.createReadStream(resolved));
  });

  app.get("/files/:fileId/text", async (request, reply) => {
    const params = parse(FileParams, request.params);
    if (!params.ok) return fail(reply, 400, "bad_request", params.message);
    try {
      const record = files.get(params.value.fileId);
      if (!record) return fail(reply, 404, "not_found", "File not found.");
      const scoped = await requireSessionWorkdir(adapter, config, record.sessionId, access);
      if (!scoped) return fail(reply, 404, "not_found", "File not found.");
      const result = await files.readText(params.value.fileId, [scoped.workdir]);
      return reply.send({
        text: result.text,
        truncated: result.truncated,
        name: result.file.name,
        mime: result.file.mime,
      });
    } catch (error) {
      return handleError(reply, error);
    }
  });
}

function handleError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof UploadError) {
    return fail(reply, error.status, error.code, error.message);
  }
  if (error instanceof OpenCodeError) {
    if (error.status === 404) return fail(reply, 404, "not_found", "Not found.");
    if (error.status === 409) return fail(reply, 409, "conflict", "Session is busy.");
    if (error.status === 401 || error.status === 403) {
      return fail(reply, 502, "opencode_auth", "Bridge could not authenticate to OpenCode.");
    }
    return fail(reply, 502, "opencode_error", "OpenCode request failed.");
  }
  if (error instanceof z.ZodError) {
    return fail(reply, 400, "bad_request", "Invalid request.");
  }
  if ((error as { statusCode?: number }).statusCode === 413) {
    return fail(reply, 413, "upload_limit", "Upload exceeds the allowed size or file count.");
  }
  reply.log.error({ err: error }, "unhandled route error");
  return fail(reply, 500, "internal_error", "Internal server error.");
}
