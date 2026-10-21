import { describe, expect, it } from "vitest";
import { AuthGuard, constantTimeEqual } from "../src/auth.js";

describe("constantTimeEqual", () => {
  it("compares equal and different strings", () => {
    expect(constantTimeEqual("a".repeat(64), "a".repeat(64))).toBe(true);
    expect(constantTimeEqual("a".repeat(64), "b".repeat(64))).toBe(false);
    expect(constantTimeEqual("short", "a".repeat(64))).toBe(false);
  });
});

describe("AuthGuard", () => {
  it("bans after repeated failures and resets on success", () => {
    const guard = new AuthGuard("x".repeat(40), 3, 60_000);
    expect(guard.check("x".repeat(40))).toBe(true);
    expect(guard.check("wrong")).toBe(false);

    guard.fail("10.0.0.1");
    guard.fail("10.0.0.1");
    expect(guard.isBanned("10.0.0.1")).toBe(false);
    guard.fail("10.0.0.1");
    expect(guard.isBanned("10.0.0.1")).toBe(true);
    expect(guard.isBanned("10.0.0.2")).toBe(false);

    guard.reset("10.0.0.1");
    expect(guard.isBanned("10.0.0.1")).toBe(false);
  });
});
