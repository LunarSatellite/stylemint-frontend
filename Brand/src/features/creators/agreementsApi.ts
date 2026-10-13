import { api, requestRaw } from '../../api/client';
import type { PagedResult } from '../../api/paging';

/**
 * Written agreements between the shop and a creator — Partnerships module `v1/vendor/agreements*`
 * (contract: D:\Stylemint\wt\seller-creators-plan.md, "Backend notes"). Enums are numbers.
 * Rates are FRACTIONS (0.15 = 15 %); money in major units of `currency`.
 */

export const AgreementKind = { Partnership: 1, Retainer: 2, Campaign: 3, Brief: 4 } as const;

export const AgreementStatus = {
  Draft: 1,
  SentForSignature: 2,
  PartiallyAccepted: 3,
  Active: 4,
  Amended: 5,
  Terminated: 6,
  Expired: 7,
  Declined: 8,
  Cancelled: 9,
} as const;

export const AgreementVersionStatus = { Draft: 1, PendingAcceptance: 2, Accepted: 3, Superseded: 4, Rejected: 5, Withdrawn: 6 } as const;
export const AgreementParty = { Vendor: 1, Creator: 2, System: 3 } as const;
export const ContentApprovalRule = { BrandApprovalRequired: 1, CreatorDiscretion: 2, DeemedApprovedAfterWindow: 3 } as const;
export const PayoutSchedule = { OnCompletion: 1, Weekly: 2, Biweekly: 3, Monthly: 4, Milestones: 5 } as const;

export interface AgreementDeliverable {
  description: string;
  quantity: number;
  platform: string | null;
  /** ISO date (yyyy-mm-dd) or null. */
  dueDate: string | null;
}

export interface AgreementTerms {
  scopeDescription: string | null;
  productIds: string[];
  collectionIds: string[];
  commissionRateMin: number | null;
  commissionRateMax: number | null;
  fixedFeeAmount: number | null;
  currency: string;
  deliverables: AgreementDeliverable[];
  contentApproval: number;
  contentApprovalWindowHours: number | null;
  usageRights: string | null;
  usageRightsDays: number | null;
  paidAdsUsageAllowed: boolean;
  exclusive: boolean;
  exclusivityScope: string | null;
  exclusivityDays: number | null;
  paymentTermsDays: number;
  payoutSchedule: number;
  terminationNoticeDays: number;
  cancellationTerms: string | null;
  governingLaw?: string;
  disputeVenue?: string;
  additionalTerms: string | null;
  effectiveFromUtc: string | null;
  expiresAtUtc: string | null;
}

export interface AgreementAcceptance {
  party: number;
  accountId: string;
  versionNumber: number;
  acceptedUtc: string;
  /** Full only on the caller's own acceptance; the creator's is masked by the server. Not shown in the UI. */
  ipAddress?: string | null;
  userAgent?: string | null;
  termsHash: string;
}

export interface AgreementVersion {
  id?: string;
  versionNumber: number;
  status: number;
  terms: AgreementTerms | null;
  renderedText: string;
  termsHash: string;
  templateId?: string | null;
  templateName: string | null;
  templateVersion: number | null;
  amendmentReason: string | null;
  createdUtc?: string;
  sentUtc: string | null;
  acceptedUtc: string | null;
  closedUtc: string | null;
  /** Acceptances of this version (grouped from the detail's flat list). */
  acceptances: AgreementAcceptance[];
}

export interface AgreementEvent {
  type: number;
  actorParty: number;
  versionNumber: number | null;
  note: string | null;
  occurredUtc: string;
}

/** `AgreementSummaryDto` as sent (list rows and `detail.agreement`). */
export interface AgreementSummaryWire {
  id: string;
  agreementNumber: string;
  kind: number;
  title: string;
  status: number;
  partnershipId: string | null;
  retainerId: string | null;
  referenceId: string | null;
  vendorAccountId?: string;
  vendorName: string;
  creatorAccountId: string;
  creatorProfileId?: string | null;
  creatorName: string;
  creatorHandle: string | null;
  currentVersion: number;
  activeVersion: number | null;
  /** Hash of the current version — the one to echo when accepting. */
  currentTermsHash?: string;
  currentVersionStatus?: number;
  vendorAcceptedCurrent?: boolean;
  creatorAcceptedCurrent?: boolean;
  /** Parties the current version still needs (1 vendor, 2 creator). */
  awaitingParties?: number[];
  effectiveFromUtc: string | null;
  expiresAtUtc: string | null;
  sentUtc: string | null;
  activatedUtc: string | null;
  endedUtc: string | null;
  endedByParty: number | null;
  endReason: string | null;
  createdUtc: string;
  updatedUtc: string;
}

/** `AgreementDetailDto` as sent. */
interface AgreementDetailWire {
  agreement: AgreementSummaryWire;
  versions: (Omit<AgreementVersion, 'acceptances'> & { acceptances?: AgreementAcceptance[] })[];
  acceptances: AgreementAcceptance[];
  timeline: AgreementEvent[];
  templateReviewedByLegal: boolean;
}

/** A list row, with the signature flags under short names. */
export interface AgreementSummary extends AgreementSummaryWire {
  /** Has each side accepted the current version? Undefined = unknown. */
  vendorAccepted?: boolean;
  creatorAccepted?: boolean;
}

export interface AgreementDetail extends AgreementSummary {
  versions: AgreementVersion[];
  events: AgreementEvent[];
  templateReviewedByLegal: boolean;
}

