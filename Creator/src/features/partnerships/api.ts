import { api } from '../../api/client';
import type { PagedResult } from '../../api/paging';
import type { Money } from '../../lib/format';

/**
 * Partnerships, campaign briefs and applications, brand directory, matches, squads, retainers, rate card.
 * (Partnerships, BrandStudio, Matchmaking and Identity modules.)
 *
 * Units: every partnership / brief / brand commission is a FRACTION 0–1 despite "Percent" in its name.
 * Match prefill uses basis points. Ids: PublicBrandProfileDto.id is the vendor PROFILE id (partnership request,
 * partnership record); .accountId is the vendor ACCOUNT id (brand detail, matches, affiliate).
 *
 * Accept/decline is only offered on an invite the BRAND sent (state Invited and !initiatedByCreator): the server
 * does not stop a creator answering their own request.
 */

export const PartnershipState = { Invited: 1, Declined: 2, Active: 3, Paused: 4, Ended: 5 } as const;
export const partnershipStateLabel: Record<number, string> = { 1: 'Invited', 2: 'Declined', 3: 'Active', 4: 'Paused', 5: 'Ended' };
export const partnershipStateColor: Record<number, string> = { 1: 'amber', 2: 'gray', 3: 'forest', 4: 'slate', 5: 'gray' };

export interface Partnership {
  id: string;
  vendorProfileId: string;
  creatorProfileId: string;
  state: number;
  commissionMinPercent: number;
  commissionMaxPercent: number;
  invitedUtc: string;
  respondedUtc: string | null;
  endedUtc: string | null;
  endReason: string | null;
  brandBriefId: string | null;
  brandBriefVersion: number | null;
  initiatedByCreator: boolean;
  requestMessage: string | null;
  vendorRating: number | null;
  vendorName: string | null;
  vendorLogoUrl: string | null;
  vendorAccountId: string | null;
}

/** Who must act on this partnership now. */
export function pendingActor(p: Pick<Partnership, 'state' | 'initiatedByCreator'>): 'creator' | 'brand' | null {
  if (p.state !== PartnershipState.Invited) return null;
  return p.initiatedByCreator ? 'brand' : 'creator';
}

export interface TermsVersion {
  id: string;
  versionNumber: number;
  publishedUtc: string;
  body: {
    whoCanJoin: { heading: string; bullets: string[] };
    reelContentRules: { heading: string; bullets: { text: string; inlineLinks: { anchor: string; url: string; startIndex: number; endIndex: number }[] }[] };
  };
}

export interface Prediction {
  predictedViews: number;
  predictedSales: number;
  predictedRevenue: number;
  predictedRevenueCurrency: string;
  confidenceLevel: string;
  topReasoningSignals: string[];
  riskFactors: string[];
  recommendedCommission: number;
  recommendedDuration: number;
  marketContext: string | null;
}

export interface MeasuredRate {
  observed: number;
  of: number;
  percent: number;
  statement: string;
}

export interface BrandRecord {
  vendorProfileId: string;
  windowDays: number;
  counts: { partnershipsAllTime: number; activeNow: number; endedByBrandInWindow: number; endedByCreatorInWindow: number };
  creatorRequestsAnswered: MeasuredRate | null;
  creatorChatsReplied: MeasuredRate | null;
  messagingRecordAvailable: boolean;
}

export interface Brand {
  id: string;
  accountId: string;
  businessName: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  description: string | null;
  websiteUrl: string | null;
  tagline: string | null;
  brandStory: string | null;
  originCity: string | null;
  isVerified: boolean;
  returnPolicySummary: string | null;
  commissionRangeMin: number | null;
  commissionRangeMax: number | null;
}

export interface RequestPartnershipBody {
  vendorProfileId: string;
  commissionMinPercent: number;
  commissionMaxPercent: number;
  message?: string | null;
  niches?: string[] | null;
  audienceGroups?: string[] | null;
  sampleReelUrls?: string[] | null;
}

export const campaignGoalLabel: Record<number, string> = {
  1: 'Drive first purchases',
  2: 'Win back past buyers',
  3: 'Launch a new variant',
  4: 'Clear slow stock',
  5: 'Seasonal awareness',
  6: 'Show how to use it',
  7: 'Reach a new audience',
};

