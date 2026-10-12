import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { qk, staleTime, type ModerationFilter } from '../queryKeys';
import type { PagedList } from '../types';

/** Shape from `ModerationItemDto` in the backend spec. */
export interface ModerationItem {
  id: string;
  targetKind: number;
  targetId: string;
  source: number;
  reporterAccountId: string | null;
  reportReasonCode: string | null;
  state: number;
  assignedReviewerId: string | null;
  submittedUtc: string;
  decidedUtc: string | null;
  action: number | null;
  decisionNote: string | null;
  rowVersion: string;
}

export function useModerationQueue(filter: ModerationFilter) {
  return useQuery({
    queryKey: qk.moderation.queue(filter),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PagedList<ModerationItem>>('/v1/admin/moderation/queue', {
        params: {
          state: filter.status,
          targetKind: filter.kind,
          pageNumber: filter.page ?? 1,
          pageSize: filter.pageSize ?? 25,
        },
        signal,
      });
      return data;
    },
    // Short, like KYC: several moderators work this at once.
    staleTime: staleTime.moderationQueue,
  });
}
