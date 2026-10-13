import { api } from '../../api/client';
import type { PagedResult } from '../../api/paging';

/**
 * Creators area — existing vendor endpoints (lead360 modules Partnerships, Matchmaking, BrandStudio,
 * Reels, Orders). Enums are integers on the wire; labels live in `labels.ts`.
 *
 * Partnership commission is a FRACTION (0.15 = 15 %) everywhere in the Partnerships and BrandStudio
 * modules (`CommissionRange.Floor/Ceiling` = 0..1). Match prefill sends basis points.
 */

// ── Partnerships (VendorPartnershipsController) ─────────────────────────────

export const PartnershipState = { Invited: 1, Declined: 2, Active: 3, Paused: 4, Ended: 5 } as const;

export interface Partnership {
  id: string;
  vendorProfileId: string;
  creatorProfileId: string;
  state: number;
  commissionMinPercent: number;
  commissionMaxPercent: number;
  activeTermsVersionId: string;
  invitedUtc: string;
  respondedUtc: string | null;
  endedUtc: string | null;
  endReason: string | null;
  brandBriefId: string | null;
  brandBriefVersion: number | null;
  initiatedByCreator: boolean;
  requestMessage: string | null;
  creatorName: string | null;
  creatorHandle: string | null;
  creatorLogoUrl: string | null;
  creatorAccountId: string | null;
  createdUtc: string;
  updatedUtc: string;
}

export interface CreatorPick {
  creatorAccountId: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  bio: string | null;
  followerCount: number | null;
  niches: string[];
  hasExistingPartnership: boolean;
}

