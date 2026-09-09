/**
 * Client runtime for {@link ../components/Suspense.astro}.
 *
 * The element implements one small state machine, and every waiting component
 * in this package is a preset over it:
 *
 * ```text
 *   armed ──gate──▶ begun ──readiness──▶ settled ──(minDisplay)──▶ revealed
 *     │                                     │
 *     └── graceDelay ──▶ placeholder painted┘
 * ```
 *
 * - **Gate** (`data-when`) — when resolution may start: `eager` on connect,
 *   `visible` on first intersection, `dialog-open` when the nearest ancestor
 *   `<dialog>` opens.
 * - **Readiness** (`data-ready`, `data-src`) — how "done" is decided: wait for
 *   the slotted media to settle (`auto`), wait for a `resolve()` call
 *   (`manual`), or fetch `data-src` and swap the HTML in.
 * - **Swap** — `is-pending` → `is-ready` (plus `is-failed` on failure). CSS in
 *   the component owns the fade; this module only owns the classes, the
 *   `inert` attribute on pending content and the live-region text.
 *
 * The two timings exist to stop the placeholder flickering:
 * `graceDelay` keeps it unpainted for content that resolves almost at once, and
 * `minDisplay` holds a placeholder that *was* painted long enough to be read.
 *
 * The DOM contract, all of it optional except the host element:
 * - host `<af-suspense>` carries the `data-*` configuration and the state classes
 * - `[data-af-ui]` children are chrome (placeholder, error, status, noscript) —
 *   never treated as content, never inerted, never waited on
 * - `[data-af-remote]` is where `data-src` HTML is written
 * - `.af-suspense__status` is the polite live region
 */

/** Tag name the element registers as. */
export const SUSPENSE_TAG = "af-suspense";

/** Dispatch on the host to resolve a `ready="manual"` suspense. */
export const SUSPENSE_RESOLVE_EVENT = "af-suspense:resolve";
/** Dispatch on the host to put any suspense into its failed state. */
export const SUSPENSE_FAIL_EVENT = "af-suspense:fail";
/** Fired (bubbling) once the content has been revealed. */
export const SUSPENSE_READY_EVENT = "af-suspense:ready";
/** Fired (bubbling) instead of `ready` when the suspense failed. */
export const SUSPENSE_ERROR_EVENT = "af-suspense:error";

const MEDIA_SELECTOR = "img, video, iframe";
const UI_SELECTOR = "[data-af-ui]";

const DEFAULTS = {
  minDisplay: 300,
  graceDelay: 100,
  timeout: 0,
  rootMargin: "200px",
} as const;

const toNumber = (raw: string | undefined, fallback: number) => {
  if (raw === undefined || raw === "") return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
};

/**
 * Has this media element already finished, such that its `load` event will
 * never fire for us? A cached image and a previously broken one both count.
 *
 * An `<iframe>` exposes nothing to test, so fall back to the document: if the
 * page has finished loading, any iframe present in the original markup has
 * already fired `load` and waiting on it would hang forever.
 */
export const isMediaSettled = (node: Element): boolean => {
  if (node instanceof HTMLImageElement) return node.complete;
  if (node instanceof HTMLVideoElement) return node.readyState >= 2;
  if (node instanceof HTMLIFrameElement) {
    return node.ownerDocument.readyState === "complete";
  }
  return false;
};

export class AfSuspenseElement extends HTMLElement {
  private gateObserver: IntersectionObserver | null = null;
  private promoteObserver: IntersectionObserver | null = null;
  private dialogObserver: MutationObserver | null = null;
  private timers: number[] = [];
  private shownAt = 0;
  private armed = false;
  private begun = false;
  private settled = false;
  private failed = false;

  connectedCallback() {
    this.arm();
  }

  disconnectedCallback() {
    this.teardown();
    // A host that is moved rather than destroyed (a view transition, a modal
    // being re-parented) must be able to pick up where it left off. Anything
    // still pending re-arms on the next connect; anything already revealed
    // stays revealed.
    if (!this.settled) {
      this.armed = false;
      this.begun = false;
    }
  }

  /** Resolve now. Idempotent — the first of resolve/fail wins. */
  resolve() {
    this.finish(false);
  }

  /** Fail now: the error slot appears and the content is revealed anyway. */
  fail() {
    this.finish(true);
  }

  /** Back to pending, then run the whole cycle again. */
  reset() {
    this.teardown();
    this.armed = false;
    this.begun = false;
    this.settled = false;
    this.failed = false;
    this.shownAt = 0;
    const remote = this.querySelector<HTMLElement>("[data-af-remote]");
    if (remote) remote.innerHTML = "";
    this.classList.remove("is-ready", "is-failed", "is-waiting");
    this.classList.add("is-pending");
    this.arm();
  }

