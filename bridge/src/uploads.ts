import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { isInsideWorkdir } from "./config.js";

export class UploadError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "UploadError";
  }
}

export interface StoredFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  path: string;
  sessionId: string;
  createdAt: number;
  source: "upload" | "workdir";
}

const BLOCKED_EXTENSIONS = new Set([
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".bat",
  ".cmd",
  ".com",
  ".msi",
  ".apk",
  ".ipa",
  ".jar",
  ".class",
  ".wasm",
  ".scr",
  ".pif",
]);

const TEXT_EXTENSIONS = new Set([
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
  ".ini",
  ".conf",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".json": "application/json",
  ".md": "text/markdown",
  ".markdown": "text/markdown",
  ".txt": "text/plain",
  ".log": "text/plain",
  ".csv": "text/csv",
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".scss": "text/x-scss",
  ".ts": "text/x-typescript",
  ".tsx": "text/x-typescript",
  ".js": "text/javascript",
  ".jsx": "text/javascript",
  ".mjs": "text/javascript",
  ".cjs": "text/javascript",
  ".py": "text/x-python",
  ".go": "text/x-go",
  ".rs": "text/x-rust",
  ".java": "text/x-java",
  ".kt": "text/x-kotlin",
  ".swift": "text/x-swift",
  ".c": "text/x-c",
  ".h": "text/x-c",
  ".cpp": "text/x-c++",
  ".hpp": "text/x-c++",
  ".cs": "text/x-csharp",
  ".rb": "text/x-ruby",
  ".php": "text/x-php",
  ".sh": "text/x-shellscript",
  ".sql": "text/plain",
  ".yaml": "application/x-yaml",
  ".yml": "application/x-yaml",
  ".toml": "text/plain",
  ".xml": "application/xml",
  ".ini": "text/plain",
  ".conf": "text/plain",
};

/** Text formats that must stay inert instead of being treated as generic text. */
const ACTIVE_TEXT_EXTENSIONS = new Set([".svg", ".svgz"]);

function isTextMime(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "application/xml" ||
    mime === "application/x-yaml"
  );
}

export function sanitizeFilename(input: string): string {
  let decoded = (input || "file").replaceAll("\\", "/");
  if (/%[0-9a-f]{2}/i.test(decoded)) {
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      // Keep the raw name when the percent escapes are malformed.
    }
  }
  decoded = decoded.replaceAll("\\", "/");
  const base = path.basename(decoded);
  const cleaned = base
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^\p{L}\p{N}\p{M}._ ()\[\]+,&#'-]/gu, "_");
  const safe = [...cleaned].slice(0, 120).join("");
  if (!safe) return "file";
  return /^\.+$/.test(safe) ? "_" : safe;
}

export function detectMime(buffer: Buffer, filename: string): string {
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 6 && buffer.subarray(0, 6).toString("ascii") === "GIF87a") return "image/gif";
  if (buffer.length >= 6 && buffer.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (buffer.length >= 4 && buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return "application/zip";
  }
  const ext = path.extname(filename).toLowerCase();
  if (
    buffer.length >= 2 &&
    ((buffer[0] === 0xff && buffer[1] === 0xfe) || (buffer[0] === 0xfe && buffer[1] === 0xff))
  ) {
    // UTF-16 text contains NUL bytes; the BOM is enough to treat it as text.
    const mapped = MIME_BY_EXTENSION[ext];
    return mapped && isTextMime(mapped) ? mapped : "text/plain";
  }
  if (!buffer.subarray(0, 8192).includes(0)) {
    if (ACTIVE_TEXT_EXTENSIONS.has(ext)) return "application/octet-stream";
    const mapped = MIME_BY_EXTENSION[ext];
    if (mapped && isTextMime(mapped)) return mapped;
    // Generic text and code files keep a text MIME so clients never download
    // them as an opaque binary.
    return TEXT_EXTENSIONS.has(ext) || !mapped ? "text/plain" : "application/octet-stream";
  }
  return "application/octet-stream";
}

