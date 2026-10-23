import { Platform } from 'react-native';
import { useAuth } from '@/state/auth';
import type {
  ApprovalRequest,
  AvailableModel,
  BridgeConfig,
  ChatMessage,
  Delivery,
  DiffFile,
  MessageFile,
  MessagePage,
  QuestionRequest,
  SessionSummary,
} from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface UploadAsset {
  uri: string;
  name: string;
  mime: string;
  size?: number;
}

export interface UploadRequest {
  promise: Promise<MessageFile>;
  abort: () => void;
}

function baseUrl(): string {
  return useAuth.getState().baseUrl;
}

export function authHeader(): Record<string, string> {
  const token = useAuth.getState().token;
  return token ? { authorization: `Bearer ${token}` } : {};
}

export function absoluteUrl(path: string): string {
  const base = baseUrl();
  if (!path) return '';
  // Never attach the bearer token to a URL supplied by a response. Bridge
  // files are always relative paths; an absolute URL is treated as invalid.
  if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return '';
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 20_000): Promise<T> {
  const base = baseUrl();
  const token = useAuth.getState().token;
  if (!base || !token) {
    throw new ApiError(0, 'not_configured', 'Bridge is not configured.');
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      ...init,
      headers: {
        ...authHeader(),
        accept: 'application/json',
        ...(init.body && !(init.body instanceof FormData)
          ? { 'content-type': 'application/json' }
          : {}),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let parsed: unknown = undefined;
    if (text) {
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = text;
      }
    }
    if (!response.ok) {
      const record = (parsed ?? {}) as { code?: string; error?: string; message?: string };
      throw new ApiError(
        response.status,
        record.code ?? record.error ?? 'request_failed',
        record.message ?? `Request failed (${response.status}).`,
      );
    }
    return parsed as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(0, 'timeout', 'The bridge did not answer in time.');
    }
    throw new ApiError(0, 'network', 'Could not reach the bridge.');
  } finally {
    clearTimeout(timer);
  }
}

export type ConnectionStage = 'reaching' | 'checking' | 'ready';

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function connectionNetworkError(error: unknown, secure: boolean): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof Error && error.name === 'AbortError') {
    return new ApiError(0, 'timeout', 'The bridge did not answer in time.');
  }
  const detail = error instanceof Error ? error.message : '';
  if (/ssl|tls|certificate|handshake|cert/i.test(detail)) {
    return new ApiError(0, 'tls', 'The secure connection could not be established.');
  }
  return new ApiError(
    0,
    secure ? 'secure_unreachable' : 'unreachable',
    secure
      ? 'Could not reach the bridge. Check the HTTPS certificate and the address.'
      : 'Could not reach the bridge. Check the address and the network.',
  );
}

/**
 * Two-step probe: the public /health route identifies a Bridge, then
 * /sessions verifies the token. Stages are reported for the Connect screen.
 */
export async function testConnection(
  base: string,
  token: string,
  onStage?: (stage: ConnectionStage) => void,
): Promise<void> {
  const root = base.replace(/\/+$/, '');
  const secure = /^https:\/\//i.test(root);

  onStage?.('reaching');
  let health: Response;
  try {
    health = await fetchWithTimeout(
      `${root}/health`,
      { headers: { accept: 'application/json' } },
      10_000,
    );
  } catch (error) {
    throw connectionNetworkError(error, secure);
  }
  if (health.status === 401 || health.status === 403 || health.status === 404) {
    throw new ApiError(health.status, 'not_bridge', 'This address does not look like a Bridge.');
  }
  if (!health.ok) {
    throw new ApiError(health.status, 'server', `Bridge returned ${health.status}.`);
  }
  let payload: unknown;
  try {
    payload = await health.json();
  } catch {
    throw new ApiError(0, 'not_bridge', 'The server returned an unexpected response.');
  }
  if (!payload || typeof payload !== 'object' || (payload as { ok?: unknown }).ok !== true) {
    throw new ApiError(0, 'not_bridge', 'This address does not look like a Bridge.');
  }

  onStage?.('checking');
  let response: Response;
  try {
    response = await fetchWithTimeout(
      `${root}/sessions`,
      { headers: { authorization: `Bearer ${token}`, accept: 'application/json' } },
      12_000,
    );
  } catch (error) {
    throw connectionNetworkError(error, secure);
  }
  if (response.status === 401) {
    throw new ApiError(401, 'unauthorized', 'Invalid token.');
  }
  if (response.status === 404) {
    throw new ApiError(404, 'not_bridge', 'This address does not look like a Bridge.');
  }
  if (!response.ok) {
    throw new ApiError(response.status, 'server', `Bridge returned ${response.status}.`);
  }
  let sessions: unknown;
  try {
    sessions = await response.json();
  } catch {
    throw new ApiError(0, 'not_bridge', 'The server returned an unexpected response.');
  }
  if (
    !sessions ||
    typeof sessions !== 'object' ||
    !Array.isArray((sessions as { data?: unknown }).data)
  ) {
    throw new ApiError(0, 'not_bridge', 'The server returned an unexpected response.');
  }
  onStage?.('ready');
}

