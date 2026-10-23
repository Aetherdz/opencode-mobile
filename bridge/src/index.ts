import { runMcpStdio } from "./mcp.js";

if (process.argv[2] === "mcp") {
  // The installer launcher loads bridge.env for the HTTP server. MCP must not
  // inherit credentials it does not need or make them available to the model.
  for (const name of ["AUTH_TOKEN", "OPENCODE_PASSWORD", "OPENCODE_URL"]) {
    delete process.env[name];
  }
  runMcpStdio().catch((error: unknown) => {
    // MCP stdio reserves stdout for JSON-RPC only.
    process.stderr.write(`${error instanceof Error ? error.message : "MCP server failed"}\n`);
    process.exitCode = 1;
  });
} else {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}

async function main(): Promise<void> {
  const { loadConfig } = await import("./config.js");
  const { buildServer } = await import("./server.js");
  const config = loadConfig();
  const server = await buildServer(config);

  const shutdown = async (signal: string): Promise<void> => {
    server.app.log.info({ signal }, "shutting down");
    await server.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await server.app.listen({ port: config.port, host: config.host });
  server.app.log.info(
    { url: `http://${config.host}:${config.port}`, workdirs: config.allowedWorkdirs },
    "bridge listening",
  );
}
