import { existsSync, readFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";

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
  /** Which `environments` entry was used (reserved `dev` = all flags on, toolbar layer). */
  activeEnvironment: string;
}

/**
 * Declarative feature flags for Astro. Merge order: inline options → optional root
 * {@link ResolveFeatureRuntimeOptions.jsonConfigPath} → optional per-environment
 * `environments.<name>.jsonConfigPath` (merged when that layer is active).
 *
 * Exactly one `when: true` across environments unless `forceEnvironment` or `AFF_ENVIRONMENT`
 * selects the layer. A reserved **`dev`** environment is required (all flags on at resolve time;
 * toggles are dev-toolbar only) plus at least one other environment (e.g. `prod`).
 */
export interface ResolveFeatureRuntimeOptions {
  /**
   * Directory used to resolve relative {@link jsonConfigPath} values (root and per-environment).
   * Defaults to `process.cwd()`.
   */
  configRoot?: string;
  /** Optional main JSON file merged after inline `flags` / `environments`. */
  jsonConfigPath?: string;
  /** Passed through to `ResolvedFeatureRuntime.mode` (e.g. `process.env.NODE_ENV`). */
  mode?: string;
  /** Process env for `AFF_FEATURE_*` and `ASTRO_FEATURE_FLAGS` (skipped when active env is `dev`). */
  env?: Record<string, string | undefined>;
  /**
   * Use this `environments` entry regardless of `when` / `AFF_ENVIRONMENT` (e.g. sitemaps, tests).
   */
  forceEnvironment?: string;
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
      /** Optional JSON merged after the root file when this environment is active. */
      jsonConfigPath?: string;
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

function resolvePath(relativeOrAbsolute: string, configRoot: string): string {
  return isAbsolute(relativeOrAbsolute)
    ? relativeOrAbsolute
    : join(configRoot, relativeOrAbsolute);
}

type NormalizedFlagDef = {
  color?: string;
  outline: boolean;
  badge: boolean;
  routes: string[];
};

type NormalizedEnvEntry = {
  when?: boolean;
  flags: Record<string, boolean>;
  /** Per-environment JSON merged after root `jsonConfigPath` when this layer is active. */
  jsonConfigPath?: string;
};

type DeclarativeFeatureConfig = {
  tokenNamespace: string;
  flags: Record<string, NormalizedFlagDef>;
  environments: Record<string, NormalizedEnvEntry>;
};

function normalizeDeclarativeConfig(
  raw: Record<string, unknown>,
  mode: string = process.env.NODE_ENV ?? "development",
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
  const environments: Record<string, NormalizedEnvEntry> = {};
  for (const [envName, maybeEnv] of Object.entries(envRaw)) {
    if (envName === "dev") continue;
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
    const layerJson =
      typeof env.jsonConfigPath === "string" ? env.jsonConfigPath : undefined;
    environments[envName] = {
      ...(when !== undefined ? { when } : {}),
      ...(layerJson ? { jsonConfigPath: layerJson } : {}),
      flags: envFlags,
    };
  }

  environments.dev = {
    when: mode !== "production",
    flags: {},
  };

  return {
    tokenNamespace: tokenNamespaceRaw,
    flags,
    environments,
  };
}

function assertEnvironmentShape(environments: Record<string, NormalizedEnvEntry>) {
  const keys = Object.keys(environments);
  if (!environments.dev) {
    throw new Error(
      'astro-feature-flags: environments must include a reserved "dev" entry.',
    );
  }
  if (keys.length < 2) {
    throw new Error(
      "astro-feature-flags: environments must include `dev` plus at least one other layer (e.g. `prod`).",
    );
  }
}

function countActiveWhen(environments: Record<string, NormalizedEnvEntry>): number {
  return Object.values(environments).filter((e) => e.when === true).length;
}

function resolveAffEnvironment(
  options: ResolveFeatureRuntimeOptions,
): string | undefined {
  const proc =
    options.env ?? (process.env as Record<string, string | undefined>);
  return proc.AFF_ENVIRONMENT?.trim();
}

function resolveActiveEnvironmentName(
  normalized: DeclarativeFeatureConfig,
  options: ResolveFeatureRuntimeOptions,
): string {
  const { environments } = normalized;
  assertEnvironmentShape(environments);

  const forced = options.forceEnvironment?.trim();
  if (forced && environments[forced]) return forced;

  const aff = resolveAffEnvironment(options);
  if (aff && environments[aff]) return aff;

  const n = countActiveWhen(environments);
  if (n !== 1) {
    const activeNames = Object.entries(environments)
      .filter(([, e]) => e.when === true)
      .map(([k]) => k);
    const devWhen = environments.dev?.when;
    const hint =
      n > 1 && environments.dev && devWhen === true
        ? " The reserved `dev` environment is active for this `mode` while another layer also has `when: true`. Pin one layer with `forceEnvironment` or `AFF_ENVIRONMENT`, or adjust non-dev `when` predicates."
        : "";
    throw new Error(
      `astro-feature-flags: exactly one environment must have when: true (found ${n}${activeNames.length ? `: ${activeNames.join(", ")}` : ""}).${hint} Set forceEnvironment or AFF_ENVIRONMENT to pick a layer explicitly.`,
    );
  }
  for (const [name, cfg] of Object.entries(environments)) {
    if (cfg.when === true) return name;
  }
  throw new Error("astro-feature-flags: internal error resolving environment.");
}

function readBaseMergedRaw(options: ResolveFeatureRuntimeOptions): Record<string, unknown> {
  const configRoot = options.configRoot ?? process.cwd();
  const {
    tokenNamespace = "ff",
    flags = {},
    environments = {},
  } = options;
  const inlineRaw: Record<string, unknown> = {
    tokenNamespace,
    flags,
    environments,
  };
  let merged = { ...inlineRaw };
  if (options.jsonConfigPath) {
    const p = resolvePath(options.jsonConfigPath, configRoot);
    merged = mergeRecords(merged as Record<string, unknown>, readJsonIfExists(p));
  }
  return merged;
}

function mergePerEnvironmentJson(
  baseRaw: Record<string, unknown>,
  envName: string,
  configRoot: string,
  mode: string,
): Record<string, unknown> {
  if (envName === "dev") return baseRaw;
  const normalized = normalizeDeclarativeConfig(baseRaw, mode);
  const entry = normalized.environments[envName];
  const rel = entry?.jsonConfigPath;
  if (!rel) return baseRaw;
  const p = resolvePath(rel, configRoot);
  return mergeRecords(baseRaw, readJsonIfExists(p));
}

function readMergedRawForActiveEnv(
  options: ResolveFeatureRuntimeOptions,
  envName: string,
): Record<string, unknown> {
  const configRoot = options.configRoot ?? process.cwd();
  const mode = options.mode ?? process.env.NODE_ENV ?? "development";
  const base = readBaseMergedRaw(options);
  return mergePerEnvironmentJson(base, envName, configRoot, mode);
}

export function loadFeatureConfig(
  options: ResolveFeatureRuntimeOptions = {},
): FeatureConfig {
  const mode = options.mode ?? process.env.NODE_ENV ?? "development";
  const baseRaw = readBaseMergedRaw(options);
  const baseNorm = normalizeDeclarativeConfig(baseRaw, mode);
  const envName = resolveActiveEnvironmentName(baseNorm, options);
  const fullRaw = readMergedRawForActiveEnv(options, envName);
  const normalized = normalizeDeclarativeConfig(fullRaw, mode);

  const envFlags = normalized.environments[envName]?.flags ?? {};
  const routeFlags: FeatureRouteMap = {};
  const colors: FeatureColorMap = {};
  const outlineDefaultsByToken: FeatureBoolByTokenMap = {};
  const badgeDefaultsByToken: FeatureBoolByTokenMap = {};
  const resolvedFlags: FeatureFlagMap = {};

  for (const [flagName, flagDef] of Object.entries(normalized.flags)) {
    if (envName === "dev") {
      resolvedFlags[flagName] = true;
    } else {
      resolvedFlags[flagName] = envFlags[flagName] === true;
    }
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
    activeEnvironment: envName,
  };
}

/** Applies `AFF_FEATURE_*` and `ASTRO_FEATURE_FLAGS` on top of a resolved flag map. */
export function mergeFlagsWithProcessEnvOverrides(
  flags: FeatureFlagMap,
  env: Record<string, string | undefined> = process.env as Record<
    string,
    string | undefined
  >,
): FeatureFlagMap {
  const resolvedFlags: FeatureFlagMap = { ...flags };
  for (const [key, value] of Object.entries(resolvedFlags)) {
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
  return resolvedFlags;
}

/**
 * Resolved flag booleans for each `environments` key, after the same process-env overrides
 * as {@link resolveFeatureRuntime} (overrides skipped for the reserved `dev` layer).
 */
export function resolveFeatureFlagsByEnvironment(
  options: ResolveFeatureRuntimeOptions = {},
): Record<string, FeatureFlagMap> {
  const baseRaw = readBaseMergedRaw(options);
  const mode = options.mode ?? process.env.NODE_ENV ?? "development";
  const normalized = normalizeDeclarativeConfig(baseRaw, mode);
  const envKeys = Object.keys(normalized.environments);
  const proc = options.env ?? (process.env as Record<string, string | undefined>);
  const out: Record<string, FeatureFlagMap> = {};
  for (const envName of envKeys) {
    const cfg = loadFeatureConfig({ ...options, forceEnvironment: envName });
    out[envName] =
      envName === "dev"
        ? { ...cfg.flags }
        : mergeFlagsWithProcessEnvOverrides({ ...cfg.flags }, proc);
  }
  return out;
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
  /** True when the active environment is the reserved `dev` layer (toolbar + all flags on). */
  isDev: boolean;
  activeEnvironment: string;
  flags: FeatureFlagMap;
  routeFlags: FeatureRouteMap;
  /** Outline/badge/route-frame colour per flag token (CSS colour strings). */
  flagColorsByToken: Record<string, string>;
  /** Default dev-toolbar outline/badge state per flag token. */
  flagOutlineDefaultsByToken: Record<string, boolean>;
  flagBadgeDefaultsByToken: Record<string, boolean>;
}

export function resolveFeatureRuntime(
  options: ResolveFeatureRuntimeOptions = {},
): ResolvedFeatureRuntime {
  const env = options.env ?? (process.env as Record<string, string | undefined>);
  const config = loadFeatureConfig(options);
  const isDevLayer = config.activeEnvironment === "dev";
  const resolvedFlags = isDevLayer
    ? { ...config.flags }
    : mergeFlagsWithProcessEnvOverrides(config.flags, env);

  const colorByToken = colorsToTokenMap(config.colors);

  return {
    namespace: config.namespace,
    mode: config.mode,
    isDev: isDevLayer,
    activeEnvironment: config.activeEnvironment,
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
  activeEnvironment,
  flags,
  flag,
}: {
  activeEnvironment: string;
  flags: FeatureFlagMap;
  flag: string;
}): boolean {
  if (activeEnvironment === "dev") return true;
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
