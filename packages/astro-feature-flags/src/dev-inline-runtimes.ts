type HeadInlinePayload = {
  featureFlagStyles: string;
  routeFlags: Record<string, string[]>;
  flagNameToToken: Record<string, string>;
};

type BootstrapPayload = {
  flagTokens: string[];
  colors: Record<string, string>;
  outlineDefaults: Record<string, boolean>;
  badgeDefaults: Record<string, boolean>;
  routeFlags: Record<string, string[]>;
  flagNameToToken: Record<string, string>;
  namespace: string;
};

function toPrefix(pattern: string): string {
  let p = String(pattern || "").trim();
  if (p.endsWith("/**")) p = p.slice(0, -3);
  else if (p.endsWith("/*")) p = p.slice(0, -2);
  else if (p.length > 1 && p.endsWith("*")) p = p.slice(0, -1);
  return p.endsWith("/") ? p : `${p}/`;
}

export function affHeadInlineRuntime(payload: HeadInlinePayload): void {
  try {
    const { featureFlagStyles, routeFlags: RF, flagNameToToken: M } = payload;
    const s = document.createElement("style");
    s.setAttribute("data-astro-feature-flags", "");
    s.textContent = featureFlagStyles;
    (document.head || document.documentElement).appendChild(s);

    const affPath = () => {
      let p = typeof location !== "undefined" && location.pathname ? location.pathname : "/";
      if (!p.endsWith("/")) p += "/";
      return p;
    };

    const affFlagNames = (pathname: string) => {
      let p = pathname || "/";
      if (!p.endsWith("/")) p += "/";
      const out: string[] = [];
      const seen = new Set<string>();
      for (const rp in RF) {
        if (!Object.prototype.hasOwnProperty.call(RF, rp)) continue;
        const route = toPrefix(rp);
        if (!(p === route || p.indexOf(route) === 0)) continue;
        const fns = RF[rp] || [];
        for (let i = 0; i < fns.length; i++) {
          const fn = fns[i];
          if (fn && !seen.has(fn)) {
            seen.add(fn);
            out.push(fn);
          }
        }
      }
      return out;
    };

    const affTokens = (pathname: string) =>
      affFlagNames(pathname)
        .map((name) => M[name])
        .filter(Boolean);

    const affSyncDisabledOverlay = () => {
      const root = document.documentElement;
      if (!document.body) return;
      const names = affFlagNames(affPath());
      const disabled: string[] = [];
      for (let i = 0; i < names.length; i++) {
        const tk = M[names[i]];
        if (!tk) continue;
        if (root.getAttribute(`data-ff-enabled-${tk}`) === "off") disabled.push(tk);
      }
      const id = "aff-route-disabled-overlay";
      let el = document.getElementById(id);
      if (!disabled.length) {
        if (el) el.remove();
        root.removeAttribute("data-aff-route-disabled");
        return;
      }
      root.setAttribute("data-aff-route-disabled", "");
      if (!el) {
        el = document.createElement("div");
        el.id = id;
        el.className = "aff-route-disabled-overlay";
        const p = document.createElement("p");
        el.appendChild(p);
        document.body.appendChild(el);
      }
      const pEl = el.querySelector("p") || el;
      const flagsText = disabled.join(", ");
      const line1 =
        disabled.length === 1
          ? `Page disabled: ${flagsText} flag is disabled.`
          : `Page disabled: ${flagsText} flags are disabled.`;
      const line2 =
        "In production builds, pages with disabled flags like this will not be emitted";
      pEl.textContent = `${line1}\n${line2}`;
    };

    const affApply = () => {
      document.documentElement.setAttribute("data-ff-route", affTokens(affPath()).join(" "));
      affSyncDisabledOverlay();
    };

    affApply();
    if (typeof MutationObserver === "function") {
      const obs = new MutationObserver((muts) => {
        for (let i = 0; i < muts.length; i++) {
          const a = muts[i] && muts[i].attributeName;
          if (a === "data-ff-route" || (a && a.indexOf("data-ff-enabled-") === 0)) {
            affSyncDisabledOverlay();
            break;
          }
        }
      });
      obs.observe(document.documentElement, { attributes: true });
    }
    document.addEventListener("astro:page-load", affApply);
    document.addEventListener("astro:after-swap", affApply);
  } catch {
    // no-op in injected runtime
  }
}

