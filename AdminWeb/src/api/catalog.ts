/**
 * Campaigns, collections, popular searches (Catalog module, ContentMod), content queues (reels link health,
 * social-feed reports, model-drafted recipes). Products are in products.ts.
 */
import { http } from './client';
import { toPage, type Page } from './paging';

export const CAMPAIGN_STATE: Record<number, string> = { 1: 'Draft', 2: 'Published', 3: 'Archived' };
export const CAMPAIGN_TONE: Record<number, string> = { 1: 'amber', 2: 'forest', 3: 'gray' };
export const PLACEMENT: Record<number, string> = { 1: 'Home', 2: 'Discover' };
export const CTA_KIND: Record<number, string> = { 1: 'Collection', 2: 'Reels', 3: 'Creators', 4: 'Category', 5: 'Brand', 6: 'Product', 7: 'Link' };

export interface Campaign {
  id: string;
  slug: string;
  placement: number;
  state: number;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  heroImageUrl: string;
  heroReelId: string | null;
  priority: number;
  startsUtc: string;
  endsUtc: string;
  collectionId: string | null;
  collectionSlug: string | null;
  ctas: { label: string; targetKind: number; targetValue: string }[];
  publishedUtc: string | null;
  createdUtc: string;
  updatedUtc: string;
}

export interface CampaignBody {
  slug: string;
  placement: number;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  heroImageUrl: string;
  heroReelId: string | null;
  priority: number;
  startsUtc: string;
  endsUtc: string;
  collectionId: string | null;
  ctas: { label: string; targetKind: number; targetValue: string | null }[];
}

export const COLLECTION_KIND: Record<number, string> = { 1: 'Editorial', 2: 'Creator collection', 3: 'Brand collection', 4: 'Look' };
export const COLLECTION_STATE = CAMPAIGN_STATE;

export interface CollectionSummary {
  id: string;
  slug: string;
  title: string;
  coverImageUrl: string | null;
  kind: number;
  state: number;
  sortOrder: number;
  itemCount: number;
  startsUtc: string | null;
  endsUtc: string | null;
  publishedUtc: string | null;
  updatedUtc: string;
}

export interface CollectionDetail extends CollectionSummary {
  subtitle: string | null;
  description: string | null;
  items: { productId: string; sortOrder: number; note: string | null; productName: string; primaryImageUrl: string | null; productState: number | null; isPubliclyListed: boolean }[];
}

export interface CollectionBody {
  kind?: number;
  slug: string;
  title: string;
  subtitle: string | null;
  description: string | null;
  coverImageUrl: string | null;
  sortOrder: number;
  startsUtc: string | null;
  endsUtc: string | null;
}

export interface PopularSearch {
  id: string;
  label: string;
  query: string;
  displayOrder: number;
  regionCode: string | null;
  isActive: boolean;
  createdUtc: string;
  updatedUtc: string;
}

export const PRODUCT_STATE: Record<number, string> = { 1: 'Draft', 2: 'Active', 3: 'Out of stock', 4: 'Archived', 5: 'Suspended' };
export const PRODUCT_TONE: Record<number, string> = { 1: 'gray', 2: 'forest', 3: 'amber', 4: 'gray', 5: 'signal' };

export const REEL_STATE: Record<number, string> = { 1: 'Draft', 2: 'Processing', 3: 'Published', 4: 'Unpublished', 5: 'Deleted on source', 6: 'Pending approval' };
export const REEL_PLATFORM: Record<number, string> = { 1: 'Instagram', 2: 'TikTok', 3: 'YouTube Shorts', 4: 'Facebook' };

export interface FailingReelLink {
  reelId: string;
  creatorAccountId: string;
  sourcePlatform: number;
  sourceUrl: string;
  reelState: number;
  consecutiveFailures: number;
  firstFailureUtc: string | null;
  lastCheckedUtc: string | null;
  lastHealthyUtc: string | null;
  lastDetail: string | null;
}

export const POST_REPORT_REASON: Record<number, string> = {
  1: 'Spam',
  2: 'Harassment',
  3: 'Hate speech',
  4: 'Sexual content',
  5: 'Self-harm',
  6: 'Violence',
  7: 'Misinformation',
  8: 'Intellectual property',
  9: 'Scam',
  10: 'Other illegal',
  99: 'Other',
};
export const POST_REPORT_STATE: Record<number, string> = { 1: 'Open', 2: 'Under review', 3: 'Actioned', 4: 'Dismissed', 5: 'Duplicate' };

export interface PostReport {
  id: string;
  postId: string;
  reporterAccountId: string;
  reason: number;
  context: string | null;
  state: number;
  createdUtc: string;
}

export interface RecipeDraft {
  id: string;
  title: string;
  origin: number;
  state: number;
  context: { moodLabel: string; brandStoryAnchor: string; intendedDurationSeconds: number };
  segment: { songTitle: string; artist: string };
  reasoning: { headlineRationale: string; isAiGenerated: boolean };
  createdUtc: string;
}

const enc = encodeURIComponent;

