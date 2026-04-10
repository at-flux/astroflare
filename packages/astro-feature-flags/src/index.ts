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
  type ResolveFeatureRuntimeOptions,
  type ResolvedFeatureRuntime,
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

export type DevOutlineHiddenStrategy = "visibility" | "display";

export interface DevOutlineCssOptions extends ElementBadgeLayoutOptions {
  outlineWidth?: string;
  outlineStyle?: "dashed" | "solid" | "dotted";
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
}

type NormalizedDevOutlineCssOptions = {
  outlineWidth: string;
  outlineStyle: "dashed" | "solid" | "dotted";
  outlineColor: string;
  outlineColorByToken: Record<string, string>;
  outlineOffset: string;
  borderRadius: string;
  badgeLabelDev: string;
  badgeLabelByToken: Record<string, string>;
  hiddenStrategy: DevOutlineHiddenStrategy;
  badgeMinInlineSize: string;
};

const defaultDevOutlineCssOptions: Omit<
  NormalizedDevOutlineCssOptions,
  "outlineColorByToken"
> = {
  outlineWidth: "2px",
  outlineStyle: "solid",
  outlineColor: "rgb(220 38 38)",
  outlineOffset: "-2px",
  borderRadius: "0.5rem",
  badgeLabelDev: "dev",
  badgeLabelByToken: {},
  hiddenStrategy: "visibility",
  badgeMinInlineSize: "8rem",
};

