export type Source = "telegram" | "app";
export type SessionSource = Source | "both" | "unknown";
export type SessionStatus = "idle" | "running" | "error" | "needs_approval" | "waiting_input";
export type Delivery = "steer" | "queue";

export interface SessionSummary {
  id: string;
  title: string;
  directory: string;
  source: SessionSource;
  status: SessionStatus;
  lastActivity: number;
  createdAt: number;
  updatedAt: number;
  busyOrigin?: Source;
}

export interface MessageFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  url: string;
}

export interface Activity {
  id: string;
  name: string;
  title: string;
  status: "running" | "done" | "error";
  detail?: string;
}

export interface ChatError {
  message: string;
  code?: string;
  detail?: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  text: string;
  createdAt: number;
  source?: Source;
  files?: MessageFile[];
  activities?: Activity[];
  status?: "streaming" | "done" | "error";
  error?: ChatError;
}

export interface ApprovalRequest {
  id: string;
  sessionId: string;
  action: string;
  resources: string[];
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface QuestionItem {
  id: string;
  header: string;
  question: string;
  multiple: boolean;
  required: boolean;
  allowCustom: boolean;
  options: QuestionOption[];
  minItems?: number;
  maxItems?: number;
}

export interface QuestionRequest {
  id: string;
  sessionId: string;
  title: string;
  questions: QuestionItem[];
  createdAt?: number;
}

export interface DiffFile {
  file: string;
  patch: string;
  additions: number;
  deletions: number;
  status: "added" | "deleted" | "modified";
}

export interface SendPromptInput {
  text: string;
  files?: Array<{ uri: string; name?: string; description?: string }>;
  metadata?: Record<string, unknown>;
  delivery?: Delivery;
  resume?: boolean;
}

export interface RawSession {
  id: string;
  parentID?: string;
  projectID: string;
  title?: string;
  time: { created: number; updated: number; archived?: number };
  location?: { directory?: string };
  metadata?: Record<string, unknown>;
  outcome?: string;
}

export interface RawUserMessage {
  id: string;
  type: "user";
  text: string;
  time: { created: number };
  metadata?: Record<string, unknown>;
  files?: Array<{
    name?: string;
    mime?: string;
    source?: { type: "inline" | "uri"; uri?: string };
    data?: string;
  }>;
}

export interface RawAssistantMessage {
  id: string;
  type: "assistant";
  time: { created: number; completed?: number; streamed?: number };
  content: Array<
    | { type: "text"; text: string }
    | { type: "reasoning"; text: string }
    | {
        type: "tool";
        id: string;
        name: string;
        state:
          | { status: "streaming"; input: string }
          | { status: "running"; input: Record<string, unknown>; metadata?: Record<string, unknown> }
          | {
              status: "completed";
              input: Record<string, unknown>;
              content: Array<{ type: "text"; text: string } | { type: "file"; [key: string]: unknown }>;
              metadata?: Record<string, unknown>;
            }
          | { status: "error"; input: Record<string, unknown>; error?: unknown };
        time: { created: number; ran?: number; completed?: number };
      }
  >;
  error?: unknown;
}

export type RawMessage = RawUserMessage | RawAssistantMessage | { id: string; type: string; time: { created: number } };

export interface RawPermissionRequest {
  id: string;
  sessionID: string;
  action: string;
  resources: string[];
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface RawFormOption {
  value: string;
  label: string;
  description?: string;
}

export interface RawFormField {
  key: string;
  type: string;
  title?: string;
  description?: string;
  required?: boolean;
  hidden?: boolean;
  options?: RawFormOption[];
  custom?: boolean;
  minItems?: number;
  maxItems?: number;
}

export interface RawForm {
  id: string;
  sessionID: string;
  title: string;
  metadata?: Record<string, unknown>;
  fields: RawFormField[];
}

export type FormAnswer = Record<string, string | string[]>;

export interface SessionListPage {
  data: RawSession[];
  cursor?: { previous?: string | null; next?: string | null };
}

export interface MessageListPage {
  data: RawMessage[];
  cursor: { previous?: string | null; next?: string | null };
}

export interface OpenCodeEvent {
  id: string;
  type: string;
  created?: number;
  location?: { directory?: string };
  data?: Record<string, unknown>;
  durable?: { aggregateID?: string; seq?: number; version?: number };
}

export type ServerWsEvent =
  | { type: "hello"; serverVersion: string; sessions: string[] }
  | {
      type: "output.chunk";
      sessionId: string;
      messageId: string;
      ordinal: number;
      delta: string;
      channel: "text" | "reasoning";
      done?: boolean;
    }
  | { type: "tool.summary"; sessionId: string; messageId: string; activity: Activity }
  | { type: "diff"; sessionId: string; files: DiffFile[] }
  | { type: "approval.request"; sessionId: string; request: ApprovalRequest }
  | {
      type: "approval.resolved";
      sessionId: string;
      requestId: string;
      decision: "once" | "always" | "reject";
    }
  | { type: "question.request"; sessionId: string; question: QuestionRequest }
  | {
      type: "question.resolved";
      sessionId: string;
      questionId: string;
      status: "answered" | "rejected";
    }
  | { type: "status"; sessionId: string; status: SessionStatus; busyOrigin?: Source }
  | { type: "session.updated"; session: SessionSummary }
  | { type: "message.created"; sessionId: string; message: ChatMessage }
  | { type: "message.completed"; sessionId: string; messageId: string; text: string }
  | { type: "resume"; sessionId: string; replayed: number }
  | { type: "ack"; sessionId: string; requestId: string }
  | { type: "pong"; t: number }
  | { type: "error"; code: string; message: string };

export type ClientWsEvent =
  | { type: "subscribe"; sessionId: string; lastEventId?: string }
  | { type: "unsubscribe"; sessionId: string }
  | {
      type: "message.send";
      sessionId: string;
      text: string;
      fileIds?: string[];
      delivery?: Delivery;
      requestId?: string;
    }
  | {
      type: "approval.reply";
      sessionId: string;
      requestId: string;
      decision: "once" | "always" | "reject";
    }
  | { type: "session.stop"; sessionId: string }
  | { type: "ping" };
