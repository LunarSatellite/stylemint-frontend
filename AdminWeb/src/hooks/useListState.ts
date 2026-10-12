import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A list's page, page size, search and filters, kept in the address bar so a reload, a shared link or the back
 * button returns to the same view. The search box is debounced (300 ms) before it reaches the query.
 */
export function useListState<F extends string>(filterKeys: readonly F[] = [], defaults: { pageSize?: number } & Partial<Record<F, string>> = {}) {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get('page')) || 1);
  const pageSize = Number(params.get('size')) || defaults.pageSize || 25;
  const search = params.get('q') ?? '';
  const selected = params.get('open');

  const [searchInput, setSearchInput] = useState(search);
  useEffect(() => setSearchInput(search), [search]);

  const update = useCallback(
    (changes: Record<string, string | number | null | undefined>, resetPage = true) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          for (const [k, v] of Object.entries(changes)) {
            if (v === null || v === undefined || v === '') next.delete(k);
            else next.set(k, String(v));
          }
          if (resetPage && !('page' in changes)) next.delete('page');
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  useEffect(() => {
    if (searchInput === search) return;
    const timer = window.setTimeout(() => update({ q: searchInput.trim() || null }), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput, search, update]);

  const filterString = filterKeys.map((k) => `${k}=${params.get(k) ?? ''}`).join('&');
  const filters = useMemo(() => {
    const out = {} as Record<F, string>;
    for (const key of filterKeys) out[key] = params.get(key) ?? (defaults[key] as string | undefined) ?? '';
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterString]);

  const filtered = search !== '' || filterKeys.some((k) => (params.get(k) ?? '') !== '' && params.get(k) !== defaults[k]);

  return {
    page,
    pageSize,
    search,
    searchInput,
    setSearchInput,
    filters,
    filtered,
    selected,
    setPage: (p: number) => update({ page: p > 1 ? p : null }, false),
    setPageSize: (s: number) => update({ size: s }),
    setFilter: (key: F, value: string | null) => update({ [key]: value }),
    clearFilters: () => {
      setSearchInput('');
      update(Object.fromEntries([['q', null], ...filterKeys.map((k) => [k, null])]));
    },
    open: (id: string | null) => update({ open: id }, false),
  };
}
