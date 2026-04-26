export interface CollectionQueryOptions {
  defaultPage?: number;
  defaultSize?: number;
  maxSize?: number;
}

export interface CollectionQueryState {
  page: number;
  size: number;
  offset: number;
  filters: Record<string, string>;
}

export interface PaginationSlice<T> {
  items: T[];
  totalItems: number;
  totalPages: number;
  start: number;
  end: number;
}

export const normalizeFilterToken = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_");

export const parseFilterValueList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map(normalizeFilterToken)
    .filter(Boolean)
    .filter((token, index, list) => list.indexOf(token) === index);

export const formatFilterValueListLabel = (value: string | undefined): string =>
  parseFilterValueList(value)
    .map((token) => token.replace(/_/g, " ").toUpperCase())
    .join(" + ");

const toInt = (value: string | null, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parseCollectionQuery = (
  searchParams: URLSearchParams,
  options: CollectionQueryOptions = {},
): CollectionQueryState => {
  const { defaultPage = 1, defaultSize = 12, maxSize = 100 } = options;

  const size = Math.min(
    maxSize,
    Math.max(1, toInt(searchParams.get("size"), defaultSize)),
  );
  const pageParam = Math.max(1, toInt(searchParams.get("page"), defaultPage));
  const hasOffset = searchParams.has("offset");
  const rawOffset = hasOffset
    ? Math.max(0, toInt(searchParams.get("offset"), 0))
    : (pageParam - 1) * size;
  // Offset (which window of the list) is authoritative. Fixes ?page=2&size=2&offset=0
  // where 0 is valid but is not a multiple of size for page 2, and 0 is not "missing".
  const page = Math.max(1, Math.floor(rawOffset / size) + 1);
  const offset = (page - 1) * size;
  const rawFilters = searchParams.get("filters");
  let filters: Record<string, string> = {};
  if (rawFilters) {
    try {
      const parsed = JSON.parse(rawFilters) as Record<string, unknown>;
      filters = Object.fromEntries(
        Object.entries(parsed)
          .filter(([, value]) => typeof value === "string")
          .map(([key, value]) => [key, parseFilterValueList(String(value)).join(",")]),
      );
    } catch {
      filters = {};
    }
  }

  return { page, size, offset, filters };
};

export const paginateCollection = <T>(
  list: T[],
  query: CollectionQueryState,
): PaginationSlice<T> => {
  const totalItems = list.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / query.size));
  const normalizedPage = Math.min(
    totalPages,
    Math.max(1, Math.floor(query.offset / query.size) + 1),
  );
  const start = (normalizedPage - 1) * query.size;
  const end = start + query.size;

  return {
    items: list.slice(start, end),
    totalItems,
    totalPages,
    start,
    end: Math.min(end, totalItems),
  };
};

export const buildCollectionHref = (
  pathname: string,
  query: CollectionQueryState,
  overrides: Partial<CollectionQueryState> = {},
): string => {
  const next: CollectionQueryState = {
    ...query,
    ...overrides,
  };
  const offsetFromPage = (next.page - 1) * next.size;
  const params = new URLSearchParams({
    page: String(next.page),
    size: String(next.size),
    /* Always follow page+size. Stale offset:0 is valid but must not break page 2+ links (0 is not nullish for ??) */
    offset: String(offsetFromPage),
  });
  if (Object.keys(next.filters ?? {}).length > 0) {
    const normalizedFilters = Object.fromEntries(
      Object.entries(next.filters).map(([key, value]) => [
        key,
        parseFilterValueList(value).join(","),
      ]),
    );
    params.set("filters", JSON.stringify(normalizedFilters));
  }
  return `${pathname}?${params.toString()}`;
};

export const matchesCollectionFilters = (
  values: Record<string, string[]>,
  filters: Record<string, string>,
): boolean =>
  Object.entries(filters).every(([key, value]) => {
    const expected = parseFilterValueList(value);
    const candidates = (values[key] ?? []).map(normalizeFilterToken);
    return expected.every((token) => candidates.includes(token));
  });

export const buildPageSequence = (
  totalPages: number,
  currentPage: number,
  maxButtons = 7,
): Array<number | "…"> => {
  if (totalPages <= maxButtons) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const innerSlots = Math.max(1, maxButtons - 2);
  const left = Math.max(2, currentPage - Math.floor(innerSlots / 2));
  const right = Math.min(totalPages - 1, left + innerSlots - 1);
  const adjustedLeft = Math.max(2, right - innerSlots + 1);

  const sequence: Array<number | "…"> = [1];
  if (adjustedLeft > 2) sequence.push("…");
  for (let page = adjustedLeft; page <= right; page += 1) sequence.push(page);
  if (right < totalPages - 1) sequence.push("…");
  sequence.push(totalPages);
  return sequence;
};

/**
 * For Astro server islands: the serialized `search` prop is usually set from the
 * page request, but the island subrequest may omit it. When empty, use the
 * `Referer` request header so `parseCollectionQuery` still matches the main document URL.
 */
/** "Showing …" for collection footers: avoids "3—3" when one item; uses en dash for ranges. */
export const formatCollectionRangeLabel = (slice: Pick<PaginationSlice<unknown>, "start" | "end" | "totalItems">): string => {
  if (slice.totalItems === 0) {
    return "Showing 0 of 0";
  }
  const a = slice.start + 1;
  const b = slice.end;
  if (a === b) {
    return `Showing result ${a} of ${slice.totalItems}`;
  }
  return `Showing results ${a}–${b} of ${slice.totalItems}`;
};

export const resolveIslandSearchString = (
  searchFromProps: string | undefined,
  request: Request,
): string => {
  if (searchFromProps) {
    return searchFromProps;
  }
  const referer = request.headers.get("referer") ?? "";
  if (!referer) {
    return "";
  }
  try {
    return new URL(referer).search;
  } catch {
    return "";
  }
};
