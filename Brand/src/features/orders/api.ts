import { api, ApiError } from '../../api/client';
import type { BulkResult, PagedResult } from '../../api/paging';

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

export type FulfillmentChannel = 'Delivery' | 'StorePickup';

export interface SubOrderListItem {
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
}

export interface DeliveryRequest {
  packageId: string;
  state: DeliveryRequestState;
  notifiedCount: number;
  openedUtc: string;
  expiresUtc: string;
  radiusKm: number;
  interested: InterestedRider[];
  assigned: { courierId: string; displayName: string; avatarUrl: string | null; phone: string | null } | null;
}

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

  openDeliveryRequest: (id: string) => api.post<DeliveryRequest>(`${base}/${id}/delivery-requests`, {}),
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
