import { afterEach, describe, expect, it } from "vitest";
import { now, nowMs, resetClock, setClock, withClock } from "../src/clock";

afterEach(resetClock);

const INSTANT = "2026-10-01T00:00:00.000Z";

describe("clock", () => {
  it("reads the system clock until it is told otherwise", () => {
    expect(Math.abs(nowMs() - Date.now())).toBeLessThan(1000);
  });

  it("takes a fixed instant as a date, a number or a string", () => {
    setClock(new Date(INSTANT));
    expect(now().toISOString()).toBe(INSTANT);
    setClock(Date.parse(INSTANT));
    expect(now().toISOString()).toBe(INSTANT);
    setClock(INSTANT);
    expect(now().toISOString()).toBe(INSTANT);
  });

  it("re-reads a function on every call, so a fake clock can advance", () => {
    let ticks = 0;
    setClock(() => 1000 * ++ticks);
    expect(nowMs()).toBe(1000);
    expect(nowMs()).toBe(2000);
  });

  it("hands back a date the caller may mutate", () => {
    setClock(INSTANT);
    const first = now();
    first.setFullYear(1999);
    expect(now().toISOString()).toBe(INSTANT);
  });

  it("refuses an instant it cannot read", () => {
    expect(() => setClock("not a date")).toThrow(/usable instant/);
  });

  it("goes back to the system clock on reset", () => {
    setClock(INSTANT);
    resetClock();
    expect(Math.abs(nowMs() - Date.now())).toBeLessThan(1000);
  });
});

describe("withClock", () => {
  it("restores the clock that was there before", () => {
    setClock(INSTANT);
    const inner = withClock("2020-01-01T00:00:00.000Z", () =>
      now().toISOString(),
    );
    expect(inner).toBe("2020-01-01T00:00:00.000Z");
    expect(now().toISOString()).toBe(INSTANT);
  });

  it("restores it when the block throws", () => {
    setClock(INSTANT);
    expect(() =>
      withClock(0, () => {
        throw new Error("boom");
      }),
    ).toThrow("boom");
    expect(now().toISOString()).toBe(INSTANT);
  });

  it("waits for an async block before restoring", async () => {
    setClock(INSTANT);
    const pending = withClock("2020-01-01T00:00:00.000Z", async () => {
      await Promise.resolve();
      return now().toISOString();
    });
    expect(await pending).toBe("2020-01-01T00:00:00.000Z");
    expect(now().toISOString()).toBe(INSTANT);
  });

  it("restores it when an async block rejects", async () => {
    setClock(INSTANT);
    await expect(
      withClock(0, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
    expect(now().toISOString()).toBe(INSTANT);
  });
});
