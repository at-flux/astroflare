export interface PagedGridLayoutInput {
  /** Column counts, narrowest first. Every step must divide `perPage`. */
  columns?: readonly number[];
  /** Rows per page at the widest step. */
  rows?: number;
  /** Overrides `columns` × `rows` when the page size is fixed by the data. */
  perPage?: number;
}

export interface PagedGridLayout {
  columns: number[];
  rows: number;
  perPage: number;
}

/**
 * Work out the page size for a grid whose rows must always come out full.
 *
 * A grid that reflows to whatever fits — `auto-fill`, or a three-column step
 * between two and four — leaves a ragged last row on most page sizes, and the
 * ragged row is what everyone notices. Declaring the column steps instead, and
 * requiring each of them to divide the page size, means every page is a whole
 * number of rows at every width.
 *
 * @throws if a column step does not divide `perPage`, because the alternative is
 * a grid that looks broken at one breakpoint and fine at the others.
 */
export function resolvePagedGridLayout({
  columns = [2, 4],
  rows = 2,
  perPage,
}: PagedGridLayoutInput = {}): PagedGridLayout {
  const steps = [...columns];
  if (steps.length === 0)
    throw new Error("paged grid: `columns` cannot be empty");
  for (const step of steps) {
    if (!Number.isInteger(step) || step < 1) {
      throw new Error(
        `paged grid: column step ${step} must be a positive integer`,
      );
    }
  }
  if (!Number.isInteger(rows) || rows < 1) {
    throw new Error(
      `paged grid: \`rows\` must be a positive integer, got ${rows}`,
    );
  }

  const widest = Math.max(...steps);
  const size = perPage ?? widest * rows;
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(
      `paged grid: \`perPage\` must be a positive integer, got ${size}`,
    );
  }
  const ragged = steps.filter((step) => size % step !== 0);
  if (ragged.length > 0) {
    throw new Error(
      `paged grid: page size ${size} leaves a part-filled row at ${ragged.join(", ")} column(s). ` +
        `Pick a page size divisible by every column step (${steps.join(", ")}).`,
    );
  }

  return { columns: steps, rows: size / widest, perPage: size };
}
