import { api, ApiError } from '../../api/client';
import type { BulkResult, PagedResult } from '../../api/paging';
import type { Money } from '../../lib/format';

/**
 * Vendor fulfilment (StyleMint.Modules.Orders VendorFulfillmentController) and delivery requests
 * (StyleMint.Modules.DeliveryRouting). Sub-order states are INTEGERS on the wire; delivery-routing
 * states are strings.
 */

export const SubOrderState = {
  Pending: 1,
  Paid: 2,
  AwaitingFulfillment: 3,
  ReadyToShip: 4,
  AwaitingTracking: 5,
  Shipped: 6,
  Delivered: 7,
  Cancelled: 8,
  Returned: 9,
  InTransit: 10,
  OutForDelivery: 11,
  Accepted: 12,
  Packed: 13,
  HandedOver: 14,
} as const;
export type SubOrderStateValue = (typeof SubOrderState)[keyof typeof SubOrderState];

export const stateLabel: Record<number, string> = {
  1: 'Awaiting payment',
  2: 'New',
  3: 'New',
  4: 'Ready to ship',
  5: 'Awaiting tracking',
  6: 'Shipped',
  7: 'Delivered',
  8: 'Cancelled',
  9: 'Returned',
  10: 'In transit',
  11: 'Out for delivery',
  12: 'Accepted',
  13: 'Packed',
  14: 'Handed over',
};

export const stateColor: Record<number, string> = {
  1: 'gray',
  2: 'amber',
  3: 'amber',
  4: 'blue',
  5: 'blue',
  6: 'teal',
  7: 'forest',
  8: 'signal',
  9: 'grape',
  10: 'teal',
  11: 'teal',
  12: 'cyan',
  13: 'indigo',
  14: 'teal',
};

/** Order tabs — each is a set of states; counts come from `?states=…&pageSize=1` → totalCount. */
export interface OrderTab {
  id: string;
  label: string;
  states: number[];
  /** Highlight the count: the seller needs to act. */
  urgent?: boolean;
}

export const ORDER_TABS: OrderTab[] = [
  { id: 'new', label: 'New', states: [2, 3], urgent: true },
  { id: 'accepted', label: 'To pack', states: [12], urgent: true },
  { id: 'packed', label: 'To hand over', states: [13, 4, 5], urgent: true },
  { id: 'shipping', label: 'On the way', states: [14, 6, 10, 11] },
  { id: 'delivered', label: 'Delivered', states: [7] },
  { id: 'cancelled', label: 'Cancelled & returned', states: [8, 9] },
  { id: 'all', label: 'All', states: [] },
];

export const VendorRejectionReason = {
  OutOfStock: 1,
  CannotFulfillInTime: 2,
  PricingError: 3,
  AddressNotServiceable: 4,
  SuspectedFraud: 5,
  Other: 6,
} as const;

export const rejectionReasons = [
  { value: '1', label: 'Out of stock' },
  { value: '2', label: 'Cannot deliver in time' },
  { value: '3', label: 'Price was wrong' },
  { value: '4', label: 'Cannot deliver to this address' },
  { value: '5', label: 'Looks like a fraudulent order' },
  { value: '6', label: 'Other reason' },
];

/** `Service` = hotel stay / travel package lines (service-cart-contract.md v1): no shipping, no fulfilment actions. */
export type FulfillmentChannel = 'Delivery' | 'StorePickup' | 'Service';

/** `lineKind` on order lines; absent on an older backend = Product. */
export const OrderLineKind = { Product: 1, Service: 2 } as const;

/** The booking behind a service order line (service-cart-contract.md v1 §4.1). Names only — no buyer contact. */
export interface OrderBooking {
  bookingId: string;
  bookingNumber: string;
  /** Bookings `BookingState` (1 PendingPayment … 7 Expired). */
  state: number;
  /** 1 Stay · 2 Package. */
  kind: number;
  listingId: string;
  listingTitle: string;
  itemName: string | null;
  roomTypeId: string | null;
  departureId: string | null;
  startDate: string;
  endDate: string | null;
  nights: number | null;
  rooms: number | null;
  adults: number;
  children: number;
  guestName: string | null;
  travellers: { fullName: string; type: number; age: number | null }[];
  specialRequests: string | null;
  currency: string;
  totalPrice: number;
  paidNowAmount: number;
  payAtVenueAmount: number;
  paymentMode: number | null;
  depositPercent: number | null;
  freeUntilDate: string | null;
  cancellationPolicySummary: string | null;
  canCancel?: boolean;
}

