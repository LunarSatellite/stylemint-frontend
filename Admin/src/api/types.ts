/** The server's paging envelope, used by every admin list endpoint. */
export interface PagedList<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}
