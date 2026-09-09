import { describe, expect, it } from "vitest";
import { resolvePagedGridLayout } from "../src/paged-grid";

describe("resolvePagedGridLayout", () => {
  it("defaults to eight tiles over two and four columns", () => {
    expect(resolvePagedGridLayout()).toEqual({
      columns: [2, 4],
      rows: 2,
      perPage: 8,
    });
  });

  it("derives the page size from the widest step", () => {
    expect(resolvePagedGridLayout({ columns: [2, 4], rows: 3 }).perPage).toBe(
      12,
    );
  });

  it("reports the rows an explicit page size actually gives", () => {
    const layout = resolvePagedGridLayout({ columns: [2, 4], perPage: 16 });
    expect(layout).toEqual({ columns: [2, 4], rows: 4, perPage: 16 });
  });

  it("rejects a page size that leaves a part-filled row", () => {
    expect(() =>
      resolvePagedGridLayout({ columns: [2, 3, 4], rows: 2 }),
    ).toThrow(/leaves a part-filled row at 3 column/);
  });

  it("names every ragged step, not just the first", () => {
    expect(() =>
      resolvePagedGridLayout({ columns: [3, 5], perPage: 4 }),
    ).toThrow(/at 3, 5 column/);
  });

  it("rejects nonsense geometry", () => {
    expect(() => resolvePagedGridLayout({ columns: [] })).toThrow(
      /cannot be empty/,
    );
    expect(() => resolvePagedGridLayout({ columns: [0, 4] })).toThrow(
      /positive integer/,
    );
    expect(() => resolvePagedGridLayout({ rows: 0 })).toThrow(/`rows`/);
    expect(() => resolvePagedGridLayout({ perPage: 0 })).toThrow(/`perPage`/);
  });
});
