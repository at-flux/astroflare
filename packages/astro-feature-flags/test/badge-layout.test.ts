import { describe, expect, it } from "vitest";
import {
  elementBadgePositionBlock,
  normalizeElementBadgeLayout,
} from "../src/badge-layout";

describe("normalizeElementBadgeLayout", () => {
  it("defaults to align end (top-right LTR), 80% vertical shift, top anchor", () => {
    expect(normalizeElementBadgeLayout(undefined)).toEqual({
      mode: "align",
      horizontalAlign: "end",
      verticalShiftPercent: 80,
      verticalAnchor: "top",
    });
  });

  it("clamps vertical shift to 0–100 in percent mode", () => {
    expect(
      normalizeElementBadgeLayout({
        elementBadgeHorizontalPercent: 0,
        elementBadgeVerticalShiftPercent: 200,
      }),
    ).toEqual({
      mode: "percent",
      horizontalPercent: 0,
      verticalShiftPercent: 100,
      verticalAnchor: "top",
    });
  });

  it("accepts bottom anchor with percent horizontal", () => {
    expect(
      normalizeElementBadgeLayout({
        elementBadgeVerticalAnchor: "bottom",
        elementBadgeHorizontalPercent: 25,
        elementBadgeVerticalShiftPercent: 40,
      }),
    ).toEqual({
      mode: "percent",
      horizontalPercent: 25,
      verticalShiftPercent: 40,
      verticalAnchor: "bottom",
    });
  });
});

describe("elementBadgePositionBlock", () => {
  it("emits top-right placement with vertical shift only (default)", () => {
    const css = elementBadgePositionBlock({
      mode: "align",
      horizontalAlign: "end",
      verticalShiftPercent: 80,
      verticalAnchor: "top",
    });
    expect(css).toContain("right: 0.35rem");
    expect(css).toContain("left: auto");
    expect(css).toContain("translateY(calc(-1 * 80%))");
    expect(css).not.toContain("translateX");
    expect(css).toContain("top: 0");
  });

  it("emits centred placement when align is center", () => {
    const css = elementBadgePositionBlock({
      mode: "align",
      horizontalAlign: "center",
      verticalShiftPercent: 80,
      verticalAnchor: "top",
    });
    expect(css).toContain("left: 50%");
    expect(css).toContain("translateX(-50%)");
  });

  it("emits bottom-anchored percent positioning", () => {
    const css = elementBadgePositionBlock({
      mode: "percent",
      horizontalPercent: 10,
      verticalShiftPercent: 30,
      verticalAnchor: "bottom",
    });
    expect(css).toContain("left: 10%");
    expect(css).toContain("bottom: 0");
    expect(css).toContain("translateY(30%)");
  });
});
