export type BadgeKey = 'invites' | 'unread';
export function useNavBadges(): Partial<Record<BadgeKey, number>> {
  return {};
}