/** Shared `PaymentMethod` ints. */
export const PaymentMethod = {
  Card: 1,
  PayPal: 2,
  Esewa: 3,
  CashOnDelivery: 4,
} as const;

/**
 * The payment plan (EMI) that pays for an order (`VendorOrderPaymentPlanDto`). The order's total is
 * the plan's price, but the buyer pays it as a down payment and then `tenureMonths` instalments —
 * so the seller must never read the price as money collected at once.
 */
export interface OrderPaymentPlan {
  agreementId: string;
  /** Instalment (EMI), PayLater or Prepay. */
  kind: string;
  priceAmount: number;
  downPaymentAmount: number;
  financedAmount: number;
  tenureMonths: number;
  monthlyInstalmentAmount: number;
  currency: string;
  /** Collected in cash when the item is delivered (else paid online). */
  downPaymentOnDelivery: boolean;
  /** Received; the plan has started. */
  downPaymentPaid: boolean;
}

export function planLabel(plan: OrderPaymentPlan): string {
  if (plan.kind === 'PayLater') return 'Pay later';
  if (plan.kind === 'Prepay') return 'Pay now, buy later';
  return 'EMI';
}

/** How the down payment is paid: "collect in cash on delivery", "paid online", … */
export function downPaymentHow(plan: OrderPaymentPlan): string {
  if (plan.downPaymentOnDelivery) return plan.downPaymentPaid ? 'collected in cash' : 'collect in cash on delivery';
  return plan.downPaymentPaid ? 'paid online' : 'to be paid online';
}

export interface SubOrderListItem {
  /** How the buyer pays (`PaymentMethod`). Absent from an older backend. */
  paymentMethod?: number;
  /** The EMI behind the order; null/absent for an ordinary order. */
  paymentPlan?: OrderPaymentPlan | null;
  id: string;
  orderId: string;
  orderNumber: string;
  receiverName: string;
  state: number;
  shippingFeeAmount: number;
  shippingFeeCurrency: string;
  subtotalAmount: number;
  subtotalCurrency: string;
  itemCount: number;
  carrier: string | null;
  trackingNumber: string | null;
  placedUtc: string;
  shippedUtc: string | null;
  deliveredUtc: string | null;
  fulfillmentChannel: FulfillmentChannel;
  collectedUtc: string | null;
}

export interface ShipTo {
  receiverName: string;
  receiverPhone: string;
  addressLine1: string;
  landmark: string | null;
  country: string;
  state: string;
  city: string;
  zipCode: string;
  latitude: number | null;
  longitude: number | null;
  locationNote: string | null;
  mapsLink: string | null;
}

export interface SubOrderLine {
  id: string;
  productVariantId: string;
  quantity: number;
  unitPriceAmount: number;
  unitPriceCurrency: string;
  productTitleSnapshot: string;
  variantLabelSnapshot: string | null;
  optionLabel: string | null;
  thumbnailUrlSnapshot: string | null;
  lineSubtotalAmount: number;
  lineSubtotalCurrency: string;
  /** 1 Product · 2 Service; absent on an older backend (= Product). */
  lineKind?: number;
  /** Service lines only: the booking (for a service line `lineSubtotalAmount` is the part paid now). */
  booking?: OrderBooking | null;
  /**
   * StyleMint's platform commission on this line (platform-commission contract v1.0 §3): charged on the full line
   * price at the category's rate, snapshotted when the order was placed. Absent on an older backend.
   */
  platformCommissionAmount?: number | null;
  platformCommissionRatePercent?: number | null;
  /** What the seller receives for this line after StyleMint's (and any creator's) commission, when the server sends it. */
  vendorNetAmount?: number | null;
}

export type RiderRatingTag =
  | 'OnTime'
  | 'Friendly'
  | 'CarefulWithParcel'
  | 'GoodCommunication'
  | 'Professional'
  | 'Late'
  | 'Rude'
  | 'ParcelDamaged'
  | 'HardToReach'
  | 'WrongLocation';

export const POSITIVE_TAGS: RiderRatingTag[] = ['OnTime', 'Friendly', 'CarefulWithParcel', 'GoodCommunication', 'Professional'];
export const NEGATIVE_TAGS: RiderRatingTag[] = ['Late', 'Rude', 'ParcelDamaged', 'HardToReach', 'WrongLocation'];
export const tagLabel: Record<RiderRatingTag, string> = {
  OnTime: 'On time',
  Friendly: 'Friendly',
  CarefulWithParcel: 'Careful with parcel',
  GoodCommunication: 'Good communication',
  Professional: 'Professional',
  Late: 'Late',
  Rude: 'Rude',
  ParcelDamaged: 'Parcel damaged',
  HardToReach: 'Hard to reach',
  WrongLocation: 'Wrong location',
};

