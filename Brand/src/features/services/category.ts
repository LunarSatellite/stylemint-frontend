import { useQuery } from '@tanstack/react-query';
import { useSession } from '../../auth/useSession';
import { settingsApi } from '../settings/api';

/**
 * A vendor is either a product seller (0) or a service vendor (service-banks-contract v1 §1). The category is
 * chosen on the vendor application, copied to the vendor profile on approval and read-only afterwards.
 */
export const ServiceCategory = { None: 0, Hotel: 1, TravelAgency: 2, Bank: 3 } as const;
export type ServiceCategoryValue = (typeof ServiceCategory)[keyof typeof ServiceCategory];

export const serviceCategoryLabel: Record<number, string> = {
  0: 'Product seller',
  1: 'Hotel',
  2: 'Travel agency',
  3: 'Bank',
};

export function toServiceCategory(value: unknown): ServiceCategoryValue {
  const n = typeof value === 'number' ? value : Number(value);
  return n === 1 || n === 2 || n === 3 ? n : 0;
}

/** Hotels and travel agencies take bookings (service-bookings contract); banks take leads. */
export const takesBookings = (c: number) => c === ServiceCategory.Hotel || c === ServiceCategory.TravelAgency;

/**
 * The signed-in vendor's service category, from the vendor profile (same query key as Store settings, so one
 * request serves both). A missing profile, an older server without the field, or an error all mean "product
 * seller" — product sellers must see no change.
 */
export function useServiceCategory(): { category: ServiceCategoryValue; isPending: boolean } {
  const { accountId, status } = useSession();
  const q = useQuery({
    queryKey: ['vendor-profile', accountId],
    queryFn: () => settingsApi.profile(accountId!),
    enabled: !!accountId && status === 'signedIn',
    staleTime: 5 * 60_000,
  });
  return { category: toServiceCategory(q.data?.serviceCategory), isPending: q.isLoading };
}