export interface CampaignPrediction {
  id: string;
  partnershipId: string;
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

export interface Insurance {
  id: string;
  partnershipId: string;
  insurerName: string;
  policyNumber: string;
  coverageAmount: number;
  coverageCurrency: string;
  premiumAmount: number;
  premiumCurrency: string;
  coverageStartUtc: string;
  coverageEndUtc: string;
  coverageDetails: string;
  claimWindowDays: number;
  state: number;
}

export interface InsuranceClaim {
  id: string;
  claimAmount: number;
  currency: string;
  reason: string;
  state: number;
  reviewerNotes: string | null;
  settlementAmount: number | null;
  createdDate: string;
}

// ── Matchmaking (VendorMatchesController) ───────────────────────────────────

export interface MatchSnapshot {
  id: string;
  creatorAccountId: string;
  creatorHandle: string;
  score: number;
  reasonSummary: string;
  origin: number;
  computedUtc: string;
  state: number;
}

export interface PartnershipPrefill {
  matchSnapshotId: string;
  creatorAccountId: string;
  creatorHandle: string;
  proposedCommissionBps: number;
  brandCommissionMinBps: number;
  brandCommissionMaxBps: number;
  matchScore: number;
  reasonSummary: string;
  brandBriefId: string | null;
}

// ── Public creator profile (Identity, Reels, Partnerships rate card) ────────

export interface CreatorProfile {
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
  socialHandles: { instagram: string | null; tiktok: string | null; youtube: string | null; facebook: string | null };
}

export interface CreatorReelStats {
  creatorAccountId: string;
  publishedReelCount: number;
  totalStyleMintLikes: number;
  totalViewsSnapshot: number;
}

export interface RateCard {
  id: string;
  version: number;
  baseRate: number;
  rates: { tierName: string; price: number; includedReels: number; description: string | null }[];
  commissionPreference: number;
  platformPreferences: string[];
  notes: string | null;
  isActive: boolean;
}

/** Orders module: what each creator sold for this shop. No buyer data. */
export interface CreatorPerformance {
  creatorAccountId: string;
  unitsSold: number;
  attributedRevenue: number;
  commissionPaid: number;
  currency: string;
  distinctReelCount: number;
  creatorHandle: string | null;
  creatorDisplayName: string | null;
  creatorAvatarUrl: string | null;
}

// ── Briefs & campaigns (BrandStudio VendorBriefsController, applications) ───

export const BriefState = { Draft: 1, Locked: 2, Retired: 3 } as const;

export interface Brief {
  id: string;
  title: string;
  primaryGoal: number;
  version: number;
  rootBriefId: string;
  state: number;
  commissionRange: { minPercent: number; maxPercent: number };
  boostBudgetAmount: number;
  boostBudgetCurrency: string;
  body: { doSayPoints: string[]; dontSayPoints: string[]; productVariantIds: string[] };
  lockedUtc: string | null;
  publishedUtc: string | null;
  applicationsOpenUtc: string | null;
  applicationsCloseUtc: string | null;
  createdUtc: string;
  updatedUtc: string;
}

export const ApplicationState = { Pending: 1, Withdrawn: 2, Accepted: 3, Declined: 4 } as const;

export interface CampaignApplication {
  id: string;
  brandBriefId: string;
  brandBriefVersion: number;
  creatorProfileId: string;
  state: number;
  message: string | null;
  submittedUtc: string;
  decidedUtc: string | null;
  declineReason: string | null;
}

export interface CampaignWorkspace {
  id: string;
  brandBriefId: string;
  name: string;
  state: number;
  budgetAmount: number;
  budgetCurrency: string;
  spentAmount: number;
  approvedUtc: string | null;
  activatedUtc: string | null;
  completedUtc: string | null;
}

// ── Retainers & squads (RetainerController, SquadController) ────────────────

export const RetainerState = { Draft: 1, Active: 2, Paused: 3, Cancelling: 4, Ended: 5 } as const;

export interface Retainer {
  id: string;
  creatorAccountId: string;
  monthlyAmount: number;
  currency: string;
  deliverablesPerMonth: string;
  autoRenew: boolean;
  renewalNoticeDays: number;
  nextBillingUtc: string | null;
  currentPeriodStartUtc: string | null;
  currentPeriodEndUtc: string | null;
  state: number;
  cancellationNoticeUtc: string | null;
  totalPeriodsCompleted: number;
  createdUtc: string;
}

export interface Squad {
  id: string;
  briefId: string;
  name: string;
  budgetTotal: number;
  budgetCurrency: string;
  state: number;
  memberCount: number;
  createdUtc: string;
}

// ── Content approvals (VendorReelApprovalsController) ───────────────────────

export interface ReelApproval {
  id: string;
  reelId: string;
  creatorAccountId: string;
  partnershipId: string;
  brandBriefId: string;
  round: number;
  state: number;
  creatorNote: string | null;
  submittedUtc: string;
  decidedUtc: string | null;
  rejectionReason: string | null;
}

export interface Reel {
  id: string;
  caption: string | null;
  thumbnailCdnUrl: string | null;
  videoCdnUrl: string | null;
  sourceUrl: string;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
}


export const creatorsApi = {
  // Partnerships
  partnerships: (states: number[] | undefined, cursor: string | null, pageSize = 25) =>
    api.get<PagedResult<Partnership>>('/v1/vendor/partnerships', { states, cursor: cursor ?? undefined, pageSize }),
  invite: (body: { creatorProfileId: string; commissionMinPercent: number; commissionMaxPercent: number; brandBriefId?: string | null }) =>
    api.post<Partnership>('/v1/vendor/partnerships/invite', body),
  acceptRequest: (id: string) => api.post<Partnership>(`/v1/vendor/partnerships/${id}/accept-request`),
  declineRequest: (id: string) => api.post<Partnership>(`/v1/vendor/partnerships/${id}/decline-request`),
  pause: (id: string, reason: string | null) => api.post<Partnership>(`/v1/vendor/partnerships/${id}/pause`, { reason }),
  resume: (id: string) => api.post<Partnership>(`/v1/vendor/partnerships/${id}/resume`),
  end: (id: string, reason: string) => api.post<Partnership>(`/v1/vendor/partnerships/${id}/end`, { reason }),
  adjustCommission: (id: string, body: { commissionMinPercent: number; commissionMaxPercent: number; reason: string | null }) =>
    api.post<Partnership>(`/v1/vendor/partnerships/${id}/adjust-commission`, body),
  searchCreators: (q: string, niche: string | null, cursor: string | null, excludeAlreadyPartnered = false) =>
    api.get<PagedResult<CreatorPick>>('/v1/vendor/partnerships/creators', {
      q: q || undefined,
      niche: niche || undefined,
      excludeAlreadyPartnered,
      cursor: cursor ?? undefined,
      pageSize: 24,
    }),
  /** The shop's program terms creators see with every invite. Required before the first invite. */
  publishTerms: (whoCanJoin: string[], contentRules: string[]) =>
    api.post<unknown>('/v1/vendor/partnership-terms', {
      whoCanJoin: { heading: 'Who Can Join', bullets: whoCanJoin },
      reelContentRules: { heading: 'Reel Content Rules', bullets: contentRules.map((text) => ({ text, inlineLinks: [] })) },
    }),
  predict: (id: string) => api.get<CampaignPrediction>(`/v1/vendor/partnerships/${id}/predict`),
  insurance: (id: string) => api.get<Insurance | null>(`/v1/partnerships/${id}/insurance`),
  insuranceClaims: (id: string) => api.get<InsuranceClaim[]>(`/v1/partnerships/${id}/insurance/claims`),
  buyInsurance: (id: string, coverageAmount: number) =>
    api.post<Insurance>(`/v1/vendor/partnerships/${id}/insurance`, { coverageAmount, currency: 'NPR' }),
  fileClaim: (id: string, body: { claimAmount: number; reason: string }) =>
    api.post<InsuranceClaim>(`/v1/partnerships/${id}/insurance/claim`, { ...body, currency: 'NPR', evidenceUrls: [] }),

  // Matches
  matches: (cursor: string | null) => api.get<PagedResult<MatchSnapshot>>('/v1/vendor/matches', { cursor: cursor ?? undefined, pageSize: 10 }),
  dismissMatch: (id: string) => api.post<MatchSnapshot>(`/v1/vendor/matches/${id}/dismiss`),
  matchPrefill: (id: string) => api.post<PartnershipPrefill>(`/v1/vendor/matches/${id}/invite`),

  // Creator profile
  profile: (accountId: string) => api.get<CreatorProfile>(`/v1/public/creators/${accountId}`),
  reelStats: (accountId: string) => api.get<CreatorReelStats>(`/v1/public/creators/${accountId}/reel-stats`),
  rateCard: (accountId: string) => api.get<RateCard>(`/v1/public/creators/${accountId}/rate-card`),
  performance: (fromUtc?: string, limit = 50) =>
    api.get<CreatorPerformance[]>('/v1/vendor/creator-performance', { fromUtc, limit }),

  // Briefs
  briefs: (states: number[] | undefined, cursor: string | null) =>
    api.get<PagedResult<Brief>>('/v1/vendor/briefs', { state: states, cursor: cursor ?? undefined, pageSize: 25 }),
  brief: (id: string) => api.get<Brief>(`/v1/vendor/briefs/${id}`),
  draftBrief: (body: { title: string; primaryGoal: number; productVariantIds: string[] }) => api.post<Brief>('/v1/vendor/briefs', body),
  updateBrief: (id: string, body: Record<string, unknown>) => api.patch<Brief>(`/v1/vendor/briefs/${id}`, body),
  briefAction: (id: string, action: 'lock' | 'unpublish' | 'fork' | 'retire') => api.post<Brief>(`/v1/vendor/briefs/${id}/${action}`),
  publishBrief: (id: string, applicationsOpenUtc: string, applicationsCloseUtc: string) =>
    api.post<Brief>(`/v1/vendor/briefs/${id}/publish`, { applicationsOpenUtc, applicationsCloseUtc }),
  applications: (briefId: string, states: number[] | undefined, cursor: string | null) =>
    api.get<PagedResult<CampaignApplication>>(`/v1/vendor/briefs/${briefId}/applications`, { states, cursor: cursor ?? undefined, pageSize: 25 }),
  acceptApplication: (briefId: string, applicationId: string) =>
    api.post<{ application: CampaignApplication; partnership: Partnership }>(`/v1/vendor/briefs/${briefId}/applications/${applicationId}/accept`),
  declineApplication: (briefId: string, applicationId: string, reason: string | null) =>
    api.post<CampaignApplication>(`/v1/vendor/briefs/${briefId}/applications/${applicationId}/decline`, { reason }),
  workspaces: () => api.get<CampaignWorkspace[]>('/v1/vendor/campaign-workspaces'),

  // Retainers & squads
  retainers: () => api.get<Retainer[]>('/v1/vendor/retainers'),
  proposeRetainer: (body: { creatorAccountId: string; monthlyAmount: number; deliverablesPerMonth: string }) =>
    api.post<Retainer>('/v1/vendor/retainers', { ...body, currency: 'NPR' }),
  retainerAction: (id: string, action: 'pause' | 'resume' | 'cancel') => api.post<void>(`/v1/retainers/${id}/${action}`),
  squads: () => api.get<Squad[]>('/v1/vendor/squads'),
  createSquad: (body: { briefId: string; name: string; budgetTotal: number }) =>
    api.post<Squad>('/v1/vendor/squads', { ...body, budgetCurrency: 'NPR' }),
  inviteToSquad: (id: string, creatorAccountId: string, budgetShare: number) =>
    api.post<void>(`/v1/vendor/squads/${id}/invite`, { creatorAccountId, budgetShare }),

  // Content approvals
  reelApprovals: () => api.get<ReelApproval[]>('/v1/vendor/reel-approvals'),
  approveReel: (requestId: string) => api.post<Reel>(`/v1/vendor/reel-approvals/${requestId}/approve`),
  rejectReel: (requestId: string, reason: string | null) =>
    api.post<ReelApproval>(`/v1/vendor/reel-approvals/${requestId}/reject`, { reason }),
  reel: (id: string) => api.get<Reel>(`/v1/public/reels/${id}`),
};