export interface OrderDelivery {
  subOrderId: string;
  packageNumber: string;
  status: string;
  riderName: string | null;
  awaitingConfirmation: boolean;
  courierId: string | null;
  canRateRider: boolean;
  riderRating: { stars: number; tags: RiderRatingTag[] } | null;
}

export interface SubOrderDetail {
  id: string;
  orderId: string;
  orderNumber: string;
  state: number;
  placedUtc: string;
  shipTo: ShipTo;
  shippingFeeAmount: number;
  shippingFeeCurrency: string;
  carrier: string | null;
  trackingNumber: string | null;
  acceptedUtc: string | null;
  packedUtc: string | null;
  handedOverUtc: string | null;
  shippedUtc: string | null;
  inTransitUtc: string | null;
  outForDeliveryUtc: string | null;
  deliveredUtc: string | null;
  fulfillmentChannel: FulfillmentChannel;
  collectedUtc: string | null;
  cancelledUtc: string | null;
  cancellationReasonCode: number | null;
  cancellationNote: string | null;
  lineSubtotalAmount: number;
  lineSubtotalCurrency: string;
  subtotalAmount: number;
  subtotalCurrency: string;
  itemCount: number;
  lines: SubOrderLine[];
  delivery: OrderDelivery | null;
  courierId?: string | null;
  canRateRider?: boolean;
  riderRating?: { stars: number; tags: RiderRatingTag[] } | null;
  /** How the buyer pays (`PaymentMethod`). Absent from an older backend. */
  paymentMethod?: number;
  /** The EMI behind the order; null/absent for an ordinary order. */
  paymentPlan?: OrderPaymentPlan | null;
  /**
   * What the rider collects in cash on delivery: the total for an ordinary cash order, only the
   * down payment for an EMI with a cash down payment; null when nothing is collected.
   */
  cashToCollectAmount?: number | null;
  cashToCollectCurrency?: string | null;
  /** StyleMint's platform commission over all lines (contract v1.0 §3). Absent on an older backend. */
  platformCommissionAmount?: number | null;
  /** The rate when every line has the same one; null when the lines differ. */
  platformCommissionRatePercent?: number | null;
  /** What the seller receives for the items after StyleMint's (and any creator's) commission, when the server sends it. */
  vendorNetAmount?: number | null;
}

/** "12.5%" — up to two decimals. */
export const formatRate = (n: number) => `${Number(n.toFixed(2))}%`;

/** "StyleMint commission (10%)", or without the rate when it is unknown or differs between lines. */
export function commissionLabel(rate: number | null | undefined): string {
  return typeof rate === 'number' && Number.isFinite(rate) ? `StyleMint commission (${formatRate(rate)})` : 'StyleMint commission';
}

/**
 * The commission and "you receive" for an amount, or null when the server does not send the commission (an older
 * backend) — the screen then hides both lines. "You receive" is the server's vendor net when it sends one, else the
 * amount less StyleMint's commission (`computed`: a creator's commission, if any, is not in it).
 */
export function commissionBreakdown(
  amount: number,
  fields: { platformCommissionAmount?: number | null; platformCommissionRatePercent?: number | null; vendorNetAmount?: number | null },
): { commission: number; rate: number | null; receive: number; computed: boolean } | null {
  const c = fields.platformCommissionAmount;
  if (typeof c !== 'number' || !Number.isFinite(c)) return null;
  const rate = typeof fields.platformCommissionRatePercent === 'number' ? fields.platformCommissionRatePercent : null;
  const net = fields.vendorNetAmount;
  if (typeof net === 'number' && Number.isFinite(net)) return { commission: c, rate, receive: net, computed: false };
  return { commission: c, rate, receive: Math.round((amount - c) * 100) / 100, computed: true };
}

export interface PackingSlip {
  packingSlipNumber: string;
  orderNumber: string;
  subOrderId: string;
  issuedUtc: string;
  placedUtc: string;
  shipTo: ShipTo;
  carrier: string | null;
  trackingNumber: string | null;
  items: { productTitleSnapshot: string; variantLabelSnapshot: string | null; quantity: number }[];
}

export type DeliveryRequestState = 'Searching' | 'RidersInterested' | 'Assigned' | 'Expired' | 'NoRiders';
export type CourierTier = 'Neighbor' | 'Traveler' | 'Pro';

