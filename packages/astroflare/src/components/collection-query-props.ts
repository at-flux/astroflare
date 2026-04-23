import type { CollectionQueryState } from "../collection-query";

export interface CollectionQueryFilterOption {
  key: string;
  value: string;
  label?: string;
}

interface CollectionQueryBaseProps {
  /** Available filters for filter pill rendering. */
  filters?: CollectionQueryFilterOption[];
  /** Max visible pager buttons before ellipsis. */
  maxPageButtons?: number;
  /** Optional wrapper class for filter pills row. */
  filtersClass?: string;
  /** Optional wrapper class for pager row. */
  pagerClass?: string;
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
}

export interface CollectionQueryClientProps extends CollectionQueryBaseProps {
  /** Client mode (default): filters and pagination are handled in-browser. */
  useServer?: false;
}

export type CollectionQueryProps = CollectionQueryServerProps | CollectionQueryClientProps;
