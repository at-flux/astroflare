import {
  elementBadgePositionBlock,
  normalizeElementBadgeLayout,
} from "./badge-layout";
import type { ElementBadgeLayoutOptions } from "./badge-layout";
import type { FeatureFlagMap, ResolvedFeatureRuntime } from "./runtime";
import { toToken } from "./runtime";

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

  for (const flag of Object.keys(runtime.flags)) {
    const token = toToken(flag);
    const routeTok = [`[data-ff-route~="${token}"]`];
    if (flag !== token) routeTok.push(`[data-ff-route~="${flag}"]`);
    const rs = routeTok.join(", ");
    chunks.push(`
${rs}[data-ff-outline-${token}="off"] body::after {
  display: none !important;
}
${rs}[data-ff-badge-${token}="off"]::before {
  display: none !important;
}
`);
  }

  chunks.push(`
.aff-route-pruned-overlay {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(1rem, 4vw, 2.5rem);
  text-align: center;
  font: 600 0.95rem/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
  color: #f8fafc;
  background: rgba(15, 23, 42, 0.58);
  backdrop-filter: blur(2px);
  pointer-events: auto;
}
`);

  return "\n" + chunks.join("\n") + "\n";
}

/**
 * CSS-only hiding for disabled flags. The Astro integration no longer injects this into
 * production builds — static HTML is culled instead. Kept for custom tooling or tests.
 */
