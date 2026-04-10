import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { elementBadgePositionBlock, normalizeElementBadgeLayout } from './badge-layout';
import { DEV_TOOLBAR_FLAG_ICON_SVG } from './dev-toolbar-flag-icon';
import type {
  ElementBadgeHorizontalAlign,
  ElementBadgeLayoutOptions,
  ElementBadgeVerticalAnchor,
  NormalizedElementBadgeLayout,
} from './badge-layout';
import {
  type ResolveFeatureRuntimeOptions,
  type ResolvedFeatureRuntime,
  resolveFeatureRuntime,
  routePathsToPrune,
  shouldIncludeRoute,
  toEnumKey,
  toToken,
} from './runtime';

export type {
  ElementBadgeHorizontalAlign,
  ElementBadgeLayoutOptions,
  ElementBadgeVerticalAnchor,
  NormalizedElementBadgeLayout,
};
export { elementBadgePositionBlock, normalizeElementBadgeLayout };

export type DevOutlineHiddenStrategy = 'visibility' | 'display';

export interface DevOutlineCssOptions extends ElementBadgeLayoutOptions {
  outlineWidth?: string;
  outlineStyle?: 'dashed' | 'solid' | 'dotted';
  /** Fallback when no per-token colour is set. */
  outlineColor?: string;
  /** Per-flag-token outline / badge / route-frame colour (overrides JSON `colors`). */
  outlineColorByToken?: Record<string, string>;
  outlineOffset?: string;
  borderRadius?: string;

  badgeLabelDev?: string;
  badgeLabelByToken?: Record<string, string>;

  hiddenStrategy?: DevOutlineHiddenStrategy;

  /**
   * @deprecated Unused: badge does not use container queries.
   */
  badgeMinInlineSize?: string;
}

export interface AstroFeatureFlagsOptions extends ResolveFeatureRuntimeOptions {
  css?: DevOutlineCssOptions;
  /** Redeclared for tooling that does not always flatten `extends` from built `.d.mts`. */
  ffEnv?: string;
}

type NormalizedDevOutlineCssOptions = {
  outlineWidth: string;
  outlineStyle: 'dashed' | 'solid' | 'dotted';
  outlineColor: string;
  outlineColorByToken: Record<string, string>;
  outlineOffset: string;
  borderRadius: string;
  badgeLabelDev: string;
  badgeLabelByToken: Record<string, string>;
  hiddenStrategy: DevOutlineHiddenStrategy;
  badgeMinInlineSize: string;
};

const defaultDevOutlineCssOptions: Omit<NormalizedDevOutlineCssOptions, 'outlineColorByToken'> = {
  outlineWidth: '2px',
  outlineStyle: 'dashed',
  outlineColor: 'rgb(220 38 38)',
  outlineOffset: '-2px',
  borderRadius: '0.5rem',
  badgeLabelDev: 'dev',
  badgeLabelByToken: {},
  hiddenStrategy: 'visibility',
  badgeMinInlineSize: '8rem',
};

function normalizeCssOptions(css: DevOutlineCssOptions | undefined, runtime: ResolvedFeatureRuntime): NormalizedDevOutlineCssOptions {
  const byToken = {
    ...runtime.flagColorsByToken,
    ...(css?.outlineColorByToken ?? {}),
  };
  return {
    ...defaultDevOutlineCssOptions,
    ...(css ?? {}),
    outlineColorByToken: byToken,
    badgeLabelByToken: {
      ...defaultDevOutlineCssOptions.badgeLabelByToken,
      ...(css?.badgeLabelByToken ?? {}),
    },
  };
}

function colorForToken(token: string, opts: NormalizedDevOutlineCssOptions): string {
  return opts.outlineColorByToken[token] ?? opts.outlineColor;
}

/** CSS variable per token, set on &lt;html&gt; from ff.json + dev-toolbar overrides. */
function affColorVar(token: string): string {
  return `--aff-c-${token}`;
}

/**
 * Dev-only styles: `data-ff="token"` (or space-separated tokens) gates outlines/badges.
 * `html[data-ff-route="<token>"]` (dev) adds a fixed top-right route badge (label only).
 * Toolbar toggles: `data-ff-enabled-*`, `data-ff-outline-*`, `data-ff-badge-*`, `--aff-c-*`.
 */
