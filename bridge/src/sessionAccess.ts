import fs from "node:fs";
import path from "node:path";
import type { RawSession } from "./types.js";
import { isInsideWorkdir } from "./config.js";

/** Runtime-only, exact-session grants. These are deliberately not workdir roots. */
export class SessionAccess {
  private readonly grants = new Map<string, string>();

  constructor(private readonly workdirs: string[]) {}

  directory(session: RawSession): string | null {
    const directory = session.location?.directory;
    if (!directory) return null;
    const normal = isInsideWorkdir(this.workdirs, directory);
    if (normal) return normal;
    const grant = this.grants.get(session.id);
    if (!grant) return null;
    try {
      const actual = fs.realpathSync.native(directory);
      if (actual === path.parse(actual).root) return null;
      return actual === grant ? actual : null;
    } catch { return null; }
  }

  authorize(session: RawSession): string | null {
    const directory = session.location?.directory;
    if (!directory) return null;
    const normal = isInsideWorkdir(this.workdirs, directory);
    if (normal) return normal;
    try {
      const actual = fs.realpathSync.native(directory);
      if (actual === path.parse(actual).root) return null;
      if (!fs.statSync(actual).isDirectory()) return null;
      this.grants.set(session.id, actual);
      return actual;
    } catch { return null; }
  }

  revoke(sessionId: string): void { this.grants.delete(sessionId); }
}