export function createProductionGateStyles(
  runtime: ResolvedFeatureRuntime,
): string {
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

export function buildAffDevBootstrapScript(
  flagTokens: string[],
  colors: Record<string, string>,
  outlineDefaults: Record<string, boolean>,
  badgeDefaults: Record<string, boolean>,
  routeFlags: Record<string, string[]>,
  flagNameToToken: Record<string, string>,
  namespace: string,
  productionFlags: FeatureFlagMap,
): string {
  const pf = JSON.stringify(productionFlags);
  return `(function(){var T=${JSON.stringify(flagTokens)};var C=${JSON.stringify(colors)};var OD=${JSON.stringify(outlineDefaults)};var BD=${JSON.stringify(badgeDefaults)};var RF=${JSON.stringify(routeFlags)};var F2T=${JSON.stringify(flagNameToToken)};var N=${JSON.stringify(toToken(namespace) || "ff")};var K=N+'.dev.v1';var PF=${pf};function pfx(p){p=String(p||'').trim();if(p.endsWith('/**'))p=p.slice(0,-3);else if(p.endsWith('/*'))p=p.slice(0,-2);else if(p.length>1&&p.endsWith('*'))p=p.slice(0,-1);return p.endsWith('/')?p:p+'/'}function affProdOn(fn){var v=PF[fn];return !!(v===true||v===1||v==='1');}function affIncludeProd(aPath){var path=aPath||'/';if(!path.endsWith('/'))path+='/';for(var rp in RF){if(!Object.prototype.hasOwnProperty.call(RF,rp))continue;var cnd=pfx(rp);if(path===cnd||path.indexOf(cnd)===0){var fns=RF[rp]||[];for(var xi=0;xi<fns.length;xi++){if(!affProdOn(fns[xi]))return false}return true}}return true}function affRoutePrunedMiss(aPath){var path=aPath||'/';if(!path.endsWith('/'))path+='/';for(var rq in RF){if(!Object.prototype.hasOwnProperty.call(RF,rq))continue;var cx=pfx(rq);if(!(path===cx||path.indexOf(cx)===0))continue;var ms=[];var fa=RF[rq]||[];for(var yj=0;yj<fa.length;yj++){var fn=fa[yj];if(!affProdOn(fn))ms.push(fn)}return ms}return []}function affRoutePrunedOverlay(){var path=window.location&&window.location.pathname?window.location.pathname:'/';if(affIncludeProd(path)){var rm=document.getElementById('aff-route-pruned-overlay');if(rm)rm.remove();document.documentElement.removeAttribute('data-aff-route-pruned');return}var miss=affRoutePrunedMiss(path);if(!miss.length){document.documentElement.removeAttribute('data-aff-route-pruned');return}document.documentElement.setAttribute('data-aff-route-pruned','');var el=document.getElementById('aff-route-pruned-overlay');if(!el){el=document.createElement('div');el.id='aff-route-pruned-overlay';el.className='aff-route-pruned-overlay';el.setAttribute('role','status');document.body.appendChild(el)}el.textContent='This route is omitted in production static output. Flags off for production: '+miss.join(', ')+'.'}function unique(a){var s=new Set();var o=[];for(var i=0;i<a.length;i++){var v=a[i];if(!v||s.has(v))continue;s.add(v);o.push(v)}return o}function comboTokens(el){var out=[];var v=(el.getAttribute('data-'+N)||'').trim();if(v)out=out.concat(v.split(/\\s+/).filter(Boolean));for(var i=0;i<T.length;i++){var tk=T[i];if(el.hasAttribute('data-'+N+'-'+tk))out.push(tk)}return unique(out)}function applyCombo(el,cols,C){var tokens=comboTokens(el);if(tokens.length<2){el.removeAttribute('data-ff-label');el.style.removeProperty('--ff-combo-gradient');el.style.removeProperty('--ff-combo-gradient-soft');el.style.removeProperty('--ff-combo-outline');el.style.removeProperty('--ff-combo-text');el.style.removeProperty('--ff-combo-badge-border');el.style.removeProperty('--ff-combo-badge-gradient');return}el.setAttribute('data-'+N,tokens.join(' '));el.setAttribute('data-ff-label',tokens.join(' | '));var soft=[];var strong=[];for(var i=0;i<tokens.length;i++){var tk=tokens[i];var c=(cols[tk]||C[tk]||'#94a3b8');soft.push('color-mix(in oklab, white 86%, '+c+' 14%)');strong.push(c)}el.style.setProperty('--ff-combo-gradient','linear-gradient(90deg, '+strong.join(', ')+')');el.style.setProperty('--ff-combo-gradient-soft','linear-gradient(90deg, '+soft.join(', ')+')');el.style.setProperty('--ff-combo-outline',(cols[tokens[0]]||C[tokens[0]]||'#64748b'));el.style.setProperty('--ff-combo-text',(cols[tokens[0]]||C[tokens[0]]||'#111827'));el.style.setProperty('--ff-combo-badge-border','color-mix(in oklab, '+(cols[tokens[0]]||C[tokens[0]]||'#64748b')+' 35%, transparent)');el.style.setProperty('--ff-combo-badge-gradient','linear-gradient(90deg, '+soft.join(', ')+')')}try{window.__AFF__={tokens:T,colors:C,namespace:N};var raw=localStorage.getItem(K)||localStorage.getItem('aff.dev.v1');var st=raw?JSON.parse(raw):{};var o=st.outline||st.chrome||{},e=st.enabled||st.render||{},b=st.badge||{},cols=st.colors||{},r=document.documentElement;for(var i=0;i<T.length;i++){var t=T[i];var od=(OD[t]!==false);var bd=(BD[t]!==false);if((o[t]===false)||(!od&&o[t]!==true))r.setAttribute('data-ff-outline-'+t,'off');else r.removeAttribute('data-ff-outline-'+t);if(e[t]===false)r.setAttribute('data-ff-enabled-'+t,'off');else r.removeAttribute('data-ff-enabled-'+t);if((b[t]===false)||(!bd&&b[t]!==true))r.setAttribute('data-ff-badge-'+t,'off');else r.removeAttribute('data-ff-badge-'+t);var col=cols[t]||C[t];var vn='--'+N+'-c-'+t;if(col)r.style.setProperty(vn,col);else r.style.removeProperty(vn)}var route=(r.getAttribute('data-ff-route')||'').trim();if(route){var rtoks=route.split(/\\s+/).filter(Boolean);var gradsStrong=[];var gradsSoft=[];for(var gi=0;gi<rtoks.length;gi++){var tk=rtoks[gi];var c=cols[tk]||C[tk]||'#94a3b8';gradsStrong.push(c);gradsSoft.push('color-mix(in oklab, white 86%, '+c+' 14%)')}if(gradsStrong.length){r.style.setProperty('--'+N+'-route-gradient','linear-gradient(90deg, '+gradsSoft.join(', ')+')');r.style.setProperty('--ff-route-outline-gradient','linear-gradient(90deg, '+gradsStrong.join(', ')+')');r.style.setProperty('--ff-route-badge-gradient','linear-gradient(90deg, '+gradsSoft.join(', ')+')');r.style.setProperty('--ff-route-badge-border','color-mix(in oklab, '+(cols[rtoks[0]]||C[rtoks[0]]||'#64748b')+' 35%, transparent)');r.style.setProperty('--ff-route-outline',(cols[rtoks[0]]||C[rtoks[0]]||'#64748b'));r.style.setProperty('--ff-route-text',(cols[rtoks[0]]||C[rtoks[0]]||'#111827'))}var path=window.location&&window.location.pathname?window.location.pathname:'/';if(!path.endsWith('/'))path+='/';var byFlag={};for(var rp in RF){if(!Object.prototype.hasOwnProperty.call(RF,rp))continue;var cnd=pfx(rp);if(!(path===cnd||path.indexOf(cnd)===0))continue;var fns=RF[rp]||[];for(var fi=0;fi<fns.length;fi++){var fn=fns[fi];var tk=F2T[fn];if(!tk)continue;if(!byFlag[tk])byFlag[tk]=[];byFlag[tk].push(rp)}}var parts=[];for(var ti=0;ti<rtoks.length;ti++){var tk=rtoks[ti];var rs=byFlag[tk]||[];parts.push(tk+' - '+(rs.length?rs.join(', '):'matched'))}r.setAttribute('data-ff-route-label','Page: '+parts.join(' | '))}var applyAll=function(){var map=new Set();var base=document.querySelectorAll('['+('data-'+N)+']');for(var bi=0;bi<base.length;bi++)map.add(base[bi]);for(var ti=0;ti<T.length;ti++){var ls=document.querySelectorAll('[data-'+N+'-'+T[ti]+']');for(var li=0;li<ls.length;li++)map.add(ls[li])}map.forEach(function(el){applyCombo(el,cols,C)})};function affAfterNav(){applyAll();affRoutePrunedOverlay()}affAfterNav();if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',affAfterNav,{once:true})}document.addEventListener('astro:after-swap',affAfterNav)}catch(_){}})();`;
}
