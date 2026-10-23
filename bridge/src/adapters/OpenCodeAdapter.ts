import type { BackendAdapter } from "./BackendAdapter.js";
import { OpenCodeHttp } from "../opencode/client.js";
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

type Wrapped<T> = { data: T };

export function mapAvailableModels(rawModels: unknown, rawProviders: unknown): AvailableModel[] {
  const models = Array.isArray(rawModels) ? rawModels : [];
  const providers = Array.isArray(rawProviders) ? rawProviders : [];
  const providerNames = new Map<string, string>();
  for (const value of providers) {
    if (!value || typeof value !== "object") continue;
    const provider = value as Record<string, unknown>;
    if (typeof provider.id === "string" && typeof provider.name === "string") {
      providerNames.set(provider.id, provider.name);
    }
  }
  const safe: AvailableModel[] = [];
  for (const value of models) {
    if (!value || typeof value !== "object") continue;
    const model = value as Record<string, unknown>;
    if (
      model.enabled !== true ||
      typeof model.providerID !== "string" ||
      typeof model.modelID !== "string" ||
      typeof model.name !== "string"
    ) continue;
    safe.push({
      providerId: model.providerID,
      modelId: model.modelID,
      name: model.name,
      providerName: providerNames.get(model.providerID) ?? model.providerID,
    });
  }
  return safe;
}

function seg(value: string): string {
  return encodeURIComponent(value);
}

function unwrap<T>(value: T | Wrapped<T>): T {
  if (value && typeof value === "object" && "data" in value) {
    return (value as Wrapped<T>).data;
  }
  return value as T;
}

export class OpenCodeAdapter implements BackendAdapter {
  constructor(private readonly http: OpenCodeHttp) {}

  static fromService(service: { url: string; password: string }): OpenCodeAdapter {
    return new OpenCodeAdapter(new OpenCodeHttp(service.url, service.password));
  }

  async serverInfo(): Promise<{ version: string; pid?: number }> {
    return this.http.request<{ version: string; pid?: number }>("GET", "/api/info");
  }

  async listModels(): Promise<AvailableModel[]> {
    const [modelsResponse, providersResponse] = await Promise.all([
      this.http.request<Wrapped<unknown[]>>("GET", "/api/model"),
      this.http.request<Wrapped<unknown[]>>("GET", "/api/provider").catch(() => ({ data: [] })),
    ]);
    return mapAvailableModels(unwrap(modelsResponse), unwrap(providersResponse));
  }

  async listSessions(options?: { limit?: number; directory?: string }): Promise<RawSession[]> {
    const query = new URLSearchParams({
      limit: String(options?.limit ?? 50),
      order: "desc",
      parentID: "null",
    });
    if (options?.directory) query.set("directory", options.directory);
    const response = await this.http.request<Wrapped<RawSession[]>>(
      "GET",
      `/api/session?${query.toString()}`,
    );
    return unwrap(response) ?? [];
  }

  async getSession(id: string): Promise<RawSession> {
    const response = await this.http.request<Wrapped<RawSession>>("GET", `/api/session/${seg(id)}`);
    return unwrap(response);
  }

  async createSession(directory: string, title?: string): Promise<RawSession> {
    const response = await this.http.request<Wrapped<RawSession>>("POST", "/api/session", {
      location: { directory },
      ...(title ? { title } : {}),
    });
    return unwrap(response);
  }

  async renameSession(id: string, title: string): Promise<void> {
    await this.http.request<void>("PATCH", `/api/session/${seg(id)}`, { title });
  }

  async deleteSession(id: string): Promise<void> {
    await this.http.request<void>("DELETE", `/api/session/${seg(id)}`);
  }

  async listMessages(
    id: string,
    options?: { limit?: number; order?: "asc" | "desc"; cursor?: string },
  ): Promise<MessageListPage> {
    const limit = options?.limit ?? 100;
    const query = new URLSearchParams({ limit: String(limit) });
    // The upstream cursor already encodes order; sending both is rejected.
    if (options?.cursor) query.set("cursor", options.cursor);
    else query.set("order", options?.order ?? "asc");
    const page = await this.http.request<MessageListPage>(
      "GET",
      `/api/session/${seg(id)}/message?${query.toString()}`,
    );
    // The upstream always returns a next cursor, even for the last page.
    if (page.data.length < limit) {
      page.cursor = { ...page.cursor, next: undefined };
    }
    return page;
  }