export interface Brief {
  id: string;
  vendorProfileId: string;
  title: string;
  primaryGoal: number;
  version: number;
  rootBriefId: string;
  commissionRange: { minPercent: number; maxPercent: number };
  roiProjection: {
    estimatedReachLow: number;
    estimatedReachHigh: number;
    estimatedSalesLow: number;
    estimatedSalesHigh: number;
  };
  body: {
    suggestedHooks: { text: string; rationale: string }[];
    doSayPoints: string[];
    dontSayPoints: string[];
    audioThemes: string[];
    suggestedCadence: { reelsPerWeek: number; idealGapHours: number; note: string };
    productVariantIds: string[];
    recipeAttachments: { recipeId: string; recipeVersion: number; isPrimary: boolean; label: string }[];
    brandDirection: {
      campaignStory: string | null;
      presentation: { brandNameUsage: string | null; logoAndMarkUsage: string | null; toneOfVoice: string | null; mandatoryMentions: string[] | null } | null;
      referenceAssets: { url: string; label: string | null }[] | null;
    } | null;
  };
  publishedUtc: string | null;
  applicationsOpenUtc: string | null;
  applicationsCloseUtc: string | null;
}

export const ApplicationState = { Pending: 1, Withdrawn: 2, Accepted: 3, Declined: 4 } as const;
export const applicationStateLabel: Record<number, string> = { 1: 'Waiting for the brand', 2: 'Withdrawn', 3: 'Accepted', 4: 'Not selected' };
export const applicationStateColor: Record<number, string> = { 1: 'amber', 2: 'gray', 3: 'forest', 4: 'gray' };

export interface CampaignApplication {
  id: string;
  brandBriefId: string;
  brandBriefRootId: string;
  brandBriefVersion: number;
  vendorProfileId: string;
  state: number;
  message: string | null;
  submittedUtc: string;
  decidedUtc: string | null;
  declineReason: string | null;
  withdrawnUtc: string | null;
}

export const MatchState = { Surfaced: 1, ActedOn: 2, DismissedByCreator: 3, DismissedByBrand: 4, Expired: 5 } as const;
export interface Match {
  id: string;
  vendorAccountId: string;
  score: number;
  reasonSummary: string;
  computedUtc: string;
  state: number;
  vendorDisplayName: string | null;
  vendorAvatarUrl: string | null;
}
export interface MatchPrefill {
  vendorAccountId: string;
  proposedCommissionBps: number;
  brandCommissionMinBps: number;
  brandCommissionMaxBps: number;
  reasonSummary: string;
}

export const squadStateLabel: Record<number, string> = { 1: 'Being planned', 2: 'Recruiting', 3: 'Active', 4: 'Completed', 5: 'Cancelled' };
export interface Squad {
  id: string;
  briefId: string;
  brandAccountId: string;
  name: string;
  budgetTotal: number;
  budgetCurrency: string;
  state: number;
  memberCount: number;
  createdUtc: string;
}

export const RetainerState = { Draft: 1, Active: 2, Paused: 3, Cancelling: 4, Ended: 5 } as const;
export const retainerStateLabel: Record<number, string> = { 1: 'Proposed', 2: 'Active', 3: 'Paused', 4: 'Ending (notice period)', 5: 'Ended' };
export const retainerStateColor: Record<number, string> = { 1: 'amber', 2: 'forest', 3: 'slate', 4: 'amber', 5: 'gray' };
export interface Retainer {
  id: string;
  brandAccountId: string;
  monthlyAmount: number;
  currency: string;
  deliverablesPerMonth: string;
  autoRenew: boolean;
  renewalNoticeDays: number;
  nextBillingUtc: string | null;
  currentPeriodStartUtc: string | null;
  currentPeriodEndUtc: string | null;
  state: number;
  totalPeriodsCompleted: number;
  createdUtc: string;
}

export interface RateTier {
  tierName: string;
  price: number;
  includedReels: number;
  description: string | null;
}
export interface RateCard {
  id: string;
  version: number;
  effectiveFromUtc: string;
  baseRate: number;
  rates: RateTier[];
  commissionPreference: number;
  platformPreferences: string[];
  notes: string | null;
  isActive: boolean;
}
export interface RateCardInput {
  baseRate: number;
  rates: RateTier[];
  commissionPreference: number;
  platformPreferences?: string[];
  notes?: string | null;
}
export const RATE_CARD_MAX_COMMISSION = 0.5;

export interface PotentialEarnings {
  commissionRate: number;
  unitPrice: Money;
  perSale: Money;
  perFiftySales: Money;
}

