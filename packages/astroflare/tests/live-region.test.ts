// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  LIVE_REGION_HEADER,
  LIVE_REGION_SWAP_EVENT,
  isLiveRegionRequest,
  liveRegionIds,
} from "../src/live-region";
import {
  AfLiveRegionElement,
  LIVE_REGION_TAG,
  defineLiveRegion,
  focusKeyFor,
  runScripts,
  urlFromForm,
} from "../src/runtime/live-region";

const page = (body: string) =>
  `<!doctype html><html><body>${body}</body></html>`;

const regionMarkup = (inner: string, id = "results") => `
  <${LIVE_REGION_TAG} class="af-live-region" data-af-live="${id}" data-grace="0" data-min-display="0">
    <div class="af-live-region__fallback" data-af-ui aria-hidden="true">wait</div>
    <span class="af-live-region__status" data-af-ui role="status"></span>
    <div class="af-live-region__content" data-af-live-content>${inner}</div>
  </${LIVE_REGION_TAG}>
`;

const pagerForm = (pageNumber: number) => `
  <form method="get" action="/paging">
    <input type="hidden" name="page" value="${pageNumber}" />
    <input type="hidden" name="size" value="2" />
    <button type="submit" data-page="${pageNumber}">${pageNumber}</button>
  </form>
`;

/** Let the microtask chain inside the swap settle. */
const flush = async () => {
  for (let index = 0; index < 6; index += 1) await Promise.resolve();
};

describe("live region request helpers", () => {
  it("reads ids from a Headers object", () => {
    const headers = new Headers({ [LIVE_REGION_HEADER]: "results, filters" });
    expect(liveRegionIds(headers)).toEqual(["results", "filters"]);
    expect(isLiveRegionRequest(headers)).toBe(true);
    expect(isLiveRegionRequest(headers, "filters")).toBe(true);
    expect(isLiveRegionRequest(headers, "other")).toBe(false);
  });

  it("reads ids from a plain header bag", () => {
    expect(liveRegionIds({ [LIVE_REGION_HEADER]: "a,b" })).toEqual(["a", "b"]);
    expect(liveRegionIds({ [LIVE_REGION_HEADER]: ["a", "b"] })).toEqual([
      "a",
      "b",
    ]);
  });

  it("treats an ordinary request as a cold load", () => {
    expect(liveRegionIds(new Headers())).toEqual([]);
    expect(isLiveRegionRequest(new Headers())).toBe(false);
    expect(isLiveRegionRequest(null)).toBe(false);
  });
});

describe("urlFromForm", () => {
  it("mirrors a browser GET submission: fields replace the query string", () => {
    document.body.innerHTML = `
      <form method="get" action="/paging?stale=1">
        <input type="hidden" name="page" value="3" />
        <input type="hidden" name="size" value="2" />
      </form>
    `;
    const form = document.querySelector("form") as HTMLFormElement;
    const url = urlFromForm(form, null, "http://localhost/paging");
    expect(url?.pathname).toBe("/paging");
    expect(url?.search).toBe("?page=3&size=2");
  });
});

describe("focusKeyFor", () => {
  it("prefers an explicit key, then id, then the pager/filter data hooks", () => {
    const make = (html: string) => {
      const host = document.createElement("div");
      host.innerHTML = html;
      return host.firstElementChild;
    };
    expect(focusKeyFor(make('<button data-af-live-key="next"></button>'))).toBe(
      '[data-af-live-key="next"]',
    );
    expect(focusKeyFor(make('<button id="go"></button>'))).toBe('[id="go"]');
    expect(focusKeyFor(make('<button data-page="4"></button>'))).toBe(
      '[data-page="4"]',
    );
    expect(focusKeyFor(make('<select name="size"></select>'))).toBe(
      'select[name="size"]',
    );
    expect(focusKeyFor(make("<button></button>"))).toBeNull();
    expect(focusKeyFor(null)).toBeNull();
  });
});

describe("runScripts", () => {
  /**
   * jsdom will not execute scripts here, so this asserts the mechanism rather
   * than the effect: the inert parsed node is replaced by a freshly created
   * one — which is what makes the browser run it — with its attributes and
   * body intact.
   */
  it("replaces inert parsed scripts with fresh, executable nodes", () => {
    const host = document.createElement("div");
    document.body.append(host);
    host.innerHTML =
      '<script type="module" data-island-id="abc">globalThis.ran = 1;<\/script>';
    const parsed = host.querySelector("script");

    runScripts(host);

    const fresh = host.querySelector("script") as HTMLScriptElement;
    expect(fresh).not.toBe(parsed);
    expect(fresh.type).toBe("module");
    expect(fresh.dataset.islandId).toBe("abc");
    expect(fresh.textContent).toBe("globalThis.ran = 1;");
  });
});

