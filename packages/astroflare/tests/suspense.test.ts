// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  AfSuspenseElement,
  SUSPENSE_FAIL_EVENT,
  SUSPENSE_RESOLVE_EVENT,
  SUSPENSE_TAG,
  defineSuspense,
} from "../src/runtime/suspense";

/**
 * jsdom has no IntersectionObserver. The stub records every instance so a test
 * can fire the callback by hand, which is the only way to drive `when="visible"`
 * and the lazy-image promotion.
 */
class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  disconnected = false;
  observed: Element[] = [];
  constructor(
    private callback: IntersectionObserverCallback,
    readonly options?: IntersectionObserverInit,
  ) {
    FakeIntersectionObserver.instances.push(this);
  }
  observe(element: Element) {
    this.observed.push(element);
  }
  disconnect() {
    this.disconnected = true;
  }
  unobserve() {}
  takeRecords() {
    return [];
  }
  trigger(isIntersecting = true) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

const mount = (attrs: Record<string, string>, inner = "") => {
  const attributes = Object.entries(attrs)
    .map(([key, value]) => `${key}="${value}"`)
    .join(" ");
  document.body.innerHTML = `
    <${SUSPENSE_TAG} class="af-suspense is-pending" ${attributes}>
      <div class="af-suspense__placeholder" data-af-ui aria-hidden="true"></div>
      <div class="af-suspense__error" data-af-ui role="alert">nope</div>
      <span class="af-suspense__status" data-af-ui role="status"></span>
      ${attrs["data-src"] ? '<div class="af-suspense__remote" data-af-remote></div>' : ""}
      ${inner}
    </${SUSPENSE_TAG}>
  `;
  return document.querySelector(SUSPENSE_TAG) as AfSuspenseElement;
};

const status = (host: Element) =>
  host.querySelector(".af-suspense__status") as HTMLElement;
const content = (host: Element) =>
  host.querySelector("[data-content]") as HTMLElement;

beforeEach(() => {
  vi.useFakeTimers();
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  defineSuspense();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("af-suspense: registration", () => {
  it("registers the element once and is safe to call again", () => {
    defineSuspense();
    expect(customElements.get(SUSPENSE_TAG)).toBe(AfSuspenseElement);
  });
});

describe("af-suspense: swap", () => {
  it("resolves immediately when there is no media to wait for", () => {
    const host = mount({ "data-when": "eager", "data-ready": "auto" });
    expect(host.classList.contains("is-ready")).toBe(true);
    expect(host.classList.contains("is-pending")).toBe(false);
    expect(host.isSettled).toBe(true);
  });

  it("never paints the placeholder when it resolves inside the grace window", () => {
    const host = mount({ "data-grace": "100" });
    vi.advanceTimersByTime(500);
    expect(host.classList.contains("is-waiting")).toBe(false);
    expect(status(host).textContent).toBe("");
  });

  it("marks pending content inert and clears it on reveal", () => {
    const host = mount(
      { "data-ready": "manual" },
      '<div data-content><a href="#x">link</a></div>',
    );
    expect(content(host).hasAttribute("inert")).toBe(true);
    host.resolve();
    vi.advanceTimersByTime(1000);
    expect(content(host).hasAttribute("inert")).toBe(false);
  });
});

describe("af-suspense: grace and minDisplay", () => {
  it("paints the placeholder after graceDelay and announces the label", () => {
    const host = mount({
      "data-ready": "manual",
      "data-grace": "100",
      "data-label": "Loading…",
    });
    expect(host.classList.contains("is-waiting")).toBe(false);
    vi.advanceTimersByTime(100);
    expect(host.classList.contains("is-waiting")).toBe(true);
    expect(status(host).textContent).toBe("Loading…");
  });

  it("holds a painted placeholder for minDisplay before revealing", () => {
    const host = mount({
      "data-ready": "manual",
      "data-grace": "100",
      "data-min-display": "500",
      "data-label": "Loading…",
    });
    vi.advanceTimersByTime(150); // placeholder painted at 100ms
    host.resolve();
    expect(host.classList.contains("is-pending")).toBe(true);
    vi.advanceTimersByTime(449);
    expect(host.classList.contains("is-pending")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(host.classList.contains("is-ready")).toBe(true);
    expect(status(host).textContent).toBe("");
  });

  it("imposes no minDisplay delay when the placeholder was never painted", () => {
    const host = mount({
      "data-ready": "manual",
      "data-grace": "1000",
      "data-min-display": "5000",
    });
    host.resolve();
    expect(host.classList.contains("is-ready")).toBe(true);
  });
});

describe("af-suspense: media readiness", () => {
  it("waits for a pending image and reveals on load", () => {
    const host = mount({}, '<img data-content src="/slow.png" />');
    const image = host.querySelector("img")!;
    expect(host.classList.contains("is-pending")).toBe(true);
    image.dispatchEvent(new Event("load"));
    vi.advanceTimersByTime(1000);
    expect(host.classList.contains("is-ready")).toBe(true);
    expect(host.classList.contains("is-failed")).toBe(false);
  });

  it("fails but still reveals when an image errors", () => {
    const host = mount({}, '<img data-content src="/missing.png" />');
    host.querySelector("img")!.dispatchEvent(new Event("error"));
    vi.advanceTimersByTime(1000);
    expect(host.classList.contains("is-ready")).toBe(true);
    expect(host.classList.contains("is-failed")).toBe(true);
    expect(content(host).hasAttribute("inert")).toBe(false);
  });

  it("ignores media inside its own chrome", () => {
    document.body.innerHTML = `
      <${SUSPENSE_TAG} class="af-suspense is-pending">
        <div class="af-suspense__placeholder" data-af-ui><img src="/spinner.gif" /></div>
      </${SUSPENSE_TAG}>`;
    const host = document.querySelector(SUSPENSE_TAG) as AfSuspenseElement;
    expect(host.classList.contains("is-ready")).toBe(true);
  });

  it("promotes a lazy image to eager once its frame is near the viewport", () => {
    const host = mount({}, '<img data-content loading="lazy" src="/x.png" />');
    const image = host.querySelector("img")!;
    expect(image.getAttribute("loading")).toBe("lazy");
    const observer = FakeIntersectionObserver.instances.at(-1)!;
    observer.trigger();
    expect(image.getAttribute("loading")).toBe("eager");
    expect(observer.disconnected).toBe(true);
    expect(host.classList.contains("is-pending")).toBe(true);
  });
});

describe("af-suspense: gates", () => {
  it("does not start until the visible gate opens", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => "<p>hi</p>" });
    vi.stubGlobal("fetch", fetchMock);
    const host = mount({ "data-when": "visible", "data-src": "/fragment/" });
    expect(fetchMock).not.toHaveBeenCalled();
    FakeIntersectionObserver.instances[0].trigger();
    expect(fetchMock).toHaveBeenCalledWith("/fragment/");
    await vi.runAllTimersAsync();
    expect(host.querySelector("[data-af-remote]")!.innerHTML).toBe("<p>hi</p>");
    expect(host.classList.contains("is-ready")).toBe(true);
  });

  it("uses the configured rootMargin for the visible gate", () => {
    mount({
      "data-when": "visible",
      "data-ready": "manual",
      "data-root-margin": "400px",
    });
    expect(FakeIntersectionObserver.instances[0].options).toEqual({
      rootMargin: "400px",
    });
  });

  it("waits for the nearest dialog to open, then retries a failure on re-open", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404 })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => "<p>second try</p>",
      });
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});

    document.body.innerHTML = `
      <dialog>
        <${SUSPENSE_TAG} class="af-suspense is-pending" data-when="dialog-open" data-src="/fragment/">
          <div class="af-suspense__placeholder" data-af-ui></div>
          <div class="af-suspense__error" data-af-ui role="alert">nope</div>
          <div class="af-suspense__remote" data-af-remote></div>
        </${SUSPENSE_TAG}>
      </dialog>`;
    const dialog = document.querySelector("dialog")!;
    const host = document.querySelector(SUSPENSE_TAG) as AfSuspenseElement;

    expect(fetchMock).not.toHaveBeenCalled();

    dialog.setAttribute("open", "");
    await vi.runAllTimersAsync();
    expect(host.classList.contains("is-failed")).toBe(true);

    dialog.removeAttribute("open");
    dialog.setAttribute("open", "");
    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(host.classList.contains("is-failed")).toBe(false);
    expect(host.querySelector("[data-af-remote]")!.innerHTML).toBe(
      "<p>second try</p>",
    );
  });

  it("falls back to eager when a dialog gate has no dialog ancestor", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, text: async () => "ok" });
    vi.stubGlobal("fetch", fetchMock);
    mount({ "data-when": "dialog-open", "data-src": "/fragment/" });
    await vi.runAllTimersAsync();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});

