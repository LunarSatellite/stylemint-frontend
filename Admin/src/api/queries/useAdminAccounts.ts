import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { qk, staleTime, type AdminFilter } from '../queryKeys';
import type { PagedList } from '../types';

/** Shape from `AdminAccountDto`. `roles` is the wire integer array. */
export interface AdminAccount {
  id: string;
  ssoSubject: string;
  email: string;
  displayName: string | null;
  state: number;
  lastLoginUtc: string | null;
  createdUtc: string;
  updatedUtc: string | null;
  rowVersion: string;
  roles: number[];
}

export function useAdminAccounts(filter: AdminFilter) {
  return useQuery({
    queryKey: qk.admins(filter),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PagedList<AdminAccount>>('/v1/admin/admins', {
        // The endpoint pages and nothing else; search and role filters
        // in the brief have no server support, so they are not sent.
        params: { pageNumber: filter.page ?? 1, pageSize: filter.pageSize ?? 25 },
        signal,
      });
      return data;
    },
    staleTime: staleTime.admins,
  });
}
