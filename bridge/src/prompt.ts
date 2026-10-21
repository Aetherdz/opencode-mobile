import { isTextFile, type StoredFile } from "./uploads.js";

const MARKER = "<!-- opencode-mobile:attachments -->";

/**
 * Text and code uploads are saved on the host, so the agent gets an explicit
 * read instruction. Binary attachments stay as OpenCode file parts.
 */
export function withReadInstructions(
  text: string,
  files: Array<Pick<StoredFile, "name" | "mime" | "path">>,
): string {
  const readable = files.filter(isTextFile);
  if (readable.length === 0) return text;

  const lines = readable.map((file) => `read ${file.path}`);
  const block = [
    MARKER,
    "Attached files are saved on the host. Use the read tool before answering when relevant:",
    ...lines,
  ].join("\n");
  const body = text.trimEnd();
  return body.length > 0 ? `${body}\n\n${block}` : block;
}

/** Keep generated instructions out of the user message shown in the app. */
export function stripReadInstructions(text: string): string {
  const index = text.indexOf(MARKER);
  if (index < 0) return text;
  return text.slice(0, index).trimEnd();
}