export function affDevBootstrapRuntime(payload: BootstrapPayload): void {
  const T = payload.flagTokens;
  const C = payload.colors;
  const OD = payload.outlineDefaults;
  const BD = payload.badgeDefaults;
  const RF = payload.routeFlags;
  const F2T = payload.flagNameToToken;
  const N = payload.namespace;
  const K = `${N}.dev.v1`;

  const root = document.documentElement;
  const isEnabled = (tk: string) => root.getAttribute(`data-ff-enabled-${tk}`) !== "off";
  const currentTokenColor = (
    tk: string,
    cols: Record<string, string>,
  ): string => {
    const cssVar = root.style.getPropertyValue(`--${N}-c-${tk}`).trim();
    return cssVar || cols[tk] || C[tk] || "#94a3b8";
  };
  const unique = (a: string[]) => [...new Set(a.filter(Boolean))];

  const comboTokens = (el: Element): string[] => {
    let out: string[] = [];
    const raw = (el.getAttribute(`data-${N}`) || "").trim();
    if (raw) out = out.concat(raw.split(/\s+/).filter(Boolean));
    for (let i = 0; i < T.length; i++) {
      const tk = T[i];
      if (el.hasAttribute(`data-${N}-${tk}`)) out.push(tk);
    }
    return unique(out);
  };

  const applyCombo = (el: Element, cols: Record<string, string>) => {
    const allTokens = comboTokens(el);
    const visual = allTokens.filter((tk) => isEnabled(tk));
    if (visual.length < 2) {
      el.removeAttribute("data-ff-label");
      el.style.removeProperty("--ff-combo-gradient");
      el.style.removeProperty("--ff-combo-gradient-soft");
      el.style.removeProperty("--ff-combo-outline");
      el.style.removeProperty("--ff-combo-text");
      el.style.removeProperty("--ff-combo-badge-border");
      el.style.removeProperty("--ff-combo-badge-gradient");
      if (visual.length === 1) {
        el.setAttribute(`data-${N}`, visual[0]!);
      }
      return;
    }
    // Mirror all enabled tokens into the primary namespace attribute so `[data-<ns>*=" "]`
    // matches (required for boolean-only combos like data-ff-a + data-ff-b).
    el.setAttribute(`data-${N}`, visual.join(" "));
    el.setAttribute("data-ff-label", visual.join(" | "));
    const strong = visual.map((tk) => currentTokenColor(tk, cols));
    const soft = strong.map((c) => `color-mix(in oklab, white 86%, ${c} 14%)`);
    el.style.setProperty("--ff-combo-gradient", `linear-gradient(90deg, ${strong.join(", ")})`);
    el.style.setProperty("--ff-combo-gradient-soft", `linear-gradient(90deg, ${soft.join(", ")})`);
    el.style.setProperty("--ff-combo-outline", strong[0] || "#64748b");
    el.style.setProperty("--ff-combo-text", strong[0] || "#111827");
    el.style.setProperty(
      "--ff-combo-badge-border",
      `color-mix(in oklab, ${strong[0] || "#64748b"} 35%, transparent)`,
    );
    el.style.setProperty("--ff-combo-badge-gradient", `linear-gradient(90deg, ${soft.join(", ")})`);
  };

  const routeTokensForPath = (path: string): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const rp in RF) {
      if (!Object.prototype.hasOwnProperty.call(RF, rp)) continue;
      const cnd = toPrefix(rp);
      if (!(path === cnd || path.indexOf(cnd) === 0)) continue;
      const fns = RF[rp] || [];
      for (let i = 0; i < fns.length; i++) {
        const tk = F2T[fns[i]];
        if (tk && !seen.has(tk)) {
          seen.add(tk);
          out.push(tk);
        }
      }
    }
    return out;
  };

  const routeLabelFor = (path: string, toks: string[]): string => {
    if (!toks.length) return "";
    const byFlag: Record<string, string[]> = {};
    for (const rp in RF) {
      if (!Object.prototype.hasOwnProperty.call(RF, rp)) continue;
      const cnd = toPrefix(rp);
      if (!(path === cnd || path.indexOf(cnd) === 0)) continue;
      const fns = RF[rp] || [];
      for (let i = 0; i < fns.length; i++) {
        const tk = F2T[fns[i]];
        if (!tk) continue;
        if (!byFlag[tk]) byFlag[tk] = [];
        byFlag[tk].push(rp);
      }
    }
    return `Page: ${toks
      .map((tk) => `${tk} - ${(byFlag[tk] || []).join(", ") || "matched"}`)
      .join(" | ")}`;
  };

  const affSyncRouteChrome = (path: string) => {
    if (!document.body) return;
    // Keep every matched route token on <html> so per-token toolbar rules
    // (`[data-ff-route~="tk"]`) still apply; gradients use enabled-only below.
    const routeAll = routeTokensForPath(path);
    if (!routeAll.length) {
      document.getElementById("aff-route-frame")?.remove();
      document.getElementById("aff-route-badge")?.remove();
      root.removeAttribute("data-ff-route");
      root.removeAttribute("data-ff-route-label");
      return;
    }
    root.setAttribute("data-ff-route", routeAll.join(" "));
    root.setAttribute("data-ff-route-label", routeLabelFor(path, routeAll));
    if (!document.getElementById("aff-route-frame")) {
      const frame = document.createElement("div");
      frame.id = "aff-route-frame";
      frame.className = "aff-route-frame";
      frame.setAttribute("aria-hidden", "true");
      document.body.appendChild(frame);
    }
    let badge = document.getElementById("aff-route-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "aff-route-badge";
      badge.className = "aff-route-badge";
      badge.setAttribute("role", "status");
      document.body.appendChild(badge);
    }
    badge.textContent = root.getAttribute("data-ff-route-label") || "";
    badge.setAttribute("aria-label", badge.textContent || "");
  };

  try {
    (window as Window & { __AFF__?: unknown }).__AFF__ = {
      tokens: T,
      colors: C,
      namespace: N,
    };
    const raw = localStorage.getItem(K) || localStorage.getItem("aff.dev.v1");
    const st = raw ? JSON.parse(raw) : {};
    const o = st.outline || st.chrome || {};
    const e = st.enabled || st.render || {};
    const b = st.badge || {};
    const cols = st.colors || {};

    for (let i = 0; i < T.length; i++) {
      const t = T[i];
      const od = OD[t] !== false;
      const bd = BD[t] !== false;
      if (o[t] === false || (!od && o[t] !== true))
        root.setAttribute(`data-ff-outline-${t}`, "off");
      else root.removeAttribute(`data-ff-outline-${t}`);
      if (e[t] === false) root.setAttribute(`data-ff-enabled-${t}`, "off");
      else root.removeAttribute(`data-ff-enabled-${t}`);
      if (b[t] === false || (!bd && b[t] !== true))
        root.setAttribute(`data-ff-badge-${t}`, "off");
      else root.removeAttribute(`data-ff-badge-${t}`);
      const col = cols[t] || C[t];
      const vn = `--${N}-c-${t}`;
      if (col) root.style.setProperty(vn, col);
      else root.style.removeProperty(vn);
    }

    const applyAll = () => {
      const map = new Set<Element>();
      document.querySelectorAll(`[data-${N}]`).forEach((el) => map.add(el));
      for (let i = 0; i < T.length; i++) {
        document.querySelectorAll(`[data-${N}-${T[i]}]`).forEach((el) => map.add(el));
      }
      map.forEach((el) => applyCombo(el, cols));
    };

    const affAfterNav = () => {
      if (!document.body) return;
      let p = window.location?.pathname || "/";
      if (!p.endsWith("/")) p += "/";
      const toks = routeTokensForPath(p).filter((tk) => isEnabled(tk));
      if (toks.length) {
        const strong = toks.map((tk) => currentTokenColor(tk, cols));
        const soft = strong.map((c) => `color-mix(in oklab, white 86%, ${c} 14%)`);
        root.style.setProperty(`--${N}-route-gradient`, `linear-gradient(90deg, ${soft.join(", ")})`);
        root.style.setProperty("--ff-route-outline-gradient", `linear-gradient(90deg, ${strong.join(", ")})`);
        root.style.setProperty("--ff-route-badge-gradient", `linear-gradient(90deg, ${soft.join(", ")})`);
        root.style.setProperty(
          "--ff-route-badge-border",
          `color-mix(in oklab, ${strong[0] || "#64748b"} 35%, transparent)`,
        );
        root.style.setProperty("--ff-route-outline", strong[0] || "#64748b");
        root.style.setProperty("--ff-route-text", strong[0] || "#111827");
      } else {
        root.style.removeProperty(`--${N}-route-gradient`);
        root.style.removeProperty("--ff-route-outline-gradient");
        root.style.removeProperty("--ff-route-badge-gradient");
        root.style.removeProperty("--ff-route-badge-border");
        root.style.removeProperty("--ff-route-outline");
        root.style.removeProperty("--ff-route-text");
      }
      applyAll();
      affSyncRouteChrome(p);
    };

    affAfterNav();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", affAfterNav, { once: true });
    }
    document.addEventListener("astro:page-load", affAfterNav);
    document.addEventListener("astro:after-swap", affAfterNav);
    if (typeof MutationObserver === "function") {
      const obs = new MutationObserver((muts) => {
        for (let i = 0; i < muts.length; i++) {
          const a = muts[i]?.attributeName;
          if (!a) continue;
          if (
            a === "style" ||
            a.indexOf("data-ff-enabled-") === 0 ||
            a.indexOf("data-ff-outline-") === 0 ||
            a.indexOf("data-ff-badge-") === 0
          ) {
            affAfterNav();
            break;
          }
        }
      });
      obs.observe(root, { attributes: true });
    }
  } catch {
    // no-op in injected runtime
  }
}
