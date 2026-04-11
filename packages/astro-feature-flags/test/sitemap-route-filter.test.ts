import { describe, expect, it } from "vitest";
import { featureRouteIncluded, getResolvedFeatures } from "../src/index";

/**
 * Mirrors the pattern in docs/how-to/hide-from-sitemaps.md: the sitemap filter should
 * exclude URLs that would be pruned for the same resolved runtime as the integration.
 */
describe("sitemap-style route filter", () => {
  it("excludes disabled flagged routes for the resolved prod layer", () => {
    const featureFlagOptions = {
      flags: {
        wip: { routes: ["/blog/*"] },
      },
      environments: {
        prod: {
          when: process.env.NODE_ENV === "production",
          flags: { wip: false },
        },
      },
    };
    const runtime = getResolvedFeatures({
      ...featureFlagOptions,
      mode: "production",
      forceEnvironment: "prod",
    });
    expect(featureRouteIncluded("/blog/post/", runtime)).toBe(false);
    expect(featureRouteIncluded("/about/", runtime)).toBe(true);
  });
});
