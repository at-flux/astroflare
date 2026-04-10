import type { ResolvedFeatureRuntime } from "../src/runtime";
import { describe, expect, it } from "vitest";
import { createFeatureFlagStyles } from "../src/dev-outline-css";

const bare = (
  r: Omit<
    ResolvedFeatureRuntime,
    | "flagColorsByToken"
    | "flagOutlineDefaultsByToken"
    | "flagBadgeDefaultsByToken"
  > &
    Partial<
      Pick<
        ResolvedFeatureRuntime,
        | "flagColorsByToken"
        | "flagOutlineDefaultsByToken"
        | "flagBadgeDefaultsByToken"
      >
    >,
): ResolvedFeatureRuntime => ({
  flagColorsByToken: {},
  flagOutlineDefaultsByToken: {},
  flagBadgeDefaultsByToken: {},
  ...r,
});

describe("dev-outline-css snapshots", () => {
  it("matches stable output for a minimal two-flag runtime", () => {
    const css = createFeatureFlagStyles(
      bare({
        namespace: "snap",
        mode: "development",
        isDev: true,
        flags: { dev: true, beta: false },
        routeFlags: {},
        flagColorsByToken: { dev: "#ff0000", beta: "#0000ff" },
      }),
      { outlineOffset: "-2px", badgeLabelDev: "dev" },
    );
    expect(css).toMatchSnapshot();
  });
});
