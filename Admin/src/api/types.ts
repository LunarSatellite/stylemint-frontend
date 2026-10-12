/** The server's paging envelope, used by every admin list endpoint. */
export interface PagedList<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/**
 * The audio module pages by cursor instead.
 *
 * A separate type rather than bending `PagedList` to fit: there is no
 * page number to jump to, and code treating `pageNumber` as optional
 * would quietly offer a pager that cannot work.
 */
export interface CursorList<T> {
  items: T[];
  totalCount: number;
  nextCursor: string | null;
  previousCursor: string | null;
  pageSize: number;
  hasMore: boolean;
}
