import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { staleTime } from '../queryKeys';

/** Shape from `PopularSearchDto`. */
export interface PopularSearch {
  id: string;
  label: string;
  query: string;
  displayOrder: number;
  regionCode: string | null;
  isActive: boolean;
  createdUtc: string;
  updatedUtc: string | null;
  rowVersion: string;
}

export const catalogKeys = {
  all: () => ['catalog'] as const,
  popularSearches: (region?: string) => ['catalog', 'popular-searches', region ?? null] as const,
};

/**
 * The suggested searches shown in the app.
 *
 * `label` is what a shopper reads; `query` is what actually runs. They
 * are separate fields and the table shows both, because a suggestion
 * whose label and query have drifted apart sends people somewhere
 * they did not ask to go.
 */
export function usePopularSearches(region?: string) {
  return useQuery({
    queryKey: catalogKeys.popularSearches(region),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<PopularSearch[]>('/v1/admin/catalog/popular-searches', {
        params: { region },
        signal,
      });
      return data;
    },
    staleTime: staleTime.config,
  });
}
