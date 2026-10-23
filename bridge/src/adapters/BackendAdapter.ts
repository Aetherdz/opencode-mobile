import type {
  DiffFile,
  AvailableModel,
  FormAnswer,
  MessageListPage,
  OpenCodeEvent,
  RawForm,
  RawPermissionRequest,
  RawSession,
  SendPromptInput,
} from "../types.js";

export interface BackendAdapter {
  serverInfo(): Promise<{ version: string; pid?: number }>;
  listModels(): Promise<AvailableModel[]>;
  listSessions(options?: { limit?: number; directory?: string }): Promise<RawSession[]>;
  getSession(id: string): Promise<RawSession>;
  createSession(directory: string, title?: string): Promise<RawSession>;
  renameSession(id: string, title: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
  listMessages(
    id: string,
    options?: { limit?: number; order?: "asc" | "desc"; cursor?: string },
  ): Promise<MessageListPage>;
  sendPrompt(id: string, input: SendPromptInput): Promise<{ id?: string }>;
  interrupt(id: string): Promise<boolean>;
  listPendingPermissions(): Promise<RawPermissionRequest[]>;
  listSessionPermissions(id: string): Promise<RawPermissionRequest[]>;
  listSessionForms(id: string): Promise<RawForm[]>;
  replyForm(id: string, formId: string, answer: FormAnswer): Promise<void>;
  cancelForm(id: string, formId: string, message?: string): Promise<void>;
  replyPermission(
    id: string,
    requestId: string,
    decision: "once" | "always" | "reject",
    message?: string,
  ): Promise<void>;
  getDiff(id: string, from?: string, to?: string): Promise<DiffFile[]>;
  activeSessions(): Promise<Record<string, { type: "running" }>>;
  events(signal: AbortSignal): AsyncGenerator<OpenCodeEvent>;
}
