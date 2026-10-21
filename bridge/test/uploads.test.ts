import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectMime,
  FileRegistry,
  sanitizeFilename,
  UploadError,
  validateFile,
} from "../src/uploads.js";

const allowed = {
  mimes: new Set(["image/png", "text/plain", "application/pdf"]),
  extensions: new Set([".ts", ".md", ".html"]),
};

describe("sanitizeFilename", () => {
  it("strips traversal and control characters", () => {
    expect(sanitizeFilename("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFilename("..\\..\\evil.ts")).toBe("evil.ts");
    expect(sanitizeFilename("a\u0000b.txt")).toBe("ab.txt");
    expect(sanitizeFilename("...")).toBe("_");
    expect(sanitizeFilename("%2e%2e%2f%2e%2e%2fetc%2fpasswd")).toBe("passwd");
  });

  it("decodes multipart names and keeps Unicode display names", () => {
    expect(sanitizeFilename("my%20file%20(1).txt")).toBe("my file (1).txt");
    expect(sanitizeFilename("%D9%85%D9%84%D9%81%20%D8%A7%D9%84%D8%AA%D9%82%D8%B1%D9%8A%D8%B1.md")).toBe(
      "ملف التقرير.md",
    );
  });
});

describe("detectMime", () => {
  it("detects png and text", () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectMime(png, "x.png")).toBe("image/png");
    expect(detectMime(Buffer.from("hello"), "x.ts")).toBe("text/x-typescript");
  });

  it("detects web text formats and generic text", () => {
    expect(detectMime(Buffer.from("<!doctype html><p>hi</p>"), "page.html")).toBe("text/html");
    expect(detectMime(Buffer.from("body { color: #000; }"), "app.css")).toBe("text/css");
    expect(detectMime(Buffer.from("plain words"), "notes.weird")).toBe("text/plain");
    expect(detectMime(Buffer.from([0xff, 0xfe, 0x68, 0x00]), "utf16.txt")).toBe("text/plain");
  });
});

describe("validateFile", () => {
  it("rejects blocked extensions and mime mismatches", () => {
    expect(() =>
      validateFile({
        filename: "evil.exe",
        mime: "application/octet-stream",
        size: 4,
        buffer: Buffer.from("MZ"),
        allowed,
        maxBytes: 100,
      }),
    ).toThrow(UploadError);

    expect(() =>
      validateFile({
        filename: "fake.png",
        mime: "image/png",
        size: 5,
        buffer: Buffer.from("hello"),
        allowed,
        maxBytes: 100,
      }),
    ).toThrow(/does not match/);
  });

  it("accepts opaque MIME for a known text extension", () => {
    const ok = validateFile({
      filename: "page.html",
      mime: "application/octet-stream",
      size: 20,
      buffer: Buffer.from("<!doctype html><p>hi</p>"),
      allowed,
      maxBytes: 100,
    });
    expect(ok).toEqual({ name: "page.html", mime: "text/html" });
  });

  it("rejects binary content hidden behind a text extension", () => {
    expect(() =>
      validateFile({
        filename: "fake.ts",
        mime: "application/octet-stream",
        size: 8,
        buffer: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07]),
        allowed,
        maxBytes: 100,
      }),
    ).toThrow(/must contain text/);
  });

  it("accepts allowed text and enforces size", () => {
    const ok = validateFile({
      filename: "app.ts",
      mime: "text/plain",
      size: 5,
      buffer: Buffer.from("hello"),
      allowed,
      maxBytes: 100,
    });
    expect(ok.name).toBe("app.ts");

    expect(() =>
      validateFile({
        filename: "big.ts",
        mime: "text/plain",
        size: 200,
        buffer: Buffer.alloc(200),
        allowed,
        maxBytes: 100,
      }),
    ).toThrow(/limit/);
  });
});

describe("FileRegistry", () => {
  it("stores uploads inside the workdir and refuses outside reads", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-test-"));
    const workdir = path.join(root, "work");
    fs.mkdirSync(workdir);
    const registry = new FileRegistry(path.join(root, "data"));
    const record = await registry.saveUpload({
      sessionId: "ses_test",
      workdir,
      filename: "note.md",
      mime: "text/markdown",
      buffer: Buffer.from("# hello"),
      allowed,
      maxBytes: 1024,
    });
    expect(record.path.startsWith(workdir + path.sep)).toBe(true);
    expect(fs.statSync(record.path).mode & 0o777).toBe(0o600);

    const text = await registry.readText(record.id, [workdir]);
    expect(text.text).toBe("# hello");

    const outside = path.join(root, "outside.txt");
    fs.writeFileSync(outside, "secret");
    expect(() =>
      registry.registerWorkdirFile({
        sessionId: "ses_test",
        workdirs: [workdir],
        filePath: outside,
        maxBytes: 1024,
      }),
    ).toThrow(/outside/);
  });
});
