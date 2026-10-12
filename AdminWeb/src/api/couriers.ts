/**
 * Riders (delivery partners) - DeliveryCouriers AdminCouriersController (`/v1/admin/couriers`) for the queue and
 * actions, CourierController (`/v1/courier/{id}`, readable by any admin token) for detail, reliability and escrow.
 * Every POST sends an Idempotency-Key (the client always does; the server treats it as required here). Document
 * enums are NUMBERS in this module.
 */
import { http } from './client';
import { toPage, type Page } from './paging';

export const COURIER_STATE: Record<number, string> = { 1: 'Applied', 2: 'KYC in review', 3: 'Rejected', 4: 'Onboarded', 5: 'Active', 6: 'Suspended', 7: 'Banned' };
export const COURIER_TONE: Record<number, string> = { 1: 'slate', 2: 'amber', 3: 'signal', 4: 'blue', 5: 'forest', 6: 'signal', 7: 'signal' };
export const TIER: Record<number, string> = { 1: 'Neighbour', 2: 'Traveller', 3: 'Pro' };
export const VEHICLE: Record<number, string> = { 1: 'On foot', 2: 'Bicycle', 3: 'Motorcycle', 4: 'Car', 5: 'Van' };
export const DEMOTE_REASON: Record<number, string> = {
  1: 'Reliability too low',
  2: 'Failure streak',
  3: 'Escrow below minimum',
  4: 'Admin action',
  5: 'Background check expired',
};
export const DOC_TYPE: Record<number, string> = {
  1: 'Passport',
  2: 'National ID card',
  3: 'Driving licence',
  4: 'Residence permit',
  5: 'Selfie',
  6: 'Proof of address',
  7: 'PAN',
  8: 'Citizenship',
  9: 'Business registration',
  10: 'Tax document',
};
/** VerificationDocumentSide: 1 = not applicable, 2 = front, 3 = back. */
export const DOC_SIDE: Record<number, string> = { 1: '', 2: 'Front', 3: 'Back' };
export const DOC_STATUS: Record<number, string> = { 1: 'Uploaded', 2: 'Under review', 3: 'Approved', 4: 'Rejected', 5: 'Expired' };
export const ESCROW_KIND: Record<number, string> = { 1: 'Deposit', 2: 'Refund', 3: 'Claim draw', 4: 'Auto top-up' };
export const ESCROW_STATE: Record<number, string> = { 1: 'Held', 2: 'Released', 3: 'Drawn' };
export const SELFIE_DOC_TYPE = 5;

export interface CourierProfile {
  accountId: string;
  id: string;
  state: number;
  currentTier: number;
  accountDisplayName: string | null;
  accountEmail: string | null;
  accountEmailVerified: boolean | null;
  accountPhone: string | null;
  governmentIdLast4: string | null;
  selfieMatchRef: string | null;
  kycVerifiedUtc: string | null;
  backgroundCheckPassedUtc: string | null;
  trainingPassedUtc: string | null;
  onboardedUtc: string | null;
  travelerUnlockedUtc: string | null;
  proUnlockedUtc: string | null;
  suspendedUtc: string | null;
  suspendedReason: string | null;
  lastDemoteReason: number | null;
  failureStreak: number;
  homeGeohash: string;
  homeGeohashPrefix5: string;
  vehicle: number | null;
  escrowHeldAmount: number;
  escrowRequiredAmount: number;
  escrowCurrency: string;
  isOnline: boolean;
  onlineChangedUtc: string | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastLocationUtc: string | null;
  reliabilityScore: number | null;
  averageCustomerRating: number | null;
  createdUtc: string;
  updatedUtc: string;
}

export interface CourierDocument {
  id: string;
  documentType: number;
  side: number;
  status: number;
  contentSizeBytes: number;
  contentType: string;
  originalFilename: string | null;
  uploadedUtc: string;
  rejectionReason: string | null;
}