export function createFeatureFlagStyles(
  runtime: ResolvedFeatureRuntime,
  css?: DevOutlineCssOptions
): string {
  const opts = normalizeCssOptions(css, runtime);
  const badgeLayout = normalizeElementBadgeLayout(css);
  const badgePos = elementBadgePositionBlock(badgeLayout);
  const chunks: string[] = [];

  for (const flag of Object.keys(runtime.flags)) {
    const token = toToken(flag);
    const col = colorForToken(token, opts);
    const v = affColorVar(token);
    const label = opts.badgeLabelByToken[token] ?? (token === 'dev' ? opts.badgeLabelDev : token);
    const labelEscaped = String(label).replace(/'/g, "\\'");

    chunks.push(`
html {
  --aff-outline-c-${token}: transparent;
}
html:not([data-ff-outline-${token}="off"]) {
  --aff-outline-c-${token}: var(${v}, ${col});
}
[data-ff~="${token}"] {
  position: relative;
  outline: ${opts.outlineWidth} ${opts.outlineStyle} var(--aff-outline-c-${token});
  outline-offset: ${opts.outlineOffset};
  border-radius: ${opts.borderRadius};
}
html:not([data-ff-badge-${token}="off"]) [data-ff~="${token}"]::before {
  box-sizing: border-box;
  position: absolute;
  inset: auto;
  margin: 0;
  width: max-content;
  max-width: min(18rem, calc(100% - 0.75rem));
  pointer-events: auto;
  z-index: 20;
${badgePos}
  display: block;
  content: '${labelEscaped}';
  border: 1px solid color-mix(in oklab, var(${v}, ${col}) 60%, transparent);
  border-radius: 9999px;
  padding: 0.125rem 0.45rem;
  font-size: 0.625rem;
  line-height: 1.2;
  letter-spacing: 0.02em;
  font-weight: 600;
  color: var(${v}, ${col});
  background: color-mix(in oklab, white 85%, var(${v}, ${col}) 15%);
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
  transition: opacity 0.14s ease, background 0.14s ease, border-color 0.14s ease;
}
html:not([data-ff-badge-${token}="off"]) [data-ff~="${token}"]:hover::before {
  opacity: 0.16;
  background: color-mix(in oklab, white 94%, var(${v}, ${col}) 6%);
  border-color: color-mix(in oklab, var(${v}, ${col}) 35%, transparent);
}
html[data-ff-route="${token}"]:not([data-ff-badge-${token}="off"])::before {
  content: '${labelEscaped}';
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10050;
  pointer-events: auto;
  box-sizing: border-box;
  width: max-content;
  max-width: min(18rem, calc(100vw - 1.5rem));
  border: 1px solid color-mix(in oklab, var(${v}, ${col}) 60%, transparent);
  border-radius: 9999px;
  padding: 0.125rem 0.45rem;
  font-size: 0.625rem;
  line-height: 1.2;
  letter-spacing: 0.02em;
  font-weight: 600;
  color: var(${v}, ${col});
  background: color-mix(in oklab, white 85%, var(${v}, ${col}) 15%);
  opacity: 1;
}
html[data-ff-route="${token}"]:not([data-ff-badge-${token}="off"])::before:hover {
  opacity: 0.16;
  background: color-mix(in oklab, white 94%, var(${v}, ${col}) 6%);
  border-color: color-mix(in oklab, var(${v}, ${col}) 35%, transparent);
}
html[data-ff-enabled-${token}="off"] [data-ff~="${token}"] {
  display: none !important;
}
`);
  }

  return '\n' + chunks.join('\n') + '\n';
}

function buildAffDevBootstrapScript(flagTokens: string[], colors: Record<string, string>): string {
  return `(function(){var T=${JSON.stringify(flagTokens)};var C=${JSON.stringify(colors)};try{window.__AFF__={tokens:T,colors:C};var raw=localStorage.getItem('aff.dev.v1');var st=raw?JSON.parse(raw):{};var o=st.outline||st.chrome||{},e=st.enabled||st.render||{},b=st.badge||{},cols=st.colors||{},r=document.documentElement;for(var i=0;i<T.length;i++){var t=T[i];if(o[t]===false)r.setAttribute('data-ff-outline-'+t,'off');else r.removeAttribute('data-ff-outline-'+t);if(e[t]===false)r.setAttribute('data-ff-enabled-'+t,'off');else r.removeAttribute('data-ff-enabled-'+t);if(b[t]===false)r.setAttribute('data-ff-badge-'+t,'off');else r.removeAttribute('data-ff-badge-'+t);var col=cols[t]||C[t];if(col)r.style.setProperty('--aff-c-'+t,col);else r.style.removeProperty('--aff-c-'+t)}}catch(_){}})();`;
}

export function createVirtualModuleSource(
  runtime: ResolvedFeatureRuntime,
  css?: DevOutlineCssOptions
): string {
  const flagNames = Object.keys(runtime.flags);
  const flagTokens = flagNames.map((name) => toToken(name));
  const enumEntries = flagNames
    .map((name) => `  ${toEnumKey(name)}: ${JSON.stringify(name)}`)
    .join(',\n');
  const tokenEntries = flagNames.map((name) => `  ${toEnumKey(name)}: ${JSON.stringify(toToken(name))}`).join(',\n');
  const styles = createFeatureFlagStyles(runtime, css);
  const colorsJson = JSON.stringify(runtime.flagColorsByToken, null, 2);
  const flagNameToToken = JSON.stringify(
    Object.fromEntries(flagNames.map((name) => [name, toToken(name)])),
    null,
    2
  );
  const bootstrap = buildAffDevBootstrapScript(flagTokens, { ...runtime.flagColorsByToken });

  return `function affRoutePatternToPrefix(pattern) {
  var p = String(pattern).trim();
  if (p.endsWith('/**')) p = p.slice(0, -3);
  else if (p.endsWith('/*')) p = p.slice(0, -2);
  else if (p.length > 1 && p.endsWith('*')) p = p.slice(0, -1);
  return p.endsWith('/') ? p : p + '/';
}

export const FeatureFlag = Object.freeze({
${enumEntries}
});

export const FeatureToken = Object.freeze({
${tokenEntries}
});

export const featureFlagTokens = Object.freeze(${JSON.stringify(flagTokens)});
export const featureFlagColors = Object.freeze(${colorsJson});
export const featureFlags = Object.freeze(${JSON.stringify(runtime.flags, null, 2)});
export const featureRouteFlags = Object.freeze(${JSON.stringify(runtime.routeFlags, null, 2)});
export const featureNamespace = ${JSON.stringify(runtime.namespace)};
export const featureMode = ${JSON.stringify(runtime.mode)};
export const isDev = import.meta.env.DEV;

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
  for (const [route, flag] of Object.entries(featureRouteFlags)) {
    const candidate = affRoutePatternToPrefix(route);
    if (normalized === candidate || normalized.startsWith(candidate)) {
      return isFeatureEnabled(flag);
    }
  }
  return true;
}

export function shouldIncludePathInProduction(pathname) {
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
  for (const [route, flag] of Object.entries(featureRouteFlags)) {
    const candidate = affRoutePatternToPrefix(route);
    if (normalized === candidate || normalized.startsWith(candidate)) {
      return isFeatureEnabled(flag);
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
  const flagName = featureRouteFlags[prefix];
  return flagName != null ? flagNameToToken[flagName] : undefined;
}

export const featureFlagStyles = import.meta.env.DEV ? ${JSON.stringify(styles)} : '';
`;
}

export function getResolvedFeatures(options: ResolveFeatureRuntimeOptions = {}): ResolvedFeatureRuntime {
  return resolveFeatureRuntime(options);
}

export function featureRouteIncluded(pathname: string, runtime: ResolvedFeatureRuntime): boolean {
  return shouldIncludeRoute({
    pathname,
    routeFlags: runtime.routeFlags,
    flags: runtime.flags,
    isDev: runtime.isDev,
  });
}

export { longestMatchingRoutePrefix, routePatternToPrefix } from './runtime';

export default function astroFeatureFlags(options: AstroFeatureFlagsOptions = {}): any {
  const { root = process.cwd(), mode = process.env.NODE_ENV || 'development', baseName = 'ff', css } = options;

  const runtime = resolveFeatureRuntime({ root, mode, baseName });

  return {
    name: 'astro-feature-flags',
    hooks: {
      'astro:config:setup': ({
        updateConfig,
        addDevToolbarApp,
      }: {
        updateConfig: (config: unknown) => void;
        addDevToolbarApp?: (opts: { id: string; name: string; icon: string; entrypoint: string }) => void;
      }) => {
        if (runtime.isDev && typeof addDevToolbarApp === 'function') {
          addDevToolbarApp({
            id: 'astro-feature-flags',
            name: 'Feature flags',
            icon: DEV_TOOLBAR_FLAG_ICON_SVG,
            entrypoint: fileURLToPath(new URL('./dev-toolbar-app.mjs', import.meta.url)),
          });
        }
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'astro-feature-flags:virtual-module',
                resolveId(id: string) {
                  if (id === 'virtual:astro-feature-flags') return '\0virtual:astro-feature-flags';
                  return null;
                },
                load(id: string) {
                  if (id === '\0virtual:astro-feature-flags') {
                    return createVirtualModuleSource(runtime, css);
                  }
                  return null;
                },
              },
            ],
          },
        });
      },
      'astro:build:done': ({ dir }: { dir: URL }) => {
        if (runtime.isDev) return;
        const outDir = new URL(dir).pathname;
        const prunePaths = routePathsToPrune({ routeFlags: runtime.routeFlags, flags: runtime.flags });
        for (const routePath of prunePaths) {
          rmSync(join(outDir, routePath), { recursive: true, force: true });
        }
      },
    },
  };
}
