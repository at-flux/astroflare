import { describe, expect, it } from "vitest";
import {
  buildCollectionHref,
  buildPageSequence,
  matchesCollectionFilters,
  paginateCollection,
  parseCollectionQuery,
} from "../src/collection-query";

describe("collection query helpers", () => {
  it("parses page, size, offset and JSON filters param", () => {
    const params = new URLSearchParams(
      `page=3&size=5&offset=10&filters=${encodeURIComponent(
        JSON.stringify({ tag: "alpha", area: "tech" }),
      )}`,
    );
    const query = parseCollectionQuery(params);
    expect(query).toEqual({
      page: 3,
      size: 5,
      offset: 10,
      filters: { tag: "alpha", area: "tech" },
    });
  });

  it("paginates a collection by offset and size", () => {
    const slice = paginateCollection([1, 2, 3, 4, 5], {
      page: 2,
      size: 2,
      offset: 2,
      filters: {},
    });
    expect(slice.items).toEqual([3, 4]);
    expect(slice.totalPages).toBe(3);
    expect(slice.start).toBe(2);
    expect(slice.end).toBe(4);
  });

  it("builds normalized hrefs with pagination params", () => {
    const href = buildCollectionHref(
      "/tech/portfolio",
      { page: 2, size: 5, offset: 5, filters: {} },
      { page: 3, offset: 10, filters: { tag: "beta" } },
    );
    expect(href).toBe(
      "/tech/portfolio?page=3&size=5&offset=10&filters=%7B%22tag%22%3A%22beta%22%7D",
    );
  });

  it("builds windowed page sequences with ellipsis", () => {
    expect(buildPageSequence(10, 5, 7)).toEqual([1, "…", 3, 4, 5, 6, 7, "…", 10]);
  });

  it("matches records against multiple filters", () => {
    expect(
      matchesCollectionFilters(
        { tag: ["alpha", "beta"], area: ["tech"] },
        { tag: "alpha", area: "tech" },
      ),
    ).toBe(true);
    expect(
      matchesCollectionFilters(
        { tag: ["alpha"], area: ["tech"] },
        { tag: "alpha", area: "sites" },
      ),
    ).toBe(false);
  });
});
