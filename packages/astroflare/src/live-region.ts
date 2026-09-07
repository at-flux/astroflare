/**
 * Shared vocabulary for {@link ../components/LiveRegion.astro}.
 *
 * These names are needed on both sides of the wire — the server page decides
 * how to render, the browser runtime decides how to ask — so they live in a
 * module with no DOM dependency. `runtime/live-region.ts` cannot be imported
 * from Astro frontmatter (it declares a custom element and would need
 * `HTMLElement` at module scope), whereas this one can.
 */

/** Tag name the live region registers as. */
export const LIVE_REGION_TAG = "af-live-region";

/** Marks the host element, valued with the region id. */
export const LIVE_REGION_ATTR = "data-af-live";

/** Marks the swappable subtree inside a host. */
export const LIVE_REGION_CONTENT_ATTR = "data-af-live-content";

/** Opt a form, link or subtree out of interception. */
export const LIVE_REGION_IGNORE_ATTR = "data-af-live-ignore";

/**
 * Sent on every swap request, valued with the comma-separated ids being
 * refreshed. A page can read it to render the fragment differently from a
 * cold load — most usefully, to skip `server:defer` so the markup the runtime
 * swaps in is the real content rather than an island placeholder.
 */
export const LIVE_REGION_HEADER = "x-astroflare-live-region";

/** Fired (bubbling) on the host after new markup has been swapped in. */
export const LIVE_REGION_SWAP_EVENT = "af-live-region:swap";

/** Fired (bubbling) on the host when a swap could not be completed. */
export const LIVE_REGION_ERROR_EVENT = "af-live-region:error";

type HeaderSource =
  | Headers
  | Request
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

const readHeader = (source: HeaderSource): string | null => {
  if (!source) return null;
  if (typeof Headers !== "undefined" && source instanceof Headers) {
    return source.get(LIVE_REGION_HEADER);
  }
  if (typeof Request !== "undefined" && source instanceof Request) {
    return source.headers.get(LIVE_REGION_HEADER);
  }
  const bag = source as Record<string, string | string[] | undefined>;
  const raw = bag[LIVE_REGION_HEADER] ?? bag[LIVE_REGION_HEADER.toUpperCase()];
  if (Array.isArray(raw)) return raw.join(",");
  return raw ?? null;
};

/**
 * The region ids this request is refreshing, or an empty array for an ordinary
 * page load.
 *
 * @example
 * const refreshing = liveRegionIds(Astro.request);
 */
export const liveRegionIds = (source: HeaderSource): string[] =>
  (readHeader(source) ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

/**
 * Is this request a live-region swap? Pass `id` to ask about one region.
 *
 * @example
 * // Defer on a cold load; render inline for the swap, so the fetched markup
 * // is the content itself rather than a server-island placeholder.
 * const defer = !isLiveRegionRequest(Astro.request, "results");
 */
export const isLiveRegionRequest = (
  source: HeaderSource,
  id?: string,
): boolean => {
  const ids = liveRegionIds(source);
  if (ids.length === 0) return false;
  return id === undefined ? true : ids.includes(id);
};
