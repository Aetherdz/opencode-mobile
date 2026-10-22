import pino from "pino";
import { describe, expect, it } from "vitest";
import { pinoOptions } from "../src/log.js";

function capture(entry: Record<string, unknown>): string {
  let line = "";
  const stream = {
    write(chunk: string) {
      line += chunk;
    },
  };
  const logger = pino(pinoOptions("info"), stream);
  logger.info(entry, "test");
  return line;
}

describe("log redaction", () => {
  it("redacts raw websocket paths that can contain a query token", () => {
    const line = capture({ path: "/health?token=super-secret-token" });
    expect(line).toContain("[redacted]");
    expect(line).not.toContain("super-secret-token");
  });

  it("redacts bare x-auth-token header objects", () => {
    const line = capture({ headers: { "x-auth-token": "super-secret-token" } });
    expect(line).toContain("[redacted]");
    expect(line).not.toContain("super-secret-token");
  });
});
