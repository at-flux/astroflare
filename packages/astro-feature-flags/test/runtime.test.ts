import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isRouteFlagged,
  loadFeatureConfig,
  longestMatchingRoutePrefix,
  resolveFeatureFlagsByEnvironment,
  resolveFeatureRuntime,
  routePatternToPrefix,
  routePathsToPrune,
  shouldIncludeRoute,
  toEnumKey,
  toToken,
} from "../src/runtime";

describe("naming", () => {
  it("creates enum-safe names", () => {
    expect(toEnumKey("shinyNewFeature")).toBe("ShinyNewFeature");
    expect(toEnumKey("dev-mode")).toBe("DevMode");
    expect(toEnumKey("foo_bar")).toBe("FooBar");
  });

  it("creates CSS/env tokens", () => {
    expect(toToken("shinyNewFeature")).toBe("shiny-new-feature");
    expect(toToken("dev mode")).toBe("dev-mode");
    expect(toToken("hotFeature2")).toBe("hot-feature-2");
  });
});

describe("class token conventions", () => {
  it("builds per-flag class names without double dashes", () => {
    const namespace = "demo-feat";
    const token = toToken("shinyNewFeature");
    expect(`${namespace}-${token}`).toBe("demo-feat-shiny-new-feature");
    expect(`${namespace}-${toToken("dev")}`).toBe("demo-feat-dev");
  });
});

describe("css token label mapping", () => {
  it("uses toToken for tokens", () => {
    expect(toToken("ShinyNewFeature")).toBe("shiny-new-feature");
    expect(toToken("dev")).toBe("dev");
  });
});

describe("routePatternToPrefix", () => {
  it("maps wildcards to directory prefixes", () => {
    expect(routePatternToPrefix("/blog/*")).toBe("/blog/");
    expect(routePatternToPrefix("/blog/**")).toBe("/blog/");
    expect(routePatternToPrefix("/docs")).toBe("/docs/");
  });
});

describe("longestMatchingRoutePrefix", () => {
  const routeFlags = {
    "/blog/": ["dev"],
    "/": ["root"],
  };

  it("returns longest matching route flag prefix", () => {
    expect(longestMatchingRoutePrefix("/blog/hello/", routeFlags)).toBe(
      "/blog/",
    );
    expect(longestMatchingRoutePrefix("/blog/", routeFlags)).toBe("/blog/");
    expect(longestMatchingRoutePrefix("/about/", routeFlags)).toBe("/");
  });

  it("matches ff.json /blog/* style keys", () => {
    expect(
      longestMatchingRoutePrefix("/blog/post/", { "/blog/*": ["dev"] }),
    ).toBe("/blog/*");
    expect(longestMatchingRoutePrefix("/blog/", { "/blog/*": ["dev"] })).toBe(
      "/blog/*",
    );
  });

  it("returns null when nothing matches", () => {
    expect(
      longestMatchingRoutePrefix("/labs/foo/", { "/blog/": ["dev"] }),
    ).toBe(null);
  });
});

