import { loadConfig } from "./config.js";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
