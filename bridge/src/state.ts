import type {
  OpenCodeEvent,
  QuestionRequest,
  RawForm,
  RawPermissionRequest,
  SessionSource,
  SessionStatus,
  Source,
} from "./types.js";
import { mapQuestion, sourceFromMetadata } from "./mapping.js";

const RESOLVED_TTL_MS = 60_000;
const MAX_RESOLVED = 300;

interface ResolvedQuestion {
  sessionId: string;
  status: "answered" | "rejected";
  at: number;
}

interface ResolvedPermission {
  sessionId: string;
  at: number;
}

export interface QuestionLookup {
  sessionId: string;
  question: QuestionRequest | null;
  resolvedStatus?: "answered" | "rejected";
}

export class RuntimeState {
  private readonly statuses = new Map<
    string,
    { status: SessionStatus; busyOrigin?: Source; updatedAt: number }
  >();
  private readonly sources = new Map<string, Set<Source>>();
  private readonly approvals = new Map<string, Set<string>>();
  private readonly permissionSessions = new Map<string, string>();
  private readonly resolvedPermissions = new Map<string, ResolvedPermission>();
  private readonly questions = new Map<string, Map<string, QuestionRequest>>();
  private readonly questionSessions = new Map<string, string>();
  private readonly resolvedQuestions = new Map<string, ResolvedQuestion>();

  statusOf(sessionId: string): { status: SessionStatus; busyOrigin?: Source } {
    const entry = this.statuses.get(sessionId);
    const busyOrigin = entry?.busyOrigin;
    if (this.questions.get(sessionId)?.size) {
      return {
        status: "waiting_input",
        ...(busyOrigin ? { busyOrigin } : {}),
      };
    }
    if (this.approvals.get(sessionId)?.size) {
      return {
        status: "needs_approval",
        ...(busyOrigin ? { busyOrigin } : {}),
      };
    }
    if (!entry) return { status: "idle" };
    return {
      status: entry.status,
      ...(entry.busyOrigin ? { busyOrigin: entry.busyOrigin } : {}),
    };
  }

  sourceOf(sessionId: string): SessionSource {
    const set = this.sources.get(sessionId);
    if (!set || set.size === 0) return "unknown";
    if (set.size === 2) return "both";
    return set.has("telegram") ? "telegram" : "app";
  }

  noteSource(sessionId: string, source: Source | undefined): void {
    if (!source) return;
    const set = this.sources.get(sessionId) ?? new Set<Source>();
    set.add(source);
    this.sources.set(sessionId, set);
  }

  noteFromMessages(
    sessionId: string,
    messages: Array<{ metadata?: Record<string, unknown> }>,
  ): void {
    for (const message of messages) this.noteSource(sessionId, sourceFromMetadata(message.metadata));
  }

  pendingApprovals(sessionId: string): string[] {
    return [...(this.approvals.get(sessionId) ?? new Set<string>())];
  }

  pendingQuestions(sessionId: string): QuestionRequest[] {
    return [...(this.questions.get(sessionId)?.values() ?? [])];
  }

  permissionSession(requestId: string): string | undefined {
    return (
      this.permissionSessions.get(requestId) ??
      this.resolvedPermissions.get(requestId)?.sessionId
    );
  }

  wasPermissionResolved(requestId: string): boolean {
    this.pruneResolved();
    const entry = this.resolvedPermissions.get(requestId);
    return Boolean(entry && Date.now() - entry.at < RESOLVED_TTL_MS);
  }

  findQuestion(questionId: string): QuestionLookup | null {
    this.pruneResolved();
    const sessionId = this.questionSessions.get(questionId);
    if (sessionId) {
      const question = this.questions.get(sessionId)?.get(questionId) ?? null;
      if (question) return { sessionId, question };
    }
    const resolved = this.resolvedQuestions.get(questionId);
    if (resolved && Date.now() - resolved.at < RESOLVED_TTL_MS) {
      return {
        sessionId: resolved.sessionId,
        question: null,
        resolvedStatus: resolved.status,
      };
    }
    return null;
  }

  noteQuestion(question: QuestionRequest): void {
    this.pruneResolved();
    if (this.resolvedQuestions.has(question.id)) return;
    const set = this.questions.get(question.sessionId) ?? new Map<string, QuestionRequest>();
    set.set(question.id, question);
    this.questions.set(question.sessionId, set);
    this.questionSessions.set(question.id, question.sessionId);
    if (this.statusOf(question.sessionId).status === "idle") {
      this.setStatus(question.sessionId, "running");
    }
  }

