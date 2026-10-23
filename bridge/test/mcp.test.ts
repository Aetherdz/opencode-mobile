import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { handleMcpMessage, handleMcpRequest } from "../src/mcp.js";

describe("OpenCode Mobile MCP stdio protocol", () => {
  it("negotiates protocol and advertises only a non-sensitive status tool", async () => {
    const initialized = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05", capabilities: {}, clientInfo: { name: "test", version: "1" } },
    });
    expect(initialized?.result).toMatchObject({
      protocolVersion: "2024-11-05",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "opencode-mobile" },
    });
    const listed = await handleMcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(listed?.result).toMatchObject({ tools: [{ name: "mobile_status", inputSchema: { additionalProperties: false } }] });
    expect(JSON.stringify(listed)).not.toMatch(/auth_token|password|secret/i);
  });

  it("ignores notifications and rejects unknown methods", async () => {
    await expect(handleMcpRequest({ jsonrpc: "2.0", method: "notifications/initialized" })).resolves.toBeNull();
    const result = await handleMcpRequest({ jsonrpc: "2.0", id: "x", method: "not/a/method" });
    expect(result).toMatchObject({ error: { code: -32601 } });
  });

  it("selects the latest protocol fallback and handles legacy JSON-RPC batches", async () => {
    const initialized = await handleMcpRequest({
      jsonrpc: "2.0",
      id: "future",
      method: "initialize",
      params: { protocolVersion: "2099-01-01" },
    });
    expect(initialized?.result).toMatchObject({ protocolVersion: "2025-11-25" });

    const batch = await handleMcpMessage([
      { jsonrpc: "2.0", id: 1, method: "ping" },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "ping" },
    ]);
    expect(batch).toEqual([
      { jsonrpc: "2.0", id: 1, result: {} },
      { jsonrpc: "2.0", id: 2, result: {} },
    ]);
    await expect(handleMcpMessage([])).resolves.toMatchObject({ error: { code: -32600 } });
  });

  it("reports unavailable without exposing connection details", async () => {
    const oldPort = process.env.PORT;
    process.env.PORT = "1";
    try {
      const result = await handleMcpRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: { name: "mobile_status", arguments: {} },
      });
      expect(result?.result).toMatchObject({ isError: true });
      expect(JSON.stringify(result)).toContain("bridge is unavailable");
      expect(JSON.stringify(result)).not.toMatch(/AUTH_TOKEN|password|127\.0\.0\.1|token/i);
    } finally {
      if (oldPort === undefined) delete process.env.PORT;
      else process.env.PORT = oldPort;
    }
  });

  it("reports healthy only for the exact local bridge health response", async () => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { "content-type": "application/json" });
      response.end('{"ok":true}');
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Test health server did not bind");
    const oldPort = process.env.PORT;
    process.env.PORT = String(address.port);
    try {
      const result = await handleMcpRequest({
        jsonrpc: "2.0",
        id: 5,
        method: "tools/call",
        params: { name: "mobile_status", arguments: {} },
      });
      expect(result?.result).toMatchObject({ isError: false });
      expect(JSON.stringify(result)).toContain("bridge is healthy");
    } finally {
      if (oldPort === undefined) delete process.env.PORT;
      else process.env.PORT = oldPort;
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });

  it("rejects unexpected tool arguments", async () => {
    const result = await handleMcpRequest({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: { name: "mobile_status", arguments: { exposeToken: true } },
    });
    expect(result?.result).toMatchObject({ isError: true });
  });
});