export async function listSessions(): Promise<SessionSummary[]> {
  const response = await request<{ data: SessionSummary[] }>('/sessions');
  return response.data;
}

export async function getSession(id: string): Promise<SessionSummary> {
  const response = await request<{ data: SessionSummary }>(`/sessions/${encodeURIComponent(id)}`);
  return response.data;
}

export async function createSession(directory: string, title?: string): Promise<SessionSummary> {
  const response = await request<{ data: SessionSummary }>('/sessions', {
    method: 'POST',
    body: JSON.stringify({ directory, ...(title ? { title } : {}) }),
  });
  return response.data;
}

export async function renameSession(id: string, title: string): Promise<void> {
  await request<{ ok: boolean }>(`/sessions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export async function deleteSession(id: string): Promise<void> {
  await request<void>(`/sessions/${encodeURIComponent(id)}?confirm=true`, { method: 'DELETE' });
}

export async function listMessages(
  id: string,
  options: { limit?: number; order?: 'asc' | 'desc'; cursor?: string } = {},
): Promise<MessagePage> {
  const params = new URLSearchParams({
    limit: String(options.limit ?? 60),
    order: options.order ?? 'desc',
  });
  if (options.cursor) params.set('cursor', options.cursor);
  return request<MessagePage>(`/sessions/${encodeURIComponent(id)}/messages?${params.toString()}`);
}

export async function sendMessage(
  id: string,
  input: { text: string; fileIds?: string[]; delivery?: Delivery },
): Promise<{ ok: boolean; id?: string }> {
  return request<{ ok: boolean; id?: string }>(`/sessions/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/**
 * Upload one file through React Native's XMLHttpRequest. Expo's fetch builds
 * multipart bodies in JavaScript and rejects `{ uri, name, type }` file parts;
 * the native XHR path supports them and reports real upload progress.
 */
export function uploadFile(
  sessionId: string,
  asset: UploadAsset,
  onProgress?: (fraction: number) => void,
): UploadRequest {
  const base = baseUrl();
  const token = useAuth.getState().token;
  if (!base || !token) {
    throw new ApiError(0, 'not_configured', 'Bridge is not configured.');
  }

  const form = new FormData();
  if (Platform.OS === 'web') {
    const promise = (async () => {
      let response: Response;
      try {
        response = await fetch(asset.uri);
      } catch {
        throw new ApiError(0, 'file_read', 'Could not read the selected file.');
      }
      if (!response.ok) {
        throw new ApiError(0, 'file_read', 'Could not read the selected file.');
      }
      form.append('files', await response.blob(), asset.name);
      return sendUploadRequest(sessionId, asset, token, form, onProgress);
    })().then((request) => request.promise);
    return { promise, abort: () => undefined };
  } else {
    form.append('files', {
      uri: asset.uri,
      name: asset.name,
      type: asset.mime || 'application/octet-stream',
    } as unknown as Blob);
  }

  return sendUploadRequest(sessionId, asset, token, form, onProgress);
}

function sendUploadRequest(
  sessionId: string,
  asset: UploadAsset,
  token: string,
  form: FormData,
  onProgress?: (fraction: number) => void,
): UploadRequest {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<MessageFile>((resolve, reject) => {
    xhr.open(
      'POST',
      absoluteUrl(`/sessions/${encodeURIComponent(sessionId)}/uploads`),
    );
    xhr.setRequestHeader('authorization', `Bearer ${token}`);
    xhr.setRequestHeader('accept', 'application/json');
    xhr.timeout = 180_000;
    xhr.upload.onprogress = (event) => {
      if (!onProgress) return;
      const total = event.lengthComputable ? event.total : (asset.size ?? 0);
      if (total > 0) {
        onProgress(Math.min(0.99, Math.max(0, event.loaded / total)));
      }
    };
    xhr.onload = () => {
      let parsed: unknown = undefined;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        parsed = xhr.responseText;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        const files = (parsed as { files?: MessageFile[] } | undefined)?.files;
        const file = files?.[0];
        if (!file) {
          reject(
            new ApiError(
              xhr.status,
              'bad_response',
              'The bridge returned an unexpected upload response.',
            ),
          );
          return;
        }
        onProgress?.(1);
        resolve(file);
        return;
      }
      const record = (parsed ?? {}) as { code?: string; error?: string; message?: string };
      reject(
        new ApiError(
          xhr.status,
          record.code ?? record.error ?? 'upload_failed',
          record.message ?? `Upload failed (${xhr.status}).`,
        ),
      );
    };
    xhr.onerror = () => {
      reject(new ApiError(0, 'network', 'Could not reach the bridge while uploading.'));
    };
    xhr.ontimeout = () => {
      reject(new ApiError(0, 'timeout', 'The upload did not finish in time.'));
    };
    xhr.onabort = () => {
      reject(new ApiError(0, 'aborted', 'The upload was cancelled.'));
    };
    onProgress?.(0);
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}

export async function getDiff(id: string): Promise<DiffFile[]> {
  const response = await request<{ data: DiffFile[] }>(
    `/sessions/${encodeURIComponent(id)}/diff`,
  );
  return response.data;
}

export async function replyPermission(
  sessionId: string,
  requestId: string,
  decision: 'once' | 'always' | 'reject',
): Promise<void> {
  await request<void>(
    `/sessions/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(requestId)}/reply`,
    { method: 'POST', body: JSON.stringify({ decision }) },
  );
}

export async function replyPermissionById(
  requestId: string,
  decision: 'once' | 'always' | 'reject',
): Promise<void> {
  await request<{ ok: boolean }>(`/permissions/${encodeURIComponent(requestId)}/reply`, {
    method: 'POST',
    body: JSON.stringify({ decision }),
  });
}

export async function listQuestions(sessionId: string): Promise<QuestionRequest[]> {
  const response = await request<{ data: QuestionRequest[] }>(
    `/sessions/${encodeURIComponent(sessionId)}/questions`,
  );
  return response.data;
}

export async function replyQuestion(
  questionId: string,
  answers: string[][],
): Promise<void> {
  await request<{ ok: boolean }>(`/questions/${encodeURIComponent(questionId)}/reply`, {
    method: 'POST',
    body: JSON.stringify({ answers }),
  });
}

export async function rejectQuestion(questionId: string, message?: string): Promise<void> {
  await request<{ ok: boolean }>(`/questions/${encodeURIComponent(questionId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ ...(message ? { message } : {}) }),
  });
}

export async function stopSession(id: string): Promise<{ interrupted: boolean }> {
  return request<{ interrupted: boolean }>(`/sessions/${encodeURIComponent(id)}/stop`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
}

export async function listPermissions(): Promise<ApprovalRequest[]> {
  const response = await request<{ data: ApprovalRequest[] }>('/permissions');
  return response.data;
}

export async function getConfig(): Promise<BridgeConfig> {
  const response = await request<{ data: BridgeConfig }>('/config');
  return response.data;
}

export async function getModels(): Promise<AvailableModel[]> {
  const response = await request<{ data: AvailableModel[] }>('/models');
  return response.data;
}

export async function registerPushToken(
  token: string,
  platform: 'ios' | 'android' | 'web' | 'unknown',
): Promise<void> {
  await request<{ ok: boolean }>('/push/register', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

export async function unregisterPushToken(token: string): Promise<void> {
  await request<void>('/push/unregister', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
}

export async function getMessagesForReconcile(id: string): Promise<ChatMessage[]> {
  const page = await listMessages(id, { limit: 100, order: 'desc' });
  return page.data.slice().reverse();
}
