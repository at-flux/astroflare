import type { DevToolbarApp } from 'astro';
import { defineToolbarApp } from 'astro/toolbar';
import {
  closeOnOutsideClick,
  createWindowElement,
  synchronizePlacementOnUpdate,
} from 'astro/runtime/client/dev-toolbar/apps/utils/window.js';
import { DEV_TOOLBAR_FLAG_ICON_SVG } from './dev-toolbar-flag-icon';

declare global {
  interface Window {
    __AFF__?: { tokens: string[]; colors?: Record<string, string> };
  }
}

const STORAGE_KEY = 'aff.dev.v1';

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
  const rgb = s.match(
    /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/
  );
  if (rgb) {
    const r = Math.min(255, Math.round(Number(rgb[1])));
    const g = Math.min(255, Math.round(Number(rgb[2])));
    const b = Math.min(255, Math.round(Number(rgb[3])));
    return `#${[r, g, b].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
  }
  return fallback;
}

function readMeta(): { tokens: string[]; colors: Record<string, string> } {
  try {
    const raw = window.__AFF__;
    const tokens = raw && Array.isArray(raw.tokens) ? raw.tokens : [];
    const colors = raw?.colors && typeof raw.colors === 'object' ? raw.colors : {};
    return { tokens, colors };
  } catch {
    return { tokens: [], colors: {} };
  }
}

function loadState(tokens: string[]): AffState {
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
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return next;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const outline = (parsed.outline ?? parsed.chrome) as Record<string, boolean> | undefined;
    const enabled = (parsed.enabled ?? parsed.render) as Record<string, boolean> | undefined;
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

function persist(state: AffState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

function applyDom(tokens: string[], state: AffState, defaults: Record<string, string>) {
  const root = document.documentElement;
  for (const t of tokens) {
    if (state.outline[t] !== false) root.removeAttribute(`data-ff-outline-${t}`);
    else root.setAttribute(`data-ff-outline-${t}`, 'off');

    if (state.enabled[t] !== false) root.removeAttribute(`data-ff-enabled-${t}`);
    else root.setAttribute(`data-ff-enabled-${t}`, 'off');

    if (state.badge[t] !== false) root.removeAttribute(`data-ff-badge-${t}`);
    else root.setAttribute(`data-ff-badge-${t}`, 'off');

    const col = state.colors[t] ?? defaults[t];
    if (col) root.style.setProperty(`--aff-c-${t}`, col);
    else root.style.removeProperty(`--aff-c-${t}`);
  }
}

const affDevToolbarApp: DevToolbarApp = defineToolbarApp({
  init(canvas, eventTarget) {
    let state = loadState([]);
    let tokens: string[] = [];

    function mount() {
      canvas.querySelector('astro-dev-toolbar-window')?.remove();
      const { tokens: nextTokens, colors: defaultColors } = readMeta();
      tokens = nextTokens;
      state = loadState(tokens);
      applyDom(tokens, state, defaultColors);

      const windowElement = createWindowElement(`
				<style>
					:host astro-dev-toolbar-window {
						height: min(520px, 78vh);
						overflow-y: auto;
						color-scheme: dark;
						--color-muted: rgba(191, 193, 201, 1);
						--color-purple: rgba(224, 204, 250, 1);
					}
					header { display: flex; }
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
						margin: 0 0 1rem;
						font-size: 14px;
						line-height: 1.5rem;
						color: var(--color-muted);
					}
					hr {
						border: 1px solid rgba(27, 30, 36, 1);
						margin: 1em 0;
					}
					.setting-row {
						display: flex;
						justify-content: space-between;
						align-items: flex-start;
						gap: 12px;
						margin: 0 0 12px;
					}
					.setting-row section { flex: 1; min-width: 0; max-width: 64%; }
					h3 {
						font-size: 16px;
						font-weight: 400;
						color: #fff;
						margin: 0 0 4px;
					}
					.aff-desc {
						margin: 0;
						font-size: 14px;
						line-height: 1.5rem;
						color: var(--color-muted);
					}
					.aff-radios {
						display: flex;
						flex-wrap: wrap;
						gap: 8px 14px;
						align-items: center;
						flex-shrink: 0;
					}
					.aff-radios label {
						display: inline-flex;
						align-items: center;
						gap: 6px;
						font-size: 14px;
						line-height: 1.5rem;
						cursor: pointer;
						color: var(--color-muted);
					}
					.aff-radios input { accent-color: var(--color-purple); cursor: pointer; }
					.aff-flag {
						margin: 0 0 12px;
						border: 1px solid rgba(52, 56, 65, 1);
						border-radius: 10px;
						padding: 0 12px 12px;
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
					}
					.aff-flag summary::-webkit-details-marker { display: none; }
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
				</header>
				<p class="aff-intro">
					Per-flag preview for <code>data-ff</code> regions. Values persist in <code>localStorage</code> (<code>aff.dev.v1</code>).
				</p>
				<hr />
				<div id="aff-body"></div>
			`);

      const body = windowElement.querySelector('#aff-body');

      if (body) {
        if (tokens.length === 0) {
          const p = document.createElement('p');
          p.className = 'aff-empty';
          p.textContent = 'No flags in ff.json.';
          body.append(p);
        } else {
          for (const token of tokens) {
            const details = document.createElement('details');
            details.className = 'aff-flag';
            details.open = tokens.length <= 8;

            const summary = document.createElement('summary');
            const swatch = document.createElement('span');
            swatch.className = 'aff-swatch';
            const name = document.createElement('span');
            name.textContent = token;
            summary.append(swatch, name);

            const syncSwatch = () => {
              const c = state.colors[token] ?? defaultColors[token] ?? '#888888';
              swatch.style.background = c;
            };
            syncSwatch();

            const inner = document.createElement('div');
            inner.className = 'aff-flag-body';

            const row = (
              title: string,
              description: string,
              key: keyof Pick<AffState, 'enabled' | 'outline' | 'badge'>,
              onLab: string,
              offLab: string
            ) => {
              const label = document.createElement('label');
              label.className = 'setting-row';
              const section = document.createElement('section');
              const h = document.createElement('h3');
              h.textContent = title;
              const desc = document.createElement('p');
              desc.className = 'aff-desc';
              desc.textContent = description;
              section.append(h, desc);
              const radios = document.createElement('div');
              radios.className = 'aff-radios';
              const mk = (on: boolean, lab: string) => {
                const wrap = document.createElement('label');
                const inp = document.createElement('input');
                inp.type = 'radio';
                inp.name = `aff-${token}-${key}`;
                const cur = state[key][token] !== false;
                inp.checked = on ? cur : !cur;
                inp.addEventListener('change', () => {
                  if (!inp.checked) return;
                  state[key][token] = on;
                  applyDom(tokens, state, defaultColors);
                  persist(state);
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
                'Enabled',
                'When off, nodes with this token in data-ff are hidden (preview flag off).',
                'enabled',
                'On',
                'Off'
              ),
              row(
                'Outline',
                'Dashed outline around data-ff elements.',
                'outline',
                'On',
                'Off'
              ),
              row(
                'Badges',
                'Pill labels on elements and the top-right route badge.',
                'badge',
                'On',
                'Off'
              )
            );

            const colorRow = document.createElement('label');
            colorRow.className = 'setting-row';
            const csection = document.createElement('section');
            const ch = document.createElement('h3');
            ch.textContent = 'Colour';
            const cd = document.createElement('p');
            cd.className = 'aff-desc';
            cd.textContent = 'Maps to CSS --aff-c-* on <html>; saved in localStorage with the rest of the panel state.';
            csection.append(ch, cd);
            const cinp = document.createElement('input');
            cinp.type = 'color';
            cinp.className = 'aff-color';
            cinp.value = toHexColor(state.colors[token] ?? defaultColors[token], '#888888');
            cinp.addEventListener('input', () => {
              state.colors[token] = cinp.value;
              syncSwatch();
              applyDom(tokens, state, defaultColors);
              persist(state);
            });
            colorRow.append(csection, cinp);
            inner.append(colorRow);

            details.append(summary, inner);
            body.append(details);
          }
        }
      }

      canvas.append(windowElement);
    }

    mount();
    document.addEventListener('astro:after-swap', mount);
    closeOnOutsideClick(eventTarget);
    synchronizePlacementOnUpdate(eventTarget, canvas);
  },
});

export default affDevToolbarApp;
