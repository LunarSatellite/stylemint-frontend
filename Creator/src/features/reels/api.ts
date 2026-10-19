import { api, ApiError, isMissingEndpoint } from '../../api/client';
import type { BulkResult, PagedResult } from '../../api/paging';
import { formatMoney, type Money } from '../../lib/format';

/**
 * Reels (Reels module CreatorReelsController + CreatorStudio post-publish report + Social content listing +
 * Discovery product search + Partnerships tag-time commission). Shapes copied from the backend DTOs.
 *
 * - StyleMint never hosts reel video: a reel is imported by URL from Instagram / TikTok / YouTube Shorts /
 *   Facebook, then products are tagged on it, then it is published (or, for a campaign reel, submitted to the
 *   brand for approval).
 * - Import uniqueness is global on (platform, externalId): 409 `state.duplicate` field `external_id`.
 * - Tagging needs an ACTIVE partnership with the product's vendor: 400 `rule.violation` field `partnershipId`.
 *   `/v1/creator/tag-products/commission` says up front which products can be tagged (status "Applies").
 * - Overlay x/y are fractions of the frame (0–1); appear/disappear are seconds within the reel's duration.
 * - Commission units: TaggedProduct.commissionRateSnapshotPercent is a PERCENT; the commission endpoint
 *   returns FRACTIONS.
 */

export const ReelPlatform = { Instagram: 1, TikTok: 2, YouTubeShorts: 3, Facebook: 4 } as const;
export const platformLabel: Record<number, string> = { 1: 'Instagram', 2: 'TikTok', 3: 'YouTube Shorts', 4: 'Facebook' };
export type ProviderSlug = 'instagram' | 'tiktok' | 'youtube' | 'facebook';
export const slugToPlatform: Record<ProviderSlug, number> = { instagram: 1, tiktok: 2, youtube: 3, facebook: 4 };
export const PROVIDER_SLUGS: ProviderSlug[] = ['instagram', 'tiktok', 'youtube', 'facebook'];

export const ReelState = { Draft: 1, Processing: 2, Published: 3, Unpublished: 4, ExternalDeleted: 5, PendingApproval: 6 } as const;
export const reelStateLabel: Record<number, string> = {
  1: 'Draft',
  2: 'Processing',
  3: 'Published',
  4: 'Unpublished',
  5: 'Deleted on platform',
  6: 'Awaiting brand approval',
};
export const reelStateColor: Record<number, string> = { 1: 'gray', 2: 'blue', 3: 'forest', 4: 'slate', 5: 'signal', 6: 'amber' };
export const canPublishFrom = (state: number) => state === 1 || state === 2 || state === 4;
export const canUnpublishFrom = (state: number) => state === 3;

export const approvalStateLabel: Record<number, string> = { 1: 'Waiting for the brand', 2: 'Approved', 3: 'Changes requested', 4: 'Expired (no answer)' };
export const approvalStateColor: Record<number, string> = { 1: 'amber', 2: 'forest', 3: 'signal', 4: 'gray' };

export const CAPTION_MAX = 2200;
export const CAPTION_RECOMMENDED = 300;
export const APPROVAL_NOTE_MAX = 1000;
export const MAX_DURATION_SECONDS = 3600;

/** SourceUrlPolicy.cs host allowlist. */
export const ALLOWED_HOSTS: Record<number, string[]> = {
  1: ['instagram.com', 'ig.me'],
  2: ['tiktok.com'],
  3: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
  4: ['facebook.com', 'fb.watch', 'fb.me'],
};

export interface TaggedProduct {
  id: string;
  reelId: string;
  productId: string;
  partnershipIdSnapshot: string;
  /** PERCENT 0–100. */
  commissionRateSnapshotPercent: number;
  productPriceSnapshotAmount: number;
  productPriceSnapshotCurrency: string;
  commissionPerSaleSnapshotAmount: number;
  commissionPerSaleSnapshotCurrency: string;
  overlayPositionX: number;
  overlayPositionY: number;
  appearAtSeconds: number | null;
  disappearAtSeconds: number | null;
  createdUtc: string;
  productName: string | null;
  productPrimaryImageUrl: string | null;
  vendorAccountId: string | null;
  vendorDisplayName: string | null;
  // service-items-contract.md v1 §5.1 — absent until deployed.
  isService?: boolean | null;
  /** 1 Stay · 2 Package · 3 Bank. */
  serviceType?: number | null;
  serviceListingId?: string | null;
  /** The CURRENT price buyers see on the tag ("from Rs 4,500/night"); the snapshot is the price at tag time. */
  displayPrice?: DisplayPrice | null;
  addableToCart?: boolean | null;
}

