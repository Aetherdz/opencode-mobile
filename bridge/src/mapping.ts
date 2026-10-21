import { fromFileUri } from "./fileUri.js";
import { stripReadInstructions } from "./prompt.js";
import type {
  ApprovalRequest,
  ChatError,
  ChatMessage,
  FormAnswer,
  MessageFile,
  QuestionItem,
  QuestionRequest,
  RawAssistantMessage,
  RawForm,
  RawFormField,
  RawMessage,
  RawPermissionRequest,
  RawSession,
  RawUserMessage,
  SessionSource,
  SessionStatus,
  SessionSummary,
  Source,
} from "./types.js";

export interface SessionRuntimeView {
  status: SessionStatus;
  busyOrigin?: Source;
  source: SessionSource;
}

export function mapSession(raw: RawSession, view: SessionRuntimeView): SessionSummary {
  return {
    id: raw.id,
    title: raw.title?.trim() || "Untitled session",
    directory: raw.location?.directory ?? "",
    source: view.source,
    status: view.status,
    lastActivity: raw.time.updated,
    createdAt: raw.time.created,
    updatedAt: raw.time.updated,
    ...(view.busyOrigin ? { busyOrigin: view.busyOrigin } : {}),
  };
}

export function sourceFromMetadata(metadata: Record<string, unknown> | undefined): Source | undefined {
  const source = metadata?.source;
  return source === "telegram" || source === "app" ? source : undefined;
}

export function toolActivity(tool: {
  id: string;
  name: string;
  state: { status: string; input?: unknown; metadata?: Record<string, unknown> };
}): {
  id: string;
  name: string;
  title: string;
  status: "running" | "done" | "error";
  detail?: string;
} {
  const input = (tool.state.input ?? {}) as Record<string, unknown>;
  const metadata = (tool.state.metadata ?? {}) as Record<string, unknown>;
  const title =
    (typeof metadata.title === "string" && metadata.title) ||
    (typeof input.description === "string" && input.description) ||
    (typeof input.command === "string" && input.command) ||
    (typeof input.path === "string" && input.path) ||
    tool.name;
  const detailParts: string[] = [];
  if (typeof input.command === "string") detailParts.push(input.command);
  if (typeof input.path === "string") detailParts.push(input.path);
  if (typeof input.pattern === "string") detailParts.push(input.pattern);
  const status =
    tool.state.status === "completed" ? "done" : tool.state.status === "error" ? "error" : "running";
  return {
    id: tool.id,
    name: tool.name,
    title: String(title).slice(0, 160),
    status,
    ...(detailParts.length > 0 ? { detail: detailParts.join(" · ").slice(0, 800) } : {}),
  };
}

function fileFromAttachment(
  attachment: {
    name?: string;
    mime?: string;
    source?: { type: "inline" | "uri"; uri?: string };
  },
  resolve: (path: string, name: string, mime: string) => MessageFile | null,
): MessageFile | null {
  const uri = attachment.source?.type === "uri" ? attachment.source.uri : undefined;
  if (!uri) return null;
  const path = fromFileUri(uri);
  if (!path) return null;
  return resolve(path, attachment.name ?? path.split("/").pop() ?? "file", attachment.mime ?? "application/octet-stream");
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function recordValue(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>) : undefined;
}

export function chatError(error: unknown): ChatError | undefined {
  if (error === undefined || error === null) return undefined;
  if (typeof error === "string") {
    const message = error.trim();
    return message ? { message } : undefined;
  }
  if (error instanceof Error) {
    return {
      message: error.message || "The agent hit an error.",
      ...(error.name ? { code: error.name } : {}),
      ...(error.stack ? { detail: error.stack } : {}),
    };
  }
  const record = recordValue(error);
  if (!record) {
    const message = String(error).trim();
    return message ? { message } : undefined;
  }
  const data = recordValue(record.data) ?? record;
  const code =
    stringValue(record.name) ??
    stringValue(record.code) ??
    stringValue(data.name) ??
    stringValue(data.code);
  const message =
    stringValue(data.message) ??
    stringValue(record.message) ??
    stringValue(data.reason) ??
    code ??
    "The agent hit an error.";
  const detailParts: string[] = [];
  const statusCode = data.statusCode ?? record.statusCode;
  if (typeof statusCode === "number") detailParts.push(`HTTP ${statusCode}`);
  const responseBody = stringValue(data.responseBody) ?? stringValue(record.responseBody);
  if (responseBody) detailParts.push(responseBody);
  const stack = stringValue(record.stack) ?? stringValue(data.stack);
  if (stack) detailParts.push(stack);
  if (detailParts.length === 0) {
    const hasUsefulFields = Object.keys(record).some(
      (key) => !["name", "code", "message", "data", "stack"].includes(key),
    );
    if (hasUsefulFields) {
      try {
        detailParts.push(JSON.stringify(error, null, 2));
      } catch {
        // Ignore non-serializable error payloads.
      }
    }
  }
  const detail = detailParts.join("\n\n");
  return {
    message,
    ...(code ? { code } : {}),
    ...(detail ? { detail: detail.length > 4000 ? `${detail.slice(0, 4000)}\n…` : detail } : {}),
  };
}

