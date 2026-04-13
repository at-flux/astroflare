import {
  elementBadgePositionBlock,
  normalizeElementBadgeLayout,
} from "./badge-layout";
import type { ElementBadgeLayoutOptions } from "./badge-layout";
import { compactInlineScript } from "./inline-script";
import type { ResolvedFeatureRuntime } from "./runtime";
import { toToken } from "./runtime";
import { routePrefixJsHelper } from "./route-prefix-js";

export type DevOutlineHiddenStrategy = "visibility" | "display";

export interface DevOutlineCssOptions extends ElementBadgeLayoutOptions {
  outlineWidth?: string;
  /** Fallback when no per-token colour is set. */
  outlineColor?: string;
  /** Per-flag-token outline / badge / route-badge colour (overrides JSON `colors`). */
  outlineColorByToken?: Record<string, string>;
  outlineOffset?: string;
  borderRadius?: string;

  /** Default pill text for the `wip` flag token in the dev toolbar. */
  badgeLabelWip?: string;
  /** @deprecated Use {@link badgeLabelWip}. */
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
  outlineColor: string;
  outlineColorByToken: Record<string, string>;
  outlineOffset: string;
  borderRadius: string;
  badgeLabelWip: string;
  badgeLabelByToken: Record<string, string>;
  hiddenStrategy: DevOutlineHiddenStrategy;
  badgeMinInlineSize: string;
};

const defaultDevOutlineCssOptions: Omit<
  NormalizedDevOutlineCssOptions,
  "outlineColorByToken"
