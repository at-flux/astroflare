import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isRouteFlagged,
  loadFeatureConfig,
  longestMatchingRoutePrefix,
  resolveFeatureRuntime,
  routePatternToPrefix,
  routePathsToPrune,
  shouldIncludeRoute,
  shouldRenderFeatureInMode,
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
  it("loads empty config when no inline or file config exists", () => {
    const config = loadFeatureConfig({
      root: "/tmp/aff-does-not-exist-9f3a2",
      mode: "production",
      baseName: "missing-ff",
    });
    expect(config.namespace).toBe("ff");
    expect(config.flags).toEqual({});
    expect(config.colors).toEqual({});
  });

  it("deep-merges ff.json over inline astro config", () => {
    const dir = mkdtempSync(join(tmpdir(), "aff-ff-"));
    try {
      writeFileSync(
        join(dir, "ff.json"),
        JSON.stringify({
          tokenNamespace: "demo",
          flags: {
            dev: { colour: "red", routes: ["/blog/*"] },
            hotFeature2: { colour: "blue", routes: ["/labs/*"] },
          },
          environments: {
            prod: {
              flags: { dev: false, hotFeature2: true },
            },
          },
        }),
      );
      const cfg = loadFeatureConfig({
        root: dir,
        mode: "production",
        baseName: "ff",
        tokenNamespace: "inline-ns",
        flags: {
          dev: { colour: "pink" },
        },
        environments: {
          prod: { when: true, flags: { dev: true } },
        },
      });
      expect(cfg.namespace).toBe("demo");
      expect(cfg.flags.dev).toBe(false);
      expect(cfg.flags.hotFeature2).toBe(true);
      expect(cfg.routeFlags["/labs/*"]).toEqual(["hotFeature2"]);
      expect(cfg.colors.dev).toBe("red");
      expect(cfg.colors.hotFeature2).toBe("blue");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("merges ff.{env}.json after ff.json when fileEnv is set", () => {
    const dir = mkdtempSync(join(tmpdir(), "aff-ff-env-"));
    try {
      writeFileSync(
        join(dir, "ff.json"),
        JSON.stringify({
          flags: {
            dev: { routes: ["/"] },
            beta: {},
          },
          environments: {
            dev: { flags: { dev: true, beta: false } },
          },
        }),
      );
      writeFileSync(
        join(dir, "ff.preview.json"),
        JSON.stringify({
          environments: {
            dev: { flags: { beta: true } },
          },
        }),
      );

      const cfg = loadFeatureConfig({
        root: dir,
        mode: "development",
        baseName: "ff",
        fileEnv: "preview",
      });
      expect(cfg.flags.dev).toBe(true);
      expect(cfg.flags.beta).toBe(true);
      expect(cfg.routeFlags["/"]).toEqual(["dev"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("route behavior", () => {
  const routeFlags = { "/blog/": ["dev"], "/labs/": ["labs"] };
  const flags = { dev: false, labs: true };

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

describe("render behavior", () => {
  it("always renders in dev mode", () => {
    expect(
      shouldRenderFeatureInMode({
        isDev: true,
        flags: { dev: false },
        flag: "dev",
      }),
    ).toBe(true);
  });

  it("obeys feature flags in production mode", () => {
    expect(
      shouldRenderFeatureInMode({
        isDev: false,
        flags: { dev: false },
        flag: "dev",
      }),
    ).toBe(false);
    expect(
      shouldRenderFeatureInMode({
        isDev: false,
        flags: { dev: true },
        flag: "dev",
      }),
    ).toBe(true);
  });
});

describe("env overrides and pruning", () => {
  it("supports AFF_FEATURE_* env overrides", () => {
    const runtime = resolveFeatureRuntime({
      mode: "production",
      isDev: false,
      env: {
        AFF_FEATURE_DEV: "true",
        AFF_FEATURE_SHINY_NEW_FEATURE: "1",
      },
      tokenNamespace: "site-ff",
      flags: {
        dev: { routes: ["/blog/*"] },
        shinyNewFeature: {},
      },
      environments: {
        prod: {
          flags: { dev: false, shinyNewFeature: false },
        },
      },
    });
    expect(runtime.flags.dev).toBe(true);
    expect(runtime.flags.shinyNewFeature).toBe(true);
  });

  it("returns only disabled route paths for pruning", () => {
    expect(
      routePathsToPrune({
        routeFlags: { "/blog/": ["dev"], "/labs/": ["labs"] },
        flags: { dev: false, labs: true },
      }),
    ).toEqual(["blog"]);
  });
});
