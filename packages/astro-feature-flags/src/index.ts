import { rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  elementBadgePositionBlock,
  normalizeElementBadgeLayout,
} from "./badge-layout";
import { DEV_TOOLBAR_FLAG_ICON_SVG } from "./dev-toolbar-flag-icon";
import type {
  ElementBadgeHorizontalAlign,
  ElementBadgeLayoutOptions,
  ElementBadgeVerticalAnchor,
  NormalizedElementBadgeLayout,
} from "./badge-layout";
import {
  type FeatureFlagMap,
  type ResolveFeatureRuntimeOptions,
  type ResolvedFeatureRuntime,
  resolveFeatureFlagsByEnvironment,
  resolveFeatureRuntime,
  routePathsToPrune,
  shouldIncludeRoute,
  toEnumKey,
  toToken,
} from "./runtime";

export type {
  ElementBadgeHorizontalAlign,
  ElementBadgeLayoutOptions,
  ElementBadgeVerticalAnchor,
  NormalizedElementBadgeLayout,
};
export { elementBadgePositionBlock, normalizeElementBadgeLayout };

export type {
  DevOutlineCssOptions,
  DevOutlineHiddenStrategy,
} from "./dev-outline-css";

import type { DevOutlineCssOptions } from "./dev-outline-css";
import {
  buildAffDevBootstrapScript,
  createFeatureFlagStyles,
  createProductionGateStyles,
} from "./dev-outline-css";
import { applyProductionHtmlCullToDist } from "./production-html-cull";
import { buildAffDevHeadInline } from "./dev-head-inject";
import { routePrefixJsHelper } from "./route-prefix-js";

export { createFeatureFlagStyles, createProductionGateStyles };
export {
  cullProductionHtml,
  applyProductionHtmlCullToDist,
} from "./production-html-cull";

export interface AstroFeatureFlagsOptions extends ResolveFeatureRuntimeOptions {
  css?: DevOutlineCssOptions;
  /** When false, keeps static build output untouched (no route pruning / HTML cull). */
  staticMinify?: boolean;
}

/** Prefer `prod` if present; else first non-`dev` key (sorted); else `"prod"`. */
export function primaryNonDevEnvironmentKey(
  flagsByEnvironment: Record<string, FeatureFlagMap>,
): string {
  const keys = Object.keys(flagsByEnvironment);
  if (keys.includes("prod")) return "prod";
  const nonDev = keys.filter((k) => k !== "dev").sort();
  return nonDev[0] ?? "prod";
}

function withDefaultEnvironments(
  options: ResolveFeatureRuntimeOptions = {},
): ResolveFeatureRuntimeOptions {
  const mode = options.mode ?? process.env.NODE_ENV ?? "development";
  const raw =
    options.environments &&
    typeof options.environments === "object" &&
    !Array.isArray(options.environments)
      ? { ...options.environments }
      : {};
  delete raw.dev;
  const environments: NonNullable<ResolveFeatureRuntimeOptions["environments"]> =
    {
      dev: {
        when: mode !== "production",
      },
      ...raw,
    };
  if (Object.keys(environments).length < 2) {
    environments.prod = environments.prod ?? {
      when: mode === "production",
      flags: {},
    };
  }
  return { ...options, environments };
}