> = {
  outlineWidth: "2px",
  outlineColor: "rgb(220 38 38)",
  outlineOffset: "-2px",
  borderRadius: "0.5rem",
  badgeLabelWip: "wip",
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
  const badgeLabelWip =
    css?.badgeLabelWip ?? css?.badgeLabelDev ?? defaultDevOutlineCssOptions.badgeLabelWip;
  return {
    ...defaultDevOutlineCssOptions,
    ...(css ?? {}),
    outlineColorByToken: byToken,
    badgeLabelWip,
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
      (token === "wip" ? opts.badgeLabelWip : token);
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
  outline: ${opts.outlineWidth} solid var(--aff-outline-c-${token});
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
.aff-route-frame {
  position: fixed;
  inset: 0.6rem;
  pointer-events: none;
  z-index: 10040;
  box-sizing: border-box;
  border-radius: 0.5rem;
  overflow: hidden;
}
.aff-route-frame::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 2px;
  background: var(--ff-route-outline-gradient, linear-gradient(90deg, #ef4444, #3b82f6, #22c55e));
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
.aff-route-badge {
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
.aff-route-badge:hover {
  opacity: 0.2;
  border-color: color-mix(in oklab, #94a3b8 35%, transparent);
}
.aff-route-disabled-overlay {
  position: fixed;
  inset: 0;
  z-index: 10050;
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: clamp(1rem, 4vw, 2.5rem);
  text-align: center;
  font: 600 0.95rem/1.45 system-ui, -apple-system, Segoe UI, sans-serif;
  color: #f8fafc;
  background: rgba(15, 23, 42, 0.52);
  backdrop-filter: blur(2px);
  pointer-events: auto;
}
.aff-route-disabled-overlay > p {
  margin: 0;
  max-width: min(44rem, calc(100vw - 2rem));
  white-space: pre-line;
}
`);

  for (const flag of Object.keys(runtime.flags)) {
    const token = toToken(flag);
    chunks.push(`
[data-ff-route~="${token}"][data-ff-outline-${token}="off"] #aff-route-frame {
  display: none !important;
}
[data-ff-route~="${token}"][data-ff-badge-${token}="off"] #aff-route-badge {
  display: none !important;
}
`);
  }

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
): string {
  const pfxHelper = routePrefixJsHelper("pfx");
  return compactInlineScript(`
    (function () {
      var T = ${JSON.stringify(flagTokens)};
      var C = ${JSON.stringify(colors)};
      var OD = ${JSON.stringify(outlineDefaults)};
      var BD = ${JSON.stringify(badgeDefaults)};
      var RF = ${JSON.stringify(routeFlags)};
      var F2T = ${JSON.stringify(flagNameToToken)};
      var N = ${JSON.stringify(toToken(namespace) || "ff")};
      var K = N + '.dev.v1';
      ${pfxHelper}

      function unique(a) {
        var s = new Set();
        var o = [];
        for (var i = 0; i < a.length; i++) {
          var v = a[i];
          if (!v || s.has(v)) continue;
          s.add(v);
          o.push(v);
        }
        return o;
      }

      function comboTokens(el) {
        var out = [];
        var v = (el.getAttribute('data-' + N) || '').trim();
        if (v) out = out.concat(v.split(/\\s+/).filter(Boolean));
        for (var i = 0; i < T.length; i++) {
          var tk = T[i];
          if (el.hasAttribute('data-' + N + '-' + tk)) out.push(tk);
        }
        return unique(out);
      }

      function applyCombo(el, cols, C) {
        var tokens = comboTokens(el);
        if (tokens.length < 2) {
          el.removeAttribute('data-ff-label');
          el.style.removeProperty('--ff-combo-gradient');
          el.style.removeProperty('--ff-combo-gradient-soft');
          el.style.removeProperty('--ff-combo-outline');
          el.style.removeProperty('--ff-combo-text');
          el.style.removeProperty('--ff-combo-badge-border');
          el.style.removeProperty('--ff-combo-badge-gradient');
          return;
        }
        el.setAttribute('data-' + N, tokens.join(' '));
        el.setAttribute('data-ff-label', tokens.join(' | '));
        var soft = [];
        var strong = [];
        for (var i = 0; i < tokens.length; i++) {
          var tk = tokens[i];
          var c = (cols[tk] || C[tk] || '#94a3b8');
          soft.push('color-mix(in oklab, white 86%, ' + c + ' 14%)');
          strong.push(c);
        }
        el.style.setProperty('--ff-combo-gradient', 'linear-gradient(90deg, ' + strong.join(', ') + ')');
        el.style.setProperty('--ff-combo-gradient-soft', 'linear-gradient(90deg, ' + soft.join(', ') + ')');
        el.style.setProperty('--ff-combo-outline', (cols[tokens[0]] || C[tokens[0]] || '#64748b'));
        el.style.setProperty('--ff-combo-text', (cols[tokens[0]] || C[tokens[0]] || '#111827'));
        el.style.setProperty('--ff-combo-badge-border', 'color-mix(in oklab, ' + (cols[tokens[0]] || C[tokens[0]] || '#64748b') + ' 35%, transparent)');
        el.style.setProperty('--ff-combo-badge-gradient', 'linear-gradient(90deg, ' + soft.join(', ') + ')');
      }

      function routeTokensForPath(path) {
        var out = [];
        var seen = new Set();
        for (var rp in RF) {
          if (!Object.prototype.hasOwnProperty.call(RF, rp)) continue;
          var cnd = pfx(rp);
          if (!(path === cnd || path.indexOf(cnd) === 0)) continue;
          var fns = RF[rp] || [];
          for (var i = 0; i < fns.length; i++) {
            var tk = F2T[fns[i]];
            if (tk && !seen.has(tk)) {
              seen.add(tk);
              out.push(tk);
            }
          }
        }
        return out;
      }

      function routeLabelFor(path, toks) {
        if (!toks.length) return '';
        var byFlag = {};
        for (var rp in RF) {
          if (!Object.prototype.hasOwnProperty.call(RF, rp)) continue;
          var cnd = pfx(rp);
          if (!(path === cnd || path.indexOf(cnd) === 0)) continue;
          var fns = RF[rp] || [];
          for (var i = 0; i < fns.length; i++) {
            var fn = fns[i];
            var tk = F2T[fn];
            if (!tk) continue;
            if (!byFlag[tk]) byFlag[tk] = [];
            byFlag[tk].push(rp);
          }
        }
        var parts = [];
        for (var j = 0; j < toks.length; j++) {
          var tk = toks[j];
          var rs = byFlag[tk] || [];
          parts.push(tk + ' - ' + (rs.length ? rs.join(', ') : 'matched'));
        }
        return 'Page: ' + parts.join(' | ');
      }

      function affSyncRouteChrome(path) {
        if (!document.body) return;
        var root = document.documentElement;
        var toks = routeTokensForPath(path);
        if (!toks.length) {
          var oldF = document.getElementById('aff-route-frame');
          if (oldF) oldF.remove();
          var oldB = document.getElementById('aff-route-badge');
          if (oldB) oldB.remove();
          root.removeAttribute('data-ff-route');
          root.removeAttribute('data-ff-route-label');
          return;
        }
        root.setAttribute('data-ff-route', toks.join(' '));
        root.setAttribute('data-ff-route-label', routeLabelFor(path, toks));

        var frame = document.getElementById('aff-route-frame');
        if (!frame) {
          frame = document.createElement('div');
          frame.id = 'aff-route-frame';
          frame.className = 'aff-route-frame';
          frame.setAttribute('aria-hidden', 'true');
          document.body.appendChild(frame);
        }

        var badge = document.getElementById('aff-route-badge');
        if (!badge) {
          badge = document.createElement('div');
          badge.id = 'aff-route-badge';
          badge.className = 'aff-route-badge';
          badge.setAttribute('role', 'status');
          document.body.appendChild(badge);
        }
        badge.textContent = root.getAttribute('data-ff-route-label') || '';
        badge.setAttribute('aria-label', badge.textContent || '');
      }

      try {
        window.__AFF__ = { tokens: T, colors: C, namespace: N };
        var raw = localStorage.getItem(K) || localStorage.getItem('aff.dev.v1');
        var st = raw ? JSON.parse(raw) : {};
        var o = st.outline || st.chrome || {};
        var e = st.enabled || st.render || {};
        var b = st.badge || {};
        var cols = st.colors || {};
        var r = document.documentElement;

        for (var i = 0; i < T.length; i++) {
          var t = T[i];
          var od = (OD[t] !== false);
          var bd = (BD[t] !== false);
          if ((o[t] === false) || (!od && o[t] !== true)) r.setAttribute('data-ff-outline-' + t, 'off');
          else r.removeAttribute('data-ff-outline-' + t);
          if (e[t] === false) r.setAttribute('data-ff-enabled-' + t, 'off');
          else r.removeAttribute('data-ff-enabled-' + t);
          if ((b[t] === false) || (!bd && b[t] !== true)) r.setAttribute('data-ff-badge-' + t, 'off');
          else r.removeAttribute('data-ff-badge-' + t);
          var col = cols[t] || C[t];
          var vn = '--' + N + '-c-' + t;
          if (col) r.style.setProperty(vn, col);
          else r.style.removeProperty(vn);
        }

        var applyAll = function () {
          var map = new Set();
          var base = document.querySelectorAll('[' + ('data-' + N) + ']');
          for (var bi = 0; bi < base.length; bi++) map.add(base[bi]);
          for (var ti = 0; ti < T.length; ti++) {
            var ls = document.querySelectorAll('[data-' + N + '-' + T[ti] + ']');
            for (var li = 0; li < ls.length; li++) map.add(ls[li]);
          }
          map.forEach(function (el) {
            applyCombo(el, cols, C);
          });
        };

        function affAfterNav() {
          if (!document.body) return;
          var p = window.location && window.location.pathname ? window.location.pathname : '/';
          if (!p.endsWith('/')) p += '/';
          var toks = routeTokensForPath(p);
          if (toks.length) {
            var gradsStrong = [];
            var gradsSoft = [];
            for (var gi = 0; gi < toks.length; gi++) {
              var tk = toks[gi];
              var c = cols[tk] || C[tk] || '#94a3b8';
              gradsStrong.push(c);
              gradsSoft.push('color-mix(in oklab, white 86%, ' + c + ' 14%)');
            }
            r.style.setProperty('--' + N + '-route-gradient', 'linear-gradient(90deg, ' + gradsSoft.join(', ') + ')');
            r.style.setProperty('--ff-route-outline-gradient', 'linear-gradient(90deg, ' + gradsStrong.join(', ') + ')');
            r.style.setProperty('--ff-route-badge-gradient', 'linear-gradient(90deg, ' + gradsSoft.join(', ') + ')');
            r.style.setProperty('--ff-route-badge-border', 'color-mix(in oklab, ' + (cols[toks[0]] || C[toks[0]] || '#64748b') + ' 35%, transparent)');
            r.style.setProperty('--ff-route-outline', (cols[toks[0]] || C[toks[0]] || '#64748b'));
            r.style.setProperty('--ff-route-text', (cols[toks[0]] || C[toks[0]] || '#111827'));
          }
          applyAll();
          affSyncRouteChrome(p);
        }

        affAfterNav();
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', affAfterNav, { once: true });
        }
        document.addEventListener('astro:after-swap', affAfterNav);
      } catch (_) {}
    })();
  `);
}
