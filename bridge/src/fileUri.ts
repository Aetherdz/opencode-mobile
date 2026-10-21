import { fileURLToPath, pathToFileURL } from "node:url";

/** Build a file URI without manual escaping. */
export function toFileUri(filePath: string): string {
  return pathToFileURL(filePath).href;
}

/**
 * Parse a file URI from the upstream service. Some older entries are not
 * percent-encoded; fall back to a raw slice instead of throwing so a malformed
 * attachment cannot tear down the event stream.
 */
export function fromFileUri(uri: string): string | null {
  if (!uri.startsWith("file://")) return null;
  try {
    return fileURLToPath(uri);
  } catch {
    const raw = uri.slice("file://".length);
    try {
      return decodeURIComponent(raw);
    } catch {
      return raw;
    }
  }
}