export function createVirtualModuleSource(
  runtime: ResolvedFeatureRuntime,
  css?: DevOutlineCssOptions,
  flagsByEnvironment: Record<string, FeatureFlagMap> = {},
  devBootstrap?: string,
): string {
  const flagNames = Object.keys(runtime.flags);
  const flagTokens = flagNames.map((name) => toToken(name));
  const enumEntries = flagNames
    .map((name) => `  ${toEnumKey(name)}: ${JSON.stringify(name)}`)
    .join(",\n");
  const tokenEntries = flagNames
    .map((name) => `  ${toEnumKey(name)}: ${JSON.stringify(toToken(name))}`)
    .join(",\n");
  const styles = createFeatureFlagStyles(runtime, css);
  const colorsJson = JSON.stringify(runtime.flagColorsByToken, null, 2);
  const flagNameToToken = JSON.stringify(
    Object.fromEntries(flagNames.map((name) => [name, toToken(name)])),
    null,
    2,
  );
  const defaultNonDevEnvironment =
    primaryNonDevEnvironmentKey(flagsByEnvironment);
  const bootstrap =
    devBootstrap ??
    buildAffDevBootstrapScript(
      flagTokens,
      { ...runtime.flagColorsByToken },
      { ...runtime.flagOutlineDefaultsByToken },
      { ...runtime.flagBadgeDefaultsByToken },
      { ...runtime.routeFlags },
      Object.fromEntries(flagNames.map((name) => [name, toToken(name)])),
      runtime.namespace,
    );
  const affRoutePatternToPrefix = routePrefixJsHelper("affRoutePatternToPrefix");

  return `${affRoutePatternToPrefix}

export const FeatureFlag = Object.freeze({
${enumEntries}
});

export const FeatureToken = Object.freeze({
${tokenEntries}
});

export const featureFlagTokens = Object.freeze(${JSON.stringify(flagTokens)});
export const featureFlagColors = Object.freeze(${colorsJson});
export const featureFlags = Object.freeze(${JSON.stringify(runtime.flags, null, 2)});
export const featureFlagsByEnvironment = Object.freeze(${JSON.stringify(flagsByEnvironment, null, 2)});
export const defaultNonDevEnvironment = ${JSON.stringify(defaultNonDevEnvironment)};
export const featureRouteFlags = Object.freeze(${JSON.stringify(runtime.routeFlags, null, 2)});
export const featureNamespace = ${JSON.stringify(runtime.namespace)};
/** True when Astro is running the dev server or dev build (import.meta.env.DEV). Not the same as the reserved \`dev\` environment layer — see \`activeEnvironmentKey\`. */
export const isAstroDev = import.meta.env.DEV;
export const activeEnvironmentKey = ${JSON.stringify(runtime.activeEnvironment)};

export const affDevBootstrap = import.meta.env.DEV ? ${JSON.stringify(bootstrap)} : '';

export function isFeatureEnabled(flag) {
  return Boolean(featureFlags[flag]);
}

export function shouldRenderFeature(flag) {
  return isFeatureEnabled(flag);
}

export function isFeatureRoute(pathname) {
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
  return Object.keys(featureRouteFlags).some((route) => {
    const candidate = affRoutePatternToPrefix(route);
    return normalized === candidate || normalized.startsWith(candidate);
  });
}

export function shouldIncludePath(pathname) {
  if (import.meta.env.DEV) return true;
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
  for (const [route, flags] of Object.entries(featureRouteFlags)) {
    const candidate = affRoutePatternToPrefix(route);
    if (normalized === candidate || normalized.startsWith(candidate)) {
      return flags.every((flag) => isFeatureEnabled(flag));
    }
  }
  return true;
}

export function flagsForEnvironment(envName) {
  var F = featureFlagsByEnvironment[envName];
  return F != null ? F : null;
}

export function isFeatureEnabledForEnvironment(flag, envName) {
  var F = featureFlagsByEnvironment[envName];
  return !!(F && F[flag]);
}

export function shouldIncludePathForEnvironment(pathname, envName) {
  var F = featureFlagsByEnvironment[envName];
  if (!F) return true;
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
  for (const [route, flagList] of Object.entries(featureRouteFlags)) {
    const candidate = affRoutePatternToPrefix(route);
    if (normalized === candidate || normalized.startsWith(candidate)) {
      return flagList.every((flag) => Boolean(F[flag]));
    }
  }
  return true;
}

const flagNameToToken = Object.freeze(${flagNameToToken});

export function matchedFeatureRoutePrefix(pathname) {
  if (!pathname) return null;
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
  let best = null;
  let bestLen = -1;
  for (const routePrefix of Object.keys(featureRouteFlags)) {
    const route = affRoutePatternToPrefix(routePrefix);
    if (normalized === route || normalized.startsWith(route)) {
      if (route.length > bestLen) {
        bestLen = route.length;
        best = routePrefix;
      }
    }
  }
  return best;
}

export function routeFeatureTokenForPath(pathname) {
  const prefix = matchedFeatureRoutePrefix(pathname);
  if (!prefix) return undefined;
  const flagNames = featureRouteFlags[prefix] || [];
  const first = flagNames[0];
  return first != null ? flagNameToToken[first] : undefined;
}

export function routeFeatureTokensForPath(pathname) {
  if (!pathname) return [];
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
  const out = [];
  const seen = new Set();
  for (const [routePrefix, flagNames] of Object.entries(featureRouteFlags)) {
    const route = affRoutePatternToPrefix(routePrefix);
    if (!(normalized === route || normalized.startsWith(route))) continue;
    for (const name of flagNames || []) {
      const token = flagNameToToken[name];
      if (!token || seen.has(token)) continue;
      seen.add(token);
      out.push(token);
    }
  }
  return out;
}

export function routeFeatureMatchesForPath(pathname) {
  if (!pathname) return [];
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
  var byFlag = {};
  for (const [routePattern, flagNames] of Object.entries(featureRouteFlags)) {
    const candidate = affRoutePatternToPrefix(routePattern);
    if (!(normalized === candidate || normalized.startsWith(candidate))) continue;
    for (const flagName of flagNames || []) {
      const token = flagNameToToken[flagName];
      if (!token) continue;
      if (!byFlag[flagName]) byFlag[flagName] = { flag: flagName, token, routes: [] };
      byFlag[flagName].routes.push(routePattern);
    }
  }
  return Object.values(byFlag);
}

export const featureFlagStyles = import.meta.env.DEV ? ${JSON.stringify(styles)} : "";
`;
}

