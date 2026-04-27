import type { CollectionQueryState } from "../collection-query";

export interface CollectionQueryFilterOption {
  key: string;
  value: string;
  label?: string;
}

interface CollectionQueryBaseProps {
  /** Extra query params to preserve across filter/pager/size interactions. */
  stickyParams?: Record<string, string>;
  /** Optional title shown above filters block in server mode. */
  filtersTitle?: string;
  /** Label shown left of tag pills in server mode. */
  filtersLabel?: string;
  /** Label shown left of optional extra filters slot in server mode. */
  extraFiltersLabel?: string;
  /** Controls whether the optional extra-filters row renders. */
  showExtraFilters?: boolean;
  /** Available filters for filter pill rendering. */
  filters?: CollectionQueryFilterOption[];
  /** Max visible pager buttons before ellipsis. */
  maxPageButtons?: number;
  /** Optional wrapper class for filter pills row. */
  filtersClass?: string;
  /** Optional wrapper class for pager row. */
  pagerClass?: string;
  /** Available page sizes for server-mode size selector. */
  sizeOptions?: number[];
  /** Toggle server-mode page size selector visibility. */
  showPageSize?: boolean;
  /** Optional wrapper class for page-size selector. */
  pageSizeClass?: string;
  /** Visible cards per page in client mode. */
  perPage?: number;
  /** Classes applied to the host wrapper element in client mode. */
  class?: string;
}

export interface CollectionQueryServerProps extends CollectionQueryBaseProps {
  /**
   * Enables URL-driven server query mode.
   * Mount with `server:defer` at the callsite when true.
   */
  useServer: true;
  /** Route pathname used to build querystring links in server mode. */
  pathname: string;
  /** Parsed query state for the current request in server mode. */
  query: CollectionQueryState;
  /** Total pages for current filtered collection in server mode. */
  totalPages: number;
  /** Currently selected page (1-based) in server mode. */
  currentPage: number;
  /** Total filtered items for current query (used for empty-state control behavior). */
  totalItems?: number;
}

export interface CollectionQueryClientProps extends CollectionQueryBaseProps {
  /** Client mode (default): filters and pagination are handled in-browser. */
  useServer?: false;
}

export type CollectionQueryProps = CollectionQueryServerProps | CollectionQueryClientProps;
