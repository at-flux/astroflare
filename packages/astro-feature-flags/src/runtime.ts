import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type FeatureFlagMap = Record<string, boolean>;
export type FeatureRouteMap = Record<string, string>;

export type FeatureColorMap = Record<string, string>;

export interface FeatureConfig {
  namespace: string;
  flags: FeatureFlagMap;
  routeFlags: FeatureRouteMap;
  colors: FeatureColorMap;
  mode: string;
}

export interface ResolveFeatureRuntimeOptions {
  root?: string;
  /** `development` / `production` / aliases `dev` / `prod` */
  mode?: string;
  isDev?: boolean;
  env?: Record<string, string | undefined>;
  /** Base filename without extension; loads `{baseName}.json`, optional `{baseName}.{ffEnv}.json`, then in prod `{baseName}.prod.json`. Default `ff`. */
  baseName?: string;
  /**
   * Merge `ff.<ffEnv>.json` after `ff.json` when set (e.g. `preview`, `staging`).
   * Defaults to `process.env.FF_ENV` so preview deployments can use branch/env-specific flags without editing the base file.
   */
  ffEnv?: string;
  defaults?: {
    namespace?: string;
    flags?: FeatureFlagMap;
    routeFlags?: FeatureRouteMap;
    colors?: FeatureColorMap;
  };
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}

function readJsonIfExists(pathname: string): Record<string, unknown> {
  if (!existsSync(pathname)) return {};
  return JSON.parse(readFileSync(pathname, 'utf8')) as Record<string, unknown>;
}