export interface ReliabilitySnapshot {
  id: string;
  windowStartUtc: string;
  windowEndUtc: string;
  hopsCompleted: number;
  hopsAccepted: number;
  hopsDeclined: number;
  hopsFailed: number;
  hopsOnTime: number;
  averageCustomerRating: number;
  onTimeRate: number;
  acceptanceRate: number;
  reliabilityScore: number;
  computedUtc: string;
}

export interface EscrowEntry {
  id: string;
  amount: number;
  currency: string;
  kind: number;
  state: number;
  packageId: string | null;
  note: string | null;
  occurredUtc: string;
}

export interface CompleteKycBody {
  approved: boolean;
  governmentIdLast4: string;
  selfieMatchRef: string;
  rejectionReason: string | null;
}

const enc = encodeURIComponent;

export const couriersApi = {
  /** One state at a time (default KYC in review), oldest first, bare array with skip/take - no total. */
  list: async (state: string, page: number, pageSize: number, signal?: AbortSignal): Promise<Page<CourierProfile>> =>
    toPage<CourierProfile>(await http.get('/v1/admin/couriers', { state: state || 2, skip: (page - 1) * pageSize, take: pageSize }, signal), page, pageSize),
  get: (id: string, signal?: AbortSignal) => http.get<CourierProfile>(`/v1/courier/${enc(id)}`, undefined, signal),
  byAccount: (accountId: string, signal?: AbortSignal) => http.get<CourierProfile>(`/v1/courier/by-account/${enc(accountId)}`, undefined, signal),
  documents: (id: string, signal?: AbortSignal) => http.get<CourierDocument[]>(`/v1/admin/couriers/${enc(id)}/documents`, undefined, signal),
  documentLink: (id: string, documentId: string, signal?: AbortSignal) => http.get<{ url: string }>(`/v1/admin/couriers/${enc(id)}/documents/${enc(documentId)}/link`, undefined, signal),
  reliability: (id: string, signal?: AbortSignal) => http.get<ReliabilitySnapshot>(`/v1/courier/${enc(id)}/reliability`, undefined, signal),
  reliabilityHistory: (id: string, signal?: AbortSignal) => http.get<ReliabilitySnapshot[]>(`/v1/courier/${enc(id)}/reliability/history`, { take: 12 }, signal),
  escrowBalance: (id: string, signal?: AbortSignal) => http.get<{ amount: number; currency: string }>(`/v1/courier/${enc(id)}/escrow/balance`, undefined, signal),
  escrow: (id: string, signal?: AbortSignal) => http.get<EscrowEntry[]>(`/v1/courier/${enc(id)}/escrow`, { take: 50 }, signal),

  completeKyc: (id: string, body: CompleteKycBody) => http.post<CourierProfile>(`/v1/admin/couriers/${enc(id)}/kyc/complete`, body),
  backgroundCheckPass: (id: string) => http.post<CourierProfile>(`/v1/admin/couriers/${enc(id)}/background-check-pass`),
  trainingPass: (id: string) => http.post<CourierProfile>(`/v1/admin/couriers/${enc(id)}/training-pass`),
  promoteTraveler: (id: string) => http.post<CourierProfile>(`/v1/admin/couriers/${enc(id)}/promote/traveler`),
  promotePro: (id: string) => http.post<CourierProfile>(`/v1/admin/couriers/${enc(id)}/promote/pro`),
  suspend: (id: string, reason: string) => http.post<CourierProfile>(`/v1/admin/couriers/${enc(id)}/suspend`, { reason }),
  reinstate: (id: string) => http.post<CourierProfile>(`/v1/admin/couriers/${enc(id)}/reinstate`),
  escrowDeposit: (id: string, body: { amount: number; currency: string; note: string | null }) => http.post<EscrowEntry>(`/v1/admin/couriers/${enc(id)}/escrow/deposit`, body),
  escrowDraw: (id: string, body: { amount: number; currency: string; packageId: string | null; note: string }) =>
    http.post<EscrowEntry>(`/v1/admin/couriers/${enc(id)}/escrow/draw`, body),
  recomputeReliability: (id: string) => http.post<ReliabilitySnapshot>(`/v1/admin/couriers/${enc(id)}/reliability/recompute`),
};
