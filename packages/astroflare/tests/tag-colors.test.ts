import { describe, expect, it } from "vitest";
import { getTagPalette } from "../src/tag-colors";

describe("tag color palettes", () => {
  it("returns deterministic values for the same tag", () => {
    const first = getTagPalette("feature-flags");
    const second = getTagPalette("feature-flags");
    expect(first).toEqual(second);
  });

  it("uses built-in override hues for known tags", () => {
    const shoots = getTagPalette("shoots");
    expect(shoots).toEqual({
      bg: "hsla(354 48% 58% / 0.12)",
      border: "hsla(354 52% 58% / 0.34)",
      text: "hsl(354 50% 66%)",
    });
  });

  it("resolves custom overrides case-insensitively by key", () => {
    const tagged = getTagPalette("Docs", {
      overrides: { docs: "#00ff00" },
    });
    expect(tagged).toEqual({
      bg: "hsla(120 48% 58% / 0.12)",
      border: "hsla(120 52% 58% / 0.34)",
      text: "hsl(120 50% 66%)",
    });
  });

  it("falls back to hashed hue when override hex is invalid", () => {
    const invalid = getTagPalette("custom-tag", {
      overrides: { "custom-tag": "#zzzzzz" },
    });
    const fallback = getTagPalette("custom-tag");
    expect(invalid).toEqual(fallback);
  });
});