export interface AgreementFilter {
  status?: number[];
  kind?: number;
  partnershipId?: string | null;
  retainerId?: string | null;
  creatorAccountId?: string | null;
  /** Only agreements expiring within this many days. */
  expiringWithinDays?: number | null;
  q?: string | null;
}

/** Body of `POST v1/vendor/agreements` and `/preview`. */
export interface CreateAgreementBody {
  kind: number;
  partnershipId?: string | null;
  retainerId?: string | null;
  referenceId?: string | null;
  templateId?: string | null;
  title: string;
  terms: AgreementTerms;
  /** true = create and send for signature in one call. */
  send?: boolean;
}

export interface AgreementTemplate {
  id: string;
  name: string;
  jurisdiction: string;
  version: number;
  summary: string;
  isLatestVersion: boolean;
  reviewedByLegal: boolean;
}

export function normalizeSummary(s: AgreementSummaryWire): AgreementSummary {
  return { ...s, vendorAccepted: s.vendorAcceptedCurrent, creatorAccepted: s.creatorAcceptedCurrent };
}

function normalizeDetail(w: AgreementDetailWire): AgreementDetail {
  const acceptances = w.acceptances ?? [];
  return {
    ...normalizeSummary(w.agreement),
    templateReviewedByLegal: !!w.templateReviewedByLegal,
    versions: (w.versions ?? [])
      .map((v) => ({
        ...v,
        terms: v.terms ?? null,
        acceptances: v.acceptances ?? acceptances.filter((a) => a.versionNumber === v.versionNumber),
      }))
      .sort((a, b) => b.versionNumber - a.versionNumber),
    events: [...(w.timeline ?? [])].sort((a, b) => b.occurredUtc.localeCompare(a.occurredUtc)),
  };
}

const BASE = '/v1/vendor/agreements';

export const agreementsApi = {
  list: async (f: AgreementFilter, cursor: string | null, pageSize = 25): Promise<PagedResult<AgreementSummary>> => {
    const page = await api.get<PagedResult<AgreementSummaryWire>>(BASE, {
      status: f.status,
      kind: f.kind,
      partnershipId: f.partnershipId ?? undefined,
      retainerId: f.retainerId ?? undefined,
      creatorAccountId: f.creatorAccountId ?? undefined,
      expiringWithinDays: f.expiringWithinDays ?? undefined,
      q: f.q || undefined,
      cursor: cursor ?? undefined,
      pageSize,
    });
    return { ...page, items: page.items.map(normalizeSummary) };
  },
  templates: () => api.get<AgreementTemplate[]>(`${BASE}/templates`, { jurisdiction: 'NP' }),
  get: async (id: string) => normalizeDetail(await api.get<AgreementDetailWire>(`${BASE}/${id}`)),
  create: async (body: CreateAgreementBody) => normalizeDetail(await api.post<AgreementDetailWire>(BASE, body)),
  updateDraft: async (id: string, body: { title: string; templateId?: string | null; terms: AgreementTerms }) =>
    normalizeDetail(await api.put<AgreementDetailWire>(`${BASE}/${id}`, body)),
  /** Renders the template with these terms without saving. */
  preview: (body: CreateAgreementBody) => api.post<{ terms: AgreementTerms; renderedText: string; templateName: string }>(`${BASE}/preview`, body),
  send: async (id: string) => normalizeDetail(await api.post<AgreementDetailWire>(`${BASE}/${id}/send`)),
  /** The shop signs a version, echoing the hash of the text it was shown. */
  accept: async (id: string, versionNumber: number, termsHash: string) =>
    normalizeDetail(await api.post<AgreementDetailWire>(`${BASE}/${id}/accept`, { versionNumber, termsHash })),
  amend: async (id: string, terms: AgreementTerms, reason: string) =>
    normalizeDetail(await api.post<AgreementDetailWire>(`${BASE}/${id}/amend`, { terms, reason })),
  /** Discard a draft, withdraw an unsigned agreement, or withdraw a pending amendment. */
  withdraw: async (id: string, reason: string | null) => normalizeDetail(await api.post<AgreementDetailWire>(`${BASE}/${id}/withdraw`, { reason })),
  terminate: async (id: string, reason: string) => normalizeDetail(await api.post<AgreementDetailWire>(`${BASE}/${id}/terminate`, { reason })),
  pdf: async (id: string, versionNumber?: number): Promise<Blob> => {
    const res = await requestRaw(`${BASE}/${id}/pdf`, { query: { version: versionNumber }, headers: { Accept: 'application/pdf' } });
    return res.blob();
  },
};

/** Default terms for a new agreement; seeded from the partnership/retainer when there is one. */
export function defaultTerms(seed: Partial<AgreementTerms> = {}): AgreementTerms {
  return {
    scopeDescription: null,
    productIds: [],
    collectionIds: [],
    commissionRateMin: 0.1,
    commissionRateMax: 0.1,
    fixedFeeAmount: null,
    currency: 'NPR',
    deliverables: [],
    contentApproval: ContentApprovalRule.BrandApprovalRequired,
    contentApprovalWindowHours: null,
    usageRights: 'Repost on the shop’s StyleMint page and social channels, credited to the creator',
    usageRightsDays: 90,
    paidAdsUsageAllowed: false,
    exclusive: false,
    exclusivityScope: null,
    exclusivityDays: null,
    paymentTermsDays: 15,
    payoutSchedule: PayoutSchedule.Monthly,
    terminationNoticeDays: 7,
    cancellationTerms: null,
    additionalTerms: null,
    effectiveFromUtc: null,
    expiresAtUtc: null,
    ...seed,
  };
}
