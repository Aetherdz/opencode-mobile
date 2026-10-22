import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertLoopback,
  isInsideWorkdir,
  loadConfig,
  parseAllowedTypes,
  parseCorsOrigins,
} from "../src/config.js";

const roots: string[] = [];

function tempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("parseAllowedTypes", () => {
  it("separates MIME types from extensions and normalizes case", () => {
    const parsed = parseAllowedTypes(
      " image/PNG, .TS ,text/plain,,.md,application/pdf, .Json ",
    );

    expect([...parsed.mimes].sort()).toEqual([
      "application/pdf",
      "image/png",
      "text/plain",
    ]);
    expect([...parsed.extensions].sort()).toEqual([".json", ".md", ".ts"]);
  });

  it("returns empty sets for an empty or whitespace-only list", () => {
    const parsed = parseAllowedTypes(" , , ");
    expect(parsed.mimes.size).toBe(0);
    expect(parsed.extensions.size).toBe(0);
  });
});

describe("parseCorsOrigins", () => {
  it("normalizes and deduplicates exact origins", () => {
    expect(
      parseCorsOrigins(" http://localhost:8081/, https://example.com , http://localhost:8081 "),
    ).toEqual(["http://localhost:8081", "https://example.com"]);
  });

  it("returns an empty list when CORS is disabled", () => {
    expect(parseCorsOrigins("")).toEqual([]);
    expect(parseCorsOrigins(" , ")).toEqual([]);
  });

  it("rejects wildcards, paths, credentials, and non-http schemes", () => {
    expect(() => parseCorsOrigins("*")).toThrow(/invalid origin/);
    expect(() => parseCorsOrigins("https://example.com/app")).toThrow(/without paths/);
    expect(() => parseCorsOrigins("https://user:pass@example.com")).toThrow(/credentials/);
    expect(() => parseCorsOrigins("file:///tmp")).toThrow(/http or https/);
  });
});

describe("isInsideWorkdir", () => {
  it("accepts a child path and returns its real path", () => {
    const root = tempRoot("bridge-config-");
    const workdir = path.join(root, "work");
    const child = path.join(workdir, "src", "child.ts");
    fs.mkdirSync(path.dirname(child), { recursive: true });
    fs.writeFileSync(child, "export {};\n");

    const workReal = fs.realpathSync.native(workdir);
    const childReal = fs.realpathSync.native(child);

    expect(isInsideWorkdir([workReal], child)).toBe(childReal);
    expect(isInsideWorkdir([workReal], path.join(workdir, "src", "..", "src", "child.ts"))).toBe(
      childReal,
    );
  });

  it("rejects a sibling directory that shares the workdir prefix", () => {
    const root = tempRoot("bridge-config-");
    const workdir = path.join(root, "work");
    const sibling = path.join(root, "work-other");
    const siblingFile = path.join(sibling, "file.txt");
    fs.mkdirSync(workdir);
    fs.mkdirSync(sibling);
    fs.writeFileSync(siblingFile, "outside");

    const workReal = fs.realpathSync.native(workdir);
    expect(isInsideWorkdir([workReal], siblingFile)).toBeNull();
  });

  it("rejects traversal and symlink escapes", () => {
    const root = tempRoot("bridge-config-");
    const workdir = path.join(root, "work");
    const outside = path.join(root, "outside.txt");
    fs.mkdirSync(workdir);
    fs.writeFileSync(outside, "secret");

    const workReal = fs.realpathSync.native(workdir);
    const traversal = `${workdir}${path.sep}sub${path.sep}..${path.sep}..${path.sep}outside.txt`;
    expect(isInsideWorkdir([workReal], traversal)).toBeNull();

    const link = path.join(workdir, "escape.txt");
    fs.symlinkSync(outside, link);
    expect(isInsideWorkdir([workReal], link)).toBeNull();
  });

  it("rejects paths that do not exist", () => {
    const root = tempRoot("bridge-config-");
    const workdir = path.join(root, "work");
    fs.mkdirSync(workdir);
    const workReal = fs.realpathSync.native(workdir);
    expect(isInsideWorkdir([workReal], path.join(workdir, "missing.txt"))).toBeNull();
  });
});

describe("assertLoopback", () => {
  it("accepts 127.0.0.1 and localhost", () => {
    expect(() => assertLoopback("http://127.0.0.1:4096")).not.toThrow();
    expect(() => assertLoopback("http://localhost:4096")).not.toThrow();
  });

  it("rejects remote hosts", () => {
    expect(() => assertLoopback("https://10.0.0.5:4096")).toThrow(/loopback/);
    expect(() => assertLoopback("https://opencode.example.com")).toThrow(/loopback/);
    expect(() => assertLoopback("http://127.0.0.1.example.com:4096")).toThrow(/loopback/);
  });
});

describe("loadConfig auth token", () => {
  it("rejects the shipped example and low-entropy tokens", () => {
    const root = tempRoot("bridge-config-token-");
    const workdir = path.join(root, "work");
    fs.mkdirSync(workdir);
    const keys = ["AUTH_TOKEN", "OPENCODE_URL", "OPENCODE_PASSWORD", "ALLOWED_WORKDIRS", "DATA_DIR"] as const;
    const saved = new Map<string, string | undefined>();
    for (const key of keys) saved.set(key, process.env[key]);

    process.env.OPENCODE_URL = "http://127.0.0.1:4096";
    process.env.OPENCODE_PASSWORD = "test-password";
    process.env.ALLOWED_WORKDIRS = workdir;
    process.env.DATA_DIR = path.join(root, "data");

    try {
      process.env.AUTH_TOKEN = "replace-with-at-least-32-random-characters";
      expect(() => loadConfig()).toThrow(/example/);

      process.env.AUTH_TOKEN = "a".repeat(64);
      expect(() => loadConfig()).toThrow(/repetitive/);
    } finally {
      for (const key of keys) {
        const value = saved.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});

describe("loadConfig defaults", () => {
  it("does not include SVG in the default upload allowlist", () => {
    const root = tempRoot("bridge-config-defaults-");
    const workdir = path.join(root, "work");
    fs.mkdirSync(workdir);

    const keys = [
      "AUTH_TOKEN",
      "OPENCODE_URL",
      "OPENCODE_PASSWORD",
      "ALLOWED_WORKDIRS",
      "DATA_DIR",
      "ALLOWED_UPLOAD_TYPES",
      "CORS_ORIGINS",
    ] as const;
    const saved = new Map<string, string | undefined>();
    for (const key of keys) saved.set(key, process.env[key]);

    process.env.AUTH_TOKEN = "0123456789abcdef".repeat(4);
    process.env.OPENCODE_URL = "http://127.0.0.1:4096";
    process.env.OPENCODE_PASSWORD = "test-password";
    process.env.ALLOWED_WORKDIRS = workdir;
    process.env.DATA_DIR = path.join(root, "data");
    delete process.env.ALLOWED_UPLOAD_TYPES;
    delete process.env.CORS_ORIGINS;

    try {
      const config = loadConfig();
      expect(config.corsOrigins).toEqual([]);
      expect(config.allowedTypes.mimes.has("image/png")).toBe(true);
      expect(config.allowedTypes.mimes.has("image/svg+xml")).toBe(false);
      expect(config.allowedTypes.extensions.has(".ts")).toBe(true);
      expect(config.allowedTypes.extensions.has(".svg")).toBe(false);
    } finally {
      for (const key of keys) {
        const value = saved.get(key);
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
