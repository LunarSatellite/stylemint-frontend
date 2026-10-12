import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { staleTime } from '../queryKeys';

/** The fields of `ReelRecipeDto` this queue needs. */
export interface ReelRecipe {
  id: string;
  title: string;
  origin: number;
  authorVendorProfileId: string | null;
  sourceBrandBriefId: string | null;
  curatedByAdminAccountId: string | null;
  musicTrackRefId: string | null;
  captionVariants: unknown[] | null;
  platformAdaptations: unknown[] | null;
  beats: unknown[] | null;
}

export const recipeKeys = {
  all: () => ['recipes'] as const,
  drafts: (skip: number, take: number) => ['recipes', 'llm-drafts', skip, take] as const,
};

/**
 * Model-written recipes waiting for a person to sign them off.
 *
 * A fourth paging convention: `skip` and `take`, where other endpoints
 * use page numbers, a cursor, or `take` alone.
 */
export function useRecipeDrafts(skip = 0, take = 25) {
  return useQuery({
    queryKey: recipeKeys.drafts(skip, take),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<ReelRecipe[]>(
        '/v1/admin/recipes/llm-drafts-pending-review',
        { params: { skip, take }, signal },
      );
      return data;
    },
    staleTime: staleTime.moderationQueue,
  });
}
