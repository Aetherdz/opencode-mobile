import "dotenv/config";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { z } from "zod";

const DEFAULT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-python",
  "text/x-typescript",
  "application/json",
  "application/x-yaml",
  "application/zip",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".cs",
  ".rb",
  ".php",
  ".sh",
  ".sql",
  ".html",
  ".css",
  ".scss",
  ".md",
  ".json",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".txt",
  ".log",
  ".csv",
].join(",");

const EnvSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default("127.0.0.1"),
  AUTH_TOKEN: z.string().min(32, "AUTH_TOKEN must be at least 32 characters"),
  OPENCODE_URL: z.string().url().optional(),
  OPENCODE_PASSWORD: z.string().optional(),
  ALLOWED_WORKDIRS: z.string().default(os.homedir()),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(25),
  MAX_UPLOAD_TOTAL_MB: z.coerce.number().positive().default(100),
  MAX_FILES_PER_MESSAGE: z.coerce.number().int().positive().default(10),
  ALLOWED_UPLOAD_TYPES: z.string().default(DEFAULT_TYPES),
  DATA_DIR: z.string().default("./data"),
  BAN_AFTER: z.coerce.number().int().positive().default(10),
  BAN_MINUTES: z.coerce.number().int().positive().default(15),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(180),
  LOG_LEVEL: z.string().default("info"),
  PUSH_ENABLED: z.enum(["0", "1"]).default("1"),
});

export type Config = ReturnType<typeof loadConfig>;

function splitList(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function expandHome(value: string): string {
  if (value === "~") return os.homedir();
  if (value.startsWith("~/")) return path.join(os.homedir(), value.slice(2));
  return value;
}

export function parseAllowedTypes(value: string): { mimes: Set<string>; extensions: Set<string> } {
  const mimes = new Set<string>();
  const extensions = new Set<string>();
  for (const entry of splitList(value)) {
    const normalized = entry.toLowerCase();
    if (normalized.startsWith(".")) extensions.add(normalized);
    else mimes.add(normalized);
  }
  return { mimes, extensions };
}

export function discoverService(): { url: string; password: string } {
  const explicitUrl = process.env.OPENCODE_URL?.trim();
  const explicitPassword = process.env.OPENCODE_PASSWORD?.trim();
  if (explicitUrl) {
    if (!explicitPassword) {
      throw new Error("OPENCODE_PASSWORD is required when OPENCODE_URL is set");
    }
    return { url: explicitUrl.replace(/\/+$/, ""), password: explicitPassword };
  }

  const stateHome = process.env.XDG_STATE_HOME || path.join(os.homedir(), ".local", "state");
  const candidates = [
    path.join(stateHome, "opencode", "service.json"),
    path.join(os.homedir(), ".local", "state", "opencode", "service.json"),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as {
        url?: string;
        password?: string;
      };
      if (parsed.url && parsed.password) {
        return { url: parsed.url.replace(/\/+$/, ""), password: parsed.password };
      }
    } catch {
      // try the next candidate
    }
  }
  throw new Error(
    "OpenCode service not found. Start it with `opencode service start` or set OPENCODE_URL and OPENCODE_PASSWORD.",
  );
}

export function assertLoopback(url: string): void {
  const host = new URL(url).hostname.replace(/^\[|\]$/g, "");
  const allowed = new Set(["127.0.0.1", "::1", "localhost"]);
  if (!allowed.has(host)) {
    throw new Error(`OpenCode URL must be loopback, got ${host}`);
  }
}

export function loadConfig(): {
  port: number;
  host: string;
  authToken: string;
  opencode: { url: string; password: string };
  allowedWorkdirs: string[];
  maxUploadBytes: number;
  maxUploadTotalBytes: number;
  maxFilesPerMessage: number;
  allowedTypes: { mimes: Set<string>; extensions: Set<string> };
  dataDir: string;
  banAfter: number;
  banMs: number;
  rateLimitPerMinute: number;
  logLevel: string;
  pushEnabled: boolean;
} {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid configuration: ${detail}`);
  }
  const env = parsed.data;
  const opencode = discoverService();
  assertLoopback(opencode.url);

  const allowedWorkdirs = splitList(env.ALLOWED_WORKDIRS).map((dir) =>
    fs.realpathSync.native(expandHome(dir)),
  );
  if (allowedWorkdirs.length === 0) {
    throw new Error("ALLOWED_WORKDIRS must contain at least one directory");
  }
  for (const dir of allowedWorkdirs) {
    if (dir === path.parse(dir).root) {
      throw new Error("ALLOWED_WORKDIRS cannot be the filesystem root");
    }
  }

  const dataDir = path.resolve(expandHome(env.DATA_DIR));
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

  return {
    port: env.PORT,
    host: env.HOST,
    authToken: env.AUTH_TOKEN,
    opencode,
    allowedWorkdirs,
    maxUploadBytes: Math.floor(env.MAX_UPLOAD_MB * 1024 * 1024),
    maxUploadTotalBytes: Math.floor(env.MAX_UPLOAD_TOTAL_MB * 1024 * 1024),
    maxFilesPerMessage: env.MAX_FILES_PER_MESSAGE,
    allowedTypes: parseAllowedTypes(env.ALLOWED_UPLOAD_TYPES),
    dataDir,
    banAfter: env.BAN_AFTER,
    banMs: env.BAN_MINUTES * 60_000,
    rateLimitPerMinute: env.RATE_LIMIT_PER_MINUTE,
    logLevel: env.LOG_LEVEL,
    pushEnabled: env.PUSH_ENABLED === "1",
  };
}

export function isInsideWorkdir(workdirs: string[], candidate: string): string | null {
  let real: string;
  try {
    real = fs.realpathSync.native(candidate);
  } catch {
    return null;
  }
  for (const root of workdirs) {
    if (real === root || real.startsWith(root + path.sep)) {
      return real;
    }
  }
  return null;
}
