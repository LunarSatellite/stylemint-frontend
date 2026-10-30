import { api, ApiError, isMissingEndpoint } from '../../api/client';
import type { Money } from '../../lib/format';
import { humanize } from '../../lib/format';
import type { DeliveryRequest } from '../orders/api';

/**
 * Return pickup by rider (D:\Stylemint\wt\return-pickup-contract.md v1.0, §3–4).
 * Every enum here is a string on the wire; unknown values are shown humanized, never crash.
 */

export type ReturnPickupStage =
  | 'SearchingRider'
  | 'RidersInterested'
  | 'NoRiders'
  | 'RiderAssigned'
  | 'AwaitingBuyerConfirmation'
  | 'Collected'
  | 'AwaitingSellerConfirmation'
  | 'ReceivedBySeller'
  | 'AttemptFailed'
  | 'Cancelled'
  | 'NeedsSupport';

export interface ReturnPickup {
  id: string;
  returnRequestId: string;
  orderId: string;
  subOrderId: string;
  trackingNumber: string | null;
  /** Existing numeric ReturnPickupState; `stage` is the one to read. */
  state: number;
  stage: string | null;
  /** "Rider" | "Legacy" */
  mode: string | null;
  packageId: string | null;
  originAddressLine?: string | null;
  destinationAddressLine?: string | null;
  requestedUtc: string | null;
  pickedUpUtc: string | null;
  receivedUtc: string | null;
  requestExpiresUtc: string | null;
  rider: { displayName: string; avatarUrl: string | null; rating: number | null; vehicle: string | null } | null;
  attempts: { failed: number; max: number; lastFailureCode: string | null } | null;
  collectionPhotoUrls: string[] | null;
  fare: { payer: string | null; amount: Money | null; upTo: Money | null; isFinal: boolean } | null;
  canCancel?: boolean;
  canRetry?: boolean;
}