export function mapMessage(
  raw: RawMessage,
  sessionId: string,
  resolveFile: (path: string, name: string, mime: string) => MessageFile | null,
): ChatMessage | null {
  if (raw.type === "user") {
    const user = raw as RawUserMessage;
    const files = (user.files ?? [])
      .map((attachment) => fileFromAttachment(attachment, resolveFile))
      .filter((file): file is MessageFile => Boolean(file));
    return {
      id: user.id,
      sessionId,
      role: "user",
      text: stripReadInstructions(user.text ?? ""),
      createdAt: user.time.created,
      ...(sourceFromMetadata(user.metadata) ? { source: sourceFromMetadata(user.metadata) } : {}),
      ...(files.length > 0 ? { files } : {}),
      status: "done",
    };
  }

  if (raw.type === "assistant") {
    const assistant = raw as RawAssistantMessage;
    const text = assistant.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("");
    const activities = assistant.content
      .filter((part): part is Extract<RawAssistantMessage["content"][number], { type: "tool" }> => part.type === "tool")
      .map((tool) => toolActivity(tool));
    const error = chatError(assistant.error);
    return {
      id: assistant.id,
      sessionId,
      role: "assistant",
      text,
      createdAt: assistant.time.created,
      ...(activities.length > 0 ? { activities } : {}),
      ...(error ? { error } : {}),
      status: error ? "error" : assistant.time.completed ? "done" : "streaming",
    };
  }

  return null;
}

export function mapPermission(raw: RawPermissionRequest): ApprovalRequest {
  return {
    id: raw.id,
    sessionId: raw.sessionID,
    action: raw.action,
    resources: raw.resources ?? [],
    ...(raw.message ? { message: raw.message } : {}),
    ...(raw.metadata ? { metadata: raw.metadata } : {}),
  };
}

function mapQuestionField(field: RawFormField, index: number): QuestionItem | null {
  if (field.type !== "string" && field.type !== "multiselect") return null;
  if (field.hidden === true || typeof field.key !== "string" || !field.key) return null;
  const header = field.title?.trim() || `Question ${index + 1}`;
  const options = (Array.isArray(field.options) ? field.options : [])
    .filter(
      (option) =>
        option &&
        typeof option.value === "string" &&
        typeof option.label === "string",
    )
    .map((option) => ({
      value: option.value,
      label: option.label,
      ...(option.description ? { description: option.description } : {}),
    }));
  const multiple = field.type === "multiselect";
  return {
    id: field.key,
    header,
    question: field.description?.trim() || field.title?.trim() || header,
    multiple,
    required: field.required !== false,
    allowCustom: field.custom === true || options.length === 0,
    options,
    ...(multiple && typeof field.minItems === "number" ? { minItems: field.minItems } : {}),
    ...(multiple && typeof field.maxItems === "number" ? { maxItems: field.maxItems } : {}),
  };
}

export function mapQuestion(raw: RawForm, createdAt?: number): QuestionRequest | null {
  if (!raw || typeof raw.id !== "string" || typeof raw.sessionID !== "string") return null;
  if (raw.metadata?.kind !== "question") return null;
  const questions = (Array.isArray(raw.fields) ? raw.fields : [])
    .map((field, index) => mapQuestionField(field, index))
    .filter((question): question is QuestionItem => Boolean(question));
  if (questions.length === 0) return null;
  return {
    id: raw.id,
    sessionId: raw.sessionID,
    title: raw.title?.trim() || "Questions",
    questions,
    ...(createdAt ? { createdAt } : {}),
  };
}

export function buildFormAnswer(question: QuestionRequest, answers: string[][]): FormAnswer {
  const answer: FormAnswer = {};
  question.questions.forEach((item, index) => {
    const values = answers[index] ?? [];
    answer[item.id] = item.multiple ? values : (values[0] ?? "");
  });
  return answer;
}
