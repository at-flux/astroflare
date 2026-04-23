import { describe, expect, it } from "vitest";
import { formatDisplayDate } from "../src/date-format";

describe("formatDisplayDate", () => {
  it("formats with default en-GB output", () => {
    expect(formatDisplayDate("2026-04-14T00:00:00.000Z")).toBe("14 April 2026");
  });

  it("supports locale and options overrides", () => {
    expect(
      formatDisplayDate("2026-04-14T00:00:00.000Z", {
        locale: "en-US",
        options: { month: "short", day: "numeric", year: "2-digit" },
      }),
    ).toBe("Apr 14, 26");
  });
});
