/**
 * Return pickups by rider (D:\Stylemint\wt\return-pickup-contract.md v1.0 §3, §4 "Admin (read-only)").
 * Delivery `v1/admin/delivery/return-pickups` - read-only; answers a bare 404 until that backend is deployed.
 * Every enum here is a string on the wire; unknown values are humanized, never dropped.
 */
import { http, request } from './client';
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
  /** List (return-fixes contract §B): true for NeedsSupport, AttemptFailed and NoRiders. Absent on an older server. */
  needsAction?: boolean;
}

/** Detail adds hops and proofs - status and times only; the API never sends codes. */
export interface ReturnPickupDetail extends ReturnPickupDto {
  /** Support actions the server allows now (`MarkReceived` | `SearchAgain` | `CancelReturn`). Absent on an older server. */
  allowedActions?: string[];
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

/** Stages the server flags `needsAction` for (return-fixes contract §B). */
export const NEEDS_ACTION_STAGES = new Set(['NeedsSupport', 'AttemptFailed', 'NoRiders']);

/**
 * "Needs action": the server's `needsAction` when it sends one; on a detail read (which carries `allowedActions` but
 * maybe not `needsAction`) the same stage rule the list uses. An older server (neither field) never shows it.
 */
export function needsAction(p: { needsAction?: boolean; allowedActions?: string[]; stage: string | null }): boolean {
  if (typeof p.needsAction === 'boolean') return p.needsAction;
  return Array.isArray(p.allowedActions) && NEEDS_ACTION_STAGES.has(p.stage ?? '');
}

export type PickupAction = 'MarkReceived' | 'SearchAgain' | 'CancelReturn';

/** Support actions for a stuck pickup, in the order the buttons show. Unknown server actions are ignored. */
export const PICKUP_ACTIONS: Record<PickupAction, { label: string; consequence: string; danger?: boolean }> = {
  MarkReceived: {
    label: 'Mark item received',
    consequence:
      'Only when you have confirmed the seller has the item. The pickup becomes "Received by seller"; a rider who collected it is paid the final fare, otherwise no fare is charged. The seller can then complete the return as usual.',
  },
  SearchAgain: {
    label: 'Search riders again',
    consequence: 'A fresh rider search starts: riders nearby are offered the pickup again and the seller is told.',
  },
  CancelReturn: {
    label: 'Cancel return',
    consequence: 'The return is cancelled by support. The return parcel is closed and the buyer and seller are told. This cannot be undone.',
    danger: true,
  },
};
export const PICKUP_ACTION_ORDER: PickupAction[] = ['MarkReceived', 'SearchAgain', 'CancelReturn'];
export const isPickupAction = (a: string): a is PickupAction => a in PICKUP_ACTIONS;

export const RESOLVE_NOTE_MAX = 500;
export const ACTION_NOT_ALLOWED = 'return_pickup.action_not_allowed';
/** 409 `return_pickup.action_not_allowed`, in plain words. */
export const ACTION_NOT_ALLOWED_TEXT = 'This pickup has moved on and that action is no longer possible. The details are up to date now - check them and choose again.';

export interface ResolvePickupBody {
  action: PickupAction;
  note: string;
}

const enc = encodeURIComponent;

export const returnPickupsApi = {
  list: async (q: { stage?: string; cursor?: string | null; pageSize: number; page: number }, signal?: AbortSignal): Promise<Page<ReturnPickupDto>> =>
    toPage<ReturnPickupDto>(
      await http.get('/v1/admin/delivery/return-pickups', { stage: q.stage || undefined, cursor: q.cursor ?? undefined, pageSize: q.pageSize }, signal),
      q.page,
      q.pageSize,
    ),
  get: (returnRequestId: string, signal?: AbortSignal) => http.get<ReturnPickupDetail>(`/v1/admin/delivery/return-pickups/${enc(returnRequestId)}`, undefined, signal),
  /**
   * Support action on a stuck pickup (return-fixes contract §B). Answers the same detail as `get`. The caller passes
   * the Idempotency-Key so a retried identical submission is one write. Bare 404 = not deployed.
   */
  resolve: (returnRequestId: string, body: ResolvePickupBody, idempotencyKey: string) =>
    request<ReturnPickupDetail>(`/v1/admin/delivery/return-pickups/${enc(returnRequestId)}/resolve`, { method: 'POST', body, idempotencyKey }),
};