export function normalizePath(pathname: string): string {
  if (!pathname) return '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

/**
 * Normalizes a route key from `ff.json` for prefix matching.
 * Supports wildcards: `/blog/*`, `/docs/**` → prefix `/blog/`, `/docs/`.
 */
export function routePatternToPrefix(pattern: string): string {
  let p = pattern.trim();
  if (p.endsWith('/**')) {
    p = p.slice(0, -3);
  } else if (p.endsWith('/*')) {
    p = p.slice(0, -2);
  } else if (p.endsWith('*') && p.length > 1) {
    p = p.slice(0, -1);
  }
  return normalizePath(p);
}

export function toEnumKey(flagName: string): string {
  return flagName
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

export function toToken(flagName: string): string {
  return flagName
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase()
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isProductionMode(mode: string): boolean {
  const m = mode.trim().toLowerCase();
  return m === 'production' || m === 'prod';
}

/** Map loose JSON shape to our fields (`ns`, `routes`, `c` aliases). */
export function pickFfFields(raw: Record<string, unknown>): {
  namespace?: string;
  flags?: FeatureFlagMap;
  routeFlags?: FeatureRouteMap;
  colors?: FeatureColorMap;
} {
  const namespace = typeof raw.ns === 'string' ? raw.ns : (raw.namespace as string | undefined);
  const flags = raw.flags as FeatureFlagMap | undefined;
  const routeCoalesce = raw.routes ?? raw.routeFlags;
  const routeFlags = routeCoalesce as FeatureRouteMap | undefined;
  const colors = (raw.colors ?? raw.c) as FeatureColorMap | undefined;
  return { namespace, flags, routeFlags, colors };
}

function mergeRecords<T extends Record<string, unknown>>(base: T, ...layers: Partial<T>[]): T {
  const out = { ...base };
  for (const layer of layers) {
    for (const [k, v] of Object.entries(layer)) {
      if (v === undefined) continue;
      const cur = out[k as keyof T];
      if (
        v &&
        typeof v === 'object' &&
        !Array.isArray(v) &&
        cur &&
        typeof cur === 'object' &&
        !Array.isArray(cur)
      ) {
        (out as Record<string, unknown>)[k] = mergeRecords(
          cur as Record<string, unknown>,
          v as Record<string, unknown>
        );
      } else {
        (out as Record<string, unknown>)[k] = v;
      }
    }
  }
  return out;
}

const defaultColors: FeatureColorMap = {
  dev: 'rgb(220 38 38)',
};

export function loadFeatureConfig({
  root = process.cwd(),
  mode = process.env.NODE_ENV || 'development',
  baseName = 'ff',
  ffEnv: ffEnvOpt,
  defaults = {
    namespace: 'ff',
    flags: { dev: true },
    routeFlags: {},
    colors: { ...defaultColors },
  },
}: ResolveFeatureRuntimeOptions = {}): FeatureConfig {
  const basePath = join(root, `${baseName}.json`);
  const prodPath = join(root, `${baseName}.prod.json`);
  const envSuffix = (ffEnvOpt ?? process.env.FF_ENV)?.trim();
  const envPath = envSuffix ? join(root, `${baseName}.${envSuffix}.json`) : '';

  const baseRaw = readJsonIfExists(basePath);
  const envRaw = envPath && existsSync(envPath) ? readJsonIfExists(envPath) : {};
  const prodRaw = isProductionMode(mode) ? readJsonIfExists(prodPath) : {};

  const basePick = pickFfFields(baseRaw);
  const envPick = pickFfFields(envRaw);
  const prodPick = pickFfFields(prodRaw);

  const merged = mergeRecords(
    {
      namespace: defaults.namespace ?? 'ff',
      flags: { ...(defaults.flags || {}) },
      routeFlags: { ...(defaults.routeFlags || {}) },
      colors: { ...defaultColors, ...(defaults.colors || {}) },
    },
    {
      ...(basePick.namespace != null ? { namespace: basePick.namespace } : {}),
      ...(basePick.flags != null ? { flags: basePick.flags } : {}),
      ...(basePick.routeFlags != null ? { routeFlags: basePick.routeFlags } : {}),
      ...(basePick.colors != null ? { colors: basePick.colors } : {}),
    },
    {
      ...(envPick.namespace != null ? { namespace: envPick.namespace } : {}),
      ...(envPick.flags != null ? { flags: envPick.flags } : {}),
      ...(envPick.routeFlags != null ? { routeFlags: envPick.routeFlags } : {}),
      ...(envPick.colors != null ? { colors: envPick.colors } : {}),
    },
    {
      ...(prodPick.namespace != null ? { namespace: prodPick.namespace } : {}),
      ...(prodPick.flags != null ? { flags: prodPick.flags } : {}),
      ...(prodPick.routeFlags != null ? { routeFlags: prodPick.routeFlags } : {}),
      ...(prodPick.colors != null ? { colors: prodPick.colors } : {}),
    }
  );

  return {
    namespace: merged.namespace as string,
    flags: merged.flags as FeatureFlagMap,
    routeFlags: merged.routeFlags as FeatureRouteMap,
    colors: merged.colors as FeatureColorMap,
    mode,
  };
}

/** Normalize colour map keys (flag names or tokens) to CSS tokens. */
export function colorsToTokenMap(colors: FeatureColorMap): Record<string, string> {
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
}

export function resolveFeatureRuntime({
  root = process.cwd(),
  mode = process.env.NODE_ENV || 'development',
  isDev: isDevOverride,
  env = process.env as Record<string, string | undefined>,
  baseName = 'ff',
  ffEnv,
  defaults,
}: ResolveFeatureRuntimeOptions = {}): ResolvedFeatureRuntime {
  const isDev = isDevOverride ?? !isProductionMode(mode);
  const config = loadFeatureConfig({ root, mode, baseName, ffEnv, defaults });
  const resolvedFlags: FeatureFlagMap = {};

  for (const [key, value] of Object.entries(config.flags)) {
    const slug = toToken(key).replace(/-/g, '_').toUpperCase();
    const envKey = `AFF_FEATURE_${slug}`;
    resolvedFlags[key] = toBoolean(env[envKey], Boolean(value));
  }

  const colorByToken = colorsToTokenMap(config.colors);

  return {
    namespace: config.namespace,
    mode: config.mode,
    isDev,
    flags: resolvedFlags,
    routeFlags: config.routeFlags,
    flagColorsByToken: colorByToken,
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

export function isRouteFlagged(pathname: string, routeFlags: FeatureRouteMap): boolean {
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
  for (const [routePrefix, flagName] of Object.entries(routeFlags || {})) {
    const route = routePatternToPrefix(routePrefix);
    if (normalized === route || normalized.startsWith(route)) {
      return isFlagEnabled(flags, flagName);
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
    .filter(([, flagName]) => !isFlagEnabled(flags, flagName))
    .map(([routePath]) => routePatternToPrefix(routePath).replace(/^\/+|\/+$/g, ''))
    .filter(Boolean);
}

/**
 * Longest `routeFlags` key that matches `pathname` (prefix match, trailing slashes normalized).
 */
export function longestMatchingRoutePrefix(pathname: string, routeFlags: FeatureRouteMap): string | null {
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