  /** Whether the content has been revealed (successfully or not). */
  get isSettled() {
    return this.settled;
  }

  /** Whether the suspense ended in its failed state. */
  get isFailed() {
    return this.failed;
  }

  // --- lifecycle -----------------------------------------------------------

  private arm() {
    if (this.armed) return;
    this.armed = true;

    this.addEventListener(SUSPENSE_RESOLVE_EVENT, this.onResolveEvent);
    this.addEventListener(SUSPENSE_FAIL_EVENT, this.onFailEvent);
    this.setContentInert(true);

    // Arm the placeholder before the gate, not after it: an off-screen box
    // should already be wearing its skeleton by the time it is scrolled into
    // view, and content that resolves inside the grace window never paints one.
    const grace = toNumber(this.dataset.grace, DEFAULTS.graceDelay);
    if (grace <= 0) this.showPlaceholder();
    else this.defer(() => this.showPlaceholder(), grace);

    switch (this.dataset.when) {
      case "visible":
        this.openOnVisible();
        return;
      case "dialog-open":
        this.openOnDialog();
        return;
      default:
        this.begin(false);
    }
  }

  private openOnVisible() {
    if (typeof IntersectionObserver !== "function") {
      this.begin(false);
      return;
    }
    this.gateObserver = new IntersectionObserver(
      (entries, observer) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        this.gateObserver = null;
        this.begin(true);
      },
      { rootMargin: this.rootMargin },
    );
    this.gateObserver.observe(this);
  }

  /**
   * Gate on the nearest ancestor `<dialog>`: heavy modal bodies stay off the
   * wire until the modal is first opened. Native `<dialog>` toggles the `open`
   * attribute, so a mutation observer is enough. With no dialog ancestor there
   * is nothing to wait for, so it behaves as `eager`.
   *
   * The observer is deliberately kept alive: re-opening a dialog whose content
   * failed to load retries it, which is what a reader who opens the modal a
   * second time expects.
   */
  private openOnDialog() {
    const dialog = this.closest("dialog");
    if (!dialog || typeof MutationObserver !== "function") {
      this.begin(false);
      return;
    }
    const onToggle = () => {
      if (!dialog.open) return;
      if (!this.begun) {
        this.begin(true);
        return;
      }
      if (this.settled && this.failed) this.reset();
    };
    this.dialogObserver = new MutationObserver(onToggle);
    this.dialogObserver.observe(dialog, {
      attributes: true,
      attributeFilter: ["open"],
    });
    if (dialog.open) onToggle();
  }

  private begin(gated: boolean) {
    if (this.begun || this.settled) return;
    this.begun = true;

    const timeout = toNumber(this.dataset.timeout, DEFAULTS.timeout);
    if (timeout > 0) this.defer(() => this.fail(), timeout);

    if (this.dataset.src) {
      void this.loadRemote();
      return;
    }
    if (this.dataset.ready === "manual") return;
    this.waitForMedia(gated);
  }

  private async loadRemote() {
    const src = this.dataset.src;
    const host = this.querySelector<HTMLElement>("[data-af-remote]");
    if (!src || !host) {
      this.resolve();
      return;
    }
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      host.innerHTML = await response.text();
    } catch (error) {
      console.error(`${SUSPENSE_TAG}: failed to load`, src, error);
      this.fail();
      return;
    }
    if (this.settled) return;
    // The fragment may itself contain media — keep waiting for it. It arrived
    // through innerHTML, so its gate is already open: promote lazy images now.
    this.waitForMedia(true);
  }

  private waitForMedia(gated: boolean) {
    const media = Array.from(
      this.querySelectorAll<HTMLElement>(MEDIA_SELECTOR),
    ).filter((node) => !node.closest(UI_SELECTOR));
    const pending = media.filter((node) => !isMediaSettled(node));
    if (pending.length === 0) {
      this.resolve();
      return;
    }

    let outstanding = pending.length;
    const settleOne = () => {
      if (--outstanding === 0) this.resolve();
    };
    for (const node of pending) {
      node.addEventListener("load", settleOne, { once: true });
      // A broken image is still worth revealing — its alt text beats a spinner
      // that never stops — so a failure reveals the content and shows the
      // error slot, if there is one, over the top.
      node.addEventListener("error", this.onMediaError, { once: true });
    }

    this.promoteLazy(pending, gated);
  }

  /**
   * Native `loading="lazy"` gets stuck when the markup was streamed from a
   * `server:defer` island or injected as `innerHTML`: Chromium never arms its
   * observer, so the fetch never starts and `load` never fires. Promote to
   * eager as the frame nears the viewport, which kicks the fetch while
   * preserving off-screen laziness. Content behind an already-open gate can be
   * promoted straight away.
   */
  private promoteLazy(nodes: HTMLElement[], gated: boolean) {
    const lazy = nodes.filter(
      (node): node is HTMLImageElement =>
        node instanceof HTMLImageElement &&
        node.getAttribute("loading") === "lazy",
    );
    if (lazy.length === 0) return;

    // Set the attribute rather than the property: it is what the parser reads,
    // and it is observable in the DOM (and in tests).
    const kick = () => {
      for (const image of lazy) {
        if (!image.complete) image.setAttribute("loading", "eager");
      }
    };
    if (gated || typeof IntersectionObserver !== "function") {
      kick();
      return;
    }
    this.promoteObserver = new IntersectionObserver(
      (entries, observer) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        this.promoteObserver = null;
        kick();
      },
      { rootMargin: this.rootMargin },
    );
    this.promoteObserver.observe(this);
  }

  // --- state ---------------------------------------------------------------

  private showPlaceholder() {
    if (this.settled) return;
    this.classList.add("is-waiting");
    this.shownAt = now();
    // Announce only once the wait is real. A live region that is populated in
    // the server markup may never be announced at all, and one populated for
    // content that resolved inside the grace window is just noise.
    const status = this.status();
    if (status && this.dataset.label) status.textContent = this.dataset.label;
  }

  private finish(failed: boolean) {
    if (this.settled) return;
    this.settled = true;
    this.failed = failed;
    this.clearTimers();
    // The gate has done its job, but a `dialog-open` gate stays observing:
    // re-opening the dialog is how a failed fragment gets retried.
    this.disconnectGateObservers();

    // Hold a placeholder that has actually been painted for its minimum, so a
    // resource landing a beat late cannot make it strobe. A placeholder that
    // was never painted imposes no delay at all.
    const minDisplay = toNumber(this.dataset.minDisplay, DEFAULTS.minDisplay);
    const remaining = this.shownAt
      ? Math.max(0, this.shownAt + minDisplay - now())
      : 0;
    if (remaining > 0) this.defer(() => this.reveal(), remaining);
    else this.reveal();
  }

  private reveal() {
    this.classList.remove("is-pending", "is-waiting");
    this.classList.add("is-ready");
    if (this.failed) this.classList.add("is-failed");
    this.setContentInert(false);
    const status = this.status();
    if (status) status.textContent = "";
    this.dispatchEvent(
      new CustomEvent(
        this.failed ? SUSPENSE_ERROR_EVENT : SUSPENSE_READY_EVENT,
        { bubbles: true },
      ),
    );
  }

  /**
   * Faded-out content must not be focusable — a keyboard user would otherwise
   * tab into something they cannot see, and a screen reader would read content
   * that is not yet on the page. The attribute is only ever set by script, so
   * a reader without JavaScript never meets it.
   */
  private setContentInert(inert: boolean) {
    for (const child of Array.from(this.children)) {
      if (!(child instanceof HTMLElement)) continue;
      if (child.hasAttribute("data-af-ui")) continue;
      child.toggleAttribute("inert", inert);
    }
  }

  // --- plumbing ------------------------------------------------------------

  private get rootMargin() {
    return this.dataset.rootMargin || DEFAULTS.rootMargin;
  }

  private status() {
    return this.querySelector<HTMLElement>(".af-suspense__status");
  }

  private onResolveEvent = () => this.resolve();
  private onFailEvent = () => this.fail();
  private onMediaError = () => this.fail();

  private defer(run: () => void, delay: number) {
    this.timers.push(setTimeout(run, delay) as unknown as number);
  }

  private clearTimers() {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers = [];
  }

  private disconnectGateObservers() {
    this.gateObserver?.disconnect();
    this.gateObserver = null;
    this.promoteObserver?.disconnect();
    this.promoteObserver = null;
  }

  private teardown() {
    this.clearTimers();
    this.disconnectGateObservers();
    this.dialogObserver?.disconnect();
    this.dialogObserver = null;
    this.removeEventListener(SUSPENSE_RESOLVE_EVENT, this.onResolveEvent);
    this.removeEventListener(SUSPENSE_FAIL_EVENT, this.onFailEvent);
  }
}

const now = () =>
  typeof performance === "object" && typeof performance.now === "function"
    ? performance.now()
    : Date.now();

/** Register `<af-suspense>`. Safe to call more than once. */
export const defineSuspense = () => {
  if (typeof customElements === "undefined") return;
  if (customElements.get(SUSPENSE_TAG)) return;
  customElements.define(SUSPENSE_TAG, AfSuspenseElement);
};