export interface AllowedTypes {
  mimes: Set<string>;
  extensions: Set<string>;
}

export function validateFile(input: {
  filename: string;
  mime: string;
  size: number;
  buffer: Buffer;
  allowed: AllowedTypes;
  maxBytes: number;
}): { name: string; mime: string } {
  const name = sanitizeFilename(input.filename);
  const ext = path.extname(name).toLowerCase();

  if (input.size <= 0) throw new UploadError("empty_file", "File is empty.");
  if (input.size > input.maxBytes) {
    throw new UploadError("file_too_large", `File exceeds the ${Math.floor(input.maxBytes / 1024 / 1024)} MB limit.`, 413);
  }
  if (BLOCKED_EXTENSIONS.has(ext)) {
    throw new UploadError("blocked_type", `Files with ${ext} extension are not allowed.`);
  }

  const declared = (input.mime || "").toLowerCase().split(";")[0]?.trim() ?? "";
  const detected = detectMime(input.buffer, name);

  const extAllowed = input.allowed.extensions.has(ext);
  const declaredAllowed = input.allowed.mimes.has(declared);
  const detectedAllowed = input.allowed.mimes.has(detected);

  if (!extAllowed && !declaredAllowed && !detectedAllowed) {
    throw new UploadError("type_not_allowed", `File type ${declared || ext || "unknown"} is not allowed.`);
  }

  if (declared.startsWith("image/") && !detected.startsWith("image/")) {
    throw new UploadError("mime_mismatch", "Declared image does not match its content.");
  }
  if (declared === "application/pdf" && detected !== "application/pdf") {
    throw new UploadError("mime_mismatch", "Declared PDF does not match its content.");
  }
  if (detected === "application/octet-stream") {
    if (TEXT_EXTENSIONS.has(ext)) {
      throw new UploadError("binary_not_allowed", "Text and code files must contain text.");
    }
    if (!extAllowed) {
      throw new UploadError("binary_not_allowed", "Binary files are not allowed.");
    }
  }

  // Always serve the detected type, never the client-declared one. Text and
  // code files upload an opaque MIME from some pickers; their extension and
  // content decide the stored type.
  return { name, mime: detected };
}

/** Files the agent should open with its read tool instead of a binary viewer. */
export function isTextFile(file: Pick<StoredFile, "name" | "mime">): boolean {
  const ext = path.extname(file.name).toLowerCase();
  return isTextMime(file.mime) || TEXT_EXTENSIONS.has(ext);
}

export class FileRegistry {
  private readonly records = new Map<string, StoredFile>();
  private readonly indexPath: string;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(private readonly dataDir: string) {
    this.indexPath = path.join(dataDir, "files.json");
    this.load();
  }