describe("config loading", () => {
  it("loads empty flags when only dev+prod with one active when", () => {
    const config = loadFeatureConfig({
      mode: "production",
      environments: {
        prod: { when: true, flags: {} },
      },
    });
    expect(config.namespace).toBe("ff");
    expect(config.flags).toEqual({});
    expect(config.colors).toEqual({});
    expect(config.activeEnvironment).toBe("prod");
  });

  it("deep-merges ff.json over inline astro config", () => {
    const dir = mkdtempSync(join(tmpdir(), "aff-ff-"));
    try {
      writeFileSync(
        join(dir, "ff.json"),
        JSON.stringify({
          tokenNamespace: "demo",
          flags: {
            wip: { colour: "red", routes: ["/blog/*"] },
            hotFeature2: { colour: "blue", routes: ["/labs/*"] },
          },
          environments: {
            prod: {
              flags: { wip: false, hotFeature2: true },
            },
          },
        }),
      );
      const cfg = loadFeatureConfig({
        configRoot: dir,
        jsonConfigPath: join(dir, "ff.json"),
        mode: "production",
        tokenNamespace: "inline-ns",
        flags: {
          wip: { colour: "pink" },
        },
        environments: {
          prod: { when: true, flags: { wip: true } },
        },
      });
      expect(cfg.namespace).toBe("demo");
      expect(cfg.flags.wip).toBe(false);
      expect(cfg.flags.hotFeature2).toBe(true);
      expect(cfg.routeFlags["/labs/*"]).toEqual(["hotFeature2"]);
      expect(cfg.colors.wip).toBe("red");
      expect(cfg.colors.hotFeature2).toBe("blue");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges per-environment jsonConfigPath when that layer is active", () => {
    const dir = mkdtempSync(join(tmpdir(), "aff-ff-env-"));
    try {
      writeFileSync(
        join(dir, "ff.json"),
        JSON.stringify({
          flags: {
            wip: { routes: ["/"] },
            beta: {},
          },
          environments: {
            staging: {
              when: true,
              flags: { wip: true, beta: false },
              jsonConfigPath: "ff.staging.json",
            },
            prod: { when: false, flags: {} },
          },
        }),
      );
      writeFileSync(
        join(dir, "ff.staging.json"),
        JSON.stringify({
          environments: {
            staging: { flags: { beta: true } },
          },
        }),
      );

      const cfg = loadFeatureConfig({
        configRoot: dir,
        jsonConfigPath: join(dir, "ff.json"),
        mode: "development",
        forceEnvironment: "staging",
      });
      expect(cfg.flags.wip).toBe(true);
      expect(cfg.flags.beta).toBe(true);
      expect(cfg.routeFlags["/"]).toEqual(["wip"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("route behavior", () => {
  const routeFlags = { "/blog/": ["wip"], "/labs/": ["labs"] };
  const flags = { wip: false, labs: true };

  it("matches flagged routes including descendants", () => {
    expect(isRouteFlagged("/blog/", routeFlags)).toBe(true);
    expect(isRouteFlagged("/blog/hello/", routeFlags)).toBe(true);
    expect(isRouteFlagged("/about/", routeFlags)).toBe(false);
  });

  it("includes everything in dev mode", () => {
    expect(
      shouldIncludeRoute({
        pathname: "/blog/hello/",
        routeFlags,
        flags,
        isDev: true,
      }),
    ).toBe(true);
  });

  it("omits disabled flagged routes in production", () => {
    expect(
      shouldIncludeRoute({
        pathname: "/blog/hello/",
        routeFlags,
        flags,
        isDev: false,
      }),
    ).toBe(false);
  });

  it("keeps enabled flagged routes in production", () => {
    expect(
      shouldIncludeRoute({
        pathname: "/labs/abc/",
        routeFlags,
        flags,
        isDev: false,
      }),
    ).toBe(true);
  });
});

describe("env overrides and pruning", () => {
  it("supports AFF_FEATURE_* env overrides when not dev layer", () => {
    const runtime = resolveFeatureRuntime({
      mode: "production",
      forceEnvironment: "prod",
      env: {
        AFF_FEATURE_WIP: "true",
        AFF_FEATURE_SHINY_NEW_FEATURE: "1",
      },
      tokenNamespace: "site-ff",
      flags: {
        wip: { routes: ["/blog/*"] },
        shinyNewFeature: {},
      },
      environments: {
        prod: {
          when: true,
          flags: { wip: false, shinyNewFeature: false },
        },
      },
    });
    expect(runtime.activeEnvironment).toBe("prod");
    expect(runtime.flags.wip).toBe(true);
    expect(runtime.flags.shinyNewFeature).toBe(true);
  });

  it("skips process env flag overrides in dev layer", () => {
    const runtime = resolveFeatureRuntime({
      mode: "development",
      env: {
        AFF_FEATURE_X: "false",
      },
      flags: { x: {} },
      environments: {
        prod: { when: false, flags: { x: false } },
      },
    });
    expect(runtime.isDev).toBe(true);
    expect(runtime.flags.x).toBe(true);
  });

  it("returns only disabled route paths for pruning", () => {
    expect(
      routePathsToPrune({
        routeFlags: { "/blog/": ["wip"], "/labs/": ["labs"] },
        flags: { wip: false, labs: true },
      }),
    ).toEqual(["blog"]);
  });
});

describe("resolveFeatureFlagsByEnvironment", () => {
  it("returns one resolved flag map per environments key", () => {
    const byEnv = resolveFeatureFlagsByEnvironment({
      mode: "development",
      tokenNamespace: "x",
      flags: {
        a: {},
        b: {},
      },
      environments: {
        prod: { when: false, flags: { a: false, b: true } },
      },
    });
    expect(byEnv.dev).toEqual({ a: true, b: true });
    expect(byEnv.prod).toEqual({ a: false, b: true });
  });

  it("honours forceEnvironment on options", () => {
    const base = {
      flags: { x: {} },
      environments: {
        prod: { when: false, flags: { x: false } },
      },
    };
    const cfgDev = loadFeatureConfig({
      mode: "production",
      forceEnvironment: "dev",
      ...base,
    });
    expect(cfgDev.flags.x).toBe(true);
    const cfgProd = loadFeatureConfig({
      mode: "development",
      forceEnvironment: "prod",
      ...base,
    });
    expect(cfgProd.flags.x).toBe(false);
  });

  it("honours forceEnvironment on resolveFeatureRuntime", () => {
    const rt = resolveFeatureRuntime({
      mode: "development",
      forceEnvironment: "prod",
      flags: { x: {} },
      environments: {
        prod: { when: false, flags: { x: false } },
      },
      env: {},
    });
    expect(rt.flags.x).toBe(false);
    expect(rt.activeEnvironment).toBe("prod");
  });

  it("prefers forceEnvironment over AFF_ENVIRONMENT", () => {
    const rt = resolveFeatureRuntime({
      mode: "development",
      forceEnvironment: "prod",
      env: { AFF_ENVIRONMENT: "staging" },
      flags: { x: {} },
      environments: {
        staging: { when: false, flags: { x: true } },
        prod: { when: false, flags: { x: false } },
      },
    });
    expect(rt.activeEnvironment).toBe("prod");
    expect(rt.flags.x).toBe(false);
  });
});

describe("environment validation", () => {
  it("throws when exactly one when is not set", () => {
    expect(() =>
      loadFeatureConfig({
        mode: "production",
        environments: {
          prod: { when: false, flags: {} },
        },
      }),
    ).toThrow(/exactly one environment must have when: true/);
  });

  it("injects reserved dev when omitted from config", () => {
    const cfg = loadFeatureConfig({
      mode: "production",
      flags: {
        onlyProd: {},
      },
      environments: {
        prod: { when: true, flags: { onlyProd: true } },
      },
    });
    expect(cfg.activeEnvironment).toBe("prod");
    expect(cfg.flags.onlyProd).toBe(true);
  });
});
