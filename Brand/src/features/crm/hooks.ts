import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { keepPreviousData, useQuery, type QueryKey } from '@tanstack/react-query';
import type { CrmPage } from './client';
import { can, visibleAreas, type CrmCapability } from './roles';
import { crmSession, type CrmSessionState } from './session';

/** The CRM session state. With `acquire`, asks for a session when there is none yet. */
export function useCrmSession({ acquire = false }: { acquire?: boolean } = {}): CrmSessionState {
  const state = useSyncExternalStore(crmSession.subscribe, crmSession.getState, crmSession.getState);
  useEffect(() => {
    if (acquire && state.status === 'idle') void crmSession.acquire();
  }, [acquire, state.status]);
  return state;
}

/** Does the seller's CRM role allow this? False until the session is ready. */
export function useCan(capability: CrmCapability): boolean {
  const { role, status } = useCrmSession();
  return status === 'ready' && can(role, capability);
}

export function useVisibleAreas() {
  const { role, areas, status } = useCrmSession();
  return useMemo(() => visibleAreas(status === 'ready' ? role : null, areas), [role, areas, status]);
}

/** Query keys of every CRM query start with this, so sign-out / tenant change can drop them. */
export const CRM_KEY = 'crm';

/**
 * Page-number paging over an OmniFlow list (`page`, `pageSize`, `totalPages`). Changing
 * `resetKey` (filters) goes back to page 1.
 */
export function usePagedQuery<T>(opts: {
  key: QueryKey;
  fetchPage: (page: number, pageSize: number) => Promise<CrmPage<T>>;
  resetKey?: string;
  pageSize?: number;
  enabled?: boolean;
}) {
  const pageSize = opts.pageSize ?? 20;
  const resetKey = opts.resetKey ?? '';
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [resetKey]);
  const query = useQuery({
    queryKey: [CRM_KEY, ...opts.key, resetKey, 'page', page, pageSize],
    queryFn: () => opts.fetchPage(page, pageSize),
    placeholderData: keepPreviousData,
    enabled: opts.enabled ?? true,
  });
  const totalPages = query.data?.totalPages ?? 1;
  const next = useCallback(() => setPage((p) => p + 1), []);
  const prev = useCallback(() => setPage((p) => Math.max(1, p - 1)), []);
  return {
    query,
    page,
    pageSize,
    total: query.data?.totalCount ?? null,
    items: query.data?.items ?? [],
    hasPrev: page > 1,
    hasNext: page < totalPages,
    next,
    prev,
  };
}

/** Paging for endpoints that return the whole list at once. */
export function useClientPage<T>(items: T[] | undefined, pageSize = 20, resetKey = '') {
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [resetKey]);
  const all = items ?? [];
  const totalPages = Math.max(1, Math.ceil(all.length / pageSize));
  const current = Math.min(page, totalPages);
  return {
    page: current,
    pageSize,
    total: all.length,
    items: all.slice((current - 1) * pageSize, current * pageSize),
    hasPrev: current > 1,
    hasNext: current < totalPages,
    next: () => setPage(Math.min(totalPages, current + 1)),
    prev: () => setPage(Math.max(1, current - 1)),
  };
}
