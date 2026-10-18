/**
 * KYC review - StyleMint.Modules.Admin KycController (`/v1/admin/kyc`). Enums travel as NUMBERS in bodies and DTOs
 * (no global string-enum converter); the detail's document fields are enum NAMES because the server calls
 * ToString() on them. Riders are reviewed through couriers.ts; once the backend adds Courier = 4 they also appear here.
 */
import { http } from './client';
import { toPage, type Page } from './paging';

/** Courier = 4 arrives with feat/admin-api-gaps (riders join the unified queue); older servers reject it as a filter. */
export const APPLICANT_KIND = { Creator: 1, Vendor: 2, Customer: 3, Courier: 4 } as const;
export type KycApplicantKind = 1 | 2 | 3 | 4;
export type KycApplicantType = 'Creator' | 'Vendor' | 'Customer' | 'Courier';
export const REVIEW_STATE = { Pending: 1, InReview: 2, Decided: 3 } as const;
export type KycReviewState = 1 | 2 | 3;
export const DECISION = { Approved: 1, RejectedRetryable: 2, RejectedTerminal: 3 } as const;
export type KycDecision = 1 | 2 | 3;

export const REVIEW_STATE_LABEL: Record<number, string> = { 1: 'Pending', 2: 'In review', 3: 'Decided' };
export const DECISION_LABEL: Record<string, string> = {
  '1': 'Approved',
  '2': 'Rejected - may reapply',
  '3': 'Rejected - final',
  Approved: 'Approved',
  RejectedRetryable: 'Rejected - may reapply',
  RejectedTerminal: 'Rejected - final',
};
export const DECISION_TONE: Record<string, string> = { '1': 'forest', '2': 'amber', '3': 'signal', Approved: 'forest', RejectedRetryable: 'amber', RejectedTerminal: 'signal' };

export const RETRYABLE_REASONS = ['DOCS_UNCLEAR', 'DOCS_MISMATCH', 'CATEGORY_MISSING', 'POLICY_VIOLATION_RECOVERABLE'] as const;
export const TERMINAL_REASONS = ['FRAUD_SUSPECTED', 'SANCTIONS_HIT', 'UNDERAGE'] as const;
export type KycReasonCode = (typeof RETRYABLE_REASONS)[number] | (typeof TERMINAL_REASONS)[number];

export const REASON_LABEL: Record<KycReasonCode, string> = {
  DOCS_UNCLEAR: 'Documents unclear or unreadable',
  DOCS_MISMATCH: 'Details do not match the documents',
  CATEGORY_MISSING: 'Product category missing',
  POLICY_VIOLATION_RECOVERABLE: 'Policy issue that can be fixed',
  FRAUD_SUSPECTED: 'Fraud suspected',
  SANCTIONS_HIT: 'Sanctions list match',
  UNDERAGE: 'Under 18',
};

/** The reason codes a decision accepts. The server rejects a retryable code on a final rejection and vice versa. */
export function reasonCodesFor(decision: KycDecision, kind: KycApplicantKind): KycReasonCode[] {
  if (decision === DECISION.Approved) return [];
  const codes: KycReasonCode[] = decision === DECISION.RejectedRetryable ? [...RETRYABLE_REASONS] : [...TERMINAL_REASONS];
  // Only vendors and creators have product categories.
  return kind === APPLICANT_KIND.Customer || kind === APPLICANT_KIND.Courier ? codes.filter((c) => c !== 'CATEGORY_MISSING') : codes;
}

export interface KycReviewItem {
  id: string;
  applicantKind: KycApplicantKind;
  applicationId: string;
  accountId: string;
  state: KycReviewState;
  assignedReviewerId: string | null;
  submittedUtc: string;
  dueByUtc: string;
  decidedUtc: string | null;
  decision: KycDecision | null;
  decisionReasonCode: string | null;
  decisionNote: string | null;
  rowVersion: string | null;
  applicantType: KycApplicantType;
}

export interface KycDocument {
  id: string;
  documentType: string;
  status: string;
  originalFilename: string | null;
  contentType: string;
  contentSizeBytes: number;
  uploadedUtc: string;
  rejectionReason: string | null;
  /** Customer only: CitizenshipFront | CitizenshipBack | NationalIdFront | NationalIdBack | PassportBio | Selfie */
  kind: string | null;
  side: string | null;
}

export interface KycPreviousAttempt {
  kycItemId: string | null;
  submittedUtc: string;
  decidedUtc: string | null;
  decision: string | null;
  decisionReasonCode: string | null;
  decisionNote: string | null;
}

