/**
 * The API pages lists in several shapes - `PagedList` (items, pageNumber, pageSize, totalCount, totalPages), cursor
 * lists (items, nextCursor, hasMore), and bare arrays. Screens only ever see this one shape, so a table can be
 * written once and getting a list's convention wrong shows up here, not as "missing data" on one page.
 */
export interface Page<T> {
  items: T[];
  /** Known only for counted lists. */
  total?: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  nextCursor?: string | null;
}

function num(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function toPage<T>(raw: unknown, page = 1, pageSize = 25): Page<T> {
  if (Array.isArray(raw)) {
    // A bare array of `take` rows: there may be more when it came back full.
    return { items: raw as T[], page, pageSize, hasMore: raw.length >= pageSize, total: undefined };
  }
  const obj = (raw ?? {}) as Record<string, unknown>;
  const items = (Array.isArray(obj.items) ? obj.items : Array.isArray(obj.data) ? obj.data : Array.isArray(obj.results) ? obj.results : []) as T[];
  const total = num(obj.totalCount) ?? num(obj.total) ?? num(obj.totalItems);
  const current = num(obj.pageNumber) ?? num(obj.page) ?? page;
  const size = num(obj.pageSize) ?? num(obj.take) ?? pageSize;
  const totalPages = num(obj.totalPages) ?? (total !== undefined ? Math.max(1, Math.ceil(total / Math.max(1, size))) : undefined);
  const nextCursor = typeof obj.nextCursor === 'string' ? obj.nextCursor : null;
  const hasMore =
    typeof obj.hasMore === 'boolean'
      ? obj.hasMore
      : typeof obj.hasNextPage === 'boolean'
        ? obj.hasNextPage
        : totalPages !== undefined
          ? current < totalPages
          : items.length >= size;
  return { items, total, page: current, pageSize: size, hasMore, nextCursor };
}

/** Paging query for the PagedList convention. */
export function pagingQuery(page: number, pageSize: number) {
  return { pageNumber: page, pageSize };
}
