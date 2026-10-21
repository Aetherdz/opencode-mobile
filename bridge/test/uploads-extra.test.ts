import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  detectMime,
  FileRegistry,
  UploadError,
  validateFile,
} from "../src/uploads.js";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
const PDF = Buffer.from("%PDF-1.7\n");
const SVG = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect /></svg>');

// Mirrors the default allowlist: common images, PDF, text, zip and a few code extensions.
// image/svg+xml and .svg are deliberately absent.
const allowed = {
  mimes: new Set([
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/gif",
    "application/pdf",
    "application/zip",
    "text/plain",
    "text/markdown",
  ]),
  extensions: new Set([".ts", ".md"]),
};

const roots: string[] = [];

function tempRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-uploads-"));
  roots.push(root);
  return root;
}

function uploadError(fn: () => unknown): UploadError {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(UploadError);
    return error as UploadError;
  }
  throw new Error("Expected an UploadError, but no error was thrown");
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) fs.rmSync(root, { recursive: true, force: true });
  }
});

// Per-message file counts (MAX_FILES_PER_MESSAGE) are enforced by the multipart
// and route layers, not by validateFile or FileRegistry.
describe("validateFile MIME policy", () => {
  it("blocks SVG by default", () => {
    expect(detectMime(SVG, "icon.svg")).toBe("application/octet-stream");

    const error = uploadError(() =>
      validateFile({
        filename: "icon.svg",
        mime: "image/svg+xml",
        size: SVG.length,
        buffer: SVG,
        allowed,
        maxBytes: 1024,
      }),
    );
    expect(error.code).toBe("type_not_allowed");
  });

  it("detects zip magic and accepts an allowed archive", () => {
    expect(detectMime(ZIP, "bundle.zip")).toBe("application/zip");

    const result = validateFile({
      filename: "bundle.zip",
      mime: "application/zip",
      size: ZIP.length,
      buffer: ZIP,
      allowed,
      maxBytes: 1024,
    });
    expect(result).toEqual({ name: "bundle.zip", mime: "application/zip" });
  });

  it("accepts a real PDF and rejects a declared PDF with non-PDF content", () => {
    expect(detectMime(PDF, "doc.pdf")).toBe("application/pdf");
    expect(
      validateFile({
        filename: "doc.pdf",
        mime: "application/pdf",
        size: PDF.length,
        buffer: PDF,
        allowed,
        maxBytes: 1024,
      }).mime,
    ).toBe("application/pdf");

    const error = uploadError(() =>
      validateFile({
        filename: "fake.pdf",
        mime: "application/pdf",
        size: 5,
        buffer: Buffer.from("hello"),
        allowed,
        maxBytes: 1024,
      }),
    );
    expect(error.code).toBe("mime_mismatch");
  });

  it("rejects an image declaration whose bytes are actually a zip", () => {
    const error = uploadError(() =>
      validateFile({
        filename: "fake.png",
        mime: "image/png",
        size: ZIP.length,
        buffer: ZIP,
        allowed,
        maxBytes: 1024,
      }),
    );
    expect(error.code).toBe("mime_mismatch");
  });
});

describe("FileRegistry workdir records", () => {
  it("reuses an existing workdir file instead of duplicating it", () => {
    const root = tempRoot();
    const workdir = path.join(root, "work");
    const file = path.join(workdir, "shared.ts");
    fs.mkdirSync(workdir);
    fs.writeFileSync(file, "export const value = 1;\n");

    const registry = new FileRegistry(path.join(root, "data"));
    const workReal = fs.realpathSync.native(workdir);
    const first = registry.registerWorkdirFile({
      sessionId: "ses_a",
      workdirs: [workReal],
      filePath: file,
      maxBytes: 1024,
    });
    const second = registry.registerWorkdirFile({
      sessionId: "ses_a",
      workdirs: [workReal],
      filePath: file,
      maxBytes: 1024,
    });

    expect(second.id).toBe(first.id);
    expect(registry.listSession("ses_a")).toHaveLength(1);
    expect(registry.get(first.id)).toEqual(first);
    expect(first).toMatchObject({
      name: "shared.ts",
      mime: "text/x-typescript",
      source: "workdir",
      sessionId: "ses_a",
    });
  });

  it("returns undefined for an unknown file id", () => {
    const root = tempRoot();
    const registry = new FileRegistry(path.join(root, "data"));
    expect(registry.get("fil_does_not_exist")).toBeUndefined();
  });

  it("rejects traversal and symlink escapes from the workdir", () => {
    const root = tempRoot();
    const workdir = path.join(root, "work");
    const outside = path.join(root, "outside.txt");
    fs.mkdirSync(workdir);
    fs.writeFileSync(outside, "secret");

    const registry = new FileRegistry(path.join(root, "data"));
    const workReal = fs.realpathSync.native(workdir);

    const traversal = uploadError(() =>
      registry.registerWorkdirFile({
        sessionId: "ses_a",
        workdirs: [workReal],
        filePath: `${workdir}${path.sep}sub${path.sep}..${path.sep}..${path.sep}outside.txt`,
        maxBytes: 1024,
      }),
    );
    expect(traversal.code).toBe("outside_workdir");

    const link = path.join(workdir, "escape.txt");
    fs.symlinkSync(outside, link);
    const symlink = uploadError(() =>
      registry.registerWorkdirFile({
        sessionId: "ses_a",
        workdirs: [workReal],
        filePath: link,
        maxBytes: 1024,
      }),
    );
    expect(symlink.code).toBe("outside_workdir");
  });

  it("rejects a path-like session id before creating directories", async () => {
    const root = tempRoot();
    const workdir = path.join(root, "work");
    fs.mkdirSync(workdir);
    const registry = new FileRegistry(path.join(root, "data"));

    await expect(
      registry.saveUpload({
        sessionId: "../escape",
        workdir,
        filename: "note.md",
        mime: "text/markdown",
        buffer: Buffer.from("# note"),
        allowed,
        maxBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: "invalid_session" });

    expect(fs.existsSync(path.join(workdir, ".opencode-uploads"))).toBe(false);
  });
});

describe("FileRegistry.readText", () => {
  it("refuses to read a binary upload as text", async () => {
    const root = tempRoot();
    const workdir = path.join(root, "work");
    fs.mkdirSync(workdir);
    const registry = new FileRegistry(path.join(root, "data"));
    const record = await registry.saveUpload({
      sessionId: "ses_a",
      workdir,
      filename: "pixel.png",
      mime: "image/png",
      buffer: PNG,
      allowed,
      maxBytes: 1024,
    });

    await expect(registry.readText(record.id, [fs.realpathSync.native(workdir)])).rejects.toMatchObject({
      code: "not_text",
      status: 415,
    });
  });

  it("returns text and a truncation flag for a text upload", async () => {
    const root = tempRoot();
    const workdir = path.join(root, "work");
    fs.mkdirSync(workdir);
    const registry = new FileRegistry(path.join(root, "data"));
    const record = await registry.saveUpload({
      sessionId: "ses_a",
      workdir,
      filename: "note.md",
      mime: "text/markdown",
      buffer: Buffer.from("# hello\n"),
      allowed,
      maxBytes: 1024,
    });

    const read = await registry.readText(record.id, [fs.realpathSync.native(workdir)]);
    expect(read.text).toBe("# hello\n");
    expect(read.truncated).toBe(false);
    expect(read.file.id).toBe(record.id);
  });
});
