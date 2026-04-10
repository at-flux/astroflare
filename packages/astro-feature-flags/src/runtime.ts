import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type FeatureFlagMap = Record<string, boolean>;
export type FeatureRouteMap = Record<string, string[]>;
export type FeatureColorMap = Record<string, string>;
export type FeatureBoolByTokenMap = Record<string, boolean>;

export interface FeatureConfig {
  namespace: string;
  flags: FeatureFlagMap;
  routeFlags: FeatureRouteMap;
  colors: FeatureColorMap;
  outlineDefaultsByToken: FeatureBoolByTokenMap;
  badgeDefaultsByToken: FeatureBoolByTokenMap;
  mode: string;
}

export interface ResolveFeatureRuntimeOptions {
  /** Absolute or relative path to a JSON config file (preferred over root/baseName). */
  jsonConfigPath?: string;
  root?: string;
  /** `development` / `production` / aliases `dev` / `prod` */
  mode?: string;
  isDev?: boolean;
  env?: Record<string, string | undefined>;
  /** Base filename without extension (default `ff`). */
  baseName?: string;
  /**
   * Optional external override file suffix: `ff.<fileEnv>.json`.
   * Useful for preview/branch deploy overrides.
   */
  fileEnv?: string;
  /**
   * Inline base config from `astro.config`.
   * If `ff.json` exists, it deep-merges over this object.
   */
  tokenNamespace?: string;
  flags?: Record<
    string,
    {
      color?: string;
      colour?: string;
      outline?: boolean;
      badge?: boolean;
      routes?: string[];
    }
  >;
  environments?: Record<
    string,
    {
      when?: boolean;
      flags?: Record<string, boolean>;
    }
  >;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function readJsonIfExists(pathname: string): Record<string, unknown> {
  if (!existsSync(pathname)) return {};
  return JSON.parse(readFileSync(pathname, "utf8")) as Record<string, unknown>;
}

export function normalizePath(pathname: string): string {
  if (!pathname) return "/";
  return pathname.endsWith("/") ? pathname : `${pathname}/`;
}

/**
 * Normalizes a route key from `ff.json` for prefix matching.
 * Supports wildcards: `/blog/*`, `/docs/**` → prefix `/blog/`, `/docs/`.
 */
export function routePatternToPrefix(pattern: string): string {
  let p = pattern.trim();
  if (p.endsWith("/**")) {
    p = p.slice(0, -3);
  } else if (p.endsWith("/*")) {
    p = p.slice(0, -2);
  } else if (p.endsWith("*") && p.length > 1) {
    p = p.slice(0, -1);
  }
  return normalizePath(p);
}

export function toEnumKey(flagName: string): string {
  return flagName
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function toToken(flagName: string): string {
  return flagName
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/([a-zA-Z])([0-9])/g, "$1-$2")
    .replace(/([0-9])([a-zA-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function isProductionMode(mode: string): boolean {
  const m = mode.trim().toLowerCase();
  return m === "production" || m === "prod";
}

function mergeRecords<T extends Record<string, unknown>>(
  base: T,
  ...layers: Partial<T>[]
): T {
  const out = { ...base };
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      if (v === undefined) continue;
      const cur = out[k as keyof T];
      if (
        v &&
        typeof v === "object" &&
        !Array.isArray(v) &&
        cur &&
        typeof cur === "object" &&
        !Array.isArray(cur)
      ) {
        (out as Record<string, unknown>)[k] = mergeRecords(
          cur as Record<string, unknown>,
          v as Record<string, unknown>,
        );
      } else {
        (out as Record<string, unknown>)[k] = v;
      }
    }
  }
  return out;
}

type NormalizedFlagDef = {
  color?: string;
  outline: boolean;
  badge: boolean;
  routes: string[];
};

type DeclarativeFeatureConfig = {
  tokenNamespace: string;
  flags: Record<string, NormalizedFlagDef>;
  environments: Record<
    string,
    { when?: boolean; flags: Record<string, boolean> }
  >;
};

function normalizeDeclarativeConfig(
  raw: Record<string, unknown>,
): DeclarativeFeatureConfig {
  const tokenNamespaceRaw =
    (typeof raw.tokenNamespace === "string" ? raw.tokenNamespace : undefined) ??
    (typeof raw.namespace === "string" ? raw.namespace : undefined) ??
    "ff";

  const flagsRaw =
    raw.flags && typeof raw.flags === "object" && !Array.isArray(raw.flags)
      ? (raw.flags as Record<string, unknown>)
      : {};
  const flags: Record<string, NormalizedFlagDef> = {};
  for (const [flagName, maybeDef] of Object.entries(flagsRaw)) {
    if (!maybeDef || typeof maybeDef !== "object" || Array.isArray(maybeDef))
      continue;
    const def = maybeDef as Record<string, unknown>;
    const color =
      (typeof def.colour === "string" ? def.colour : undefined) ??
      (typeof def.color === "string" ? def.color : undefined);
    const outline = typeof def.outline === "boolean" ? def.outline : true;
    const badge = typeof def.badge === "boolean" ? def.badge : true;
    const routes = Array.isArray(def.routes)
      ? def.routes.filter((v): v is string => typeof v === "string")
      : [];
    flags[flagName] = { color, outline, badge, routes };
  }

  const envRaw =
    raw.environments &&
    typeof raw.environments === "object" &&
    !Array.isArray(raw.environments)
      ? (raw.environments as Record<string, unknown>)
      : {};
  const environments: Record<
    string,
    { when?: boolean; flags: Record<string, boolean> }
  > = {};
  for (const [envName, maybeEnv] of Object.entries(envRaw)) {
    if (!maybeEnv || typeof maybeEnv !== "object" || Array.isArray(maybeEnv))
      continue;
    const env = maybeEnv as Record<string, unknown>;
    const envFlagsRaw =
      env.flags && typeof env.flags === "object" && !Array.isArray(env.flags)
        ? (env.flags as Record<string, unknown>)
        : {};
    const envFlags: Record<string, boolean> = {};
    for (const [flagName, value] of Object.entries(envFlagsRaw)) {
      envFlags[flagName] = Boolean(value);
    }
    const when = typeof env.when === "boolean" ? env.when : undefined;
    environments[envName] = {
      ...(when !== undefined ? { when } : {}),
      flags: envFlags,
    };
  }

  return {
    tokenNamespace: tokenNamespaceRaw,
    flags,
    environments,
  };
}

function resolveActiveEnvironmentName({
  environments,
  mode,
}: {
  environments: Record<
    string,
    { when?: boolean; flags: Record<string, boolean> }
  >;
  mode: string;
}): string | undefined {
  const envOverride = process.env.AFF_ENVIRONMENT?.trim();
  if (envOverride && environments[envOverride]) return envOverride;
  for (const [name, cfg] of Object.entries(environments)) {
    if (cfg.when === true) return name;
  }
  if (isProductionMode(mode) && environments.prod) return "prod";
  if (!isProductionMode(mode) && environments.dev) return "dev";
  return Object.keys(environments)[0];
}

export function loadFeatureConfig({
  jsonConfigPath,
  root = process.cwd(),
  mode = process.env.NODE_ENV || "development",
  baseName = "ff",
  fileEnv,
  tokenNamespace = "ff",
  flags = {},
  environments = {},
}: ResolveFeatureRuntimeOptions = {}): FeatureConfig {
  const basePath = jsonConfigPath ?? join(root, `${baseName}.json`);
  const envSuffix = (fileEnv ?? process.env.FF_ENV)?.trim();
  const envPath = envSuffix ? join(root, `${baseName}.${envSuffix}.json`) : "";

  const inlineRaw: Record<string, unknown> = {
    tokenNamespace,
    flags,
    environments,
  };
  const fileRaw = readJsonIfExists(basePath);
  const envFileRaw =
    envPath && existsSync(envPath) ? readJsonIfExists(envPath) : {};

  const mergedRaw = mergeRecords(inlineRaw, fileRaw, envFileRaw);
  const normalized = normalizeDeclarativeConfig(mergedRaw);
  const envName = resolveActiveEnvironmentName({
    environments: normalized.environments,
    mode,
  });
  const envFlags = envName
    ? (normalized.environments[envName]?.flags ?? {})
    : {};

  const routeFlags: FeatureRouteMap = {};
  const colors: FeatureColorMap = {};
  const outlineDefaultsByToken: FeatureBoolByTokenMap = {};
  const badgeDefaultsByToken: FeatureBoolByTokenMap = {};
  const resolvedFlags: FeatureFlagMap = {};
  for (const [flagName, flagDef] of Object.entries(normalized.flags)) {
    resolvedFlags[flagName] = envFlags[flagName] === true;
    if (flagDef.color) colors[flagName] = flagDef.color;
    const token = toToken(flagName);
    outlineDefaultsByToken[token] = flagDef.outline;
    badgeDefaultsByToken[token] = flagDef.badge;
    for (const route of flagDef.routes) {
      routeFlags[route] = [...(routeFlags[route] ?? []), flagName];
    }
  }

  return {
    namespace: normalized.tokenNamespace || "ff",
    flags: resolvedFlags,
    routeFlags,
    colors,
    outlineDefaultsByToken,
    badgeDefaultsByToken,
    mode,
  };
}

/** Normalize colour map keys (flag names or tokens) to CSS tokens. */
export function colorsToTokenMap(
  colors: FeatureColorMap,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(colors)) {
    out[toToken(key)] = value;
  }
  return out;
}

export interface ResolvedFeatureRuntime {
  namespace: string;
  mode: string;
  isDev: boolean;
  flags: FeatureFlagMap;
  routeFlags: FeatureRouteMap;
  /** Outline/badge/route-frame colour per flag token (CSS colour strings). */
  flagColorsByToken: Record<string, string>;
  /** Default dev chrome state per flag token. */
  flagOutlineDefaultsByToken: Record<string, boolean>;
  flagBadgeDefaultsByToken: Record<string, boolean>;
}

export function resolveFeatureRuntime({
  jsonConfigPath,
  root = process.cwd(),
  mode = process.env.NODE_ENV || "development",
  isDev: isDevOverride,
  env = process.env as Record<string, string | undefined>,
  baseName = "ff",
  fileEnv,
  tokenNamespace,
  flags,
  environments,
}: ResolveFeatureRuntimeOptions = {}): ResolvedFeatureRuntime {
  const isDev = isDevOverride ?? !isProductionMode(mode);
  const config = loadFeatureConfig({
    root,
    jsonConfigPath,
    mode,
    baseName,
    fileEnv,
    tokenNamespace,
    flags,
    environments,
  });
  const resolvedFlags: FeatureFlagMap = {};

  for (const [key, value] of Object.entries(config.flags)) {
    const slug = toToken(key).replace(/-/g, "_").toUpperCase();
    const envKey = `AFF_FEATURE_${slug}`;
    resolvedFlags[key] = toBoolean(env[envKey], Boolean(value));
  }
  const envMapRaw = env.ASTRO_FEATURE_FLAGS;
  if (envMapRaw) {
    try {
      const envMap = JSON.parse(envMapRaw) as Record<string, unknown>;
      for (const [flag, value] of Object.entries(envMap)) {
        resolvedFlags[flag] = Boolean(value);
      }
    } catch {
      // ignore invalid JSON override
    }
  }

  const colorByToken = colorsToTokenMap(config.colors);

  return {
    namespace: config.namespace,
    mode: config.mode,
    isDev,
    flags: resolvedFlags,
    routeFlags: config.routeFlags,
    flagColorsByToken: colorByToken,
    flagOutlineDefaultsByToken: config.outlineDefaultsByToken,
    flagBadgeDefaultsByToken: config.badgeDefaultsByToken,
  };
}

export function isFlagEnabled(flags: FeatureFlagMap, flag: string): boolean {
  return Boolean(flags?.[flag]);
}

export function shouldRenderFeatureInMode({
  isDev,
  flags,
  flag,
}: {
  isDev: boolean;
  flags: FeatureFlagMap;
  flag: string;
}): boolean {
  if (isDev) return true;
  return isFlagEnabled(flags, flag);
}

export function isRouteFlagged(
  pathname: string,
  routeFlags: FeatureRouteMap,
): boolean {
  const normalized = normalizePath(pathname);
  return Object.keys(routeFlags || {}).some((routePrefix) => {
    const route = routePatternToPrefix(routePrefix);
    return normalized === route || normalized.startsWith(route);
  });
}

export function shouldIncludeRoute({
  pathname,
  routeFlags,
  flags,
  isDev,
}: {
  pathname: string;
  routeFlags: FeatureRouteMap;
  flags: FeatureFlagMap;
  isDev: boolean;
}): boolean {
  if (isDev) return true;
  const normalized = normalizePath(pathname);
  for (const [routePrefix, flagNames] of Object.entries(routeFlags || {})) {
    const route = routePatternToPrefix(routePrefix);
    if (normalized === route || normalized.startsWith(route)) {
      return (flagNames || []).every((flagName) =>
        isFlagEnabled(flags, flagName),
      );
    }
  }
  return true;
}

export function routePathsToPrune({
  routeFlags,
  flags,
}: {
  routeFlags: FeatureRouteMap;
  flags: FeatureFlagMap;
}): string[] {
  return Object.entries(routeFlags || {})
    .filter(([, flagNames]) =>
      (flagNames || []).some((flagName) => !isFlagEnabled(flags, flagName)),
    )
    .map(([routePath]) =>
      routePatternToPrefix(routePath).replace(/^\/+|\/+$/g, ""),
    )
    .filter(Boolean);
}

/**
 * Longest `routeFlags` key that matches `pathname` (prefix match, trailing slashes normalized).
 */
export function longestMatchingRoutePrefix(
  pathname: string,
  routeFlags: FeatureRouteMap,
): string | null {
  const normalized = normalizePath(pathname);
  let best: string | null = null;
  let bestLen = -1;
  for (const routePrefix of Object.keys(routeFlags || {})) {
    const route = routePatternToPrefix(routePrefix);
    if (normalized === route || normalized.startsWith(route)) {
      if (route.length > bestLen) {
        bestLen = route.length;
        best = routePrefix;
      }
    }
  }
  return best;
}
