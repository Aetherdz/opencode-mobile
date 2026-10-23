import { create } from 'zustand';
import {
  ApiError,
  getDiff,
  getSession,
  listMessages,
  listPermissions,
  listQuestions,
  rejectQuestion as rejectQuestionApi,
  replyPermissionById,
  replyQuestion as replyQuestionApi,
  stopSession,
} from '@/api/client';
import { bridgeSocket } from '@/api/ws';
import type {
  Activity,
  ApprovalRequest,
  ChatMessage,
  Delivery,
  ModelSelection,
  DiffFile,
  MessageFile,
  QuestionRequest,
  ServerWsEvent,
  SessionStatus,
  Source,
} from '@/api/types';

interface SendInput {
  text: string;
  files?: MessageFile[];
  delivery?: Delivery;
  model?: ModelSelection;
}

export interface SendResult {
  ok: boolean;
  reason?: 'busy' | 'offline' | 'error';
}

function mergeById(existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  const map = new Map<string, ChatMessage>();
  for (const message of existing) map.set(message.id, message);
  for (const message of incoming) {
    const current = map.get(message.id);
    map.set(message.id, current ? { ...current, ...message, pending: false } : message);
  }
  return [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
}

function updateMessage(
  messages: ChatMessage[],
  id: string,
  update: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  return messages.map((message) => (message.id === id ? update(message) : message));
}

function deriveStatus(
  base: SessionStatus,
  questions: QuestionRequest[],
  approvals: ApprovalRequest[],
): SessionStatus {
  if (base === 'error') return 'error';
  if (questions.length > 0) return 'waiting_input';
  if (approvals.length > 0) return 'needs_approval';
  if (base === 'waiting_input' || base === 'needs_approval') return 'running';
  return base;
}

function alreadyGone(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 409);
}

export interface ChatState {
  sessionId: string | null;
  messages: ChatMessage[];
  status: SessionStatus;
  busyOrigin?: Source;
  diff: DiffFile[];
  approvals: ApprovalRequest[];
  questions: QuestionRequest[];
  reasoning: Record<string, string>;
  loading: boolean;
  loadingOlder: boolean;
  hasOlder: boolean;
  cursor: string | null;
  error: string | null;
  lastErrorCode: string | null;
  load: (sessionId: string) => Promise<void>;
  loadOlder: () => Promise<void>;
  reconcile: () => Promise<void>;
  refreshInputs: () => Promise<void>;
  applyEvent: (event: ServerWsEvent) => void;
  send: (input: SendInput) => Promise<SendResult>;
  retryLast: () => Promise<SendResult>;
  stop: () => Promise<void>;
  replyApproval: (requestId: string, decision: 'once' | 'always' | 'reject') => Promise<void>;
  replyQuestion: (questionId: string, answers: string[][]) => Promise<void>;
  rejectQuestion: (questionId: string) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  sessionId: null,
  messages: [] as ChatMessage[],
  status: 'idle' as SessionStatus,
  busyOrigin: undefined as Source | undefined,
  diff: [] as DiffFile[],
  approvals: [] as ApprovalRequest[],
  questions: [] as QuestionRequest[],
  reasoning: {} as Record<string, string>,
  loading: false,
  loadingOlder: false,
  hasOlder: false,
  cursor: null as string | null,
  error: null as string | null,
  lastErrorCode: null as string | null,
};

