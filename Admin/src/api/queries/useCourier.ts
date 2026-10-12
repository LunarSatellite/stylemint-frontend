import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { staleTime } from '../queryKeys';

/** Shape from `CourierProfileDto`. */
export interface CourierProfile {
  id: string;
  accountId: string;
  state: number;
  currentTier: number;
  governmentIdLast4: string | null;
  selfieMatchRef: string | null;
  kycVerifiedUtc: string | null;
  backgroundCheckPassedUtc: string | null;
  trainingPassedUtc: string | null;
  onboardedUtc: string | null;
  travelerUnlockedUtc: string | null;
  proUnlockedUtc: string | null;
  suspendedUtc: string | null;
  suspendedReason: string | null;
  failureStreak: number;
  homeGeohash: string | null;
  vehicle: number | null;
  escrowHeldAmount: number | null;
  escrowRequiredAmount: number | null;
  escrowCurrency: string | null;
  createdUtc: string;
}

export const courierKeys = {
  all: () => ['courier'] as const,
  byId: (id: string) => ['courier', id] as const,
};

/**
 * One courier, by profile id.
 *
 * There is no admin list endpoint for couriers -- the nine admin
 * operations are all writes against a known id. This read is
 * `/v1/courier/{id}`, which is not admin-scoped, so it may refuse an
 * operator token. If it does, the page says so rather than rendering
 * an empty profile: "we could not read this" and "no such courier"
 * are different answers and a support agent needs to know which.
 */
export function useCourier(courierProfileId: string | undefined) {
  return useQuery({
    queryKey: courierKeys.byId(courierProfileId ?? ''),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<CourierProfile>(`/v1/courier/${courierProfileId}`, { signal });
      return data;
    },
    enabled: Boolean(courierProfileId),
    staleTime: staleTime.admins,
  });
}