describe("af-suspense: manual and events", () => {
  it("stays pending until the resolve event", () => {
    const host = mount({ "data-ready": "manual" });
    expect(host.classList.contains("is-pending")).toBe(true);
    host.dispatchEvent(new CustomEvent(SUSPENSE_RESOLVE_EVENT));
    vi.advanceTimersByTime(1000);
    expect(host.classList.contains("is-ready")).toBe(true);
  });

  it("enters the failed state on the fail event", () => {
    const host = mount({ "data-ready": "manual" });
    host.dispatchEvent(new CustomEvent(SUSPENSE_FAIL_EVENT));
    vi.advanceTimersByTime(1000);
    expect(host.classList.contains("is-failed")).toBe(true);
    expect(host.isFailed).toBe(true);
  });

  it("dispatches a bubbling ready event, once", () => {
    const onReady = vi.fn();
    document.addEventListener("af-suspense:ready", onReady);
    const host = mount({ "data-ready": "manual" });
    host.resolve();
    host.resolve();
    vi.advanceTimersByTime(1000);
    expect(onReady).toHaveBeenCalledOnce();
    document.removeEventListener("af-suspense:ready", onReady);
  });

  it("fails on timeout", () => {
    const host = mount({ "data-ready": "manual", "data-timeout": "800" });
    vi.advanceTimersByTime(799);
    expect(host.classList.contains("is-failed")).toBe(false);
    vi.advanceTimersByTime(1);
    vi.advanceTimersByTime(1000);
    expect(host.classList.contains("is-failed")).toBe(true);
  });
});

describe("af-suspense: lifecycle", () => {
  it("re-arms a still-pending element when it is moved in the DOM", () => {
    const host = mount({ "data-ready": "manual", "data-grace": "0" });
    const holder = document.createElement("section");
    document.body.append(holder);
    holder.append(host); // disconnect + reconnect
    expect(host.classList.contains("is-waiting")).toBe(true);
    host.resolve();
    vi.advanceTimersByTime(1000);
    expect(host.classList.contains("is-ready")).toBe(true);
  });

  it("resets back to pending and runs again", () => {
    const host = mount({ "data-ready": "manual" });
    host.resolve();
    vi.advanceTimersByTime(1000);
    expect(host.classList.contains("is-ready")).toBe(true);

    host.reset();
    expect(host.classList.contains("is-pending")).toBe(true);
    expect(host.classList.contains("is-ready")).toBe(false);
    expect(host.isSettled).toBe(false);
  });
});
