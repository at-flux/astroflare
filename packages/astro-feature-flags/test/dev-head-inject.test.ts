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

  it("marks the injected dev-chrome style persistent across view transitions", () => {
    const out = buildAffDevHeadInline({
      runtime: bareRuntime({
        flags: { hot: true },
        routeFlags: { "/blog/*": ["hot"] },
      }),
      featureFlagStyles: "html{}",
      affDevBootstrap: "/*bootstrap*/",
    });
    // The style must carry the persist marker so Astro's ClientRouter keeps it
    // when it swaps <head> on a navigation, and injection must be idempotent so
    // it is re-applied on astro:after-swap rather than duplicated.
    expect(out).toContain("data-astro-transition-persist");
    expect(out).toContain("ensureFeatureFlagStyles");
  });
});
