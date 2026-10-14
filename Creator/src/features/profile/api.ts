import { api } from '../../api/client';
import type { PagedResult } from '../../api/paging';

/**
 * Profile & storefront (Identity: account, creator profile, cover, specializations, public profile;
 * Catalog: categories, creator collections; Reels: public reel stats; SocialGraph: follow stats;
 * Partnerships: tier; Reputation: milestones; Social: audience summary).
 *
 * - Avatar: `POST /v1/customer/me/avatar` only stores the image (JPEG/PNG, 5 MB) and returns a URL; then
 *   `PATCH /v1/accounts/{id}` with `{ displayName, avatarUrl }` (displayName is required on every PATCH).
 * - Cover: `POST /v1/creator/me/cover` stores AND saves it (JPEG/PNG/WebP, 5 MB).
 * - Specializations use CATALOG category ids (`/v1/public/categories`), max 15.
 * - The public profile is cached for 60 s, so an edit can take a minute to show there.
 */

export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_TYPES = ['image/jpeg', 'image/png'];
export const COVER_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export interface Account {
  id: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  locale: string;
  timezone: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  rowVersion: string;
}

export const ProfileStatus = { Pending: 1, UnderReview: 2, Approved: 3, Rejected: 4 } as const;

export interface CreatorProfile {
  id: string;
  accountId: string;
  bio: string | null;
  specializationSummary: string | null;
  instagramHandle: string | null;
  tiktokHandle: string | null;
  youtubeHandle: string | null;
  facebookHandle: string | null;
  tags: string[] | null;
  followerCountCached: number;
  status: number;
  rejectionReason: string | null;
  coverImageUrl: string | null;
  location: string | null;
  isVerified: boolean;
}

export interface CreatorProfileUpdate {
  bio?: string | null;
  specializationSummary?: string | null;
  instagramHandle?: string | null;
  tiktokHandle?: string | null;
  youtubeHandle?: string | null;
  facebookHandle?: string | null;
  tags?: string[] | null;
  location?: string | null;
}

export const PROFILE_LIMITS = {
  displayName: 64,
  bio: 500,
  specializationSummary: 140,
  instagramHandle: 60,
  tiktokHandle: 60,
  youtubeHandle: 100,
  facebookHandle: 100,
  location: 80,
  tagMaxLength: 30,
  maxTags: 20,
} as const;

export interface Specialization {
  id: string;
  categoryId: string;
  isPrimary: boolean;
}
export const MAX_SPECIALIZATIONS = 15;

export interface Category {
  id: string;
  parentCategoryId: string | null;
  slug: string;
  nameEn: string;
  displayOrder: number;
  isActive: boolean;
}

export interface PublicCreator {
  accountId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  coverImageUrl: string | null;
  bio: string | null;
  location: string | null;
  styleTags: string[];
  isVerified: boolean;
  specializationSummary: string | null;
}

export interface ReelStats {
  publishedReelCount: number;
  totalStyleMintLikes: number;
  totalViewsSnapshot: number;
}

export interface FollowStats {
  followers: number;
  following: number;
}

export const TierLevel = { Bronze: 1, Silver: 2, Gold: 3, Diamond: 4 } as const;
export const tierLabel: Record<number, string> = { 1: 'Bronze', 2: 'Silver', 3: 'Gold', 4: 'Diamond' };
export const tierColor: Record<number, string> = { 1: 'orange', 2: 'gray', 3: 'yellow', 4: 'cyan' };
export interface Tier {
  currentTier: number;
  tierAchievedUtc: string;
  nextReviewUtc: string;
  metrics: {
    totalReelsPublished: number;
    totalRevenue: number;
    completedPartnerships: number;
    /** FRACTION. */
    avgEngagementRate: number;
    followerCount: number;
    verifiedReviewCount: number;
  };
  slaResponseHours: number;
  isFeatured: boolean;
  nextTier: number | null;
  /** Server-formatted English; render as-is. */
  nextTierProgress: string | null;
}
/** TierService.DetermineTier thresholds — no endpoint exposes them. Engagement as fractions. */
export const TIER_THRESHOLDS: Record<number, { reels: number; engagement: number; partnerships?: number; revenue?: number; followers?: number; reviews?: number }> = {
  2: { reels: 10, engagement: 0.02, partnerships: 5 },
  3: { reels: 50, revenue: 100_000, engagement: 0.04, followers: 100, partnerships: 5 },
  4: { reels: 200, revenue: 500_000, engagement: 0.06, followers: 1000, reviews: 10 },
};

export interface UnlockedFeature {
  featureKey: string;
  featureName: string;
  description: string;
  unlockedByBadge: string;
}

export interface AudienceSummary {
  totalFollowers: number | null;
  /** Already a percentage. */
  averageEngagementRatePercent: number | null;
  platforms: { provider: number; handle: string; followerCount: number | null; engagementRatePercent: number | null; postsSampled: number }[];
}

export const CollectionState = { Draft: 1, Published: 2, Archived: 3 } as const;
export const collectionStateLabel: Record<number, string> = { 1: 'Draft', 2: 'Published', 3: 'Archived' };
export const collectionStateColor: Record<number, string> = { 1: 'gray', 2: 'forest', 3: 'slate' };
export const CollectionKind = { CreatorCollection: 2, Look: 4 } as const;
export const collectionKindLabel: Record<number, string> = { 1: 'Editorial', 2: 'Collection', 3: 'Brand collection', 4: 'Look' };

export interface CollectionSummary {
  id: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  kind: number;
  state: number;
  sortOrder: number;
  itemCount: number;
  publishedUtc: string | null;
  updatedUtc: string;
}

