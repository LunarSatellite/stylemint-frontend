import { useQuery } from '@tanstack/react-query';
import { activityApi } from '../activity/api';
import { partnershipsApi, pendingActor } from '../partnerships/api';

export type BadgeKey = 'invites' | 'unread';

/** Counts for the sidebar and tab bar: brand invites waiting on the creator, unread notifications. */
export function useNavBadges(): Partial<Record<BadgeKey, number>> {
  const invites = useQuery({
    queryKey: ['partnerships', 'badge'],
    queryFn: async () => (await partnershipsApi.list([1], null, 50)).items.filter((p) => pendingActor(p) === 'creator').length,
    refetchInterval: 120_000,
    staleTime: 30_000,
  });
  const unread = useQuery({
    queryKey: ['inbox', 'badge'],
    queryFn: async () => (await activityApi.inbox(null, 50)).filter((i) => !i.readUtc).length,
    refetchInterval: 60_000,
    staleTime: 20_000,
  });
  return { invites: invites.data ?? 0, unread: unread.data ?? 0 };
}
