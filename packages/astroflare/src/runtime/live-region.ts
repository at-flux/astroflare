/**
 * Client runtime for {@link ../components/LiveRegion.astro}.
 *
 * A live region turns ordinary GET navigation *inside itself* — a pager form,
 * a filter pill, a page-size `<select>`, a link — into a fetch-and-swap:
 *
 * ```text
 *   submit/click ──▶ build URL ──▶ pushState ──▶ fetch same URL
 *        │                                            │
 *        └── grace ──▶ paint fallback                 ▼
 *                            ▲            parse, take [data-af-live="id"]
 *                            │                        │
 *                    minDisplay ◀── swap content ◀────┘
 * ```
 *
 * The point is what does *not* happen: no document unload, so the scroll
 * position, the focus ring, open `<details>` outside the region and every other
 * scrap of page state survive. The query string still changes, so the URL is
 * shareable and the server stays the single source of truth for what a page
 * shows.
 *
 * ### Why the two timers
 * Same reasoning as `runtime/suspense.ts`: the fallback is not painted for the
 * first `grace` ms, so a swap that lands quickly never flashes one; once
 * painted it stays for at least `minDisplay` ms, so it cannot strobe. Content
 * is swapped in as soon as it arrives — underneath the fallback — so the reveal
 * is just the fallback lifting.
 *
 * ### Without JavaScript
 * Nothing here is required. The forms and links are real forms and links; if
 * this module never loads they navigate, which is the behaviour it replaces.
 *
 * ### Back and forward
 * Entries are pushed with `history.pushState` and read back on `popstate`.
 * When Astro's `<ClientRouter />` is on the page it already owns `popstate` and
 * swaps the whole document itself, so this module stands aside rather than
 * fetching the same URL twice.
 *
 * The DOM contract:
 * - host `<af-live-region data-af-live="id">` carries the configuration
 * - `[data-af-live-content]` is the subtree that gets replaced
 * - `[data-af-ui]` children are chrome (fallback, status) and are never swapped
 * - `[data-af-live-ignore]` on a form, link or ancestor opts it out
 */
import {
  LIVE_REGION_ATTR,
  LIVE_REGION_CONTENT_ATTR,
  LIVE_REGION_ERROR_EVENT,
  LIVE_REGION_HEADER,
  LIVE_REGION_IGNORE_ATTR,
  LIVE_REGION_SWAP_EVENT,
  LIVE_REGION_TAG,
} from "../live-region";

export {
  LIVE_REGION_ATTR,
  LIVE_REGION_CONTENT_ATTR,
  LIVE_REGION_ERROR_EVENT,
  LIVE_REGION_HEADER,
  LIVE_REGION_IGNORE_ATTR,
  LIVE_REGION_SWAP_EVENT,
  LIVE_REGION_TAG,
};

const DEFAULTS = {
  minDisplay: 220,
  graceDelay: 120,
} as const;

const registry = new Set<AfLiveRegionElement>();

/** True while the current history entry is one this module pushed. */
let ownsHistoryEntry = false;
let popStateBound = false;

const now = () =>
  typeof performance === "object" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

