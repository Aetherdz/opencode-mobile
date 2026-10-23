/** Minimal MCP stdio server exposing non-sensitive bridge health only. */
const MAX_LINE_BYTES = 1024 * 1024;
const SUPPORTED_PROTOCOLS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"] as const;

type JsonRpcId = string | number | null;
type JsonObject = Record<string, unknown>;

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: JsonObject;
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function response(id: JsonRpcId, result: unknown): JsonObject {
  return { jsonrpc: "2.0", id, result };
}

function errorResponse(id: JsonRpcId, code: number, message: string): JsonObject {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

function selectedProtocol(value: unknown): string {
  const fallback = SUPPORTED_PROTOCOLS[0];
  if (typeof value !== "string") return fallback;
  return SUPPORTED_PROTOCOLS.find((version) => version === value) ?? fallback;
}

export async function handleMcpRequest(value: unknown): Promise<JsonObject | null> {
  if (!isRecord(value) || value.jsonrpc !== "2.0" || typeof value.method !== "string") {
    return errorResponse(isRecord(value) && (typeof value.id === "string" || typeof value.id === "number" || value.id === null) ? value.id : null, -32600, "Invalid JSON-RPC request");
  }
  const request = value as unknown as JsonRpcRequest;
  const hasId = Object.prototype.hasOwnProperty.call(value, "id");
  const id = typeof value.id === "string" || typeof value.id === "number" || value.id === null ? value.id : null;

  // Notifications have no response, including unknown notifications.
  if (!hasId) return null;

  switch (request.method) {
    case "initialize":
      return response(id, {
        protocolVersion: selectedProtocol(request.params?.protocolVersion),
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "opencode-mobile", version: "0.2.0" },
        instructions: "Reports only whether the local OpenCode Mobile bridge is healthy. It does not expose pairing credentials or session content.",
      });
    case "ping":
      return response(id, {});
    case "tools/list":
      return response(id, {
        tools: [
          {
            name: "mobile_status",
            description: "Check whether the OpenCode Mobile bridge is responding locally. Does not return credentials, URLs, or session data.",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
          },
        ],
      });
    case "tools/call": {
      const name = request.params?.name;
      if (name !== "mobile_status") {
        return response(id, { content: [{ type: "text", text: "Unknown OpenCode Mobile tool." }], isError: true });
      }
      const args = request.params?.arguments;
      if (args !== undefined && (!isRecord(args) || Object.keys(args).length > 0)) {
        return response(id, { content: [{ type: "text", text: "mobile_status accepts no arguments." }], isError: true });
      }
      const port = Number(process.env.PORT ?? "8787");
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        return response(id, { content: [{ type: "text", text: "Bridge port configuration is invalid." }], isError: true });
      }
      try {
        const health = await fetch(`http://127.0.0.1:${port}/health`, {
          headers: { accept: "application/json" },
          signal: AbortSignal.timeout(1500),
        });
        const healthy = health.ok && (await health.text()) === '{"ok":true}';
        return response(id, {
          content: [{ type: "text", text: healthy ? "OpenCode Mobile bridge is healthy." : "OpenCode Mobile bridge is not healthy." }],
          isError: !healthy,
        });
      } catch {
        return response(id, {
          content: [{ type: "text", text: "OpenCode Mobile bridge is unavailable." }],
          isError: true,
        });
      }
    }
    default:
      return errorResponse(id, -32601, "Method not found");
  }
}

/** Support JSON-RPC batches for MCP revisions that still permit them. */
export async function handleMcpMessage(value: unknown): Promise<JsonObject | JsonObject[] | null> {
  if (!Array.isArray(value)) return handleMcpRequest(value);
  if (value.length === 0) return errorResponse(null, -32600, "Invalid JSON-RPC batch");
  const replies: JsonObject[] = [];
  for (const item of value) {
    const reply = await handleMcpRequest(item);
    if (reply) replies.push(reply);
  }
  return replies.length > 0 ? replies : null;
}

/** Read/write newline-delimited JSON-RPC. Protocol output is the only stdout. */
export async function runMcpStdio(): Promise<void> {
  let pending = Buffer.alloc(0);
  for await (const chunk of process.stdin) {
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    pending = Buffer.concat([pending, bytes]);
    if (pending.length > MAX_LINE_BYTES && !pending.includes(0x0a)) {
      process.stderr.write("MCP input line exceeds the 1 MiB limit\n");
      process.exitCode = 1;
      return;
    }
    while (true) {
      const newline = pending.indexOf(0x0a);
      if (newline < 0) break;
      const line = pending.subarray(0, newline);
      pending = pending.subarray(newline + 1);
      if (!line.length) continue;
      if (line.length > MAX_LINE_BYTES) {
        process.stderr.write("MCP input line exceeds the 1 MiB limit\n");
        continue;
      }
      let message: unknown;
      try {
        message = JSON.parse(line.toString("utf8"));
      } catch {
        process.stdout.write(`${JSON.stringify(errorResponse(null, -32700, "Parse error"))}\n`);
        continue;
      }
      const reply = await handleMcpMessage(message);
      if (reply) process.stdout.write(`${JSON.stringify(reply)}\n`);
    }
  }
  if (pending.length) {
    process.stdout.write(`${JSON.stringify(errorResponse(null, -32700, "Incomplete JSON-RPC message"))}\n`);
  }
}