/** Service items (hotel stays, travel packages, bank products) sold like items through reels. */
export const ServiceItemType = { Stay: 1, Package: 2, Bank: 3 } as const;
export const serviceItemTypeLabel: Record<number, string> = { 1: 'Hotel stay', 2: 'Travel package', 3: 'Bank product' };

export interface DisplayPrice {
  amount: number | null;
  currency: string;
  /** "night" · "person" · null. */
  unit: string | null;
  isFrom: boolean;
  /** Server-formatted; null for bank items. */
  label: string | null;
}

/** `GET v1/tag-picker/items` row (service-items-contract.md v1 §5.3). */
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

/**
 * The price label buyers see on a tag: the server label, else a local one ("from Rs 4,500/night",
 * "Rs 45,000 per person", "Dates coming soon", "Enquiry only"); a product falls back to its plain price.
 */
export function displayPriceLabel(
  dp: DisplayPrice | null | undefined,
  serviceType: number | null | undefined,
  fallback: Money | null,
): string {
  if (dp?.label) return dp.label;
  if (serviceType === ServiceItemType.Bank) return 'Enquiry only';
  if (dp && dp.amount != null) {
    const unit = dp.unit === 'night' ? '/night' : dp.unit === 'person' ? ' per person' : '';
    return `${dp.isFrom ? 'from ' : ''}${formatMoney({ amount: dp.amount, currency: dp.currency || 'NPR' })}${unit}`;
  }
  if (serviceType === ServiceItemType.Package) return 'Dates coming soon';
  return fallback ? formatMoney(fallback) : '—';
}

export interface Reel {
  id: string;
  sourcePlatform: number;
  sourceUrl: string;
  externalId: string;
  durationSeconds: number;
  musicTrackTitle: string | null;
  musicArtistName: string | null;
  caption: string | null;
  thumbnailCdnUrl: string | null;
  videoCdnUrl: string | null;
  isAiGenerated: boolean | null;
  state: number;
  publishedAtUtc: string | null;
  likeCount: number;
  viewCount: number;
  saveCount: number;
  shareCount: number;
  commentsSnapshot: number;
  createdUtc: string;
  updatedUtc: string;
  taggedProducts: TaggedProduct[];
}

export interface ApprovalRound {
  id: string;
  reelId: string;
  partnershipId: string;
  round: number;
  state: number;
  creatorNote: string | null;
  submittedUtc: string;
  decidedUtc: string | null;
  rejectionReason: string | null;
  expiredUtc: string | null;
}

export interface ImportReelBody {
  sourcePlatform: number;
  sourceUrl: string;
  externalId: string;
  durationSeconds: number;
  caption?: string | null;
  thumbnailCdnUrl?: string | null;
  /** Instagram / Facebook only (Meta CDN); must be omitted for TikTok and YouTube. */
  videoCdnUrl?: string | null;
  isAiGenerated?: boolean | null;
}

export interface TagPlacement {
  overlayPositionX: number;
  overlayPositionY: number;
  appearAtSeconds?: number | null;
  disappearAtSeconds?: number | null;
}

/** Social content listing: posts the creator can import. */
export interface ProviderContentItem {
  externalId: string;
  permalink: string;
  caption: string | null;
  thumbnailUrl: string | null;
  videoUrl: string | null;
  mediaType: string;
  publishedUtc: string | null;
  durationSeconds: number | null;
  likeCount: number | null;
  viewCount: number | null;
  commentCount: number | null;
}

export interface ProviderContentPage {
  items: ProviderContentItem[];
  nextCursor: string | null;
  servedFromCache: boolean;
  fetchedUtc: string | null;
  staleSinceUtc: string | null;
  providerStatus: { code: string; message: string; retryAfterUtc: string | null } | null;
}

