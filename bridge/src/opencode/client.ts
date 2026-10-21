import type { OpenCodeEvent } from "../types.js";

export class OpenCodeError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
    readonly method: string,
    readonly path: string,
  ) {
    super(`OpenCode ${method} ${path} -> ${status}: ${body.slice(0, 300)}`);
    this.name = "OpenCodeError";
  }
}

export class OpenCodeHttp {
  private readonly baseUrl: string;
  private readonly authHeader: string;

  constructor(url: string, password: string) {
    this.baseUrl = url.replace(/\/+$/, "");
    this.authHeader = "Basic " + Buffer.from(`opencode:${password}`).toString("base64");
  }

  get url(): string {
    return this.baseUrl;
  }

  private headers(extra?: Record<string, string>): Record<string, string> {
    return {
      authorization: this.authHeader,
      accept: "application/json",
      ...extra,
    };
  }

  async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(this.baseUrl + path, {
      method,
      headers: this.headers(body === undefined ? undefined : { "content-type": "application/json" }),
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new OpenCodeError(response.status, text, method, path);
    }
    if (response.status === 204 || text.trim() === "") {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  async *events(signal: AbortSignal): AsyncGenerator<OpenCodeEvent> {
    const response = await fetch(this.baseUrl + "/api/event", {
      headers: this.headers({ accept: "text/event-stream", "cache-control": "no-cache" }),
      signal,
    });
    if (!response.ok || !response.body) {
      throw new OpenCodeError(response.status, await response.text(), "GET", "/api/event");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (!signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          const event = parseFrame(frame);
          if (event) yield event;
          boundary = buffer.indexOf("\n\n");
        }
      }
    } finally {
      await reader.cancel().catch(() => undefined);
    }
  }
}

function parseFrame(frame: string): OpenCodeEvent | null {
  const dataLines: string[] = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith(":")) continue;
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const raw = dataLines.join("\n");
  try {
    const parsed = JSON.parse(raw) as Partial<OpenCodeEvent> & { type?: string };
    if (!parsed || typeof parsed.type !== "string") return null;
    return {
      id: typeof parsed.id === "string" ? parsed.id : "",
      type: parsed.type,
      created: parsed.created,
      location: parsed.location,
      data: parsed.data,
      durable: parsed.durable,
    };
  } catch {
    return null;
  }
}
