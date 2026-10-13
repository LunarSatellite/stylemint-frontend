/** StyleMint's cursor page (StyleMint.Shared/Core/Results/PagedResult.cs). */
export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  nextCursor: string | null;
  previousCursor: string | null;
  pageSize: number;
  hasMore: boolean;
}

/** BulkResult<T> — per-row outcome, outer status always 200. */
export interface BulkItemResult<T> {
  index: number;
  success: boolean;
  value: T | null;
  errorCode: string | null;
  errorMessage: string | null;
  field: string | null;
}

export interface BulkResult<T> {
  items: BulkItemResult<T>[];
  successCount: number;
  failureCount: number;
  allSucceeded: boolean;
  anySucceeded: boolean;
  anyFailed: boolean;
}