export interface InterestedRider {
  offerId: string;
  courierId: string;
  displayName: string;
  avatarUrl: string | null;
  tier: CourierTier;
  rating: number | null;
  ratingCount?: number;
  completedDeliveries: number;
  verified?: boolean;
  distanceKm: number;
  vehicle: string | null;
  interestedUtc: string;
  /** The offer's fixed fare (return pickups, return-pickup contract §4). Absent on older servers. */
  fare?: Money | null;
}

export interface DeliveryRequest {
  packageId: string;
  /** "Delivery" | "Return" (return-pickup contract §4). Absent on older servers = Delivery. */
  kind?: string;
  returnRequestId?: string | null;
  state: DeliveryRequestState;
  notifiedCount: number;
  openedUtc: string;
  expiresUtc: string;
  radiusKm: number;
  interested: InterestedRider[];
  assigned: { courierId: string; displayName: string; avatarUrl: string | null; phone: string | null } | null;
  /**
   * Why the request is `NoRiders`, when there is a specific reason (null otherwise):
   * `delivery.no_pro_rider_high_value` — a high-value parcel may only go to a Pro rider and none is available;
   * `delivery.no_verified_rider_high_value` — the seller already agreed to a verified rider and none is in range.
   */
  noRidersReason?: string | null;
  /** The seller may retry with `allowVerifiedNonPro` (only with `delivery.no_pro_rider_high_value`). */
  canUseVerifiedRider?: boolean;
  /** The seller's recorded agreement to a verified non-Pro rider for this parcel. */
  verifiedRiderConsent?: { consentedByAccountId: string; consentedUtc: string } | null;
}

export const NO_PRO_RIDER_HIGH_VALUE = 'delivery.no_pro_rider_high_value';
export const NO_VERIFIED_RIDER_HIGH_VALUE = 'delivery.no_verified_rider_high_value';

export interface RiderProfile {
  courierId: string;
  offerId: string | null;
  displayName: string;
  avatarUrl: string | null;
  verified: boolean;
  memberSinceUtc: string | null;
  tier: CourierTier;
  vehicle: { type: string | null; plateLast4: string | null } | null;
  homeArea: string | null;
  distanceKm: number;
  interestedUtc: string | null;
  rating: {
    average: number | null;
    count: number;
    breakdown: Record<string, number>;
    topTags: { tag: RiderRatingTag; count: number }[];
  } | null;
  completedDeliveries: number;
  onTimeRate: number | null;
  cancellationRate: number | null;
  recentReviews: { stars: number; tags: RiderRatingTag[]; comment: string | null; ageDays: number }[];
  state: 'Interested' | 'Assigned' | 'NotSelected' | 'Withdrawn';
}

export interface RiderRating {
  subOrderId: string;
  courierId: string;
  riderName: string;
  raterRole: 'Buyer' | 'Vendor';
  stars: number;
  tags: RiderRatingTag[];
  comment: string | null;
  createdUtc: string;
  updatedUtc: string;
  editableUntilUtc: string;
}

export interface OrderListFilter {
  states?: number[];
  placedFromUtc?: string;
  placedToUtc?: string;
  pageSize?: number;
}

const base = '/v1/vendor/sub-orders';

