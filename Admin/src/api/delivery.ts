/**
 * Delivery operations: packages (Delivery AdminPackagesController - SupportAgent/Readonly), guardian (Delivery, SuperAdmin),
 * routing and fulfilment (DeliveryRouting, SuperAdmin - note the backend path is `fulfilment`).
 * NB: the delivery module's own DeliveryTier is Pro = 1, Traveler = 2, Neighbor = 3 - the reverse of the courier module.
 */
import { http } from './client';
import type { RiderFareBreakdown } from './fare';
import { toPage, type Page } from './paging';

export const PACKAGE_STATE: Record<number, string> = {
  1: 'Created',
  2: 'Awaiting pickup',
  3: 'Picked up',
  4: 'In transit',
  5: 'At hand-off',
  6: 'Out for delivery',
  7: 'Delivered',
  8: 'Failed delivery',
  9: 'Returning',
  10: 'Returned',
};
export const ROUTING_TIER: Record<number, string> = { 1: 'Pro', 2: 'Traveller', 3: 'Neighbour' };
export const OFFER_STATE: Record<number, string> = { 1: 'Pending', 2: 'Accepted', 3: 'Declined', 4: 'Expired', 5: 'Superseded', 6: 'Interested' };
export const PLAN_STATUS: Record<number, string> = { 1: 'Offers issued', 2: 'Hop assigned', 3: 'Multi-hop composed', 4: 'Escalated to Pro queue', 5: 'No candidates' };
export const REPLAN_REASON: Record<number, string> = {
  1: 'Hop failed',
  2: 'Package exception',
  3: 'Admin replan',
  4: 'Round failed',
  5: 'Address changed',
  6: 'Vendor requested',
  7: 'Courier available',
};
export const PROMISE_STATE: Record<number, string> = {
  1: 'No window requested',
  2: 'Insufficient evidence',
  3: 'Evidence supports the window',
  4: 'Evidence contradicts the window',
};

export interface PackageAwaiting {
  packageId: string;
  subOrderId: string;
  trackingNumber: string;
  state: number;
  originGeohash: string;
  destinationGeohash: string;
  sameLocality: boolean;
  createdUtc: string;
  waitingHours: number;
}

export interface PackageDetail {
  id: string;
  subOrderId: string;
  trackingNumber: string;
  state: number;
  weightGrams: number;
  lengthMm: number;
  widthMm: number;
  heightMm: number;
  declaredValueAmount: number;
  declaredValueCurrency: string;
  isFragile: boolean;
  isTimeSensitive: boolean;
  deliverByUtc: string | null;
  originAddressLine: string;
  destinationAddressLine: string;
  hasSeal: boolean;
  sealedUtc: string | null;
  dispatchedUtc: string | null;
  deliveredUtc: string | null;
  createdUtc: string;
  /** The parcel's legs. `fareBreakdown` on each (rider-fare contract v1) is null for hops priced before it shipped. */
  hops?: PackageHop[];
}

export const HOP_STATE: Record<number, string> = {
  1: 'Waiting to be offered',
  2: 'Offered',
  3: 'Accepted',
  4: 'Going to pick up',
  5: 'Picked up',
  6: 'Going to hand off',
  7: 'Handed off',
  8: 'Cancelled',
  9: 'Failed',
};

/** `DeliveryHopDto` (Delivery module; tier uses ROUTING_TIER numbering). */
export interface PackageHop {
  id: string;
  packageId: string;
  hopIndex: number;
  tier: number;
  courierProfileId: string;
  state: number;
  fromGeohash: string;
  toGeohash: string;
  acceptedUtc: string | null;
  pickedUpUtc: string | null;
  handedOffUtc: string | null;
  courierPayoutAmount: number;
  courierPayoutCurrency: string;
  fareBreakdown?: RiderFareBreakdown | null;
  failureCode: number | null;
  failureNote: string | null;
}

export interface HopOffer {
  id: string;
  packageId: string;
  courierProfileId: string;
  tier: number;
  hopIndex: number;
  roundNumber: number;
  score: number;
  proposedPayoutAmount: number;
  proposedPayoutCurrency: string;
  fromGeohash: string;
  toGeohash: string;
  state: number;
  offeredUtc: string;
  expiresUtc: string;
  respondedUtc: string | null;
  declineNote: string | null;
  distanceToPickupKm: number | null;
  fareBreakdown?: RiderFareBreakdown | null;
}

export interface RoutingMetrics {
  totalOffers: number;
  accepted: number;
  declined: number;
  expired: number;
  superseded: number;
  pending: number;
  acceptanceRate: number;
  expiryRate: number;
}