describe("<af-live-region>", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    defineLiveRegion();
    history.replaceState(null, "", "/paging");
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  const mount = (inner: string) => {
    document.body.innerHTML = regionMarkup(inner);
    return document.querySelector(LIVE_REGION_TAG) as AfLiveRegionElement;
  };

  const respond = (html: string) =>
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => html,
    });

  it("swaps content in place instead of navigating, and pushes the URL", async () => {
    const host = mount(`<p class="body">page one</p>${pagerForm(2)}`);
    respond(page(regionMarkup(`<p class="body">page two</p>${pagerForm(1)}`)));

    const swaps: string[] = [];
    host.addEventListener(LIVE_REGION_SWAP_EVENT, () => swaps.push("swap"));

    (host.querySelector("button[data-page='2']") as HTMLButtonElement).click();
    await flush();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/paging?page=2&size=2");
    expect((init.headers as Record<string, string>)[LIVE_REGION_HEADER]).toBe(
      "results",
    );
    expect(location.search).toBe("?page=2&size=2");
    expect(host.textContent).toContain("page two");
    expect(host.textContent).not.toContain("page one");
    expect(swaps).toEqual(["swap"]);
  });

  it("keeps the ClientRouter's scroll bookkeeping on the entry it pushes", async () => {
    history.replaceState({ index: 4, scrollX: 0, scrollY: 555 }, "", "/paging");
    window.scrollY = 120;
    const stamped = vi.spyOn(history, "replaceState");
    const host = mount(pagerForm(2));
    respond(page(regionMarkup(pagerForm(1))));

    (host.querySelector("button") as HTMLButtonElement).click();
    await flush();

    // A state of `{ afLive }` alone would read back as scrollY `undefined`,
    // and the router sends the reader to the top of the page on `back`.
    expect(history.state).toEqual({
      index: 5,
      scrollX: 0,
      scrollY: 120,
      afLive: "results",
    });
    // The entry being left keeps the position too, so `back` returns to it.
    // The entry being left keeps the position too, so `back` returns to it.
    expect(stamped).toHaveBeenCalledWith(
      expect.objectContaining({ index: 4, scrollY: 120 }),
      "",
    );
  });

  it("leaves the entry index alone when it replaces instead of pushes", async () => {
    history.replaceState({ index: 4, scrollX: 0, scrollY: 555 }, "", "/paging");
    window.scrollY = 120;
    const host = mount(pagerForm(2));
    host.dataset.history = "replace";
    respond(page(regionMarkup(pagerForm(1))));

    (host.querySelector("button") as HTMLButtonElement).click();
    await flush();

    expect(history.state).toEqual({
      index: 4,
      scrollX: 0,
      scrollY: 120,
      afLive: "results",
    });
  });

  it("leaves the pending classes behind once the swap lands", async () => {
    const host = mount(pagerForm(2));
    respond(page(regionMarkup(pagerForm(1))));
    (host.querySelector("button") as HTMLButtonElement).click();
    await flush();
    expect(host.classList.contains("is-loading")).toBe(false);
    expect(host.classList.contains("is-waiting")).toBe(false);
    expect(host.hasAttribute("aria-busy")).toBe(false);
  });

  it("ignores forms marked with the opt-out attribute", async () => {
    const host = mount(`<div data-af-live-ignore>${pagerForm(2)}</div>`);
    const form = host.querySelector("form") as HTMLFormElement;
    const event = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("leaves cross-route links to the browser", async () => {
    const host = mount('<a href="/somewhere-else">away</a>');
    const anchor = host.querySelector("a") as HTMLAnchorElement;
    const event = new MouseEvent("click", { bubbles: true, cancelable: true });
    anchor.dispatchEvent(event);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });

  it("does nothing at all when disabled", async () => {
    const host = mount(pagerForm(2));
    host.dataset.enabled = "false";
    const form = host.querySelector("form") as HTMLFormElement;
    const event = new Event("submit", { bubbles: true, cancelable: true });
    form.dispatchEvent(event);
    await flush();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
  });
});