  replaceQuestions(sessionId: string, incoming: QuestionRequest[]): void {
    this.pruneResolved();
    const previous = this.questions.get(sessionId);
    const previousStatus = this.statusOf(sessionId);
    const next = new Map<string, QuestionRequest>();
    for (const question of incoming) {
      if (this.resolvedQuestions.has(question.id)) continue;
      if (question.sessionId !== sessionId) continue;
      next.set(question.id, question);
      this.questionSessions.set(question.id, sessionId);
    }
    const current = this.questions.get(sessionId);
    if (current) {
      for (const id of current.keys()) {
        if (!next.has(id)) this.questionSessions.delete(id);
      }
    }
    if (next.size > 0) {
      this.questions.set(sessionId, next);
      if (this.statusOf(sessionId).status === "idle") {
        this.setStatus(sessionId, "running");
      }
    } else {
      this.questions.delete(sessionId);
      if (
        (previous?.size ?? 0) > 0 &&
        previousStatus.status !== "error" &&
        !this.approvals.get(sessionId)?.size
      ) {
        this.setStatus(sessionId, "running", previousStatus.busyOrigin);
      }
    }
  }

  resolveQuestion(
    sessionId: string,
    questionId: string,
    status: "answered" | "rejected",
  ): void {
    this.questions.get(sessionId)?.delete(questionId);
    if (this.questions.get(sessionId)?.size === 0) this.questions.delete(sessionId);
    this.questionSessions.delete(questionId);
    this.resolvedQuestions.set(questionId, { sessionId, status, at: Date.now() });
    this.pruneResolved();
    if (!this.questions.get(sessionId)?.size && !this.approvals.get(sessionId)?.size) {
      const current = this.statusOf(sessionId);
      if (current.status !== "error") {
        this.setStatus(sessionId, "running", current.busyOrigin);
      }
    }
  }

  notePermissions(permissions: RawPermissionRequest[]): void {
    this.pruneResolved();
    for (const request of permissions) {
      if (!request?.id || !request.sessionID) continue;
      this.permissionSessions.set(request.id, request.sessionID);
      if (this.resolvedPermissions.has(request.id)) continue;
      const set = this.approvals.get(request.sessionID) ?? new Set<string>();
      set.add(request.id);
      this.approvals.set(request.sessionID, set);
    }
  }

  notePermission(sessionId: string, requestId: string): void {
    this.permissionSessions.set(requestId, sessionId);
    const set = this.approvals.get(sessionId) ?? new Set<string>();
    set.add(requestId);
    this.approvals.set(sessionId, set);
    this.setStatus(sessionId, "needs_approval");
  }

  resolvePermission(sessionId: string, requestId: string): void {
    const set = this.approvals.get(sessionId);
    if (set && requestId) set.delete(requestId);
    if (!set || set.size === 0) this.approvals.delete(sessionId);
    if (requestId) {
      this.permissionSessions.delete(requestId);
      this.resolvedPermissions.set(requestId, { sessionId, at: Date.now() });
      this.pruneResolved();
    }
    if (!this.questions.get(sessionId)?.size && !this.approvals.get(sessionId)?.size) {
      const current = this.statusOf(sessionId);
      if (current.status !== "error") {
        this.setStatus(sessionId, "running", current.busyOrigin);
      }
    }
  }

  syncActive(activeIds: Set<string>): void {
    for (const id of activeIds) {
      const current = this.statusOf(id);
      if (current.status !== "needs_approval" && current.status !== "waiting_input") {
        this.setStatus(id, "running", current.busyOrigin);
      }
    }
    for (const [id, entry] of this.statuses) {
      if (
        !activeIds.has(id) &&
        (entry.status === "running" || entry.status === "needs_approval") &&
        !this.questions.get(id)?.size &&
        !this.approvals.get(id)?.size
      ) {
        this.setStatus(id, "idle");
      }
    }
  }

  private setStatus(sessionId: string, status: SessionStatus, busyOrigin?: Source): void {
    this.statuses.set(sessionId, { status, ...(busyOrigin ? { busyOrigin } : {}), updatedAt: Date.now() });
  }

