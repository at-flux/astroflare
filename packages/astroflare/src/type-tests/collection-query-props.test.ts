import type { CollectionQueryProps } from "../components/collection-query-props";

const validServerProps: CollectionQueryProps = {
  useServer: true,
  pathname: "/example",
  query: { page: 1, size: 12, offset: 0, filters: {} },
  totalPages: 3,
  currentPage: 1,
};

const validClientProps: CollectionQueryProps = {
  perPage: 6,
};

// @ts-expect-error server mode requires pathname/query/totalPages/currentPage
const invalidServerProps: CollectionQueryProps = {
  useServer: true,
};

void validServerProps;
void validClientProps;
void invalidServerProps;