export interface ProductTile {
  productId: string;
  name: string;
  heroImageUrl: string;
  price: number;
  currency: string;
  brandName: string;
  isOutOfStock: boolean;
  isSponsored: boolean;
  sponsoredLabel: string | null;
  // Set when the row came from the tag picker (service items included).
  isService?: boolean;
  serviceType?: number | null;
  displayPrice?: DisplayPrice | null;
}

/** A tag-picker row as a ProductTile (the shape the picker UI already renders). */
export function tileFromTaggable(it: TaggableItem): ProductTile {
  return {
    productId: it.productId,
    name: it.name,
    heroImageUrl: it.primaryImageUrl ?? '',
    price: it.displayPrice?.amount ?? 0,
    currency: it.displayPrice?.currency || 'NPR',
    brandName: it.vendorDisplayName ?? '',
    isOutOfStock: false,
    isSponsored: false,
    sponsoredLabel: null,
    isService: it.isService,
    serviceType: it.serviceType,
    displayPrice: it.displayPrice,
  };
}

export const tilePriceLabel = (p: ProductTile) =>
  p.isService || p.displayPrice ? displayPriceLabel(p.displayPrice, p.serviceType, { amount: p.price, currency: p.currency }) : formatMoney({ amount: p.price, currency: p.currency });

export type TagCommissionStatus = 'Applies' | 'NoPartnership' | 'ProductUnavailable';

export interface TagCommissionItem {
  productId: string;
  status: TagCommissionStatus;
  partnershipId: string | null;
  /** FRACTION (0.15 = 15%). */
  commissionRateFraction: number | null;
  commissionRateMinFraction: number | null;
  commissionRateMaxFraction: number | null;
  unitPrice: Money | null;
  commissionPerSale: Money | null;
}

export interface PostPublishReport {
  id: string;
  reelId: string;
  body: {
    topMoments: { atMs: number; retentionRate: number; note: string }[];
    commentThemes: { label: string; commentCount: number; representativeQuote: string }[];
    convertingSegments: { startAtMs: number; endAtMs: number; attributedTapCount: number; attributedUnitsSold: number; note: string }[];
    nextSteps: { key: string; headline: string; body: string }[];
    audienceEvolution: { newFollowersAttributed: number; newAudienceSegments: string[]; segmentShifts: string[] };
  };
  explanationByKey: Record<string, string>;
  /** Server-formatted — render as-is, never reformat. */
  commissionEarnedFormatted: string;
  commissionProjectedNext7Formatted: string;
  generatedUtc: string;
}

/** True when the server refused a tag because there is no active partnership with the brand. */
export function isNoPartnershipError(e: unknown): boolean {
  return e instanceof ApiError && e.code === 'rule.violation' && (e.problem?.field as string | undefined)?.toLowerCase() === 'partnershipid';
}

/** True when the reel has a campaign tag and must go to the brand for approval instead of being published. */
export function isCampaignReelError(e: unknown): boolean {
  return e instanceof ApiError && e.code === 'rule.violation' && /approval/i.test(e.message);
}

/**
 * Best-effort external id + platform from a pasted reel link, so a creator who has not connected the account can
 * still import. Returns null when the link is not a recognised reel/video URL.
 */
export function parseReelUrl(raw: string): { platform: number; externalId: string; url: string } | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  const host = url.hostname.toLowerCase().replace(/^www\.|^m\./, '');
  const platform = Object.entries(ALLOWED_HOSTS).find(([, hosts]) => hosts.some((h) => host === h || host.endsWith(`.${h}`)))?.[0];
  if (!platform) return null;
  const p = Number(platform);
  const parts = url.pathname.split('/').filter(Boolean);
  let id: string | undefined;
  if (p === 1) {
    const i = parts.findIndex((s) => s === 'reel' || s === 'reels' || s === 'p' || s === 'tv');
    id = i >= 0 ? parts[i + 1] : undefined;
  } else if (p === 2) {
    const i = parts.indexOf('video');
    id = i >= 0 ? parts[i + 1] : undefined;
  } else if (p === 3) {
    if (host === 'youtu.be') id = parts[0];
    else {
      const i = parts.indexOf('shorts');
      id = i >= 0 ? parts[i + 1] : (url.searchParams.get('v') ?? undefined);
    }
  } else if (p === 4) {
    const i = parts.findIndex((s) => s === 'reel' || s === 'videos');
    id = i >= 0 ? parts[i + 1] : (url.searchParams.get('v') ?? undefined);
  }
  if (!id || !/^[\w-]{3,128}$/.test(id)) return null;
  return { platform: p, externalId: id, url: url.toString() };
}

