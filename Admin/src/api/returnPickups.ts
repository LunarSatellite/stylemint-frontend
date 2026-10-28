/**
 * Return pickups by rider (D:\Stylemint\wt\return-pickup-contract.md v1.0 §3, §4 "Admin (read-only)").
 * Delivery `v1/admin/delivery/return-pickups` - read-only; answers a bare 404 until that backend is deployed.
 * Every enum here is a string on the wire; unknown values are humanized, never dropped.
 */
import { http } from './client';
import { humanize } from '@/lib/format';
import { toPage, type Page } from './paging';

export interface WireMoney {
  amount: number;
  currency: string;
}

export interface ReturnPickupDto {
  id: string;
  returnRequestId: string;
  orderId: string;
  subOrderId: string;
  trackingNumber: string | null;
  state: number;
  stage: string | null;
  mode: string | null;
  packageId: string | null;
  requestedUtc: string | null;
  pickedUpUtc: string | null;
  receivedUtc: string | null;
  requestExpiresUtc: string | null;
  rider: { displayName: string; avatarUrl: string | null; rating: number | null; vehicle: string | null } | null;
  attempts: { failed: number; max: number; lastFailureCode: string | null } | null;
  collectionPhotoUrls: string[] | null;
  fare: { payer: string | null; amount: WireMoney | null; upTo: WireMoney | null; isFinal: boolean } | null;
  canCancel?: boolean;
  canRetry?: boolean;
}

/** Detail adds hops and proofs - status and times only; the API never sends codes. */
export interface ReturnPickupDetail extends ReturnPickupDto {
  hops?: { id?: string; hopId?: string; status?: string | number | null; state?: string | number | null; courierDisplayName?: string | null; createdUtc?: string | null; acceptedUtc?: string | null; pickedUpUtc?: string | null; completedUtc?: string | null; failedUtc?: string | null; failureCode?: string | null }[];
  proofs?: { id?: string; purpose?: string | null; status?: string | null; createdUtc?: string | null; expiresUtc?: string | null; confirmedUtc?: string | null }[];
}

export const PICKUP_STAGE: Record<string, string> = {
  SearchingRider: 'Finding a rider',
  RidersInterested: 'Riders interested',
  NoRiders: 'No rider yet',
  RiderAssigned: 'Rider assigned',
  AwaitingBuyerConfirmation: 'Rider at the buyer',
  Collected: 'Collected',
  AwaitingSellerConfirmation: 'Rider at the seller',
  ReceivedBySeller: 'Received by seller',
  AttemptFailed: 'Attempt failed',
  Cancelled: 'Cancelled',
  NeedsSupport: 'Needs support',
};
export const PICKUP_STAGE_TONE: Record<string, string> = {
  SearchingRider: 'blue',
  RidersInterested: 'blue',
  NoRiders: 'amber',
  RiderAssigned: 'cyan',
  AwaitingBuyerConfirmation: 'cyan',
  Collected: 'cyan',
  AwaitingSellerConfirmation: 'amber',
  ReceivedBySeller: 'forest',
  AttemptFailed: 'amber',
  Cancelled: 'gray',
  NeedsSupport: 'signal',
};
export const REASON_CATEGORY: Record<string, string> = {
  Damaged: 'Damaged',
  WrongItem: 'Wrong item',
  Defective: 'Defective',
  NotAsDescribed: 'Not as described',
  ChangedMind: 'Changed mind',
  Unspecified: 'Unspecified (older app)',
};
export const FARE_PAYER: Record<string, string> = { Seller: 'Seller', Buyer: 'Buyer (from the refund)' };
export const FAILURE_CODE: Record<string, string> = { BuyerUnreachable: 'Buyer unreachable', AddressIncorrect: 'Address incorrect', HandoverRefused: 'Handover refused' };

export const label = (map: Record<string, string>, v: string | null | undefined) => (v ? (map[v] ?? humanize(v)) : '—');

const enc = encodeURIComponent;

export const returnPickupsApi = {
  list: async (q: { stage?: string; cursor?: string | null; pageSize: number; page: number }, signal?: AbortSignal): Promise<Page<ReturnPickupDto>> =>
    toPage<ReturnPickupDto>(
      await http.get('/v1/admin/delivery/return-pickups', { stage: q.stage || undefined, cursor: q.cursor ?? undefined, pageSize: q.pageSize }, signal),
      q.page,
      q.pageSize,
    ),
  get: (returnRequestId: string, signal?: AbortSignal) => http.get<ReturnPickupDetail>(`/v1/admin/delivery/return-pickups/${enc(returnRequestId)}`, undefined, signal),
};
