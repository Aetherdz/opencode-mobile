export type Source = 'telegram' | 'app';
export type SessionSource = Source | 'both' | 'unknown';
export type SessionStatus =
  | 'idle'
  | 'running'
  | 'error'
  | 'needs_approval'
  | 'waiting_input';
export type Delivery = 'steer' | 'queue';

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
  status: 'running' | 'done' | 'error';
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
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: number;
  source?: Source;
  files?: MessageFile[];
  activities?: Activity[];
  status?: 'streaming' | 'done' | 'error';
  error?: ChatError;
  pending?: boolean;
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
  status: 'added' | 'deleted' | 'modified';
}

export interface BridgeConfig {
  version: string;
  workdirs: string[];
  maxUploadMB: number;
  maxUploadTotalMB: number;
  maxFilesPerMessage: number;
}

export interface MessagePage {
  data: ChatMessage[];
  cursor: { previous?: string | null; next?: string | null };
}

export type ServerWsEvent =
  | { type: 'hello'; serverVersion: string; sessions: string[] }
  | {
      type: 'output.chunk';
      sessionId: string;
      messageId: string;
      ordinal: number;
      delta: string;
      channel: 'text' | 'reasoning';
      done?: boolean;
    }
  | { type: 'tool.summary'; sessionId: string; messageId: string; activity: Activity }
  | { type: 'diff'; sessionId: string; files: DiffFile[] }
  | { type: 'approval.request'; sessionId: string; request: ApprovalRequest }
  | {
      type: 'approval.resolved';
      sessionId: string;
      requestId: string;
      decision: 'once' | 'always' | 'reject';
    }
  | { type: 'question.request'; sessionId: string; question: QuestionRequest }
  | {
      type: 'question.resolved';
      sessionId: string;
      questionId: string;
      status: 'answered' | 'rejected';
    }
  | { type: 'status'; sessionId: string; status: SessionStatus; busyOrigin?: Source }
  | { type: 'session.updated'; session: SessionSummary }
  | { type: 'message.created'; sessionId: string; message: ChatMessage }
  | { type: 'message.completed'; sessionId: string; messageId: string; text: string }
  | { type: 'resume'; sessionId: string; replayed: number }
  | { type: 'ack'; sessionId: string; requestId: string }
  | { type: 'pong'; t: number }
  | { type: 'error'; code: string; message: string };

export type ClientWsEvent =
  | { type: 'subscribe'; sessionId: string; lastEventId?: string }
  | { type: 'unsubscribe'; sessionId: string }
  | {
      type: 'message.send';
      sessionId: string;
      text: string;
      fileIds?: string[];
      delivery?: Delivery;
      requestId?: string;
    }
  | {
      type: 'approval.reply';
      sessionId: string;
      requestId: string;
      decision: 'once' | 'always' | 'reject';
    }
  | { type: 'session.stop'; sessionId: string }
  | { type: 'ping' };
