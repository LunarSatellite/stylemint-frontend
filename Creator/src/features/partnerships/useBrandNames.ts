import { useQuery } from '@tanstack/react-query';
import { brandDirectory, type Brand } from './api';

/** vendorProfileId → brand, for lists that only carry the profile id. Never blocks the list: unknown → null. */
export function useBrandLookup(): (vendorProfileId: string) => Brand | null {
  const q = useQuery({ queryKey: ['partnerships', 'brand-directory'], queryFn: brandDirectory, staleTime: 10 * 60_000, retry: false });
  return (id) => q.data?.get(id) ?? null;
}