const toNumber = (raw: string | undefined, fallback: number) => {
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizePath = (path: string) =>
  path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;

const escapeAttr = (value: string) => value.replace(/["\\]/g, "\\$&");

/**
 * Astro's `<ClientRouter />` already intercepts `popstate` and re-renders the
 * document for the new URL. Two handlers for one event means two fetches and a
 * swap that fights a view transition, so defer to it when it is present.
 */
const clientRouterOwnsHistory = () =>
  typeof document !== "undefined" &&
  document.querySelector('meta[name="astro-view-transitions-enabled"]') !==
    null;

/**
 * A selector that finds the equivalent control after the swap, so focus lands
 * back where the reader left it instead of on `<body>`.
 */
export const focusKeyFor = (element: Element | null): string | null => {
  if (!(element instanceof HTMLElement)) return null;
  if (element.dataset.afLiveKey) {
    return `[data-af-live-key="${escapeAttr(element.dataset.afLiveKey)}"]`;
  }
  // `[id="…"]` rather than `#…`: it needs no CSS identifier escaping, so ids
  // with dots or colons in them (Tailwind-ish, framework-generated) still match.
  if (element.id) return `[id="${escapeAttr(element.id)}"]`;
  if (element.dataset.page) {
    return `[data-page="${escapeAttr(element.dataset.page)}"]`;
  }
  if (element.dataset.filter) {
    return `[data-filter="${escapeAttr(element.dataset.filter)}"]`;
  }
  const name = (element as HTMLInputElement).name;
  if (name) {
    return `${element.tagName.toLowerCase()}[name="${escapeAttr(name)}"]`;
  }
  return null;
};

/**
 * The URL a GET form would navigate to. Mirrors the browser: the form's own
 * fields replace the action's query string wholesale.
 */
export const urlFromForm = (
  form: HTMLFormElement,
  submitter: HTMLElement | null = null,
  base: string = typeof location === "undefined"
    ? "http://localhost/"
    : location.href,
): URL | null => {
  const action = form.getAttribute("action") ?? new URL(base).pathname;
  let url: URL;
  try {
    url = new URL(action, base);
  } catch {
    return null;
  }
  let data: FormData;
  try {
    data = new FormData(form, submitter);
  } catch {
    data = new FormData(form);
  }
  const params = new URLSearchParams();
  for (const [key, value] of data.entries()) {
    if (typeof value !== "string") continue;
    params.append(key, value);
  }
  url.search = params.toString();
  return url;
};

/**
 * `innerHTML` never runs scripts. Re-create them so it does — which is how a
 * `server:defer` island swapped in by this module still boots. External module
 * scripts are deduplicated by the browser, so nothing runs twice.
 */
export const runScripts = (host: ParentNode): void => {
  for (const stale of Array.from(host.querySelectorAll("script"))) {
    const fresh = document.createElement("script");
    for (const attribute of Array.from(stale.attributes)) {
      fresh.setAttribute(attribute.name, attribute.value);
    }
    fresh.text = stale.textContent ?? "";
    stale.replaceWith(fresh);
  }
};

export class AfLiveRegionElement extends HTMLElement {
  private timers: number[] = [];
  private shownAt = 0;
  private controller: AbortController | null = null;

  connectedCallback() {
    this.addEventListener("submit", this.onSubmit as EventListener);
    this.addEventListener("click", this.onClick as EventListener);
    registry.add(this);
    bindPopState();
  }

  disconnectedCallback() {
    this.removeEventListener("submit", this.onSubmit as EventListener);
    this.removeEventListener("click", this.onClick as EventListener);
    registry.delete(this);
    this.controller?.abort();
    this.controller = null;
    this.clearTimers();
  }

  /** The region id; matched against `[data-af-live]` in the fetched markup. */
  get regionId(): string {
    return this.dataset.afLive ?? "";
  }

  /** Regions sharing a group refresh together. Defaults to the region id. */
  get group(): string {
    return this.dataset.group || this.regionId;
  }

  get enabled(): boolean {
    return this.dataset.enabled !== "false";
  }

  get historyMode(): "push" | "replace" | "none" {
    const mode = this.dataset.history;
    return mode === "replace" || mode === "none" ? mode : "push";
  }

  /** The subtree replaced on every swap. */
  get contentHost(): HTMLElement {
    return (
      this.querySelector<HTMLElement>(`[${LIVE_REGION_CONTENT_ATTR}]`) ?? this
    );
  }

  /** Refresh from the current URL without touching history. */
  refresh(): Promise<void> {
    return swapGroup(new URL(location.href), [this], null, false);
  }

  /** Navigate this region to `href`, exactly as an in-region link would. */
  navigate(href: string): Promise<void> {
    return navigateRegion(new URL(href, location.href), this, null);
  }

  // --- interception --------------------------------------------------------

  private onSubmit = (event: SubmitEvent) => {
    if (!this.enabled || event.defaultPrevented) return;
    const form = event.target;
    if (!(form instanceof HTMLFormElement)) return;
    if (form.method.toLowerCase() !== "get") return;
    if (!this.owns(form)) return;
    const url = urlFromForm(form, event.submitter);
    if (!url || !this.sameRoute(url)) return;
    event.preventDefault();
    void navigateRegion(url, this, focusKeyFor(event.submitter ?? form));
  };

  private onClick = (event: MouseEvent) => {
    if (!this.enabled || this.dataset.links === "false") return;
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
      return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    if (!this.owns(anchor)) return;
    if (anchor.hasAttribute("download")) return;
    if (anchor.target && anchor.target !== "_self") return;
    const url = new URL(anchor.href, location.href);
    if (!this.sameRoute(url)) return;
    event.preventDefault();
    void navigateRegion(url, this, focusKeyFor(anchor));
  };

  /** Inside the swappable content, and not opted out. */
  private owns(node: Element): boolean {
    if (!this.contentHost.contains(node)) return false;
    return node.closest(`[${LIVE_REGION_IGNORE_ATTR}]`) === null;
  }

  /**
   * Only same-document navigation is swapped. A link to another page is left
   * to the browser (or to whatever router the host app runs): fetching it and
   * grafting a fragment of it into this page would be a lie about where the
   * reader is.
   */
  sameRoute(url: URL): boolean {
    return (
      url.origin === location.origin &&
      normalizePath(url.pathname) === normalizePath(location.pathname)
    );
  }

  // --- pending state -------------------------------------------------------

  beginLoading(controller: AbortController) {
    this.controller?.abort();
    this.controller = controller;
    this.clearTimers();
    this.shownAt = 0;
    this.classList.remove("is-failed");
    this.classList.add("is-loading");
    this.setAttribute("aria-busy", "true");
    if (this.dataset.suspense === "false") return;
    const grace = toNumber(this.dataset.grace, DEFAULTS.graceDelay);
    if (grace <= 0) this.paint();
    else this.defer(() => this.paint(), grace);
  }

  private paint() {
    if (!this.classList.contains("is-loading")) return;
    this.classList.add("is-waiting");
    this.shownAt = now();
    // Announce only once the wait is real; a swap that lands inside the grace
    // window is not worth interrupting a screen reader for.
    const status = this.status();
    if (status && this.dataset.label) status.textContent = this.dataset.label;
  }

  applySwap(doc: Document, focusKey: string | null) {
    const next = doc.querySelector(
      `[${LIVE_REGION_ATTR}="${escapeAttr(this.regionId)}"]`,
    );
    const source =
      next?.querySelector(`[${LIVE_REGION_CONTENT_ATTR}]`) ?? next ?? null;
    if (!source) {
      this.settleLoading();
      return;
    }

    const host = this.contentHost;
    const hadFocus = host.contains(document.activeElement);
    host.innerHTML = source.innerHTML;
    if (this.dataset.scripts !== "false") runScripts(host);

    // `preventScroll` throughout: the whole promise of this component is that
    // the page does not move under the reader.
    if (hadFocus) {
      const match = focusKey ? host.querySelector<HTMLElement>(focusKey) : null;
      if (match && !(match as HTMLButtonElement).disabled) {
        match.focus({ preventScroll: true });
      } else {
        // The control that was clicked often becomes the current one and is
        // rendered disabled — the active pager pill, the selected pill. Rather
        // than dropping the reader back on `<body>`, park focus on the region
        // so the next tab carries on from where they were.
        host.tabIndex = -1;
        host.focus({ preventScroll: true });
      }
    }

    this.dispatchEvent(
      new CustomEvent(LIVE_REGION_SWAP_EVENT, {
        bubbles: true,
        detail: { url: location.href, region: this.regionId },
      }),
    );
    this.settleLoading();
  }

  failLoading(error: unknown) {
    this.clearTimers();
    this.classList.add("is-failed");
    this.classList.remove("is-loading", "is-waiting");
    this.removeAttribute("aria-busy");
    this.controller = null;
    const status = this.status();
    if (status) status.textContent = "";
    this.dispatchEvent(
      new CustomEvent(LIVE_REGION_ERROR_EVENT, {
        bubbles: true,
        detail: { error, region: this.regionId },
      }),
    );
  }

  /** Lift the fallback, holding a painted one for its minimum. */
  settleLoading() {
    const minDisplay = toNumber(this.dataset.minDisplay, DEFAULTS.minDisplay);
    const remaining = this.shownAt
      ? Math.max(0, this.shownAt + minDisplay - now())
      : 0;
    if (remaining > 0) this.defer(() => this.reveal(), remaining);
    else this.reveal();
  }

  private reveal() {
    this.clearTimers();
    this.classList.remove("is-loading", "is-waiting");
    this.removeAttribute("aria-busy");
    this.shownAt = 0;
    this.controller = null;
    const status = this.status();
    if (status) status.textContent = "";
  }

  private status() {
    return this.querySelector<HTMLElement>(".af-live-region__status");
  }

  private defer(run: () => void, delay: number) {
    this.timers.push(setTimeout(run, delay) as unknown as number);
  }

  private clearTimers() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }
}

// --- navigation ------------------------------------------------------------

const groupFor = (origin: AfLiveRegionElement): AfLiveRegionElement[] =>
  Array.from(registry).filter((region) => region.group === origin.group);

const navigateRegion = async (
  url: URL,
  origin: AfLiveRegionElement,
  focusKey: string | null,
): Promise<void> => {
  const mode = origin.historyMode;
  const href = `${url.pathname}${url.search}${url.hash}`;
  if (mode === "push") {
    history.pushState({ afLive: origin.regionId }, "", href);
    ownsHistoryEntry = true;
  } else if (mode === "replace") {
    history.replaceState({ afLive: origin.regionId }, "", href);
    ownsHistoryEntry = true;
  }
  await swapGroup(url, groupFor(origin), focusKey, mode !== "none");
};

/**
 * @param urlChanged whether the address bar already shows `url`. If it does, a
 *   failed fetch has to fall back to a real navigation — leaving a stale page
 *   under a new URL would be worse than a reload.
 */
const swapGroup = async (
  url: URL,
  targets: AfLiveRegionElement[],
  focusKey: string | null,
  urlChanged: boolean,
): Promise<void> => {
  if (targets.length === 0) return;
  const controller = new AbortController();
  for (const target of targets) target.beginLoading(controller);

  let doc: Document;
  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
      credentials: "same-origin",
      headers: {
        accept: "text/html",
        [LIVE_REGION_HEADER]: targets
          .map((target) => target.regionId)
          .join(","),
      },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    doc = new DOMParser().parseFromString(await response.text(), "text/html");
  } catch (error) {
    if (controller.signal.aborted) return;
    for (const target of targets) target.failLoading(error);
    if (urlChanged) location.reload();
    return;
  }

  if (controller.signal.aborted) return;
  for (const target of targets) target.applySwap(doc, focusKey);
};

const onPopState = (event: PopStateEvent) => {
  if (clientRouterOwnsHistory()) return;
  const state = event.state as { afLive?: string } | null;
  const wasOurs = ownsHistoryEntry;
  ownsHistoryEntry = Boolean(state?.afLive);
  // Claim the entry only if we pushed it, or if we are stepping off one of
  // ours back onto the entry the page was loaded with.
  if (!state?.afLive && !wasOurs) return;

  const url = new URL(location.href);
  const seen = new Set<string>();
  for (const region of Array.from(registry)) {
    if (region.historyMode === "none") continue;
    if (!region.sameRoute(url)) continue;
    if (seen.has(region.group)) continue;
    seen.add(region.group);
    void swapGroup(url, groupFor(region), null, false);
  }
};

const bindPopState = () => {
  if (popStateBound || typeof window === "undefined") return;
  popStateBound = true;
  window.addEventListener("popstate", onPopState);
};

/** Register `<af-live-region>`. Safe to call more than once. */
export const defineLiveRegion = (): void => {
  if (typeof customElements === "undefined") return;
  if (customElements.get(LIVE_REGION_TAG)) return;
  customElements.define(LIVE_REGION_TAG, AfLiveRegionElement);
};
