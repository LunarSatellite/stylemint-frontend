import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Page numbers over a cursor list. The cursor for page N is the `nextCursor` page N-1 returned; they are remembered
 * as pages load and forgotten when the filters change. A page whose cursor is unknown (a reload on page 4) falls back
 * to page 1 rather than showing the wrong rows.
 */
export function useCursorPages(resetKey: string, page: number, setPage: (p: number) => void) {
  const cursors = useRef<Map<number, string | null>>(new Map([[1, null]]));
  const [, force] = useState(0);

  useEffect(() => {
    cursors.current = new Map([[1, null]]);
    force((n) => n + 1);
  }, [resetKey]);

  const known = cursors.current.has(page);
  useEffect(() => {
    if (!known) setPage(1);
  }, [known, setPage]);

  const remember = useCallback((forPage: number, nextCursor: string | null | undefined) => {
    if (nextCursor && !cursors.current.has(forPage + 1)) cursors.current.set(forPage + 1, nextCursor);
  }, []);

  return { cursor: cursors.current.get(page) ?? null, ready: known, remember };
}
