import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { qk, staleTime, type KycQueueFilter } from '../queryKeys';
import type { KycApplicantKind, KycState } from '@/lib/enums';

/**
 * The KYC review queue.
 *
 * Shapes come from `swagger-spec.json` (`KycReviewItemDto`,
 * `PagedList<T>`) rather than from the written brief, which names the
 * endpoints illustratively. `rowVersion` is carried through because a
 * decision has to send it back: two reviewers open the same case, and
 * the second write must be rejected rather than silently overwrite the
 * first.
 */
export interface KycReviewItem {
  id: string;
  applicantKind: KycApplicantKind;
  applicationId: string;
  accountId: string;
  state: KycState;
  assignedReviewerId: string | null;
  submittedUtc: string;
  dueByUtc: string | null;
  decidedUtc: string | null;
  decision: number | null;
  decisionReasonCode: string | null;
  decisionNote: string | null;
  rowVersion: string;
}

export interface PagedList<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
}

/** The query's own parameter names, which differ from the UI's filter. */
function toParams(filter: KycQueueFilter): Record<string, unknown> {
  return {
    state: filter.status,
    pageNumber: filter.page ?? 1,
    pageSize: filter.pageSize ?? 25,
  };
}

export function useKycQueue(filter: KycQueueFilter) {
  return useQuery({
    queryKey: qk.kyc.queue(filter),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PagedList<KycReviewItem>>('/v1/admin/kyc/queue', {
        params: toParams(filter),
        signal,
      });
      return data;
    },
    // Ten seconds, because several reviewers work this queue at once and
    // a stale row is a case two people both pick up.
    staleTime: staleTime.kycQueue,
  });
}
