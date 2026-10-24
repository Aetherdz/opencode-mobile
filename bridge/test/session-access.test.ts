import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { SessionAccess } from "../src/sessionAccess.js";
import type { RawSession } from "../src/types.js";

const roots: string[] = [];

function tempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bridge-session-access-"));
  roots.push(dir);
  return dir;
}

function session(id: string, directory: string): RawSession {
  return { id, projectID: "project", time: { created: 1, updated: 1 }, location: { directory } };
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

describe("SessionAccess", () => {
  it("grants one exact session without changing the configured workdirs", () => {
    const allowed = tempDir();
    const outside = tempDir();
    const access = new SessionAccess([allowed]);
    const target = session("outside-session", outside);

    expect(access.directory(target)).toBeNull();
    expect(access.authorize(target)).toBe(fs.realpathSync.native(outside));
    expect(access.directory(target)).toBe(fs.realpathSync.native(outside));
    expect(access.directory(session("different-session", outside))).toBeNull();
    expect(access.directory(session("allowed-session", allowed))).toBe(fs.realpathSync.native(allowed));
  });

  it("does not carry a grant to a different directory and supports revocation", () => {
    const first = tempDir();
    const second = tempDir();
    const access = new SessionAccess([]);
    access.authorize(session("one", first));

    expect(access.directory(session("one", second))).toBeNull();
    access.revoke("one");
    expect(access.directory(session("one", first))).toBeNull();
  });

  it("refuses to grant the filesystem root", () => {
    const access = new SessionAccess([]);
    const root = path.parse(process.cwd()).root;
    expect(access.authorize(session("root-session", root))).toBeNull();
  });
});