  private load(): void {
    try {
      const raw = JSON.parse(fs.readFileSync(this.indexPath, "utf8")) as StoredFile[];
      for (const record of raw) this.records.set(record.id, record);
    } catch {
      // first run
    }
  }

  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      const temp = `${this.indexPath}.${process.pid}.tmp`;
      const body = JSON.stringify([...this.records.values()], null, 2);
      fs.mkdirSync(this.dataDir, { recursive: true, mode: 0o700 });
      fs.writeFileSync(temp, body, { mode: 0o600 });
      fs.renameSync(temp, this.indexPath);
    }, 100);
    this.saveTimer.unref();
  }

  get(id: string): StoredFile | undefined {
    return this.records.get(id);
  }

  async remove(id: string): Promise<void> {
    const record = this.records.get(id);
    if (!record) return;
    this.records.delete(id);
    this.scheduleSave();
    if (record.source === "upload") {
      await fsp.unlink(record.path).catch(() => undefined);
    }
  }

  listSession(sessionId: string): StoredFile[] {
    return [...this.records.values()].filter((record) => record.sessionId === sessionId);
  }

  totalBytesForSession(sessionId: string): number {
    let total = 0;
    for (const record of this.records.values()) {
      if (record.sessionId === sessionId && record.source === "upload") total += record.size;
    }
    return total;
  }

  async saveUpload(input: {
    sessionId: string;
    workdir: string;
    filename: string;
    mime: string;
    buffer: Buffer;
    allowed: AllowedTypes;
    maxBytes: number;
  }): Promise<StoredFile> {
    if (!/^[A-Za-z0-9_-]+$/.test(input.sessionId)) {
      throw new UploadError("invalid_session", "Invalid session id.");
    }
    const validated = validateFile({
      filename: input.filename,
      mime: input.mime,
      size: input.buffer.length,
      buffer: input.buffer,
      allowed: input.allowed,
      maxBytes: input.maxBytes,
    });

    const folder = path.join(input.workdir, ".opencode-uploads", input.sessionId);
    await fsp.mkdir(folder, { recursive: true, mode: 0o700 });
    await fsp.chmod(folder, 0o700);

    const id = `fil_${crypto.randomUUID().replaceAll("-", "")}`;
    const storedName = `${Date.now()}-${id.slice(4, 12)}-${validated.name}`;
    const target = path.join(folder, storedName);
    await fsp.writeFile(target, input.buffer, { mode: 0o600, flag: "wx" });

    const record: StoredFile = {
      id,
      name: validated.name,
      mime: validated.mime,
      size: input.buffer.length,
      path: target,
      sessionId: input.sessionId,
      createdAt: Date.now(),
      source: "upload",
    };
    this.records.set(id, record);
    this.scheduleSave();
    return record;
  }

  registerWorkdirFile(input: {
    sessionId: string;
    workdirs: string[];
    filePath: string;
    maxBytes: number;
  }): StoredFile {
    const resolved = isInsideWorkdir(input.workdirs, input.filePath);
    if (!resolved) throw new UploadError("outside_workdir", "File is outside the allowed workdirs.", 403);
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) throw new UploadError("not_a_file", "Not a regular file.");
    if (stat.size > input.maxBytes) throw new UploadError("file_too_large", "File is too large.", 413);

    for (const record of this.records.values()) {
      if (record.path === resolved && record.sessionId === input.sessionId) return record;
    }

    const name = path.basename(resolved);
    const ext = path.extname(name).toLowerCase();
    const record: StoredFile = {
      id: `fil_${crypto.randomUUID().replaceAll("-", "")}`,
      name,
      mime: MIME_BY_EXTENSION[ext] ?? "application/octet-stream",
      size: stat.size,
      path: resolved,
      sessionId: input.sessionId,
      createdAt: Date.now(),
      source: "workdir",
    };
    this.records.set(record.id, record);
    this.scheduleSave();
    return record;
  }

  async readText(id: string, workdirs: string[], maxBytes = 256 * 1024): Promise<{ text: string; truncated: boolean; file: StoredFile }> {
    const record = this.records.get(id);
    if (!record) throw new UploadError("not_found", "File not found.", 404);
    const resolved = isInsideWorkdir(workdirs, record.path);
    if (!resolved) throw new UploadError("outside_workdir", "File is outside the allowed workdirs.", 403);

    const ext = path.extname(record.name).toLowerCase();
    const isText = record.mime.startsWith("text/") || record.mime === "application/json" || TEXT_EXTENSIONS.has(ext);
    if (!isText) throw new UploadError("not_text", "This file is not previewable as text.", 415);

    const handle = await fsp.open(resolved, "r");
    try {
      const buffer = Buffer.alloc(maxBytes);
      const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
      const truncated = record.size > bytesRead;
      return { text: buffer.subarray(0, bytesRead).toString("utf8"), truncated, file: record };
    } finally {
      await handle.close();
    }
  }
}