function normalizeCssOptions(
  css: DevOutlineCssOptions | undefined,
  runtime: ResolvedFeatureRuntime,
): NormalizedDevOutlineCssOptions {
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

function colorForToken(
  token: string,
  opts: NormalizedDevOutlineCssOptions,
): string {
  return opts.outlineColorByToken[token] ?? opts.outlineColor;
}

/** CSS variable per token, set on &lt;html&gt; from ff.json + dev-toolbar overrides. */
function featureColorVar(token: string, namespace: string): string {
  const ns = toToken(namespace) || "ff";
  return `--${ns}-c-${token}`;
}

/**
 * Dev-only styles: `data-ff="token"` (or space-separated tokens) gates outlines/badges.
 * `html[data-ff-route="<token>"]` (dev) adds a fixed top-right route badge (label only).
 * Toolbar toggles: `data-ff-enabled-*`, `data-ff-outline-*`, `data-ff-badge-*`, `--<namespace>-c-*`.
 */
export function createFeatureFlagStyles(
  runtime: ResolvedFeatureRuntime,
  css?: DevOutlineCssOptions,
): string {
  const nsAttr = `data-${toToken(runtime.namespace) || "ff"}`;
  const opts = normalizeCssOptions(css, runtime);
  const badgeLayout = normalizeElementBadgeLayout(css);
  const badgePos = elementBadgePositionBlock(badgeLayout);
  const chunks: string[] = [];

  for (const flag of Object.keys(runtime.flags)) {
    const token = toToken(flag);
    const valueSelectors = [`[${nsAttr}~="${token}"]`];
    if (flag !== token) valueSelectors.push(`[${nsAttr}~="${flag}"]`);
    const baseSelectors = [...valueSelectors, `[${nsAttr}-${token}]`];
    const sel = baseSelectors.join(", ");
    const selIs = `:is(${baseSelectors.join(", ")})`;
    const col = colorForToken(token, opts);
    const v = featureColorVar(token, runtime.namespace);
    const label =
      opts.badgeLabelByToken[token] ??
      (token === "dev" ? opts.badgeLabelDev : token);
    const labelEscaped = String(label).replace(/'/g, "\\'");

    chunks.push(`
html {
  --aff-outline-c-${token}: transparent;
}
html:not([data-ff-outline-${token}="off"]) {
  --aff-outline-c-${token}: var(${v}, ${col});
}
${sel} {
  position: relative;
  outline: ${opts.outlineWidth} ${opts.outlineStyle} var(--aff-outline-c-${token});
  outline-offset: ${opts.outlineOffset};
  border-radius: ${opts.borderRadius};
}
html:not([data-ff-badge-${token}="off"]) ${selIs}::before {
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
html:not([data-ff-badge-${token}="off"]) ${selIs}:hover::before {
  opacity: 0.16;
  background: color-mix(in oklab, white 94%, var(${v}, ${col}) 6%);
  border-color: color-mix(in oklab, var(${v}, ${col}) 35%, transparent);
}
html:not([data-ff-badge-${token}="off"]) ${selIs}[data-ff-align="start"]::before {
  left: 0.35rem;
  right: auto;
  transform: translateY(calc(-1 * 80%));
}
html:not([data-ff-badge-${token}="off"]) ${selIs}[data-ff-align="center"]::before {
  left: 50%;
  right: auto;
  transform: translate(-50%, calc(-1 * 80%));
}
html:not([data-ff-badge-${token}="off"]) ${selIs}[data-ff-align="end"]::before {
  left: auto;
  right: 0.35rem;
  transform: translateY(calc(-1 * 80%));
}
html:not([data-ff-badge-${token}="off"]) ${selIs}[data-ff-horizontal]::before {
  left: calc(attr(data-ff-horizontal number, 50) * 1%);
  right: auto;
  transform: translate(-50%, calc(-1 * 80%));
}
html:not([data-ff-badge-${token}="off"]) ${selIs}[data-ff-horizontal][data-ff-anchor="bottom"]::before {
  transform: translate(-50%, 80%);
}
html:not([data-ff-badge-${token}="off"]) ${selIs}[data-ff-anchor="bottom"]::before {
  top: auto;
  bottom: 0;
  transform: translateY(80%);
}
html:not([data-ff-badge-${token}="off"]) ${selIs}[data-ff-anchor="bottom"][data-ff-align="center"]::before {
  transform: translate(-50%, 80%);
}
html:not([data-ff-badge-${token}="off"]) ${selIs}[data-ff-vertical]::before {
  transform: translateY(calc(attr(data-ff-vertical number, 80) * -1%));
}
html:not([data-ff-badge-${token}="off"]) ${selIs}[data-ff-horizontal][data-ff-vertical]::before {
  transform: translate(-50%, calc(attr(data-ff-vertical number, 80) * -1%));
}
html:not([data-ff-badge-${token}="off"]) ${selIs}[data-ff-anchor="bottom"][data-ff-vertical]::before {
  transform: translateY(calc(attr(data-ff-vertical number, 80) * 1%));
}
html:not([data-ff-badge-${token}="off"]) ${selIs}[data-ff-anchor="bottom"][data-ff-horizontal][data-ff-vertical]::before {
  transform: translate(-50%, calc(attr(data-ff-vertical number, 80) * 1%));
}
html[data-ff-enabled-${token}="off"] ${selIs} {
  display: none !important;
}
`);
  }

  // Multi-token value on a single element: show combined badge text and a gradient outline.
  chunks.push(`
[${nsAttr}*=" "] {
  outline: none !important;
  outline-offset: 0 !important;
  border: ${opts.outlineWidth} solid transparent;
  background:
    linear-gradient(white, white) padding-box,
    var(--ff-combo-gradient, linear-gradient(90deg, #fecaca, #bfdbfe, #bbf7d0)) border-box;
  border-radius: ${opts.borderRadius};
}
html [${nsAttr}*=" "]::before {
  content: attr(${nsAttr});
  background: var(--ff-combo-badge-gradient, var(--ff-combo-gradient-soft, linear-gradient(90deg, #fff1f2, #eff6ff, #f0fdf4))) !important;
  color: var(--ff-combo-text, #111827) !important;
  border: 1px solid var(--ff-combo-badge-border, color-mix(in oklab, #94a3b8 50%, transparent)) !important;
  transition: opacity 0.14s ease, background 0.14s ease, border-color 0.14s ease;
}
html [${nsAttr}*=" "][data-ff-label]::before {
  content: attr(data-ff-label) !important;
}
html [${nsAttr}*=" "]:hover::before {
  opacity: 0.2;
  background: linear-gradient(90deg, #fff8f9, #f8fbff, #f8fff9);
  border-color: color-mix(in oklab, #94a3b8 35%, transparent);
}
html[data-ff-route]:not([data-ff-route=""]) body::after {
  content: '';
  position: fixed;
  inset: 0.6rem;
  pointer-events: none;
  z-index: 10040;
  padding: 2px;
  background: var(--ff-route-outline-gradient, linear-gradient(90deg, #ef4444, #3b82f6, #22c55e));
  -webkit-mask:
    linear-gradient(#fff 0 0) content-box,
    linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  border-radius: 0.5rem;
}
html[data-ff-route]:not([data-ff-route=""])::before {
  content: attr(data-ff-route-label);
  position: fixed;
  top: 0.75rem;
  right: 0.75rem;
  z-index: 10060;
  pointer-events: auto;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  max-width: min(34rem, calc(100vw - 1.5rem));
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border: 1px solid var(--ff-route-badge-border, color-mix(in oklab, #94a3b8 55%, transparent));
  border-radius: 9999px;
  padding: 0.15rem 0.5rem;
  font-size: 0.625rem;
  line-height: 1.2;
  letter-spacing: 0.02em;
  font-weight: 600;
  color: var(--ff-route-text, #111827);
  background: var(--ff-route-badge-gradient, linear-gradient(90deg, #fff1f2));
  opacity: 1;
  transition: opacity 0.14s ease, border-color 0.14s ease, background 0.14s ease;
}
html[data-ff-route]:not([data-ff-route=""])::before:hover {
  opacity: 0.2;
  border-color: color-mix(in oklab, #94a3b8 35%, transparent);
}
`);

  return "\n" + chunks.join("\n") + "\n";
}

function createProductionGateStyles(runtime: ResolvedFeatureRuntime): string {
  const nsAttr = `data-${toToken(runtime.namespace) || "ff"}`;
  const chunks: string[] = [];
  for (const [flag, enabled] of Object.entries(runtime.flags)) {
    if (enabled) continue;
    const token = toToken(flag);
    const valueSelectors = [`[${nsAttr}~="${token}"]`];
    if (flag !== token) valueSelectors.push(`[${nsAttr}~="${flag}"]`);
    chunks.push(
      `${[...valueSelectors, `[${nsAttr}-${token}]`].join(", ")} { display: none !important; }`,
    );
  }
  return chunks.length ? `\n${chunks.join("\n")}\n` : "";
}

function buildAffDevBootstrapScript(
  flagTokens: string[],
  colors: Record<string, string>,
  outlineDefaults: Record<string, boolean>,
  badgeDefaults: Record<string, boolean>,
  routeFlags: Record<string, string[]>,
  flagNameToToken: Record<string, string>,
  namespace: string,
): string {
  return `(function(){var T=${JSON.stringify(flagTokens)};var C=${JSON.stringify(colors)};var OD=${JSON.stringify(outlineDefaults)};var BD=${JSON.stringify(badgeDefaults)};var RF=${JSON.stringify(routeFlags)};var F2T=${JSON.stringify(flagNameToToken)};var N=${JSON.stringify(toToken(namespace) || "ff")};var K=N+'.dev.v1';function pfx(p){p=String(p||'').trim();if(p.endsWith('/**'))p=p.slice(0,-3);else if(p.endsWith('/*'))p=p.slice(0,-2);else if(p.length>1&&p.endsWith('*'))p=p.slice(0,-1);return p.endsWith('/')?p:p+'/'}function unique(a){var s=new Set();var o=[];for(var i=0;i<a.length;i++){var v=a[i];if(!v||s.has(v))continue;s.add(v);o.push(v)}return o}function comboTokens(el){var out=[];var v=(el.getAttribute('data-'+N)||'').trim();if(v)out=out.concat(v.split(/\\s+/).filter(Boolean));for(var i=0;i<T.length;i++){var tk=T[i];if(el.hasAttribute('data-'+N+'-'+tk))out.push(tk)}return unique(out)}function applyCombo(el,cols,C){var tokens=comboTokens(el);if(tokens.length<2){el.removeAttribute('data-ff-label');el.style.removeProperty('--ff-combo-gradient');el.style.removeProperty('--ff-combo-gradient-soft');el.style.removeProperty('--ff-combo-outline');el.style.removeProperty('--ff-combo-text');el.style.removeProperty('--ff-combo-badge-border');el.style.removeProperty('--ff-combo-badge-gradient');return}el.setAttribute('data-'+N,tokens.join(' '));el.setAttribute('data-ff-label',tokens.join(' | '));var soft=[];var strong=[];for(var i=0;i<tokens.length;i++){var tk=tokens[i];var c=(cols[tk]||C[tk]||'#94a3b8');soft.push('color-mix(in oklab, white 86%, '+c+' 14%)');strong.push(c)}el.style.setProperty('--ff-combo-gradient','linear-gradient(90deg, '+strong.join(', ')+')');el.style.setProperty('--ff-combo-gradient-soft','linear-gradient(90deg, '+soft.join(', ')+')');el.style.setProperty('--ff-combo-outline',(cols[tokens[0]]||C[tokens[0]]||'#64748b'));el.style.setProperty('--ff-combo-text',(cols[tokens[0]]||C[tokens[0]]||'#111827'));el.style.setProperty('--ff-combo-badge-border','color-mix(in oklab, '+(cols[tokens[0]]||C[tokens[0]]||'#64748b')+' 35%, transparent)');el.style.setProperty('--ff-combo-badge-gradient','linear-gradient(90deg, '+soft.join(', ')+')')}try{window.__AFF__={tokens:T,colors:C,namespace:N};var raw=localStorage.getItem(K)||localStorage.getItem('aff.dev.v1');var st=raw?JSON.parse(raw):{};var o=st.outline||st.chrome||{},e=st.enabled||st.render||{},b=st.badge||{},cols=st.colors||{},r=document.documentElement;for(var i=0;i<T.length;i++){var t=T[i];var od=(OD[t]!==false);var bd=(BD[t]!==false);if((o[t]===false)||(!od&&o[t]!==true))r.setAttribute('data-ff-outline-'+t,'off');else r.removeAttribute('data-ff-outline-'+t);if(e[t]===false)r.setAttribute('data-ff-enabled-'+t,'off');else r.removeAttribute('data-ff-enabled-'+t);if((b[t]===false)||(!bd&&b[t]!==true))r.setAttribute('data-ff-badge-'+t,'off');else r.removeAttribute('data-ff-badge-'+t);var col=cols[t]||C[t];var vn='--'+N+'-c-'+t;if(col)r.style.setProperty(vn,col);else r.style.removeProperty(vn)}var route=(r.getAttribute('data-ff-route')||'').trim();if(route){var rtoks=route.split(/\\s+/).filter(Boolean);var gradsStrong=[];var gradsSoft=[];for(var gi=0;gi<rtoks.length;gi++){var tk=rtoks[gi];var c=cols[tk]||C[tk]||'#94a3b8';gradsStrong.push(c);gradsSoft.push('color-mix(in oklab, white 86%, '+c+' 14%)')}if(gradsStrong.length){r.style.setProperty('--'+N+'-route-gradient','linear-gradient(90deg, '+gradsSoft.join(', ')+')');r.style.setProperty('--ff-route-outline-gradient','linear-gradient(90deg, '+gradsStrong.join(', ')+')');r.style.setProperty('--ff-route-badge-gradient','linear-gradient(90deg, '+gradsSoft.join(', ')+')');r.style.setProperty('--ff-route-badge-border','color-mix(in oklab, '+(cols[rtoks[0]]||C[rtoks[0]]||'#64748b')+' 35%, transparent)');r.style.setProperty('--ff-route-outline',(cols[rtoks[0]]||C[rtoks[0]]||'#64748b'));r.style.setProperty('--ff-route-text',(cols[rtoks[0]]||C[rtoks[0]]||'#111827'))}var path=window.location&&window.location.pathname?window.location.pathname:'/';if(!path.endsWith('/'))path+='/';var byFlag={};for(var rp in RF){if(!Object.prototype.hasOwnProperty.call(RF,rp))continue;var cnd=pfx(rp);if(!(path===cnd||path.indexOf(cnd)===0))continue;var fns=RF[rp]||[];for(var fi=0;fi<fns.length;fi++){var fn=fns[fi];var tk=F2T[fn];if(!tk)continue;if(!byFlag[tk])byFlag[tk]=[];byFlag[tk].push(rp)}}var parts=[];for(var ti=0;ti<rtoks.length;ti++){var tk=rtoks[ti];var rs=byFlag[tk]||[];parts.push(tk+' - '+(rs.length?rs.join(', '):'matched'))}r.setAttribute('data-ff-route-label','Page: '+parts.join(' | '))}var applyAll=function(){var map=new Set();var base=document.querySelectorAll('['+('data-'+N)+']');for(var bi=0;bi<base.length;bi++)map.add(base[bi]);for(var ti=0;ti<T.length;ti++){var ls=document.querySelectorAll('[data-'+N+'-'+T[ti]+']');for(var li=0;li<ls.length;li++)map.add(ls[li])}map.forEach(function(el){applyCombo(el,cols,C)})};applyAll();if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',applyAll,{once:true})}document.addEventListener('astro:after-swap',applyAll)}catch(_){}})();`;
}

export function createVirtualModuleSource(
  runtime: ResolvedFeatureRuntime,
  css?: DevOutlineCssOptions,
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
  const productionGateStyles = createProductionGateStyles(runtime);
  const colorsJson = JSON.stringify(runtime.flagColorsByToken, null, 2);
  const flagNameToToken = JSON.stringify(
    Object.fromEntries(flagNames.map((name) => [name, toToken(name)])),
    null,
    2,
  );
  const bootstrap = buildAffDevBootstrapScript(
    flagTokens,
    { ...runtime.flagColorsByToken },
    { ...runtime.flagOutlineDefaultsByToken },
    { ...runtime.flagBadgeDefaultsByToken },
    { ...runtime.routeFlags },
    Object.fromEntries(flagNames.map((name) => [name, toToken(name)])),
    runtime.namespace,
  );

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
  for (const [route, flags] of Object.entries(featureRouteFlags)) {
    const candidate = affRoutePatternToPrefix(route);
    if (normalized === candidate || normalized.startsWith(candidate)) {
      return flags.every((flag) => isFeatureEnabled(flag));
    }
  }
  return true;
}

export function shouldIncludePathInProduction(pathname) {
  const normalized = pathname.endsWith('/') ? pathname : pathname + '/';
  for (const [route, flags] of Object.entries(featureRouteFlags)) {
    const candidate = affRoutePatternToPrefix(route);
    if (normalized === candidate || normalized.startsWith(candidate)) {
      return flags.every((flag) => isFeatureEnabled(flag));
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

export const featureFlagStyles = import.meta.env.DEV ? ${JSON.stringify(styles)} : ${JSON.stringify(productionGateStyles)};
`;
}

export function getResolvedFeatures(
  options: ResolveFeatureRuntimeOptions = {},
): ResolvedFeatureRuntime {
  return resolveFeatureRuntime(options);
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

export { longestMatchingRoutePrefix, routePatternToPrefix } from "./runtime";

export default function astroFeatureFlags(
  options: AstroFeatureFlagsOptions = {},
): any {
  const {
    root = process.cwd(),
    mode = process.env.NODE_ENV || "development",
    baseName = "ff",
    css,
  } = options;

  const runtime = resolveFeatureRuntime({
    ...options,
    root,
    mode,
    baseName,
  });

  return {
    name: "astro-feature-flags",
    hooks: {
      "astro:config:setup": ({
        updateConfig,
        addDevToolbarApp,
      }: {
        updateConfig: (config: unknown) => void;
        addDevToolbarApp?: (opts: {
          id: string;
          name: string;
          icon: string;
          entrypoint: string;
        }) => void;
      }) => {
        if (runtime.isDev && typeof addDevToolbarApp === "function") {
          addDevToolbarApp({
            id: "astro-feature-flags",
            name: "Feature flags",
            icon: DEV_TOOLBAR_FLAG_ICON_SVG,
            entrypoint: fileURLToPath(
              new URL("./dev-toolbar-app.mjs", import.meta.url),
            ),
          });
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
                    return createVirtualModuleSource(runtime, css);
                  }
                  return null;
                },
              },
            ],
          },
        });
      },
      "astro:build:done": ({ dir }: { dir: URL }) => {
        if (runtime.isDev) return;
        const outDir = new URL(dir).pathname;
        const prunePaths = routePathsToPrune({
          routeFlags: runtime.routeFlags,
          flags: runtime.flags,
        });
        for (const routePath of prunePaths) {
          rmSync(join(outDir, routePath), { recursive: true, force: true });
        }
      },
    },
  };
}
