import type { ResolvedFeatureRuntime } from "../src/runtime";
import { describe, expect, it } from "vitest";
import { createFeatureFlagStyles } from "../src/dev-outline-css";

const bare = (
  r: Omit<
    ResolvedFeatureRuntime,
    | "flagColorsByToken"
    | "flagOutlineDefaultsByToken"
    | "flagBadgeDefaultsByToken"
    | "activeEnvironment"
  > &
    Partial<
      Pick<
        ResolvedFeatureRuntime,
        | "flagColorsByToken"
        | "flagOutlineDefaultsByToken"
        | "flagBadgeDefaultsByToken"
      >
    >,
): ResolvedFeatureRuntime => {
  const activeEnvironment =
    (r as { activeEnvironment?: string }).activeEnvironment ??
    (r.isDev ? "dev" : "prod");
  return {
    flagColorsByToken: {},
    flagOutlineDefaultsByToken: {},
    flagBadgeDefaultsByToken: {},
    ...r,
    activeEnvironment,
    isDev: r.isDev ?? activeEnvironment === "dev",
  };
};

describe("dev-outline-css snapshots", () => {
  it("matches stable output for a minimal two-flag runtime", () => {
    const css = createFeatureFlagStyles(
      bare({
        namespace: "snap",
        mode: "development",
        isDev: true,
        flags: { wip: true, beta: false },
        routeFlags: {},
        flagColorsByToken: { wip: "#ff0000", beta: "#0000ff" },
      }),
      { outlineOffset: "-2px", badgeLabelWip: "wip" },
    );
    expect(css).toMatchSnapshot();
  });
});