export const stageLabel: Record<string, string> = {
  SearchingRider: 'Finding a rider',
  RidersInterested: 'Riders interested',
  NoRiders: 'No rider yet',
  RiderAssigned: 'Rider on the way to the buyer',
  AwaitingBuyerConfirmation: 'Rider is at the buyer',
  Collected: 'Rider is bringing your return',
  AwaitingSellerConfirmation: 'Rider is with you',
  ReceivedBySeller: 'You have the item',
  AttemptFailed: 'Rider couldn’t collect',
  Cancelled: 'Pickup cancelled',
  NeedsSupport: 'Support is looking into it',
};
export const stageColor: Record<string, string> = {
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
export const labelOfStage = (s: string | null | undefined) => (s ? (stageLabel[s] ?? humanize(s)) : '—');

/** Reason categories (contract §4). `Unspecified` = an older app sent none (D1: the seller pays). */
export const reasonCategoryLabel: Record<string, string> = {
  Damaged: 'Arrived damaged',
  WrongItem: 'Wrong item',
  Defective: 'Defective',
  NotAsDescribed: 'Not as described',
  ChangedMind: 'Changed mind',
  Unspecified: 'No reason type',
};
export const labelOfReason = (c: string | null | undefined) => (c ? (reasonCategoryLabel[c] ?? humanize(c)) : null);

export const failureLabel: Record<string, string> = {
  BuyerUnreachable: 'buyer not reachable',
  AddressIncorrect: 'address incorrect',
  HandoverRefused: 'buyer refused the handover',
};

/** Stages where the seller can (re)open a rider search. */
export const SEARCH_STAGES = new Set(['SearchingRider', 'RidersInterested', 'NoRiders', 'AttemptFailed']);
/** Stages where the rider has the item (or is about to hand it over) and the seller confirms by code. */
export const CONFIRM_STAGES = new Set(['Collected', 'AwaitingSellerConfirmation']);

export const PICKUP_NOT_RECEIVED = 'return.pickup_not_received';
export const isPickupNotReceived = (e: unknown) => e instanceof ApiError && e.status === 409 && e.code === PICKUP_NOT_RECEIVED;
export const PICKUP_NOT_RECEIVED_TEXT = 'The rider hasn’t handed this return to you yet. Enter the rider’s code first, then mark it received.';

/**
 * What the pickup read answered:
 * - `ok`: a pickup exists (`mode` says Rider or Legacy);
 * - `none`: the server has the feature but no pickup for this return → treat as Legacy ("Find a rider");
 * - `unavailable`: the route is not deployed → show nothing, gate nothing.
 */
export type PickupRead = { status: 'ok'; pickup: ReturnPickup } | { status: 'none' } | { status: 'unavailable' };

export interface ConfirmReceiptResult {
  purpose?: string;
  returnRequestId?: string | null;
  packageNumber?: string;
  status?: string;
}

const base = (id: string) => `/v1/vendor/returns/${encodeURIComponent(id)}`;

export const returnPickupApi = {
  /**
   * `deployed` = the list item already carries the new return fields (`pickupStage` key present). Then a bare 404
   * means "no pickup yet" rather than "route missing".
   */
  pickup: async (id: string, deployed: boolean): Promise<PickupRead> => {
    try {
      return { status: 'ok', pickup: await api.get<ReturnPickup>(`${base(id)}/pickup`) };
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        if (isMissingEndpoint(e) && !deployed) return { status: 'unavailable' };
        return { status: 'none' };
      }
      if (isMissingEndpoint(e)) return { status: 'unavailable' };
      throw e;
    }
  },
  /**
   * Open or re-open ("Try again" / "Find a rider"). A Legacy return also gets its reverse package.
   * `allowVerifiedNonPro` records the seller's yes to a verified rider for a high-value return that found no Pro
   * rider (`delivery.no_pro_rider_high_value` + `canUseVerifiedRider`); never sent without that explicit yes.
   */
  openRequest: (id: string, opts?: { allowVerifiedNonPro?: boolean }) =>
    api.post<DeliveryRequest>(`${base(id)}/pickup-requests`, opts?.allowVerifiedNonPro ? { allowVerifiedNonPro: true } : {}),
  /** null when no request is open (404 is the normal "not yet" answer). */
  currentRequest: async (id: string): Promise<DeliveryRequest | null> => {
    try {
      return await api.get<DeliveryRequest>(`${base(id)}/pickup-requests/current`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  selectRider: (id: string, offerId: string) => api.post<DeliveryRequest>(`${base(id)}/pickup-requests/current/select`, { offerId }),
  /** The seller is the recipient of the return parcel: same endpoint as the buyer's delivery confirm (contract §4). */
  confirmReceipt: (packageNumber: string, code: string) =>
    api.post<ConfirmReceiptResult>('/v1/customer/deliveries/confirm', { packageNumber, code }),
};

export const pickupKey = (id: string) => ['care', 'returns', 'pickup', id] as const;

export function pickupErrorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    switch (e.code) {
      case 'delivery_request.expired':
        return 'This request expired. Try again to notify riders.';
      case 'delivery_request.rider_not_interested':
        return 'That rider is no longer available. Choose another rider.';
      case 'delivery_request.already_assigned':
        return 'A rider is already assigned to this return.';
      case 'delivery_request.closed':
        return 'This return is no longer waiting for a rider.';
      case 'delivery_proof.invalid':
        return 'That code doesn’t match. Check the code in the rider’s app.';
      case 'delivery_proof.expired':
        return 'That code has expired. Ask the rider to show a new one.';
      case 'delivery_proof.too_many_attempts':
        return 'Too many wrong codes. Try again in 15 minutes.';
      case 'delivery_proof.not_recipient':
        return 'This code is not for your shop.';
      case PICKUP_NOT_RECEIVED:
        return PICKUP_NOT_RECEIVED_TEXT;
    }
  }
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

/** "Rider" mode returns can't be completed before the seller confirmed receipt (contract §3, 409 otherwise). */
export function isReceiptPending(read: PickupRead | undefined): boolean {
  if (!read || read.status !== 'ok') return false;
  const p = read.pickup;
  if (p.mode !== 'Rider') return false;
  // Only a known stage gates (same rule as the mobile seller app); an unknown one leaves it to the server's 409.
  if (!p.stage || !(p.stage in stageLabel)) return false;
  return p.stage !== 'ReceivedBySeller' && !p.receivedUtc;
}