export interface RoutingPlan {
  packageId: string;
  status: number;
  eligibility: { matchedRule: string; reason: string; allowedTiers: number[] };
  legs: { hopIndex: number; originGeohash: string; destinationGeohash: string; topCandidates: { candidate: { courierProfileId: string; tier: number }; score: number }[] }[];
  issuedOfferIds: string[];
  roundNumber: number;
  escalationReason: string | null;
}

export interface CourierPick {
  courierProfileId: string;
  tier: number;
  currentGeohash: string;
  score: number;
  reliability: number;
  rating: number;
  recentDeclines24h: number;
  earningsLast7Days: number;
  proposedPayoutAmount: number;
  proposedPayoutCurrency: string;
  /** What this rider would be paid, itemised - a quote, not persisted. */
  fareBreakdown?: RiderFareBreakdown | null;
}

export interface FulfilmentOption {
  key: string;
  tier: number;
  candidateCount: number;
  proposedCourierPayoutAmount: number | null;
  currency: string;
  score: number | null;
  evidence: { sampleSize: number; isSufficient: boolean; medianLeadTimeMinutes: number | null; observedOnTimeRate: number | null };
}

export interface FulfilmentAssessment {
  packageId: string;
  subOrderId: string;
  trackingNumber: string;
  eligibilityReason: string;
  options: FulfilmentOption[];
  recommendedOptionKey: string | null;
  recommendationReason: string;
  promise: { state: number; reasonCode: string; explanation: string; deliverByUtc: string | null };
  unavailableFactors: { factorCode: string; sheetStage: string; reason: string }[];
  assessedUtc: string;
}

export interface GuardianSweepReport {
  sweptUtc: string;
  candidatesExamined: number;
  buyerNotResolved: number;
  assessmentRefused: number;
  parcelsWithLiveRemedies: number;
  haltedAfterFailure: boolean;
}

export interface InterventionLedger {
  dimension: string;
  dimensionValue: string;
  riskReasonCode: string;
  minimumSampleSize: number;
  arms: {
    armCode: string;
    armLabel: string;
    outcomes: { parcels: number; deliveredWithinRecordedWindow: number; deliveredAfterRecordedWindow: number; deliveryFailed: number; notYetObservable: number };
    meetsMinimumSample: boolean;
  }[];
  statement: string;
}

const enc = encodeURIComponent;

export const deliveryApi = {
  awaitingCourier: async (page: number, pageSize: number, signal?: AbortSignal): Promise<Page<PackageAwaiting>> => {
    const take = Math.min(100, pageSize);
    return toPage<PackageAwaiting>(await http.get('/v1/admin/delivery/packages/awaiting-courier', { skip: (page - 1) * take, take }, signal), page, take);
  },
  packageBySubOrder: (subOrderId: string, signal?: AbortSignal) => http.get<PackageDetail>(`/v1/admin/delivery/packages/by-sub-order/${enc(subOrderId)}`, undefined, signal),
  stuckOffers: async (cursor: string | null, page: number, pageSize: number, signal?: AbortSignal): Promise<Page<HopOffer>> =>
    toPage<HopOffer>(await http.get('/v1/admin/routing/stuck', { cursor: cursor || undefined, pageSize }, signal), page, pageSize),
  routingMetrics: (sinceUtc: string, signal?: AbortSignal) => http.get<RoutingMetrics>('/v1/admin/routing/metrics', { sinceUtc }, signal),
  candidates: (packageId: string, signal?: AbortSignal) => http.get<CourierPick[]>(`/v1/admin/routing/candidates/${enc(packageId)}`, undefined, signal),
  replan: (packageId: string, reason: number, note: string | null) => http.post<RoutingPlan>(`/v1/admin/routing/replan/${enc(packageId)}`, { reason, note }),
  offerTo: (packageId: string, courierProfileId: string, note: string | null) =>
    http.post<RoutingPlan>(`/v1/admin/routing/offer/${enc(packageId)}/courier/${enc(courierProfileId)}`, { note }),
  assessment: (packageId: string, signal?: AbortSignal) => http.get<FulfilmentAssessment>(`/v1/admin/fulfilment/${enc(packageId)}/assessment`, undefined, signal),
  commit: (packageId: string, optionKey: string, note: string | null) => http.post<unknown>(`/v1/admin/fulfilment/${enc(packageId)}/commit`, { optionKey, note }),
  guardianSweep: (maxParcels: number) => http.post<GuardianSweepReport>('/v1/admin/delivery/guardian/sweep', undefined, { maxParcels }),
  interventions: (dimension: string, signal?: AbortSignal) => http.get<InterventionLedger[]>('/v1/admin/delivery/guardian/interventions', { dimension }, signal),
};
