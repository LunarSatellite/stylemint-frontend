import { api } from '../../api/client';
import type { PagedResult } from '../../api/paging';

/**
 * Creator activity feed (CreatorStudio `/v1/creator/activity`) and the in-app notification inbox
 * (Messaging `/v1/notifications/inbox`). Both may mention other people, so both are fetched with
 * `privacy: 'mask-text'` — emails and phone numbers inside text are masked.
 *
 * The inbox returns a bare array (no cursor): the next page is `before = last item's queuedUtc`. Items carry a
 * `templateKey` and a JSON string of variables, not rendered text — `describeNotification` turns the creator
 * template keys into sentences.
 */

export const ActivityKind = {
  Earnings: 1,
  ReelPublished: 2,
  PartnershipRequest: 3,
  PartnershipAccepted: 4,
  MilestoneAchieved: 5,
  PayoutCompleted: 6,
  PayoutFailed: 7,
  AccountSecurity: 8,
} as const;
export const activityKindLabel: Record<number, string> = {
  1: 'Earnings',
  2: 'Reel published',
  3: 'Partnership request',
  4: 'Partnership accepted',
  5: 'Milestone',
  6: 'Payout paid',
  7: 'Payout failed',
  8: 'Account security',
};
export const ACTIVITY_FILTERS: { value: string; label: string; kinds: number[] | null }[] = [
  { value: 'all', label: 'All', kinds: null },
  { value: 'reels', label: 'Reels', kinds: [2] },
  { value: 'partnerships', label: 'Partnerships', kinds: [3, 4] },
  { value: 'money', label: 'Money & milestones', kinds: [1, 5, 6, 7] },
  { value: 'security', label: 'Security', kinds: [8] },
];

export interface ActivityEntry {
  id: string;
  kind: number;
  headline: string;
  body: string | null;
  actionUrl: string | null;
  occurredUtc: string;
}

export interface InboxItem {
  id: string;
  templateKey: string;
  category: number;
  variablesJson: string;
  queuedUtc: string;
  readUtc: string | null;
}

export const activityApi = {
  activity: (cursor: string | null, kinds: number[] | null) =>
    api.get<PagedResult<ActivityEntry>>('/v1/creator/activity', { cursor: cursor ?? undefined, pageSize: 25, kinds: kinds ?? undefined }, { privacy: 'mask-text' }),
  inbox: (before: string | null, pageSize = 30) =>
    api.get<InboxItem[]>('/v1/notifications/inbox', { before: before ?? undefined, pageSize }, { privacy: 'mask-text' }),
  markRead: (id: string) => api.post<boolean>(`/v1/notifications/inbox/${id}/read`),
  markAllRead: () => api.post<number>('/v1/notifications/inbox/read-all'),
};

function vars(item: InboxItem): Record<string, string> {
  try {
    const v = JSON.parse(item.variablesJson || '{}') as unknown;
    return v && typeof v === 'object' ? (v as Record<string, string>) : {};
  } catch {
    return {};
  }
}

const money = (amount?: string, currency?: string) => {
  const n = Number(amount);
  if (!amount || Number.isNaN(n)) return '';
  return `${currency === 'NPR' || !currency ? 'Rs ' : `${currency} `}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(n)}`;
};

/** A title, a line and an in-app link for a notification. Unknown templates get a neutral sentence. */
export function describeNotification(item: InboxItem): { title: string; body: string; to: string | null } {
  const v = vars(item);
  switch (item.templateKey) {
    case 'payout.paid':
      return { title: 'Payout sent', body: `${money(v.amount, v.currency)} is on its way to your account.`, to: '/payouts' };
    case 'payout.failed':
      return { title: 'Payout failed', body: v.failureMessage || 'Check your payout account and try again.', to: '/payouts' };
    case 'partnerships.invite.sent':
      return { title: 'New partnership invite', body: 'A brand wants to work with you.', to: v.partnershipId ? `/partnerships/${v.partnershipId}` : '/partnerships?tab=invites' };
    case 'partnerships.partnership.ended':
      return { title: 'A partnership ended', body: 'You can no longer tag this brand’s products.', to: '/partnerships?tab=past' };
    case 'creatorstudio.boost_offer.issued':
      return { title: 'Free boost offer', body: 'One of your reels is doing well — StyleMint offers to boost it for free. Accept within 30 minutes.', to: '/' };
    case 'creatorstudio.post_publish_report.generated':
      return { title: 'Your 24-hour report is ready', body: 'See how your reel did and what to try next.', to: '/reels' };
    case 'creatorstudio.story_arc.suggested':
      return { title: 'New story arc idea', body: 'A series of reels StyleMint thinks your audience will love.', to: '/studio?tab=arcs' };
    case 'socialgraph.tip.settled':
      return { title: 'You received a tip', body: v.amount ? `${money(v.amount, v.currency)} from a fan.` : 'A fan tipped you.', to: '/earnings?tab=tips' };
    case 'socialgraph.follow.created':
      return { title: 'New follower', body: 'Someone started following you.', to: '/profile' };
    case 'comment.reply':
      return { title: 'New reply', body: 'Someone replied to a comment.', to: null };
    case 'reputation.badge.awarded':
      return { title: 'Badge earned', body: 'You unlocked something new.', to: '/growth' };
    case 'reach.publish.failed':
      return { title: 'Cross-posting failed', body: v.reasonMessage || 'A scheduled post could not be published.', to: null };
    case 'reach.boost.spent':
    case 'reach.boost.paused':
    case 'reach.boost.resumed':
      return { title: 'Boost update', body: v.amount ? `Boost budget: ${money(v.amount, v.currency)}.` : 'Your boost changed.', to: null };
    default:
      return { title: 'Notification', body: item.templateKey.replace(/[._]/g, ' '), to: null };
  }
}
