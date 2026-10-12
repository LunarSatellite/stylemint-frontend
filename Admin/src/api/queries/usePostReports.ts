import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { staleTime } from '../queryKeys';

/** Shape from `PostReportDto`. */
export interface PostReport {
  id: string;
  postId: string;
  reporterAccountId: string | null;
  reason: number;
  context: string | null;
  state: number;
  resolverAccountId: string | null;
  resolutionNote: string | null;
  resolvedUtc: string | null;
  createdUtc: string;
  updatedUtc: string | null;
  rowVersion: string;
}

export const socialFeedKeys = {
  all: () => ['social-feed'] as const,
  reports: (take: number) => ['social-feed', 'reports', take] as const,
};

/**
 * Reports on social-feed posts.
 *
 * Returns a bare array and takes only `take` — no cursor, no page
 * number. That is a third paging convention in this API, after the
 * numbered `PagedList` most lists use and the cursor the audio module
 * uses, so the page offers "show more" rather than a pager it cannot
 * drive.
 */
export function usePostReports(take = 50) {
  return useQuery({
    queryKey: socialFeedKeys.reports(take),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PostReport[]>('/v1/admin/social-feed/reports', {
        params: { take },
        signal,
      });
      return data;
    },
    // Short: several moderators work this queue at once.
    staleTime: staleTime.moderationQueue,
  });
}
