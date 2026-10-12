import { useCallback, useEffect, useState } from 'react';
import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';
import type { PagedResult } from './paging';

/**
 * Page-by-page navigation over a cursor-paged list. The cursor that starts every visited page is
 * remembered, so "Previous" works without the server supporting it. Changing `resetKey` (filters)
 * returns to page 1.
 */
export function useCursorList<T>(opts: {
  key: QueryKey;
  fetchPage: (cursor: string | null) => Promise<PagedResult<T>>;
  resetKey?: string;
  refetchInterval?: number | false;
  enabled?: boolean;
}) {
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const [page, setPage] = useState(1);
  const resetKey = opts.resetKey ?? '';

  useEffect(() => {
    setCursors([null]);
    setPage(1);
  }, [resetKey]);

  const cursor = cursors[page - 1] ?? null;
  const query = useQuery({
    queryKey: [...opts.key, resetKey, 'cursor', cursor],
    queryFn: () => opts.fetchPage(cursor),
    placeholderData: keepPreviousData,
    refetchInterval: opts.refetchInterval,
    enabled: opts.enabled ?? true,
  });

  const nextCursor = query.data?.nextCursor ?? null;
  const next = useCallback(() => {
    if (!nextCursor) return;
    setCursors((c) => {
      const copy = c.slice(0, page);
      copy[page] = nextCursor;
      return copy;
    });
    setPage((p) => p + 1);
  }, [nextCursor, page]);

  const prev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  const first = useCallback(() => setPage(1), []);

  const pageSize = query.data?.pageSize ?? 25;
  return {
    query,
    page,
    pageSize,
    total: query.data?.totalCount ?? null,
    hasNext: !!nextCursor,
    hasPrev: page > 1,
    next,
    prev,
    first,
  };
}
