import { describe, expect, it } from "vitest";
import { buildAffDevHeadInline } from "../src/dev-head-inject";
import type { ResolvedFeatureRuntime } from "../src/runtime";

const bareRuntime = (
  partial: Partial<ResolvedFeatureRuntime> &
    Pick<ResolvedFeatureRuntime, "flags" | "routeFlags">,
): ResolvedFeatureRuntime => ({
  namespace: "ff",
  mode: "development",
  isDev: true,
  activeEnvironment: "dev",
  flagColorsByToken: {},
  flagOutlineDefaultsByToken: {},
  flagBadgeDefaultsByToken: {},
  ...partial,
});

describe("buildAffDevHeadInline", () => {
  it("injects style, route setter, and bootstrap", () => {
    const out = buildAffDevHeadInline({
      runtime: bareRuntime({
        flags: { hot: true },
        routeFlags: { "/blog/*": ["hot"] },
      }),
      featureFlagStyles: "html{}",
      affDevBootstrap: "/*bootstrap*/",
    });
    expect(out).toContain("data-ff-route");
    expect(out).toContain("/*bootstrap*/");
    expect(out).toContain("html{}");
  });
});
