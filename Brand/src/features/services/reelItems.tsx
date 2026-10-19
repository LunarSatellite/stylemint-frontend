import { Badge, Tooltip } from '@mantine/core';
import { IconMovie } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api, isMissingEndpoint } from '../../api/client';
import type { PagedResult } from '../../api/paging';
import { formatMoney } from '../../lib/format';

/**
 * Service items in reels — D:\Stylemint\wt\service-items-contract.md v1.
 * Every PUBLISHED hotel property, travel package and bank product is mirrored as one Catalog item whose
 * product id IS the listing id (bank product id for banks). Items are taggable in reels like products.
 * `GET v1/tag-picker/items` lists taggable items (products + service items); until the deploy it 404s with no
 * errorCode and every caller degrades (no badge, "being set up").
 */

export const ServiceItemType = { Stay: 1, Package: 2, Bank: 3 } as const;
export const serviceItemTypeLabel: Record<number, string> = { 1: 'Hotel stay', 2: 'Travel package', 3: 'Bank product' };

export interface DisplayPrice {
  amount: number | null;
  currency: string;
  /** "night" (stay) · "person" (package) · null. */
  unit: string | null;
  isFrom: boolean;
  /** Server-formatted ("from Rs 4,500/night"); null for bank items. */
  label: string | null;
}

export interface TaggableItem {
  productId: string;
  name: string;
  primaryImageUrl: string | null;
  vendorAccountId: string;
  vendorDisplayName: string | null;
  isService: boolean;
  serviceType: number | null;
  serviceListingId: string | null;
  displayPrice: DisplayPrice | null;
  addableToCart: boolean;
  defaultVariantId: string | null;
  createdUtc: string;
}

export interface TagPickerQuery {
  q?: string;
  scope?: 'all' | 'mine';
  kind?: 'all' | 'product' | 'service';
  serviceType?: number;
  cursor?: string | null;
  pageSize?: number;
}

export const REEL_ITEMS_KEY = ['reel-items'] as const;

export const tagPickerApi = {
  items: (query: TagPickerQuery) =>
    api.get<PagedResult<TaggableItem>>('/v1/tag-picker/items', {
      q: query.q?.trim() ? query.q.trim().slice(0, 100) : undefined,
      scope: query.scope ?? 'mine',
      kind: query.kind && query.kind !== 'all' ? query.kind : undefined,
      serviceType: query.serviceType,
      cursor: query.cursor ?? undefined,
      pageSize: query.pageSize ?? 20,
    }),
};

/**
 * The price a buyer sees on the tag: the server label when there is one, else a local fallback
 * ("from Rs 4,500/night", "Rs 45,000 per person", "Dates coming soon", "Enquiry only").
 */
export function priceLabel(item: Pick<TaggableItem, 'displayPrice' | 'serviceType' | 'isService'>): string {
  const p = item.displayPrice;
  if (p?.label) return p.label;
  if (item.serviceType === ServiceItemType.Bank) return 'Enquiry only';
  if (!p || p.amount == null) return item.serviceType === ServiceItemType.Package ? 'Dates coming soon' : '—';
  const money = formatMoney({ amount: p.amount, currency: p.currency || 'NPR' });
  const unit = p.unit === 'night' ? '/night' : p.unit === 'person' ? ' per person' : '';
  return `${p.isFrom ? 'from ' : ''}${money}${unit}`;
}

/** Up to 5 pages of this vendor's own service items, as a set of product ids (= listing / bank product ids). */
async function myServiceItemIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let cursor: string | null = null;
  for (let i = 0; i < 5; i++) {
    const page: PagedResult<TaggableItem> = await tagPickerApi.items({ scope: 'mine', kind: 'service', cursor, pageSize: 50 });
    for (const it of page.items ?? []) {
      ids.add(it.productId);
      if (it.serviceListingId) ids.add(it.serviceListingId);
    }
    if (!page.hasMore || !page.nextCursor) break;
    cursor = page.nextCursor;
  }
  return ids;
}

export type ReelVisibility = 'visible' | 'pending' | 'hidden' | 'unknown';

/**
 * Which of this vendor's listings are taggable in reels. `known` is false while loading, on an error or while the
 * picker endpoint is not deployed — then no badge is shown (never a wrong "hidden").
 */
export function useReelItems() {
  const q = useQuery({
    queryKey: [...REEL_ITEMS_KEY, 'mine-services'],
    queryFn: myServiceItemIds,
    staleTime: 60_000,
    retry: (n, e) => !isMissingEndpoint(e) && n < 1,
  });
  return {
    known: !!q.data,
    missing: isMissingEndpoint(q.error),
    visibility(id: string, published: boolean): ReelVisibility {
      if (!q.data) return 'unknown';
      if (q.data.has(id)) return 'visible';
      return published ? 'pending' : 'hidden';
    },
  };
}

const LOOK: Record<Exclude<ReelVisibility, 'unknown'>, { label: string; color: string; tip: string }> = {
  visible: {
    label: 'Visible in reels as an item',
    color: 'forest',
    tip: 'You and creators can tag it in reels; buyers open it like any item.',
  },
  pending: {
    label: 'Not in reels yet',
    color: 'amber',
    tip: 'Published listings become reel items within a few minutes. Refresh later.',
  },
  hidden: {
    label: 'Hidden from reels',
    color: 'gray',
    tip: 'Only published listings can be tagged in reels. Existing tags show again when you publish.',
  },
};

export function ReelVisibilityBadge({ visibility }: { visibility: ReelVisibility }) {
  if (visibility === 'unknown') return null;
  const look = LOOK[visibility];
  return (
    <Tooltip label={look.tip} multiline w={240} withArrow>
      <Badge variant="light" color={look.color} size="sm" leftSection={<IconMovie size={12} />} data-testid="reel-visibility">
        {look.label}
      </Badge>
    </Tooltip>
  );
}
