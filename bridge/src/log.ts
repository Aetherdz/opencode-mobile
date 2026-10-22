import pino, { type Logger } from "pino";

const REDACT = {
  paths: [
    "req.headers.authorization",
    "headers.authorization",
    "authorization",
    "token",
    "*.token",
    "password",
    "*.password",
    "OPENCODE_PASSWORD",
    "AUTH_TOKEN",
    "req.headers.cookie",
    'req.headers["x-auth-token"]',
    'request.headers["x-auth-token"]',
    'headers["x-auth-token"]',
    '*.headers["x-auth-token"]',
    "req.query.token",
    "request.query.token",
    "url",
    "req.url",
    "path",
    "*.path",
  ],
  censor: "[redacted]",
};

export interface LoggerLike {
  info(obj: unknown, msg?: string): void;
  warn(obj: unknown, msg?: string): void;
  error(obj: unknown, msg?: string): void;
  debug(obj: unknown, msg?: string): void;
}

export function pinoOptions(level: string): Record<string, unknown> {
  return {
    level,
    redact: REDACT,
    base: { service: "opencode-bridge" },
  };
}

export function createLogger(level: string): Logger {
  return pino(pinoOptions(level));
}
