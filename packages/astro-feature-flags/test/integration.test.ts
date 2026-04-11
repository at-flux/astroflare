import type { ResolvedFeatureRuntime } from "../src/runtime";
import { describe, expect, it } from "vitest";
import astroFeatureFlags, {
  createFeatureFlagStyles,
  createVirtualModuleSource,
  featureRouteIncluded,
  getResolvedFeatures,
} from "../src/index";

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

describe("integration exports", () => {
  it("resolves runtime and route helper", () => {
    const runtime = getResolvedFeatures({
      mode: "production",
      isDev: false,
      flags: {
        dev: { routes: ["/blog/*"] },
      },
      environments: {
        prod: { flags: { dev: false } },
      },
    });
    expect(featureRouteIncluded("/blog/post-1/", runtime)).toBe(false);
    expect(featureRouteIncluded("/about/", runtime)).toBe(true);
  });

  it("returns an astro integration shape", () => {
    const integration = astroFeatureFlags();
    expect(integration.name).toBe("astro-feature-flags");
    expect(typeof integration.hooks["astro:config:setup"]).toBe("function");
    expect(typeof integration.hooks["astro:build:done"]).toBe("function");
  });

  it("generates namespaced data selectors and css variables per token", () => {
    const css = createFeatureFlagStyles(
      bare({
        namespace: "demo-feat",
        mode: "development",
        isDev: true,
        flags: { dev: false, shinyNewFeature: true, anotherFlag: false },
        routeFlags: {},
      }),
      {
        outlineColor: "#00ff00",
        badgeLabelDev: "DEV!",
        badgeLabelByToken: { "shiny-new-feature": "Shiny" },
        hiddenStrategy: "display",
      },
    );

    expect(css).toContain('[data-demo-feat~="dev"]');
    expect(css).toContain('[data-demo-feat~="shinyNewFeature"]');
    expect(css).toContain('[data-demo-feat~="shiny-new-feature"]');
    expect(css).toContain('[data-demo-feat~="another-flag"]');
    expect(css).toContain("content: 'DEV!'");
    expect(css).toContain("content: 'Shiny'");
    expect(css).toContain("--demo-feat-c-dev");
    expect(css).toContain("--aff-outline-c-dev: transparent");
    expect(css).toContain("outline: 2px solid var(--aff-outline-c-dev)");
    expect(css).toContain("outline-offset: -2px");
    expect(css).toContain("position: absolute");
    expect(css).toContain("right: 0.35rem");
    expect(css).toContain("translateY(calc(-1 * 80%))");
    expect(css).toContain(
      'html[data-ff-route]:not([data-ff-route=""])::before',
    );
    expect(css).toContain("position: fixed");
    expect(css).toContain("data-ff-enabled-");
    expect(css).toContain(
      ':is([data-demo-feat~="dev"], [data-demo-feat-dev]):hover::before',
    );
    expect(css).toContain(
      'html[data-ff-route]:not([data-ff-route=""])::before:hover',
    );
    expect(css).toContain("pointer-events: auto");
    expect(css).toContain('[data-demo-feat~="dev"]');
    expect(css).toContain("position: relative");
  });

  it("uses per-token colours from runtime for outlines when set", () => {
    const css = createFeatureFlagStyles(
      bare({
        namespace: "x",
        mode: "development",
        isDev: true,
        flags: { dev: true, beta: true },
        routeFlags: {},
        flagColorsByToken: { dev: "#ff0000", beta: "#0000ff" },
      }),
    );
    expect(css).toContain("var(--x-c-dev, #ff0000)");
    expect(css).toContain("var(--x-c-beta, #0000ff)");
  });

  it("embeds production flags for shouldIncludePathInProduction and bootstrap overlay", () => {
    const runtime = bare({
      namespace: "ff",
      mode: "development",
      isDev: true,
      flags: { dev: true, hotFeature2: true },
      routeFlags: { "/hot/*": ["hotFeature2"] },
    });
    const prodFlags = { dev: true, hotFeature2: false };
    const src = createVirtualModuleSource(runtime, undefined, prodFlags);
    expect(src).toContain("export const featureFlagsProduction");
    expect(src).toContain('"hotFeature2": false');
    expect(src).toMatch(
      /shouldIncludePathInProduction\([\s\S]+isFeatureEnabledProduction/,
    );
  });

  it("includes customized CSS in virtual module source", () => {
    const runtime = bare({
      namespace: "demo-feat",
      mode: "development",
      isDev: true,
      flags: { dev: false, shinyNewFeature: true },
      routeFlags: {},
    });

    const moduleSource = createVirtualModuleSource(runtime, {
      outlineColor: "#00ff00",
      badgeLabelDev: "DEV!",
      badgeLabelByToken: { "shiny-new-feature": "Shiny" },
      hiddenStrategy: "display",
    });

    expect(moduleSource).toContain("content: 'DEV!'");
    expect(moduleSource).toContain("content: 'Shiny'");
    expect(moduleSource).toContain("[data-demo-feat~=");
    expect(moduleSource).toContain("export const featureFlagTokens");
    expect(moduleSource).toContain("export const featureFlagsProduction");
    expect(moduleSource).toContain(
      "export function isFeatureEnabledProduction",
    );
    expect(moduleSource).toContain("export const featureFlagColors");
    expect(moduleSource).toContain(
      "export function matchedFeatureRoutePrefix(pathname)",
    );
    expect(moduleSource).toContain(
      "export function routeFeatureTokenForPath(pathname)",
    );
    expect(moduleSource).toContain(
      "export function shouldIncludePathInProduction(pathname)",
    );
    expect(moduleSource).toContain("export const affDevBootstrap");
    expect(moduleSource).toMatch(
      /export const featureFlagStyles = import\.meta\.env\.DEV \? [\s\S]+ : "";/,
    );
    expect(moduleSource).not.toContain("export function featureClass");
  });

  it("defaults outline-offset inside the box", () => {
    const css = createFeatureFlagStyles(
      bare({
        namespace: "t",
        mode: "development",
        isDev: true,
        flags: { dev: true },
        routeFlags: {},
      }),
    );
    expect(css).toContain("outline-offset: -2px");
  });

  it("allows positive outlineOffset override", () => {
    const css = createFeatureFlagStyles(
      bare({
        namespace: "t",
        mode: "development",
        isDev: true,
        flags: { dev: true },
        routeFlags: {},
      }),
      { outlineOffset: "4px" },
    );
    expect(css).toContain("outline-offset: 4px");
    expect(css).not.toContain("outline-offset: -2px");
  });

  it("applies custom element badge layout from css options", () => {
    const css = createFeatureFlagStyles(
      bare({
        namespace: "ns",
        mode: "development",
        isDev: true,
        flags: { dev: true },
        routeFlags: {},
      }),
      {
        elementBadgeHorizontalPercent: 10,
        elementBadgeVerticalShiftPercent: 50,
        elementBadgeVerticalAnchor: "bottom",
      },
    );
    expect(css).toContain("left: 10%");
    expect(css).toContain("translateY(50%)");
    expect(css).toContain("bottom: 0");
  });

  it("includes route badge and enabled-off rules for each flag token", () => {
    const css = createFeatureFlagStyles(
      bare({
        namespace: "ns",
        mode: "development",
        isDev: true,
        flags: { dev: true, beta: true },
        routeFlags: {},
      }),
    );
    expect(css).toContain(
      'html[data-ff-route]:not([data-ff-route=""])::before',
    );
    expect(css).toContain('[data-ns~="dev"]');
    expect(css).toContain('[data-ns~="beta"]');
    expect(css).toContain(
      'html[data-ff-enabled-dev="off"] :is([data-ns~="dev"], [data-ns-dev])',
    );
  });
});
