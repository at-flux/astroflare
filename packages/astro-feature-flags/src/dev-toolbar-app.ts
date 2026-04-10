import type { DevToolbarApp } from "astro";
import { defineToolbarApp } from "astro/toolbar";
import {
  closeOnOutsideClick,
  createWindowElement,
  synchronizePlacementOnUpdate,
} from "astro/runtime/client/dev-toolbar/apps/utils/window.js";
import { DEV_TOOLBAR_FLAG_ICON_SVG } from "./dev-toolbar-flag-icon";

declare global {
  interface Window {
    __AFF__?: {
      tokens: string[];
      colors?: Record<string, string>;
      namespace?: string;
    };
  }
}

type AffState = {
  enabled: Record<string, boolean>;
  outline: Record<string, boolean>;
  badge: Record<string, boolean>;
  colors: Record<string, string>;
};

function toHexColor(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  const s = raw.trim();
  const hex7 = s.match(/^#([0-9a-fA-F]{6})$/);
  if (hex7) return `#${hex7[1]!.toLowerCase()}`;
  const rgb = s.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  if (rgb) {
    const r = Math.min(255, Math.round(Number(rgb[1])));
    const g = Math.min(255, Math.round(Number(rgb[2])));
    const b = Math.min(255, Math.round(Number(rgb[3])));
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
  }
  return fallback;
}

function readMeta(): {
  tokens: string[];
  colors: Record<string, string>;
  namespace: string;
} {
  try {
    const raw = window.__AFF__;
    const tokens = raw && Array.isArray(raw.tokens) ? raw.tokens : [];
    const colors =
      raw?.colors && typeof raw.colors === "object" ? raw.colors : {};
    const namespace = raw?.namespace?.trim() ? raw.namespace.trim() : "ff";
    return { tokens, colors, namespace };
  } catch {
    return { tokens: [], colors: {}, namespace: "ff" };
  }
}

function storageKey(namespace: string): string {
  return `${namespace}.dev.v1`;
}

function loadState(tokens: string[], namespace: string): AffState {
  const next: AffState = {
    enabled: {},
    outline: {},
    badge: {},
    colors: {},
  };
  for (const t of tokens) {
    next.enabled[t] = true;
    next.outline[t] = true;
    next.badge[t] = true;
  }
  try {
    const raw =
      localStorage.getItem(storageKey(namespace)) ||
      localStorage.getItem("aff.dev.v1");
    if (!raw) return next;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const outline = (parsed.outline ?? parsed.chrome) as
      | Record<string, boolean>
      | undefined;
    const enabled = (parsed.enabled ?? parsed.render) as
      | Record<string, boolean>
      | undefined;
    const badge = parsed.badge as Record<string, boolean> | undefined;
    const colors = parsed.colors as Record<string, string> | undefined;
    if (outline) Object.assign(next.outline, outline);
    if (enabled) Object.assign(next.enabled, enabled);
    if (badge) Object.assign(next.badge, badge);
    if (colors) Object.assign(next.colors, colors);
  } catch {
    /* ignore */
  }
  return next;
}

function persist(state: AffState, namespace: string) {
  try {
    localStorage.setItem(storageKey(namespace), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function applyDom(
  tokens: string[],
  state: AffState,
  defaults: Record<string, string>,
  namespace: string,
) {
  const root = document.documentElement;
  for (const t of tokens) {
    if (state.outline[t] !== false)
      root.removeAttribute(`data-ff-outline-${t}`);
    else root.setAttribute(`data-ff-outline-${t}`, "off");

    if (state.enabled[t] !== false)
      root.removeAttribute(`data-ff-enabled-${t}`);
    else root.setAttribute(`data-ff-enabled-${t}`, "off");

    if (state.badge[t] !== false) root.removeAttribute(`data-ff-badge-${t}`);
    else root.setAttribute(`data-ff-badge-${t}`, "off");

    const col = state.colors[t] ?? defaults[t];
    if (col) root.style.setProperty(`--${namespace}-c-${t}`, col);
    else root.style.removeProperty(`--${namespace}-c-${t}`);
  }
}

const affDevToolbarApp: DevToolbarApp = defineToolbarApp({
  init(canvas, eventTarget) {
    let state = loadState([], "ff");
    let tokens: string[] = [];
    let namespace = "ff";

    function mount() {
      canvas.querySelector("astro-dev-toolbar-window")?.remove();
      const {
        tokens: nextTokens,
        colors: defaultColors,
        namespace: ns,
      } = readMeta();
      tokens = nextTokens;
      namespace = ns;
      state = loadState(tokens, namespace);
      applyDom(tokens, state, defaultColors, namespace);

      const windowElement = createWindowElement(`
				<style>
					:host astro-dev-toolbar-window {
						height: min(520px, 78vh);
						overflow-y: auto;
						color-scheme: dark;
						--color-muted: rgba(191, 193, 201, 1);
						--color-purple: rgba(224, 204, 250, 1);
					}
					header {
						display: flex;
						align-items: center;
						justify-content: space-between;
						gap: 12px;
					}
					h1 {
						display: flex;
						align-items: center;
						gap: 8px;
						font-weight: 600;
						color: #fff;
						margin: 0;
						font-size: 22px;
					}
					.aff-flag-toolbar-icon {
						display: inline-flex;
						width: 1em;
						height: 1em;
						flex-shrink: 0;
						align-items: center;
						justify-content: center;
					}
					.aff-flag-toolbar-icon svg {
						width: 100%;
						height: 100%;
						display: block;
					}
					.aff-intro {
						margin: 0;
						font-size: 14px;
						line-height: 1.5rem;
						color: var(--color-muted);
            margin-bottom: 1rem;
					}
					.aff-top {
						display: flex;
						align-items: flex-start;
						justify-content: space-between;
						gap: 12px;
						margin: 1rem 0;
					}
					.aff-top-left {
						flex: 1;
						min-width: 0;
					}
					.aff-help {
						display: grid;
						grid-template-columns: minmax(7.5rem, auto) 1fr;
						gap: 0.45rem 0.75rem;
					}
					.aff-help code,
					.aff-help span {
						font-size: 12px;
						line-height: 1.35;
					}
					.aff-help code {
						justify-self: start;
					}
					.aff-actions {
						display: flex;
						justify-content: flex-end;
						margin: 0;
						flex-shrink: 0;
					}
					.aff-reset {
						border: 1px solid #343841;
						border-radius: 0.5rem;
						background: #24262d;
						color: #fff;
						padding: 0.3rem 0.55rem;
						font-size: 12px;
						cursor: pointer;
					}
					hr {
						border: 1px solid rgba(27, 30, 36, 1);
						margin: 1em 0;
					}
					.setting-row {
						display: flex;
						justify-content: space-between;
						align-items: center;
						gap: 12px;
						margin: 0 0 8px;
					}
					.setting-row section { flex: 1; min-width: 0; max-width: 54%; }
					h3.aff-row-title {
						font-size: 12px;
						font-weight: 600;
						color: #fff;
						letter-spacing: 0.05em;
						text-transform: uppercase;
						margin: 0;
					}
					.aff-radios {
						display: flex;
						gap: 8px;
						align-items: center;
						flex-shrink: 0;
					}
					.aff-radios label {
						display: inline-flex;
						align-items: center;
						gap: 4px;
						font-size: 11px;
						cursor: pointer;
						color: var(--color-muted);
						letter-spacing: 0.04em;
						text-transform: uppercase;
					}
					.aff-radios input { accent-color: var(--color-purple); cursor: pointer; }
					.aff-flag {
						margin: 0 0 12px;
						border: 1px solid rgba(52, 56, 65, 1);
						border-radius: 10px;
						padding: 0 10px 10px;
						background: rgba(19, 21, 26, 0.55);
					}
					.aff-flag summary {
						list-style: none;
						cursor: pointer;
						user-select: none;
						display: flex;
						align-items: center;
						gap: 8px;
						padding: 10px 0;
						font-weight: 600;
						font-size: 11px;
						letter-spacing: 0.06em;
						text-transform: uppercase;
						color: #fff;
						justify-content: space-between;
					}
					.aff-flag summary::-webkit-details-marker { display: none; }
					.aff-flag summary::after {
						content: '▸';
						display: inline-flex;
						align-items: center;
						justify-content: center;
						margin-left: auto;
						color: var(--color-muted);
						font-size: 12px;
						transform: rotate(0deg);
						transition: transform 0.12s ease;
					}
					.aff-flag[open] summary::after {
						transform: rotate(90deg);
					}
					.aff-flag-summary-left {
						display: inline-flex;
						align-items: center;
						gap: 8px;
					}
					.aff-swatch {
						width: 10px;
						height: 10px;
						border-radius: 9999px;
						flex-shrink: 0;
						box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12);
					}
					.aff-flag-body { padding-top: 2px; }
					.aff-empty {
						margin: 0;
						font-size: 14px;
						line-height: 1.5rem;
						color: var(--color-muted);
					}
					code {
						color: var(--color-purple);
						border: 1px solid #343841;
						border-radius: 0.35em;
						background-color: #24262d;
						padding: 0.15em 0.35em;
						font-size: 0.9em;
					}
					input[type="color"].aff-color {
						width: 2.25rem;
						height: 1.75rem;
						padding: 0;
						border: 1px solid #343841;
						border-radius: 6px;
						cursor: pointer;
						background: transparent;
					}
				</style>
				<header>
					<h1><span class="aff-flag-toolbar-icon">${DEV_TOOLBAR_FLAG_ICON_SVG}</span> Feature flags</h1>
					<div class="aff-actions"><button id="aff-reset" class="aff-reset" type="button" title="Reset all flags to defaults">Reset all</button></div>
				</header>
				<div class="aff-top">
					<div class="aff-top-left">
						<p class="aff-intro">Per-flag preview for <code>data-${namespace}</code> regions.</p>
				<div class="aff-help">
					<code>Enabled</code><span>Show/hide flagged regions in preview.</span>
					<code>Outline</code><span>Toggle flag outlines without changing layout.</span>
					<code>Badges</code><span>Toggle element and route labels.</span>
					<code>Colour</code><span>Set <code>--${namespace}-c-&lt;token&gt;</code> on <code>&lt;html&gt;</code>.</span>
						</div>
					</div>
				</div>
				<hr />
				<div id="aff-body"></div>
			`);

      const body = windowElement.querySelector("#aff-body");
      const resetBtn = windowElement.querySelector(
        "#aff-reset",
      ) as HTMLButtonElement | null;

      if (body) {
        if (tokens.length === 0) {
          const p = document.createElement("p");
          p.className = "aff-empty";
          p.textContent = "No flags in ff.json.";
          body.append(p);
        } else {
          for (const token of tokens) {
            const details = document.createElement("details");
            details.className = "aff-flag";
            details.open = tokens.length <= 8;

            const summary = document.createElement("summary");
            const summaryLeft = document.createElement("span");
            summaryLeft.className = "aff-flag-summary-left";
            const swatch = document.createElement("span");
            swatch.className = "aff-swatch";
            const name = document.createElement("span");
            name.textContent = token;
            summaryLeft.append(swatch, name);
            summary.append(summaryLeft);

            const syncSwatch = () => {
              const c =
                state.colors[token] ?? defaultColors[token] ?? "#888888";
              swatch.style.background = c;
            };
            syncSwatch();

            const inner = document.createElement("div");
            inner.className = "aff-flag-body";

            const row = (
              title: string,
              tooltip: string,
              key: keyof Pick<AffState, "enabled" | "outline" | "badge">,
              onLab: string,
              offLab: string,
            ) => {
              const label = document.createElement("label");
              label.className = "setting-row";
              const section = document.createElement("section");
              const h = document.createElement("h3");
              h.className = "aff-row-title";
              h.textContent = title;
              section.append(h);
              const radios = document.createElement("div");
              radios.className = "aff-radios";
              const mk = (on: boolean, lab: string) => {
                const wrap = document.createElement("label");
                const inp = document.createElement("input");
                inp.type = "radio";
                inp.name = `aff-${token}-${key}`;
                const cur = state[key][token] !== false;
                inp.checked = on ? cur : !cur;
                inp.addEventListener("change", () => {
                  if (!inp.checked) return;
                  state[key][token] = on;
                  applyDom(tokens, state, defaultColors, namespace);
                  persist(state, namespace);
                });
                wrap.append(inp, document.createTextNode(lab));
                return wrap;
              };
              radios.append(mk(true, onLab), mk(false, offLab));
              label.append(section, radios);
              return label;
            };

            inner.append(
              row(
                "Enabled",
                "When off, nodes with this flag token are hidden in preview.",
                "enabled",
                "On",
                "Off",
              ),
              row(
                "Outline",
                "Toggles dashed outline around flagged elements.",
                "outline",
                "On",
                "Off",
              ),
              row(
                "Badges",
                "Toggles element badges and top-right route pill.",
                "badge",
                "On",
                "Off",
              ),
            );

            const colorRow = document.createElement("label");
            colorRow.className = "setting-row";
            const csection = document.createElement("section");
            const ch = document.createElement("h3");
            ch.className = "aff-row-title";
            ch.textContent = "Colour";
            ch.title = `Maps to CSS --${namespace}-c-<token> on <html>.`;
            csection.append(ch);
            const cinp = document.createElement("input");
            cinp.type = "color";
            cinp.className = "aff-color";
            cinp.title = `Set --${namespace}-c-${token}`;
            cinp.value = toHexColor(
              state.colors[token] ?? defaultColors[token],
              "#888888",
            );
            cinp.addEventListener("input", () => {
              state.colors[token] = cinp.value;
              syncSwatch();
              applyDom(tokens, state, defaultColors, namespace);
              persist(state, namespace);
            });
            colorRow.append(csection, cinp);
            inner.append(colorRow);

            details.append(summary, inner);
            body.append(details);
          }
        }
      }

      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          try {
            localStorage.removeItem(storageKey(namespace));
            localStorage.removeItem("aff.dev.v1");
          } catch {
            // ignore
          }
          state = loadState(tokens, namespace);
          applyDom(tokens, state, defaultColors, namespace);
          mount();
        });
      }

      canvas.append(windowElement);
    }

    mount();
    document.addEventListener("astro:after-swap", mount);
    closeOnOutsideClick(eventTarget);
    synchronizePlacementOnUpdate(eventTarget, canvas);
  },
});

export default affDevToolbarApp;
