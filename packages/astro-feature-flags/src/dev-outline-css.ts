import {
  elementBadgePositionBlock,
  normalizeElementBadgeLayout,
} from "./badge-layout";
import type { ElementBadgeLayoutOptions } from "./badge-layout";
import { inlineInvoke } from "./inline-script";
import { affDevBootstrapRuntime } from "./dev-inline-runtimes";
import type { ResolvedFeatureRuntime } from "./runtime";
import { toToken } from "./runtime";

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
    const selOutline = baseSelectors
      .map((s) => `${s}:not([${nsAttr}*=" "])`)
      .join(", ");
    const selIs = `:is(${baseSelectors.join(", ")})`;
    /** Combo hosts use `[${nsAttr}*=" "]` + `data-ff-label`; skip per-token ::before so combo rules win. */
    const selIsSingleBadge = `${selIs}:not([${nsAttr}*=" "])`;
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
${selOutline} {
  position: relative;
  outline: ${opts.outlineWidth} solid var(--aff-outline-c-${token});
  outline-offset: ${opts.outlineOffset};
  border-radius: ${opts.borderRadius};
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}::before {
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
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}:hover::before {
  opacity: 0.16;
  background: color-mix(in oklab, white 94%, var(${v}, ${col}) 6%);
  border-color: color-mix(in oklab, var(${v}, ${col}) 35%, transparent);
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}[data-ff-align="start"]::before {
  left: 0.35rem;
  right: auto;
  transform: translateY(calc(-1 * 80%));
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}[data-ff-align="center"]::before {
  left: 50%;
  right: auto;
  transform: translate(-50%, calc(-1 * 80%));
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}[data-ff-align="end"]::before {
  left: auto;
  right: 0.35rem;
  transform: translateY(calc(-1 * 80%));
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}[data-ff-horizontal]::before {
  left: calc(attr(data-ff-horizontal number, 50) * 1%);
  right: auto;
  transform: translate(-50%, calc(-1 * 80%));
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}[data-ff-horizontal][data-ff-anchor="bottom"]::before {
  transform: translate(-50%, 80%);
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}[data-ff-anchor="bottom"]::before {
  top: auto;
  bottom: 0;
  transform: translateY(80%);
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}[data-ff-anchor="bottom"][data-ff-align="center"]::before {
  transform: translate(-50%, 80%);
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}[data-ff-vertical]::before {
  transform: translateY(calc(attr(data-ff-vertical number, 80) * -1%));
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}[data-ff-horizontal][data-ff-vertical]::before {
  transform: translate(-50%, calc(attr(data-ff-vertical number, 80) * -1%));
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}[data-ff-anchor="bottom"][data-ff-vertical]::before {
  transform: translateY(calc(attr(data-ff-vertical number, 80) * 1%));
}
html:not([data-ff-badge-${token}="off"]) ${selIsSingleBadge}[data-ff-anchor="bottom"][data-ff-horizontal][data-ff-vertical]::before {
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
  position: relative;
  outline: none !important;
  outline-offset: 0 !important;
  border-radius: ${opts.borderRadius};
}
html [${nsAttr}*=" "]::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: inherit;
  pointer-events: none;
  z-index: 10;
  box-sizing: border-box;
  padding: ${opts.outlineWidth};
  background: var(--ff-combo-gradient, linear-gradient(90deg, #fecaca, #bfdbfe, #bbf7d0));
  -webkit-mask:
    linear-gradient(#000 0 0) content-box,
    linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
}
html [${nsAttr}*=" "]::before {
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
  content: attr(${nsAttr});
  background: var(--ff-combo-badge-gradient, var(--ff-combo-gradient-soft, linear-gradient(90deg, #fff1f2, #eff6ff, #f0fdf4))) !important;
  color: var(--ff-combo-text, #111827) !important;
  border: 1px solid var(--ff-combo-badge-border, color-mix(in oklab, #94a3b8 50%, transparent)) !important;
  border-radius: 9999px;
  padding: 0.125rem 0.45rem;
  font-size: 0.625rem;
  line-height: 1.2;
  letter-spacing: 0.02em;
  font-weight: 600;
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
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
`);

  // Combo chrome must be suppressed *after* generic combo rules so `!important` / order cannot be
  // overridden by `html [...][data-ff-label]::before { content: ... !important }`.
  for (const flag of Object.keys(runtime.flags)) {
    const token = toToken(flag);
    const valueSelectors = [`[${nsAttr}~="${token}"]`];
    if (flag !== token) valueSelectors.push(`[${nsAttr}~="${flag}"]`);
    const baseSelectors = [...valueSelectors, `[${nsAttr}-${token}]`];
    const selIs = `:is(${baseSelectors.join(", ")})`;
    chunks.push(`
html[data-ff-badge-${token}="off"] ${selIs}[${nsAttr}*=" "]::before,
html[data-ff-badge-${token}="off"] ${selIs}[${nsAttr}*=" "][data-ff-label]::before {
  display: none !important;
  content: none !important;
}
html[data-ff-badge-${token}="off"] ${selIs}[${nsAttr}*=" "]:hover::before,
html[data-ff-badge-${token}="off"] ${selIs}[${nsAttr}*=" "][data-ff-label]:hover::before {
  display: none !important;
  opacity: 1 !important;
  background: none !important;
  border-color: transparent !important;
}
html[data-ff-outline-${token}="off"] ${selIs}[${nsAttr}*=" "] {
  outline: none !important;
  outline-offset: 0 !important;
}
html[data-ff-outline-${token}="off"] ${selIs}[${nsAttr}*=" "]::after {
  display: none !important;
}
`);
  }

  chunks.push(`
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
[data-ff-route~="${token}"][data-ff-enabled-${token}="off"] #aff-route-frame {
  display: none !important;
}
[data-ff-route~="${token}"][data-ff-enabled-${token}="off"] #aff-route-badge {
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
  return inlineInvoke(affDevBootstrapRuntime, {
    flagTokens,
    colors,
    outlineDefaults,
    badgeDefaults,
    routeFlags,
    flagNameToToken,
    namespace: toToken(namespace) || "ff",
  });
}
