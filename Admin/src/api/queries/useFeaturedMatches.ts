import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { staleTime } from '../queryKeys';
import type { CursorList } from '../types';

/** Shape from `FeaturedMatchCandidateDto`. */
export interface FeaturedMatch {
  id: string;
  matchSnapshotId: string;
  state: number;
  reviewedByAccountId: string | null;
  reviewerNote: string | null;
  reviewedUtc: string | null;
  pushedUtc: string | null;
  proposedUtc: string;
  createdUtc: string;
  rowVersion: string;
}

/** Shape from `FairnessAuditReportDto`. */
export interface FairnessAudit {
  reportId: string;
  ranUtc: string;
  scorerVersion: string | null;
  passed: boolean;
  maxDisparityIndex: number | null;
  axes: unknown[] | null;
}

export const matchmakingKeys = {
  all: () => ['matchmaking'] as const,
  pending: (cursor?: string) => ['matchmaking', 'featured', cursor ?? null] as const,
  fairness: () => ['matchmaking', 'fairness'] as const,
};

export function useFeaturedPending(cursor?: string) {
  return useQuery({
    queryKey: matchmakingKeys.pending(cursor),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<CursorList<FeaturedMatch>>(
        '/v1/admin/matchmaking/featured/pending',
        { params: { cursor, pageSize: 25 }, signal },
      );
      return data;
    },
    staleTime: staleTime.moderationQueue,
  });
}

/**
 * The most recent fairness audit of the matching algorithm.
 *
 * Shown above the approval queue on purpose: an operator approving
 * featured matches should know whether the thing proposing them
 * currently passes its own fairness check.
 */
export function useFairnessAudit() {
  return useQuery({
    queryKey: matchmakingKeys.fairness(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<FairnessAudit>(
        '/v1/admin/matchmaking/fairness-audit/latest',
        { signal },
      );
      return data;
    },
    staleTime: staleTime.audit,
  });
}