  async sendPrompt(id: string, input: SendPromptInput): Promise<{ id?: string }> {
    const response = await this.http.request<Wrapped<{ id?: string }>>(
      "POST",
      `/api/session/${seg(id)}/prompt`,
      {
        text: input.text,
        ...(input.files && input.files.length > 0 ? { files: input.files } : {}),
        ...(input.metadata ? { metadata: input.metadata } : {}),
        ...(input.delivery ? { delivery: input.delivery } : {}),
        ...(input.resume === undefined ? {} : { resume: input.resume }),
        ...(input.model ? { model: input.model } : {}),
      },
    );
    return unwrap(response) ?? {};
  }

  async interrupt(id: string): Promise<boolean> {
    const response = await this.http.request<
      Wrapped<{ interrupted?: boolean }> | { interrupted?: boolean }
    >("POST", `/api/session/${seg(id)}/interrupt`, {});
    const data = unwrap(response);
    return Boolean(data?.interrupted);
  }

  async listPendingPermissions(): Promise<RawPermissionRequest[]> {
    const response = await this.http.request<Wrapped<RawPermissionRequest[]>>(
      "GET",
      "/api/permission/request",
    );
    return unwrap(response) ?? [];
  }

  async listSessionPermissions(id: string): Promise<RawPermissionRequest[]> {
    const response = await this.http.request<Wrapped<RawPermissionRequest[]>>(
      "GET",
      `/api/session/${seg(id)}/permission`,
    );
    return unwrap(response) ?? [];
  }

  async listSessionForms(id: string): Promise<RawForm[]> {
    const response = await this.http.request<Wrapped<RawForm[]>>(
      "GET",
      `/api/session/${seg(id)}/form`,
    );
    return unwrap(response) ?? [];
  }

  async replyForm(id: string, formId: string, answer: FormAnswer): Promise<void> {
    await this.http.request<void>(
      "POST",
      `/api/session/${seg(id)}/form/${seg(formId)}/reply`,
      { answer },
    );
  }

  async cancelForm(id: string, formId: string, message?: string): Promise<void> {
    const query = new URLSearchParams();
    if (message) query.set("message", message);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    await this.http.request<void>(
      "DELETE",
      `/api/session/${seg(id)}/form/${seg(formId)}${suffix}`,
    );
  }

  async replyPermission(
    id: string,
    requestId: string,
    decision: "once" | "always" | "reject",
    message?: string,
  ): Promise<void> {
    await this.http.request<void>(
      "POST",
      `/api/session/${seg(id)}/permission/${seg(requestId)}/reply`,
      { decision, ...(message ? { message } : {}) },
    );
  }

  async getDiff(id: string, from?: string, to?: string): Promise<DiffFile[]> {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const suffix = query.size > 0 ? `?${query.toString()}` : "";
    const response = await this.http.request<
      DiffFile[] | Wrapped<DiffFile[]> | { data: { files?: DiffFile[] } }
    >("GET", `/api/session/${seg(id)}/diff${suffix}`);
    if (Array.isArray(response)) return response;
    if (response && typeof response === "object" && "data" in response) {
      const data = response.data;
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object" && Array.isArray((data as { files?: DiffFile[] }).files)) {
        return (data as { files: DiffFile[] }).files;
      }
    }
    return [];
  }

  async activeSessions(): Promise<Record<string, { type: "running" }>> {
    const response = await this.http.request<Wrapped<Record<string, { type: "running" }>>>(
      "GET",
      "/api/session/active",
    );
    return unwrap(response) ?? {};
  }

  events(signal: AbortSignal): AsyncGenerator<OpenCodeEvent> {
    return this.http.events(signal);
  }
}
