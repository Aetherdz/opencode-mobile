import { describe, expect, it } from "vitest";
import { mapLimit, sleep } from "../src/util.js";

describe("mapLimit", () => {
  it("handles empty items array gracefully", async () => {
    const results = await mapLimit([], 4, async (item) => item);
    expect(results).toEqual([]);
  });

  it("handles non-positive or NaN limit gracefully by defaulting to worker count >= 1", async () => {
    const items = [1, 2, 3];
    const resZero = await mapLimit(items, 0, async (x) => x * 2);
    expect(resZero).toEqual([2, 4, 6]);

    const resNeg = await mapLimit(items, -5, async (x) => x * 2);
    expect(resNeg).toEqual([2, 4, 6]);

    const resNaN = await mapLimit(items, NaN, async (x) => x * 2);
    expect(resNaN).toEqual([2, 4, 6]);
  });

  it("limits concurrency correctly", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 10 }, (_, i) => i);
    const results = await mapLimit(items, 3, async (x) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(10);
      active -= 1;
      return x * 10;
    });

    expect(results).toEqual(items.map((x) => x * 10));
    expect(maxActive).toBeLessThanOrEqual(3);
  });

  it("stops pulling new items from cursor when a worker rejects", async () => {
    const processed: number[] = [];
    const items = Array.from({ length: 20 }, (_, i) => i);

    await expect(
      mapLimit(items, 2, async (x) => {
        processed.push(x);
        if (x === 2) throw new Error("boom");
        await sleep(10);
        return x;
      }),
    ).rejects.toThrow("boom");

    // Once aborted, remaining items should not have been pulled
    expect(processed.length).toBeLessThan(items.length);
  });
});

describe("sleep", () => {
  it("sleeps for the requested duration", async () => {
    const start = Date.now();
    await sleep(20);
    expect(Date.now() - start).toBeGreaterThanOrEqual(15);
  });

  it("aborts immediately when AbortSignal fires", async () => {
    const controller = new AbortController();
    const start = Date.now();
    setTimeout(() => controller.abort(), 10);
    await sleep(5000, controller.signal);
    expect(Date.now() - start).toBeLessThan(100);
  });

  it("returns immediately if signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const start = Date.now();
    await sleep(5000, controller.signal);
    expect(Date.now() - start).toBeLessThan(50);
  });
});