export const reelsApi = {
  list: (cursor: string | null, pageSize = 25) => api.get<PagedResult<Reel>>('/v1/creator/reels', { cursor: cursor ?? undefined, pageSize }),
  get: (id: string) => api.get<Reel>(`/v1/creator/reels/${id}`),
  import: (body: ImportReelBody) => api.post<Reel>('/v1/creator/reels/import', body),
  importBulk: (items: ImportReelBody[]) => api.post<BulkResult<Reel>>('/v1/creator/reels/import/bulk', { items }),
  publish: (id: string, isAiGenerated?: boolean | null) =>
    api.post<Reel>(`/v1/creator/reels/${id}/publish`, isAiGenerated === undefined ? {} : { isAiGenerated }),
  submitForApproval: (id: string, note: string | null) => api.post<ApprovalRound>(`/v1/creator/reels/${id}/submit-for-approval`, note ? { note } : {}),
  approvalRounds: (id: string) => api.get<ApprovalRound[]>(`/v1/creator/reels/${id}/approval-rounds`),
  unpublish: (id: string) => api.post<Reel>(`/v1/creator/reels/${id}/unpublish`),
  updateCaption: (id: string, caption: string | null) => api.put<Reel>(`/v1/creator/reels/${id}/caption`, { caption }),
  remove: (id: string) => api.del<void>(`/v1/creator/reels/${id}`),
  tags: (id: string) => api.get<TaggedProduct[]>(`/v1/creator/reels/${id}/tagged-products`),
  tag: (id: string, productId: string, placement: TagPlacement) =>
    api.post<TaggedProduct>(`/v1/creator/reels/${id}/tagged-products`, { productId, ...placement }),
  /** Full replacement of the placement: an omitted time clears that bound. */
  updateTag: (id: string, tagId: string, placement: TagPlacement) =>
    api.put<TaggedProduct>(`/v1/creator/reels/${id}/tagged-products/${tagId}`, placement),
  untag: (id: string, tagId: string) => api.del<void>(`/v1/creator/reels/${id}/tagged-products/${tagId}`),
  /** 404 until the 24-hour coach report exists. */
  postPublishReport: (id: string) => api.get<PostPublishReport>(`/v1/creator/reels/${id}/post-publish-report`),
  /** Posts on a connected account. Comments/captions here are the creator's own. */
  providerContent: (slug: ProviderSlug, cursor: string | null, refresh = false) =>
    api.get<ProviderContentPage>(`/v1/social/accounts/${slug}/content`, { limit: 25, cursor: cursor ?? undefined, refresh: refresh || undefined }),
  /**
   * Taggable items for the picker: `GET v1/tag-picker/items` (products AND service items — hotel stays, travel
   * packages, bank products; service-items-contract.md v1 §5.3). Until that is deployed (bare 404) the older
   * customer search is used, which returns products only. `includeServices: false` keeps products only.
   */
  searchProducts: async (q: string, opts: { includeServices?: boolean } = {}): Promise<ProductTile[]> => {
    try {
      const page = await api.get<PagedResult<TaggableItem>>('/v1/tag-picker/items', {
        q: q.slice(0, 100),
        scope: 'all',
        kind: opts.includeServices === false ? 'product' : undefined,
        pageSize: 20,
      });
      return (page.items ?? []).map(tileFromTaggable);
    } catch (e) {
      if (!isMissingEndpoint(e)) throw e;
    }
    const res = await api.get<{ products: ProductTile[] }>('/api/v1/customer/search', { q, type: 'products', limit: 20 });
    return res.products ?? [];
  },
  tagCommission: async (productIds: string[]): Promise<TagCommissionItem[]> => {
    if (productIds.length === 0) return [];
    const out: TagCommissionItem[] = [];
    for (let i = 0; i < productIds.length; i += 50) {
      const res = await api.get<{ items: TagCommissionItem[] }>('/v1/creator/tag-products/commission', { productIds: productIds.slice(i, i + 50) });
      out.push(...res.items);
    }
    return out;
  },
};