export interface KycApplicationDetail {
  kycItemId: string;
  applicantKind: KycApplicantKind;
  applicationId: string;
  accountId: string;
  displayName: string;
  legalName: string | null;
  countryCode: string | null;
  city: string | null;
  addressLine: string | null;
  website: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  story: string | null;
  commissionMinPercent: number | null;
  commissionMaxPercent: number | null;
  submittedUtc: string;
  expectedDecisionByUtc: string | null;
  documents: KycDocument[];
  applicantType: KycApplicantType;
  fullName: string | null;
  dateOfBirth: string | null;
  documentType: string | null;
  documentNumberLast4: string | null;
  documentNumberMasked: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  previousAttempts: KycPreviousAttempt[] | null;
  /**
   * Vendor items only (service-banks-contract v1 §1; null/absent for creators, customers, couriers and on older
   * servers): 0 product seller, 1 Hotel, 2 TravelAgency, 3 Bank. Bank = NRB licence number.
   */
  serviceCategory?: number | null;
  serviceCategoryName?: string | null;
  licenceNumber?: string | null;
  licenceIssuer?: string | null;
  /** "2028-07-15" */
  licenceExpiresOn?: string | null;
  /** Courier items only (feat/admin-api-gaps). */
  vehicle?: string | null;
  homeArea?: string | null;
  courierState?: string | null;
}

export interface KycQueueFilter {
  applicantKind?: KycApplicantKind | null;
  state?: KycReviewState | null;
  overdueOnly?: boolean;
  reviewerId?: string | null;
  page: number;
  pageSize: number;
}

export interface DecideKycBody {
  decision: KycDecision;
  decisionReasonCode: KycReasonCode | null;
  decisionNote: string | null;
}

export const kycApi = {
  queue: async (f: KycQueueFilter, signal?: AbortSignal): Promise<Page<KycReviewItem>> =>
    toPage<KycReviewItem>(
      await http.get(
        '/v1/admin/kyc/queue',
        {
          applicantKind: f.applicantKind ?? undefined,
          state: f.state ?? undefined,
          overdueOnly: f.overdueOnly || undefined,
          reviewerId: f.reviewerId ?? undefined,
          pageNumber: f.page,
          pageSize: f.pageSize,
        },
        signal,
      ),
      f.page,
      f.pageSize,
    ),
  item: (id: string, signal?: AbortSignal) => http.get<KycReviewItem>(`/v1/admin/kyc/${encodeURIComponent(id)}`, undefined, signal),
  application: (id: string, signal?: AbortSignal) => http.get<KycApplicationDetail>(`/v1/admin/kyc/${encodeURIComponent(id)}/application`, undefined, signal),
  documentLink: (id: string, documentId: string, signal?: AbortSignal) =>
    http.get<{ url: string }>(`/v1/admin/kyc/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentId)}/link`, undefined, signal),
  /** Claim for yourself (empty body) or assign to another reviewer. */
  assign: (id: string, reviewerAdminId?: string | null) =>
    http.post<KycReviewItem>(`/v1/admin/kyc/${encodeURIComponent(id)}/assign`, reviewerAdminId ? { reviewerAdminId } : {}),
  decide: (id: string, body: DecideKycBody) => http.post<KycReviewItem>(`/v1/admin/kyc/${encodeURIComponent(id)}/decide`, body),
};

/**
 * Decide, claiming the item first when it is still Pending: the server only lets an InReview item be decided, and
 * making the reviewer press "claim" before every decision is a step that only exists to produce a 409.
 */
export async function decideKyc(item: Pick<KycReviewItem, 'id' | 'state'>, body: DecideKycBody): Promise<KycReviewItem> {
  if (item.state === REVIEW_STATE.Pending) await kycApi.assign(item.id);
  return kycApi.decide(item.id, body);
}

/** Slots for side-by-side comparison of a buyer's ID photos and selfie. */
export type DocSlot = 'front' | 'back' | 'bio' | 'selfie' | 'other';

export function slotOf(doc: Pick<KycDocument, 'kind' | 'documentType' | 'side'>): DocSlot {
  const kind = (doc.kind ?? '').toLowerCase();
  if (kind === 'selfie' || doc.documentType === 'SelfiePhoto') return 'selfie';
  if (kind === 'passportbio') return 'bio';
  if (kind.endsWith('front') || doc.side === 'Front') return 'front';
  if (kind.endsWith('back') || doc.side === 'Back') return 'back';
  if (doc.documentType === 'Passport') return 'bio';
  return 'other';
}

/** Which slots a customer's chosen ID type needs; missing ones are worth a DOCS_UNCLEAR. */
export function requiredSlots(documentType: string | null): DocSlot[] {
  if (documentType === 'Passport') return ['bio', 'selfie'];
  if (documentType === 'Citizenship' || documentType === 'NationalId') return ['front', 'back', 'selfie'];
  return [];
}

export const ID_TYPE_LABEL: Record<string, string> = {
  Citizenship: 'Citizenship certificate',
  NationalId: 'National ID card',
  Passport: 'Passport',
};

/** Whole years between a YYYY-MM-DD birth date and today. */
export function ageFrom(dateOfBirth: string | null, now = new Date()): number | null {
  if (!dateOfBirth) return null;
  const d = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}
