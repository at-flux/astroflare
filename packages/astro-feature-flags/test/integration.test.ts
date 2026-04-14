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

describe("integration exports", () => {
  it("resolves runtime and route helper", () => {
    const runtime = getResolvedFeatures({
      mode: "production",
      forceEnvironment: "prod",
      flags: {
        wip: { routes: ["/blog/*"] },
      },
      environments: {
        prod: { when: true, flags: { wip: false } },
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

  it("registers head-inline dev toolbar bundle via injectScript when command is dev", () => {
    const integration = astroFeatureFlags({
      mode: "development",
      flags: { only: {} },
      environments: {
        prod: { when: false, flags: { only: false } },
      },
    });
    const headInline: string[] = [];
    integration.hooks["astro:config:setup"]?.({
      command: "dev",
      isRestart: false,
      config: {} as never,
      updateConfig: () => ({}) as never,
      addWatchFile: () => {},
      injectScript: (stage: string, content: string) => {
        if (stage === "head-inline") headInline.push(content);
      },
      addMiddleware: () => {},
      logger: {
        options: {},
        warn: () => {},
        error: () => {},
        info: () => {},
        debug: () => {},
      },
    } as never);
    expect(headInline.length).toBeGreaterThan(0);
    expect(headInline[0]).toContain("data-ff-route");
    expect(headInline[0]).toContain("document.documentElement");
  });

  it("generates namespaced data selectors and css variables per token", () => {
    const css = createFeatureFlagStyles(
      bare({
        namespace: "demo-feat",
        mode: "development",
        isDev: true,
        flags: { wip: false, shinyNewFeature: true, anotherFlag: false },
        routeFlags: {},
      }),
      {
        outlineColor: "#00ff00",
        badgeLabelWip: "WIP!",
        badgeLabelByToken: { "shiny-new-feature": "Shiny" },
        hiddenStrategy: "display",
      },
    );

    expect(css).toContain('[data-demo-feat~="wip"]');
    expect(css).toContain('[data-demo-feat~="shinyNewFeature"]');
    expect(css).toContain('[data-demo-feat~="shiny-new-feature"]');
    expect(css).toContain('[data-demo-feat~="another-flag"]');
    expect(css).toContain("content: 'WIP!'");
    expect(css).toContain("content: 'Shiny'");
    expect(css).toContain("--demo-feat-c-wip");
    expect(css).toContain("--aff-outline-c-wip: transparent");
    expect(css).toContain("outline: 2px solid var(--aff-outline-c-wip)");
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
      ':is([data-demo-feat~="wip"], [data-demo-feat-wip]):hover::before',
    );
    expect(css).toContain(
      'html[data-ff-route]:not([data-ff-route=""])::before:hover',
    );
    expect(css).toContain("pointer-events: auto");
    expect(css).toContain('[data-demo-feat~="wip"]');
    expect(css).toContain("position: relative");
  });

  it("uses per-token colours from runtime for outlines when set", () => {
    const css = createFeatureFlagStyles(
      bare({
        namespace: "x",
        mode: "development",
        isDev: true,
        flags: { wip: true, beta: true },
        routeFlags: {},
        flagColorsByToken: { wip: "#ff0000", beta: "#0000ff" },
      }),
    );
    expect(css).toContain("var(--x-c-wip, #ff0000)");
    expect(css).toContain("var(--x-c-beta, #0000ff)");
  });

  it("embeds per-environment maps and bootstrap overlay helpers", () => {
    const runtime = bare({
      namespace: "ff",
      mode: "development",
      isDev: true,
      flags: { wip: true, hotFeature2: true },
      routeFlags: { "/hot/*": ["hotFeature2"] },
    });
    const prodFlags = { wip: true, hotFeature2: false };
    const src = createVirtualModuleSource(runtime, undefined, {
      prod: prodFlags,
    });
    expect(src).toContain("export const featureFlagsByEnvironment");
    expect(src).toContain("export const defaultNonDevEnvironment");
    expect(src).toContain('"hotFeature2": false');
    expect(src).toContain("export function shouldIncludePathForEnvironment");
    expect(src).toContain("export function flagsForEnvironment");
    expect(src).toContain("export const activeEnvironmentKey");
    expect(src).toContain("export const isAstroDev");
    expect(src).toContain("This URL is not emitted for configured environment");
  });

  it("includes customized CSS in virtual module source", () => {
    const runtime = bare({
      namespace: "demo-feat",
      mode: "development",
      isDev: true,
      flags: { wip: false, shinyNewFeature: true },
      routeFlags: {},
    });

    const moduleSource = createVirtualModuleSource(runtime, {
      outlineColor: "#00ff00",
      badgeLabelWip: "WIP!",
      badgeLabelByToken: { "shiny-new-feature": "Shiny" },
      hiddenStrategy: "display",
    });

    expect(moduleSource).toContain("content: 'WIP!'");
    expect(moduleSource).toContain("content: 'Shiny'");
    expect(moduleSource).toContain("[data-demo-feat~=");
    expect(moduleSource).toContain("export const featureFlagTokens");
    expect(moduleSource).toContain("export const featureFlagsByEnvironment");
    expect(moduleSource).toContain("export function flagsForEnvironment");
    expect(moduleSource).toContain(
      "export function isFeatureEnabledForEnvironment",
    );
    expect(moduleSource).toContain("export const featureFlagColors");
    expect(moduleSource).toContain(
      "export function matchedFeatureRoutePrefix(pathname)",
    );
    expect(moduleSource).toContain(
      "export function routeFeatureTokenForPath(pathname)",
    );
    expect(moduleSource).toContain(
      "export function shouldIncludePathForEnvironment(pathname, envName)",
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
        flags: { wip: true },
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
        flags: { wip: true },
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
        flags: { wip: true },
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
        flags: { wip: true, beta: true },
        routeFlags: {},
      }),
    );
    expect(css).toContain(
      'html[data-ff-route]:not([data-ff-route=""])::before',
    );
    expect(css).toContain('[data-ns~="wip"]');
    expect(css).toContain('[data-ns~="beta"]');
    expect(css).toContain(
      'html[data-ff-enabled-wip="off"] :is([data-ns~="wip"], [data-ns-wip])',
    );
  });
});
