import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { qk, staleTime } from '../queryKeys';

export interface FeatureFlagOverride {
  id?: string;
  audience?: number;
  roleKind?: number;
  value?: boolean;
  [key: string]: unknown;
}

/** Shape from `FeatureFlagDto`. */
export interface FeatureFlag {
  id: string;
  key: string;
  defaultEnabled: boolean;
  description: string | null;
  createdUtc: string;
  updatedUtc: string | null;
  rowVersion: string;
  overrides: FeatureFlagOverride[] | null;
}

/**
 * This endpoint returns a bare array, not the paged envelope the list
 * endpoints use. Assuming otherwise would have read `.items` off an
 * array and rendered an empty table against a perfectly good response.
 */
export function useFeatureFlags() {
  return useQuery({
    queryKey: qk.flags(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<FeatureFlag[]>('/v1/admin/feature-flags', { signal });
      return data;
    },
    staleTime: staleTime.flags,
  });
}