export const useChat = create<ChatState>((set, get) => ({
  ...initialState,

  load: async (sessionId) => {
    if (get().sessionId !== sessionId) {
      set({ ...initialState, sessionId, loading: true });
    } else {
      set({ loading: true, error: null });
    }
    try {
      const page = await listMessages(sessionId, { limit: 100, order: 'desc' });
      const messages = page.data.slice().reverse();
      const cursor = page.cursor?.next ?? null;
      const [diff, pending, questions] = await Promise.all([
        getDiff(sessionId).catch(() => []),
        listPermissions().catch(() => []),
        listQuestions(sessionId).catch(() => []),
      ]);
      const session = await getSession(sessionId).catch(() => null);
      const approvals = pending.filter((request) => request.sessionId === sessionId);
      if (get().sessionId !== sessionId) return;
      set({
        messages,
        hasOlder: Boolean(cursor),
        cursor,
        diff,
        approvals,
        questions,
        status: deriveStatus(session?.status ?? get().status, questions, approvals),
        busyOrigin: session?.busyOrigin,
        loading: false,
        error: null,
      });
    } catch (error) {
      if (get().sessionId !== sessionId) return;
      set({
        loading: false,
        error: error instanceof Error ? error.message : 'Could not load messages.',
      });
    }
  },

  loadOlder: async () => {
    const { sessionId, cursor, loadingOlder, hasOlder } = get();
    if (!sessionId || !cursor || loadingOlder || !hasOlder) return;
    set({ loadingOlder: true });
    try {
      const page = await listMessages(sessionId, { limit: 60, order: 'desc', cursor });
      const older = page.data.slice().reverse();
      if (get().sessionId !== sessionId) return;
      set((state) => ({
        messages: mergeById(older, state.messages),
        cursor: page.cursor?.next ?? null,
        hasOlder: Boolean(page.cursor?.next),
        loadingOlder: false,
      }));
    } catch {
      set({ loadingOlder: false });
    }
  },

  reconcile: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    try {
      const page = await listMessages(sessionId, { limit: 100, order: 'desc' });
      const incoming = page.data.slice().reverse();
      if (get().sessionId !== sessionId) return;
      set((state) => {
        const pending = state.messages.filter((message) => message.pending);
        const merged = mergeById([], [...incoming, ...pending]);
        return { messages: merged };
      });
    } catch {
      // the socket will retry; keep the current transcript
    }
  },

  refreshInputs: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    const [pendingResult, questionsResult] = await Promise.allSettled([
      listPermissions(),
      listQuestions(sessionId),
    ]);
    if (get().sessionId !== sessionId) return;
    const session = await getSession(sessionId).catch(() => null);
    if (get().sessionId !== sessionId) return;
    set((state) => {
      const approvals =
        pendingResult.status === 'fulfilled'
          ? pendingResult.value.filter((request) => request.sessionId === sessionId)
          : state.approvals;
      const questions =
        questionsResult.status === 'fulfilled' ? questionsResult.value : state.questions;
      return {
        approvals,
        questions,
        status: deriveStatus(session?.status ?? state.status, questions, approvals),
        busyOrigin: session ? session.busyOrigin : state.busyOrigin,
      };
    });
  },

  applyEvent: (event) => {
    const sessionId = get().sessionId;
    if (!sessionId) return;

    switch (event.type) {
      case 'status': {
        if (event.sessionId !== sessionId) return;
        set((state) => ({
          status: deriveStatus(event.status, state.questions, state.approvals),
          busyOrigin: event.busyOrigin,
        }));
        return;
      }
      case 'diff': {
        if (event.sessionId !== sessionId) return;
        set({ diff: event.files });
        return;
      }
      case 'approval.request': {
        if (event.sessionId !== sessionId) return;
        set((state) => {
          if (state.approvals.some((request) => request.id === event.request.id)) return state;
          const approvals = [...state.approvals, event.request];
          return {
            approvals,
            status: deriveStatus('needs_approval', state.questions, approvals),
          };
        });
        return;
      }
      case 'approval.resolved': {
        if (event.sessionId !== sessionId) return;
        set((state) => {
          const approvals = state.approvals.filter((request) => request.id !== event.requestId);
          return {
            approvals,
            status: deriveStatus('running', state.questions, approvals),
          };
        });
        return;
      }
      case 'question.request': {
        if (event.sessionId !== sessionId) return;
        set((state) => {
          if (state.questions.some((question) => question.id === event.question.id)) return state;
          const questions = [...state.questions, event.question];
          return {
            questions,
            status: deriveStatus(state.status, questions, state.approvals),
          };
        });
        return;
      }
      case 'question.resolved': {
        if (event.sessionId !== sessionId) return;
        set((state) => {
          const questions = state.questions.filter(
            (question) => question.id !== event.questionId,
          );
          return {
            questions,
            status: deriveStatus('running', questions, state.approvals),
          };
        });
        return;
      }
      case 'message.created': {
        if (event.sessionId !== sessionId) return;
        const message = event.message;
        set((state) => {
          if (message.role === 'user') {
            const pendingIndex = state.messages.findIndex(
              (item) => item.pending && item.role === 'user',
            );
            if (pendingIndex >= 0) {
              const copy = state.messages.slice();
              copy[pendingIndex] = { ...message, pending: false };
              return {
                messages: copy,
                status: deriveStatus('running', state.questions, state.approvals),
              };
            }
          }
          if (state.messages.some((item) => item.id === message.id)) {
            return {
              messages: updateMessage(state.messages, message.id, (item) => ({
                ...item,
                ...message,
                text: message.text.length > 0 ? message.text : item.text,
                pending: false,
              })),
            };
          }
          return {
            messages: [...state.messages, { ...message, pending: false }],
            ...(message.role === 'user'
              ? { status: deriveStatus('running', state.questions, state.approvals) }
              : {}),
          };
        });
        return;
      }
      case 'output.chunk': {
        if (event.sessionId !== sessionId) return;
        if (event.channel === 'reasoning') {
          set((state) => ({
            reasoning: {
              ...state.reasoning,
              [event.messageId]: (state.reasoning[event.messageId] ?? '') + event.delta,
            },
          }));
          return;
        }
        set((state) => ({
          messages: updateMessage(state.messages, event.messageId, (message) => ({
            ...message,
            text: message.text + event.delta,
            status: 'streaming',
          })),
        }));
        return;
      }
      case 'message.completed': {
        if (event.sessionId !== sessionId) return;
        set((state) => ({
          messages: updateMessage(state.messages, event.messageId, (message) => ({
            ...message,
            text: event.text.length > 0 ? event.text : message.text,
            status: 'done',
          })),
        }));
        return;
      }
      case 'tool.summary': {
        if (event.sessionId !== sessionId) return;
        const next = { ...event.activity } as Activity;
        set((state) => ({
          messages: updateMessage(state.messages, event.messageId, (message) => {
            const activities = message.activities ? message.activities.slice() : [];
            const index = activities.findIndex((activity) => activity.id === next.id);
            if (index >= 0) activities[index] = next;
            else activities.push(next);
            return { ...message, activities, status: message.status ?? 'streaming' };
          }),
        }));
        return;
      }
      case 'resume': {
        if (event.sessionId !== sessionId) return;
        void get().reconcile();
        void get().refreshInputs();
        return;
      }
      case 'error': {
        if (event.code === 'upstream_disconnected') {
          set({ error: event.message, lastErrorCode: event.code });
        } else if (event.code === 'model_unavailable') {
          const optimisticId = event.requestId?.startsWith('req_local_')
            ? event.requestId.slice(4)
            : null;
          set((state) => ({
            messages: optimisticId
              ? state.messages.filter((message) => message.id !== optimisticId)
              : state.messages,
            error: event.message,
            lastErrorCode: event.code,
          }));
        }
        return;
      }
      default:
        return;
    }
  },

  send: async ({ text, files, delivery, model }) => {
    const { sessionId, status, busyOrigin } = get();
    if (!sessionId) return { ok: false, reason: 'error' };
    const busy =
      status === 'running' || status === 'waiting_input' || status === 'needs_approval';
    if (busy && !delivery) {
      set({
        error: busyOrigin ? `Busy (started from ${busyOrigin})` : 'Session is busy.',
        lastErrorCode: 'busy',
      });
      return { ok: false, reason: 'busy' };
    }
    const tempId = `local_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const optimistic: ChatMessage = {
      id: tempId,
      sessionId,
      role: 'user',
      text,
      createdAt: Date.now(),
      source: 'app',
      ...(files && files.length > 0 ? { files } : {}),
      status: 'done',
      pending: true,
    };
    set((state) => ({
      messages: [...state.messages, optimistic],
      error: null,
      lastErrorCode: null,
    }));
    const requestId = `req_${tempId}`;
    const sent = bridgeSocket.send({
      type: 'message.send',
      sessionId,
      text,
      ...(files && files.length > 0 ? { fileIds: files.map((file) => file.id) } : {}),
      ...(delivery ? { delivery } : {}),
      ...(model ? { model } : {}),
      requestId,
    });
    if (!sent) {
      set((state) => ({
        messages: state.messages.filter((message) => message.id !== tempId),
        error: 'Not connected to the bridge.',
        lastErrorCode: 'offline',
      }));
      return { ok: false, reason: 'offline' };
    }
    set((state) => ({
      status: deriveStatus('running', state.questions, state.approvals),
    }));
    return { ok: true };
  },

  retryLast: async () => {
    const { sessionId, status, busyOrigin, messages } = get();
    if (!sessionId) return { ok: false, reason: 'error' };
    const busy =
      status === 'running' || status === 'waiting_input' || status === 'needs_approval';
    if (busy) {
      set({
        error: busyOrigin ? `Busy (started from ${busyOrigin})` : 'Session is busy.',
        lastErrorCode: 'busy',
      });
      return { ok: false, reason: 'busy' };
    }
    const lastUser = [...messages]
      .reverse()
      .find(
        (message) =>
          message.role === 'user' &&
          (message.text.trim().length > 0 || (message.files?.length ?? 0) > 0),
      );
    if (!lastUser) return { ok: false, reason: 'error' };

    const requestId = `req_retry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const sent = bridgeSocket.send({
      type: 'message.send',
      sessionId,
      text: lastUser.text,
      ...(lastUser.files && lastUser.files.length > 0
        ? { fileIds: lastUser.files.map((file) => file.id) }
        : {}),
      requestId,
    });
    if (!sent) {
      set({
        error: 'Not connected to the bridge.',
        lastErrorCode: 'offline',
      });
      return { ok: false, reason: 'offline' };
    }
    set((state) => ({
      status: deriveStatus('running', state.questions, state.approvals),
      error: null,
      lastErrorCode: null,
    }));
    return { ok: true };
  },

  stop: async () => {
    const { sessionId } = get();
    if (!sessionId) return;
    bridgeSocket.send({ type: 'session.stop', sessionId });
    try {
      await stopSession(sessionId);
    } catch {
      // the socket event will correct the state
    }
  },

  replyApproval: async (requestId, decision) => {
    if (!get().sessionId) return;
    try {
      await replyPermissionById(requestId, decision);
    } catch (error) {
      if (alreadyGone(error)) {
        await get().refreshInputs();
        if (!get().approvals.some((request) => request.id === requestId)) return;
      }
      throw error;
    }
    set((state) => {
      const approvals = state.approvals.filter((request) => request.id !== requestId);
      return {
        approvals,
        status: deriveStatus('running', state.questions, approvals),
      };
    });
  },

  replyQuestion: async (questionId, answers) => {
    if (!get().sessionId) return;
    try {
      await replyQuestionApi(questionId, answers);
    } catch (error) {
      if (alreadyGone(error)) {
        await get().refreshInputs();
        if (!get().questions.some((question) => question.id === questionId)) return;
      }
      throw error;
    }
    set((state) => {
      const questions = state.questions.filter((question) => question.id !== questionId);
      return {
        questions,
        status: deriveStatus('running', questions, state.approvals),
      };
    });
  },

  rejectQuestion: async (questionId) => {
    if (!get().sessionId) return;
    try {
      await rejectQuestionApi(questionId);
    } catch (error) {
      if (alreadyGone(error)) {
        await get().refreshInputs();
        if (!get().questions.some((question) => question.id === questionId)) return;
      }
      throw error;
    }
    set((state) => {
      const questions = state.questions.filter((question) => question.id !== questionId);
      return {
        questions,
        status: deriveStatus('running', questions, state.approvals),
      };
    });
  },

  clearError: () => set({ error: null, lastErrorCode: null }),

  reset: () => set({ ...initialState }),
}));