const pageQuery = (cursor: string | null, pageSize = 25) => ({ cursor: cursor ?? undefined, pageSize });

export const partnershipsApi = {
  list: (states: number[] | null, cursor: string | null, pageSize = 25) =>
    api.get<PagedResult<Partnership>>('/v1/partnerships', { ...pageQuery(cursor, pageSize), states: states ?? undefined }),
  get: (id: string) => api.get<Partnership>(`/v1/partnerships/${id}`),
  accept: (id: string) => api.post<Partnership>(`/v1/partnerships/${id}/accept`),
  decline: (id: string) => api.post<Partnership>(`/v1/partnerships/${id}/decline`),
  terms: (id: string) => api.get<TermsVersion>(`/v1/partnerships/${id}/terms/active`),
  predict: (id: string) => api.get<Prediction>(`/v1/creator/partnerships/${id}/predict`),
  potentialEarnings: (id: string, variantId: string) => api.get<PotentialEarnings>(`/v1/partnerships/${id}/potential-earnings`, { variantId }),
  request: (body: RequestPartnershipBody) => api.post<Partnership>('/v1/creator/partnerships/request', body),
  brandRecord: (vendorProfileId: string) => api.get<BrandRecord>(`/v1/creator/brands/${vendorProfileId}/partnership-record`),
  brands: (cursor: string | null) => api.get<PagedResult<Brand>>('/v1/brands', pageQuery(cursor, 24)),
  recommendedBrands: async () => (await api.get<PagedResult<Brand>>('/v1/brands/recommended', { limit: 6 })).items,
  brand: (vendorAccountId: string) => api.get<Brand>(`/v1/brands/${vendorAccountId}`),
  matches: (cursor: string | null) => api.get<PagedResult<Match>>('/v1/creator/matches', pageQuery(cursor, 10)),
  dismissMatch: (id: string) => api.post<Match>(`/v1/creator/matches/${id}/dismiss`),
  proposeMatch: (id: string) => api.post<MatchPrefill>(`/v1/creator/matches/${id}/propose`),
  briefs: (cursor: string | null) => api.get<PagedResult<Brief>>('/v1/creator/campaigns', pageQuery(cursor)),
  brief: (id: string) => api.get<Brief>(`/v1/creator/campaigns/${id}`),
  apply: (briefId: string, message: string | null) => api.post<CampaignApplication>(`/v1/creator/campaigns/${briefId}/applications`, message ? { message } : {}),
  withdraw: (applicationId: string) => api.post<CampaignApplication>(`/v1/creator/campaigns/applications/${applicationId}/withdraw`),
  applications: (cursor: string | null) => api.get<PagedResult<CampaignApplication>>('/v1/creator/campaigns/applications', pageQuery(cursor)),
  squads: () => api.get<Squad[]>('/v1/creator/squads'),
  acceptSquad: (id: string) => api.post<void>(`/v1/creator/squads/${id}/accept`),
  retainers: () => api.get<Retainer[]>('/v1/creator/retainers'),
  acceptRetainer: (id: string) => api.post<void>(`/v1/creator/retainers/${id}/accept`),
  pauseRetainer: (id: string) => api.post<void>(`/v1/retainers/${id}/pause`),
  resumeRetainer: (id: string) => api.post<void>(`/v1/retainers/${id}/resume`),
  cancelRetainer: (id: string) => api.post<void>(`/v1/retainers/${id}/cancel`),
  rateCard: () => api.get<RateCard>('/v1/creator/rate-card'),
  publishRateCard: (body: RateCardInput) => api.post<void>('/v1/creator/rate-card', body),
  deactivateRateCard: () => api.del<void>('/v1/creator/rate-card'),
};

/** "10–15%" from two fractions. */
export function commissionRange(min: number | null | undefined, max: number | null | undefined): string {
  if (min == null || max == null) return '—';
  const a = Math.round(min * 1000) / 10;
  const b = Math.round(max * 1000) / 10;
  return a === b ? `${a}%` : `${a}–${b}%`;
}

/**
 * Briefs and applications carry only the vendor PROFILE id. Names come from the brand directory (first 100
 * approved brands, cached), with "A brand" as the fallback for any not in that page.
 */
export async function brandDirectory(): Promise<Map<string, Brand>> {
  const page = await api.get<PagedResult<Brand>>('/v1/brands', { pageSize: 100 });
  return new Map(page.items.map((b) => [b.id, b]));
}