export function getResolvedFeatures(
  options: ResolveFeatureRuntimeOptions = {},
): ResolvedFeatureRuntime {
  return resolveFeatureRuntime(withDefaultEnvironments(options));
}

export function featureRouteIncluded(
  pathname: string,
  runtime: ResolvedFeatureRuntime,
): boolean {
  return shouldIncludeRoute({
    pathname,
    routeFlags: runtime.routeFlags,
    flags: runtime.flags,
    isDev: runtime.isDev,
  });
}

export type { FeatureFlagMap } from "./runtime";
export {
  longestMatchingRoutePrefix,
  mergeFlagsWithProcessEnvOverrides,
  resolveFeatureFlagsByEnvironment,
  routePatternToPrefix,
} from "./runtime";

export default function astroFeatureFlags(
  options: AstroFeatureFlagsOptions = {},
): any {
  const { css, staticMinify = true, ...flagOpts } = options;
  const opts = withDefaultEnvironments(flagOpts);
  const mode = opts.mode ?? process.env.NODE_ENV ?? "development";

  const runtime = resolveFeatureRuntime({
    ...opts,
    mode,
  });

  return {
    name: "astro-feature-flags",
    hooks: {
      "astro:config:setup": ({
        updateConfig,
        addDevToolbarApp,
        command,
        injectScript,
      }: {
        updateConfig: (config: unknown) => void;
        addDevToolbarApp?: (opts: {
          id: string;
          name: string;
          icon: string;
          entrypoint: string;
        }) => void;
        command?: string;
        injectScript?: (stage: string, content: string) => void;
      }) => {
        const flagNames = Object.keys(runtime.flags);
        const flagTokens = flagNames.map((name) => toToken(name));
        const flagsByEnvironment = resolveFeatureFlagsByEnvironment(opts);
        const flagNameToToken = Object.fromEntries(
          flagNames.map((name) => [name, toToken(name)]),
        );
        const bootstrap = buildAffDevBootstrapScript(
          flagTokens,
          { ...runtime.flagColorsByToken },
          { ...runtime.flagOutlineDefaultsByToken },
          { ...runtime.flagBadgeDefaultsByToken },
          { ...runtime.routeFlags },
          flagNameToToken,
          runtime.namespace,
        );

        if (
          command === "dev" &&
          runtime.isDev &&
          typeof addDevToolbarApp === "function"
        ) {
          addDevToolbarApp({
            id: "astro-feature-flags",
            name: "Feature flags",
            icon: DEV_TOOLBAR_FLAG_ICON_SVG,
            entrypoint: fileURLToPath(
              new URL("./dev-toolbar-app.mjs", import.meta.url),
            ),
          });
        }
        if (
          command === "dev" &&
          runtime.isDev &&
          typeof injectScript === "function"
        ) {
          const styles = createFeatureFlagStyles(runtime, css);
          injectScript(
            "head-inline",
            buildAffDevHeadInline({
              runtime,
              featureFlagStyles: styles,
              affDevBootstrap: bootstrap,
            }),
          );
        }
        updateConfig({
          vite: {
            plugins: [
              {
                name: "astro-feature-flags:virtual-module",
                resolveId(id: string) {
                  if (id === "virtual:astro-feature-flags")
                    return "\0virtual:astro-feature-flags";
                  return null;
                },
                load(id: string) {
                  if (id === "\0virtual:astro-feature-flags") {
                    return createVirtualModuleSource(
                      runtime,
                      css,
                      flagsByEnvironment,
                      bootstrap,
                    );
                  }
                  return null;
                },
              },
            ],
          },
        });
      },
      "astro:build:done": ({ dir }: { dir: URL }) => {
        if (runtime.isDev || !staticMinify) return;
        const outDir = fileURLToPath(dir);
        const prunePaths = routePathsToPrune({
          routeFlags: runtime.routeFlags,
          flags: runtime.flags,
        });
        for (const routePath of prunePaths) {
          rmSync(join(outDir, routePath), { recursive: true, force: true });
        }
        applyProductionHtmlCullToDist(outDir, runtime);
      },
    },
  };
}