export const campaignsApi = {
  list: async (f: { state?: string; placement?: string; cursor: string | null; page: number; pageSize: number }, signal?: AbortSignal): Promise<Page<Campaign>> =>
    toPage<Campaign>(
      await http.get('/v1/admin/campaigns', { state: f.state || undefined, placement: f.placement || undefined, cursor: f.cursor || undefined, pageSize: Math.min(50, f.pageSize) }, signal),
      f.page,
      Math.min(50, f.pageSize),
    ),
  create: (body: CampaignBody) => http.post<Campaign>('/v1/admin/campaigns', body),
  update: (id: string, body: CampaignBody) => http.put<Campaign>(`/v1/admin/campaigns/${enc(id)}`, body),
  publish: (id: string) => http.post<Campaign>(`/v1/admin/campaigns/${enc(id)}/publish`),
  archive: (id: string) => http.post<Campaign>(`/v1/admin/campaigns/${enc(id)}/archive`),
};

export const collectionsApi = {
  list: async (f: { state?: string; cursor: string | null; page: number; pageSize: number }, signal?: AbortSignal): Promise<Page<CollectionSummary>> =>
    toPage<CollectionSummary>(await http.get('/v1/admin/collections', { state: f.state || undefined, cursor: f.cursor || undefined, pageSize: Math.min(50, f.pageSize) }, signal), f.page, Math.min(50, f.pageSize)),
  get: (id: string, signal?: AbortSignal) => http.get<CollectionDetail>(`/v1/admin/collections/${enc(id)}`, undefined, signal),
  create: (body: CollectionBody) => http.post<CollectionDetail>('/v1/admin/collections', body),
  update: (id: string, body: CollectionBody) => http.put<CollectionDetail>(`/v1/admin/collections/${enc(id)}`, body),
  publish: (id: string) => http.post<CollectionDetail>(`/v1/admin/collections/${enc(id)}/publish`),
  archive: (id: string) => http.post<CollectionDetail>(`/v1/admin/collections/${enc(id)}/archive`),
  addItem: (id: string, productId: string, note: string | null) => http.post<CollectionDetail>(`/v1/admin/collections/${enc(id)}/items`, { productId, note }),
  removeItem: (id: string, productId: string) => http.del<CollectionDetail>(`/v1/admin/collections/${enc(id)}/items/${enc(productId)}`),
};

export const popularSearchesApi = {
  list: (region: string | undefined, signal?: AbortSignal) => http.get<PopularSearch[]>('/v1/admin/catalog/popular-searches', { region: region || undefined }, signal),
  create: (body: { label: string; query: string; displayOrder: number; regionCode: string | null }) => http.post<PopularSearch>('/v1/admin/catalog/popular-searches', body),
  update: (id: string, body: { label: string; query: string; displayOrder: number; regionCode: string | null }) => http.put<PopularSearch>(`/v1/admin/catalog/popular-searches/${enc(id)}`, body),
  activate: (id: string) => http.post<PopularSearch>(`/v1/admin/catalog/popular-searches/${enc(id)}/activate`),
  deactivate: (id: string) => http.post<PopularSearch>(`/v1/admin/catalog/popular-searches/${enc(id)}/deactivate`),
  /** Hard delete. */
  remove: (id: string) => http.del<void>(`/v1/admin/catalog/popular-searches/${enc(id)}`),
};

export const contentApi = {
  failingReelLinks: (limit: number, signal?: AbortSignal) => http.get<FailingReelLink[]>('/v1/admin/reels/link-health/failing', { limit }, signal),
  markReelExternalDeleted: (reelId: string) => http.post<unknown>(`/v1/admin/reels/${enc(reelId)}/external-deleted`),
  postReports: (take: number, signal?: AbortSignal) => http.get<PostReport[]>('/v1/admin/social-feed/reports', { take }, signal),
  hidePost: (postId: string, reason: string) => http.post<unknown>(`/v1/admin/social-feed/posts/${enc(postId)}/hide`, { reason }),
  removePost: (postId: string, reason: string) => http.post<unknown>(`/v1/admin/social-feed/posts/${enc(postId)}/remove`, { reason }),
  restorePost: (postId: string) => http.post<unknown>(`/v1/admin/social-feed/posts/${enc(postId)}/restore`),
  /** terminal: 3 Actioned | 4 Dismissed | 5 Duplicate */
  resolveReport: (reportId: string, terminal: number, reason: string) => http.post<PostReport>(`/v1/admin/social-feed/reports/${enc(reportId)}/resolve?terminal=${terminal}`, { reason }),
  recipeDrafts: (skip: number, take: number, signal?: AbortSignal) => http.get<RecipeDraft[]>('/v1/admin/recipes/llm-drafts-pending-review', { skip, take }, signal),
  promoteRecipe: (id: string) => http.post<unknown>(`/v1/admin/recipes/${enc(id)}/promote-to-curated`),
  hideRecipe: (id: string, reason: string) => http.post<unknown>(`/v1/admin/recipes/${enc(id)}/hide`, { reason }),
};