export const ordersApi = {
  list: (filter: OrderListFilter, cursor: string | null) =>
    api.get<PagedResult<SubOrderListItem>>(base, {
      states: filter.states && filter.states.length ? filter.states : undefined,
      placedFromUtc: filter.placedFromUtc,
      placedToUtc: filter.placedToUtc,
      cursor: cursor ?? undefined,
      pageSize: filter.pageSize ?? 25,
    }),

  /** No counts endpoint exists: one `pageSize=1` request per bucket, read totalCount. */
  count: async (states: number[]) => {
    const page = await api.get<PagedResult<SubOrderListItem>>(base, {
      states: states.length ? states : undefined,
      pageSize: 1,
    });
    return page.totalCount;
  },

  detail: (id: string) => api.get<SubOrderDetail>(`${base}/${id}`),
  accept: (id: string) => api.post<unknown>(`${base}/${id}/accept`),
  reject: (id: string, reasonCode: number, note: string | null) =>
    api.post<unknown>(`${base}/${id}/reject`, { reasonCode, note }),
  packed: (id: string) => api.post<unknown>(`${base}/${id}/packed`),
  handover: (id: string, body: { carrier?: string | null; trackingNumber?: string | null; handoverNote?: string | null }) =>
    api.post<unknown>(`${base}/${id}/handover`, body),
  readyToShip: (id: string) => api.post<unknown>(`${base}/${id}/ready-to-ship`),
  tracking: (id: string, carrier: string, trackingNumber: string) =>
    api.post<unknown>(`${base}/${id}/tracking`, { carrier, trackingNumber }),
  inTransit: (id: string) => api.post<unknown>(`${base}/${id}/in-transit`),
  outForDelivery: (id: string) => api.post<unknown>(`${base}/${id}/out-for-delivery`),
  delivered: (id: string) => api.post<unknown>(`${base}/${id}/delivered`),
  collected: (id: string) => api.post<unknown>(`${base}/${id}/collected`),
  seal: (id: string, sealId: string, sealPhotoUrl: string) =>
    api.post<boolean>(`${base}/${id}/seal`, { sealId, sealPhotoUrl }),
  uploadSealPhoto: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<{ url: string }>('/v1/vendor/packages/seal-images', form);
  },

  packingSlip: (id: string) => api.get<PackingSlip>(`${base}/${id}/packing-slip`),
  bulkAccept: (ids: string[]) => api.post<BulkResult<unknown>>(`${base}/bulk/accept`, { subOrderIds: ids }),
  bulkReadyToShip: (ids: string[]) => api.post<BulkResult<unknown>>(`${base}/bulk/ready-to-ship`, { subOrderIds: ids }),
  bulkPackingSlips: (ids: string[]) =>
    api.post<BulkResult<PackingSlip>>(`${base}/bulk/packing-slips`, { subOrderIds: ids }, { idempotencyKey: false }),

  /**
   * Opens (or re-opens) the request. `allowVerifiedNonPro` records the seller's consent to hand a high-value
   * parcel to a verified rider of any tier (only after `delivery.no_pro_rider_high_value`). Every call gets a
   * fresh Idempotency-Key, so the consent retry is never answered from the earlier reply.
   */
  openDeliveryRequest: (id: string, opts?: { allowVerifiedNonPro?: boolean }) =>
    api.post<DeliveryRequest>(`${base}/${id}/delivery-requests`, opts?.allowVerifiedNonPro ? { allowVerifiedNonPro: true } : {}),
  /** null when no request was ever opened (404 is the normal "not yet" answer). */
  currentDeliveryRequest: async (id: string): Promise<DeliveryRequest | null> => {
    try {
      return await api.get<DeliveryRequest>(`${base}/${id}/delivery-requests/current`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  selectRider: (id: string, offerId: string) =>
    api.post<DeliveryRequest>(`${base}/${id}/delivery-requests/current/select`, { offerId }),
  riderProfile: (id: string, courierId: string) =>
    api.get<RiderProfile>(`${base}/${id}/delivery-requests/current/riders/${courierId}`),

  riderRating: async (id: string): Promise<RiderRating | null> => {
    try {
      return await api.get<RiderRating>(`${base}/${id}/rider-rating`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },
  rateRider: (id: string, body: { stars: number; tags: RiderRatingTag[]; comment: string | null }) =>
    api.put<RiderRating>(`${base}/${id}/rider-rating`, body),
};

/** The actions the seller can take now, by state and channel (mirrors the mobile vendor app). */
export type OrderAction =
  | 'accept'
  | 'reject'
  | 'pack'
  | 'findRider'
  | 'handover'
  | 'readyToShip'
  | 'tracking'
  | 'collected'
  | 'inTransit'
  | 'outForDelivery'
  | 'delivered';

export function availableActions(state: number, channel: FulfillmentChannel): OrderAction[] {
  const S = SubOrderState;
  // Bookings are run from the booking page; the backend refuses fulfilment actions on a Service sub-order (409).
  if (channel === 'Service') return [];
  if (state === S.Paid || state === S.AwaitingFulfillment) return ['accept', 'reject'];
  if (state === S.Accepted) return ['pack'];
  if (channel === 'StorePickup') {
    if (state === S.Packed) return ['collected', 'readyToShip'];
    if (state === S.ReadyToShip || state === S.AwaitingTracking) return ['collected'];
    return [];
  }
  switch (state) {
    case S.Packed:
      return ['findRider', 'handover'];
    case S.ReadyToShip:
    case S.AwaitingTracking:
      return ['tracking'];
    case S.HandedOver:
    case S.Shipped:
      return ['inTransit', 'delivered'];
    case S.InTransit:
      return ['outForDelivery', 'delivered'];
    case S.OutForDelivery:
      return ['delivered'];
    default:
      return [];
  }
}

export const isMoving = (state: number) => [2, 3, 4, 5, 6, 10, 11, 12, 13, 14].includes(state);