export interface CollectionItem {
  productId: string;
  sortOrder: number;
  note: string | null;
  positionX: number | null;
  positionY: number | null;
  productName: string;
  primaryImageUrl: string | null;
  isPubliclyListed: boolean;
}

export interface Collection extends CollectionSummary {
  subtitle: string | null;
  description: string | null;
  startsUtc: string | null;
  endsUtc: string | null;
  items: CollectionItem[];
}

export interface CollectionInput {
  slug: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  coverImageUrl?: string | null;
  sortOrder: number;
}

export const COLLECTION_LIMITS = { slug: 80, title: 80, subtitle: 140, description: 2000, note: 140, maxItems: 60 } as const;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, COLLECTION_LIMITS.slug);
}

export const CreatorApplicationState = { Draft: 1, Submitted: 2, UnderReview: 3, Approved: 4, Rejected: 5 } as const;
export interface CreatorApplication {
  id: string;
  state: number;
  bio: string;
  submittedAtUtc: string | null;
  expectedDecisionByUtc: string | null;
  decisionAtUtc: string | null;
  rejectionReason: string | null;
  createdUtc: string;
}

function imageForm(file: File) {
  const form = new FormData();
  form.append('file', file);
  return form;
}

export const profileApi = {
  account: (accountId: string) => api.get<Account>(`/v1/accounts/${accountId}`, undefined, { privacy: 'none' }),
  updateAccount: (accountId: string, body: { displayName: string; bio?: string | null; avatarUrl?: string | null; rowVersion?: string | null }) =>
    api.patch<Account>(`/v1/accounts/${accountId}`, body, { privacy: 'none' }),
  uploadAvatar: (file: File) => api.upload<{ url: string }>('/v1/customer/me/avatar', imageForm(file)),
  creatorProfile: (accountId: string) => api.get<CreatorProfile>(`/v1/accounts/${accountId}/creator-profile`),
  updateCreatorProfile: (accountId: string, body: CreatorProfileUpdate) => api.patch<CreatorProfile>(`/v1/accounts/${accountId}/creator-profile`, body),
  uploadCover: (file: File) => api.upload<{ url: string }>('/v1/creator/me/cover', imageForm(file)),
  specializations: (accountId: string) => api.get<Specialization[]>(`/v1/accounts/${accountId}/creator-specializations`),
  addSpecialization: (accountId: string, categoryId: string, isPrimary: boolean) =>
    api.post<Specialization>(`/v1/accounts/${accountId}/creator-specializations`, { categoryId, isPrimary }),
  setPrimarySpecialization: (accountId: string, categoryId: string) => api.post<void>(`/v1/accounts/${accountId}/creator-specializations/${categoryId}/primary`),
  removeSpecialization: (accountId: string, categoryId: string) => api.del<void>(`/v1/accounts/${accountId}/creator-specializations/${categoryId}`),
  categories: () => api.get<Category[]>('/v1/public/categories', undefined, { anonymous: true }),
  publicCreator: (accountId: string) => api.get<PublicCreator>(`/v1/public/creators/${accountId}`),
  reelStats: (accountId: string) => api.get<ReelStats>(`/v1/public/creators/${accountId}/reel-stats`),
  followStats: (accountId: string) => api.get<FollowStats>(`/v1/follows/${accountId}/stats`),
  tier: () => api.get<Tier>('/v1/creator/me/tier'),
  unlocked: () => api.get<UnlockedFeature[]>('/v1/creator/me/milestones/unlocked'),
  audience: () => api.get<AudienceSummary>('/v1/social/accounts/audience-summary'),
  collections: (cursor: string | null, state?: number) =>
    api.get<PagedResult<CollectionSummary>>('/v1/creator/collections', { cursor: cursor ?? undefined, pageSize: 20, state }),
  collection: (id: string) => api.get<Collection>(`/v1/creator/collections/${id}`),
  createCollection: (kind: number, body: CollectionInput) => api.post<Collection>('/v1/creator/collections', { kind, ...body }),
  updateCollection: (id: string, body: CollectionInput) => api.put<Collection>(`/v1/creator/collections/${id}`, body),
  publishCollection: (id: string) => api.post<Collection>(`/v1/creator/collections/${id}/publish`),
  archiveCollection: (id: string) => api.post<Collection>(`/v1/creator/collections/${id}/archive`),
  addCollectionItem: (id: string, productId: string, note: string | null) =>
    api.post<Collection>(`/v1/creator/collections/${id}/items`, { productId, ...(note ? { note } : {}) }),
  removeCollectionItem: (id: string, productId: string) => api.del<Collection>(`/v1/creator/collections/${id}/items/${productId}`),
  reorderCollection: (id: string, productIds: string[]) => api.put<Collection>(`/v1/creator/collections/${id}/items/order`, { productIds }),
  application: () => api.get<CreatorApplication>('/v1/creator/application'),
  activate: () => api.post<{ creatorProfileId: string; profileApproved: boolean; creatorRoleActive: boolean }>('/v1/creator/activate', {}),
};

/** Client-side check before an upload: the site caps request bodies at 25 MB, these endpoints at 5 MB. */
export function checkImage(file: File, types: string[]): string | null {
  if (!types.includes(file.type)) return `Use a ${types.map((t) => t.replace('image/', '').toUpperCase()).join(', ')} image.`;
  if (file.size > IMAGE_MAX_BYTES - 64 * 1024) return 'The image must be smaller than 5 MB.';
  return null;
}
