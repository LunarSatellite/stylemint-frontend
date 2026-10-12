import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { qk, staleTime, type AuditFilter } from '../queryKeys';
import type { PagedList } from '../types';

/** Shape from `AdminAuditEntryDto`. */
export interface AuditEntry {
  id: string;
  adminAccountId: string;
  action: string;
  targetKind: string | null;
  targetId: string | null;
  reason: string | null;
  payloadJson: string | null;
  sourceIp: string | null;
  userAgent: string | null;
  occurredUtc: string;
}

export function useAuditLog(filter: AuditFilter) {
  return useQuery({
    queryKey: qk.audit(filter),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PagedList<AuditEntry>>('/v1/admin/audit', {
        params: {
          adminAccountId: filter.actorId,
          action: filter.action,
          fromUtc: filter.fromUtc,
          toUtc: filter.toUtc,
          pageNumber: filter.page ?? 1,
          pageSize: filter.pageSize ?? 50,
        },
        signal,
      });
      return data;
    },
    staleTime: staleTime.audit,
  });
}