  private pruneResolved(): void {
    const now = Date.now();
    for (const [id, entry] of this.resolvedQuestions) {
      if (now - entry.at > RESOLVED_TTL_MS) {
        this.resolvedQuestions.delete(id);
        this.questionSessions.delete(id);
      }
    }
    for (const [id, entry] of this.resolvedPermissions) {
      if (now - entry.at > RESOLVED_TTL_MS) this.resolvedPermissions.delete(id);
    }
    while (this.resolvedQuestions.size > MAX_RESOLVED) {
      const oldest = this.resolvedQuestions.keys().next().value;
      if (!oldest) break;
      this.resolvedQuestions.delete(oldest);
    }
    while (this.resolvedPermissions.size > MAX_RESOLVED) {
      const oldest = this.resolvedPermissions.keys().next().value;
      if (!oldest) break;
      this.resolvedPermissions.delete(oldest);
    }
  }

  apply(event: OpenCodeEvent): void {
    const data = (event.data ?? {}) as Record<string, unknown>;
    const form = data.form as RawForm | undefined;
    const sessionId =
      (typeof data.sessionID === "string" && data.sessionID) ||
      (typeof form?.sessionID === "string" && form.sessionID) ||
      (event.durable?.aggregateID?.startsWith("ses") ? event.durable.aggregateID : "");
    if (!sessionId) return;

    switch (event.type) {
      case "session.execution.started":
        this.setStatus(sessionId, "running");
        break;
      case "session.execution.succeeded":
        this.setStatus(
          sessionId,
          this.pendingApprovals(sessionId).length > 0 ? "needs_approval" : "idle",
        );
        break;
      case "session.execution.failed":
        this.setStatus(sessionId, "error");
        break;
      case "session.execution.interrupted":
      case "session.idle":
        this.setStatus(
          sessionId,
          this.pendingApprovals(sessionId).length > 0 ? "needs_approval" : "idle",
        );
        break;
      case "session.inbox.enqueued": {
        const item = data.item as { payload?: { metadata?: Record<string, unknown> } } | undefined;
        const source = sourceFromMetadata(item?.payload?.metadata);
        this.noteSource(sessionId, source);
        const current = this.statusOf(sessionId);
        if (current.status === "running" && source) {
          this.setStatus(sessionId, "running", source);
        }
        break;
      }
      case "session.inbox.delivered": {
        const item = data.item as { payload?: { metadata?: Record<string, unknown> } } | undefined;
        this.noteSource(sessionId, sourceFromMetadata(item?.payload?.metadata));
        break;
      }
      case "form.created": {
        const question = form ? mapQuestion(form, event.created) : null;
        if (question) this.noteQuestion(question);
        break;
      }
      case "form.replied":
      case "form.cancelled": {
        const questionId = typeof data.id === "string" ? data.id : form?.id;
        if (questionId) {
          this.resolveQuestion(
            sessionId,
            questionId,
            event.type === "form.replied" ? "answered" : "rejected",
          );
        }
        break;
      }
      case "permission.asked": {
        const requestId =
          (typeof data.id === "string" && data.id) ||
          (typeof (data.request as { id?: string } | undefined)?.id === "string"
            ? (data.request as { id: string }).id
            : "");
        if (requestId) this.notePermission(sessionId, requestId);
        break;
      }
      case "permission.replied": {
        const requestId =
          (typeof data.id === "string" && data.id) ||
          (typeof data.requestID === "string" && data.requestID) ||
          "";
        if (requestId) this.resolvePermission(sessionId, requestId);
        break;
      }
      case "session.deleted":
        this.statuses.delete(sessionId);
        this.sources.delete(sessionId);
        this.approvals.delete(sessionId);
        this.questions.delete(sessionId);
        for (const [id, entry] of this.permissionSessions) {
          if (entry === sessionId) this.permissionSessions.delete(id);
        }
        for (const [id, entry] of this.questionSessions) {
          if (entry === sessionId) this.questionSessions.delete(id);
        }
        for (const [id, entry] of this.resolvedQuestions) {
          if (entry.sessionId === sessionId) this.resolvedQuestions.delete(id);
        }
        for (const [id, entry] of this.resolvedPermissions) {
          if (entry.sessionId === sessionId) this.resolvedPermissions.delete(id);
        }
        break;
      default:
        break;
    }
  }
}
