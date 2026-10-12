/**
 * Orders (StyleMint.Modules.Orders AdminOrdersController), archive (Admin OrderArchiveController), refunds
 * (Admin PaymentsController) and order care. Money is decimal MAJOR units with a separate currency ("NPR").
 */
import { http, request } from './client';
import { toPage, type Page } from './paging';

export const SUB_ORDER_STATE: Record<number, string> = {
  1: 'Pending',
  2: 'Paid',
  3: 'Awaiting fulfilment',
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
export const SUB_ORDER_TONE: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'amber', 4: 'blue', 5: 'amber', 6: 'blue', 7: 'forest', 8: 'signal', 9: 'slate', 10: 'blue', 11: 'blue', 12: 'blue', 13: 'blue', 14: 'blue' };
export const ORDER_STATE: Record<number, string> = { 1: 'Placed', 2: 'Paid', 3: 'Fulfilling', 4: 'Completed', 5: 'Cancelled' };
export const ORDER_TONE: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'blue', 4: 'forest', 5: 'signal' };
export const PAYMENT_METHOD: Record<number, string> = { 1: 'Card (Visa/Mastercard)', 2: 'PayPal', 3: 'eSewa', 4: 'Cash on delivery' };
export const CANCEL_REASON: Record<number, string> = {
  1: 'Ordered by mistake',
  2: 'Found a better price',
  3: 'Changed mind',
  4: 'Delivery too long',
  5: 'Needs a different size or colour',
  6: 'Other',
};

export interface AdminSubOrderRow {
  id: string;
  orderId: string;
  orderNumber: string;
  vendorAccountId: string;
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
  fulfillmentChannel: 'Delivery' | 'StorePickup' | string;
  fulfillmentLocationId: string | null;
  collectedUtc: string | null;
  vendorName: string | null;
  archivedUtc: string | null;
  archivedReason: string | null;
}

export interface ShippingAddress {
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

export interface OrderDelivery {
  subOrderId: string;
  packageNumber: string;
  status: string;
  riderName: string | null;
  awaitingConfirmation: boolean;
  courierId: string | null;
  riderRating: { stars: number; tags: string[] } | null;
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
  creatorAccountId: string | null;
  commissionAmountValue: number | null;
  commissionAmountCurrency: string | null;
  originChannel: string | null;
  lineSubtotalAmount: number;
  lineSubtotalCurrency: string;
}

export interface SubOrder {
  id: string;
  orderId: string;
  vendorAccountId: string;
  state: number;
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
  fulfillmentChannel: string;
  collectedUtc: string | null;
  cancelledUtc: string | null;
  cancellationReasonCode: number | null;
  cancellationNote: string | null;
  subtotalAmount: number;
  subtotalCurrency: string;
  lines: SubOrderLine[];
  delivery: OrderDelivery | null;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  accountId: string;
  state: number;
  shipTo: ShippingAddress;
  paymentMethod: number;
  paymentIntentId: string | null;
  shippingTotalAmount: number;
  shippingTotalCurrency: string;
  taxTotalAmount: number;
  taxTotalCurrency: string;
  taxIncluded: boolean;
  discountTotalAmount: number;
  discountTotalCurrency: string;
  subtotalAmount: number;
  subtotalCurrency: string;
  grandTotalAmount: number;
  grandTotalCurrency: string;
  placedUtc: string;
  cancelledUtc: string | null;
  cancellationReasonCode: number | null;
  cancellationNote: string | null;
  archivedUtc: string | null;
  archivedReason: string | null;
  archivedById: string | null;
  subOrders: SubOrder[];
  delivery: OrderDelivery | null;
}

export interface OrderListFilter {
  state?: string;
  vendorAccountId?: string;
  placedFromUtc?: string;
  placedToUtc?: string;
  includeArchived?: boolean;
  archivedOnly?: boolean;
  cursor?: string | null;
  pageSize: number;
}

export interface OrderArchiveRequest {
  orderIds?: string[] | null;
  vendorAccountId?: string | null;
  placedBefore?: string | null;
  reason?: string | null;
  /** The server defaults to true: nothing changes unless this is false. */
  dryRun: boolean;
}

export interface OrderArchiveItem {
  orderId: string;
  orderNumber: string;
  buyerAccountId: string;
  buyerName: string;
  vendors: { vendorAccountId: string; vendorName: string | null; subOrderId: string; subOrderState: number }[];
  state: number;
  placedUtc: string;
  grandTotalAmount: number;
  currency: string;
  changes: boolean;
  archivedUtc: string | null;
  archivedReason: string | null;
}

export interface OrderArchiveResult {
  operation: 'archive' | 'unarchive';
  dryRun: boolean;
  matchedCount: number;
  changedCount: number;
  unchangedCount: number;
  notFoundOrderIds: string[];
  orders: OrderArchiveItem[];
}

export interface RefundContext {
  orderId: string;
  orderNumber: string;
  paymentIntentId: string | null;
  /** The order total; earlier refunds are NOT subtracted. */
  refundableAmount: number;
  currency: string;
  state: string;
}

export interface RefundBody {
  amount: number;
  currency: string;
  /** ^[a-z0-9_-]+$, <= 60 */
  reasonTag: string;
  reason: string;
}

export interface RefundResult {
  refundId: string;
  paymentIntentId: string;
  state: 'Pending' | 'Completed' | string;
  providerRefundId: string | null;
}

export interface CareThemeReport {
  windowDays: number;
  generatedUtc: string;
  themes: { code: string; accountableArea: string; openCount: number }[];
}

export const CARE_LABEL: Record<string, string> = {
  deliveryOverdueAgainstPromise: 'Deliveries overdue against the promised date',
  returnWindowClosingSoon: 'Return windows closing soon',
  warrantyCoverEndingSoon: 'Warranty cover ending soon',
  approvedReturnStillOpen: 'Approved returns still open',
  refundUnresolved: 'Refunds unresolved',
};

export const REFUND_TAGS = [
  { value: 'goodwill', label: 'Goodwill' },
  { value: 'item_not_received', label: 'Item not received' },
  { value: 'damaged_item', label: 'Damaged item' },
  { value: 'wrong_item', label: 'Wrong item' },
  { value: 'return_accepted', label: 'Return accepted' },
  { value: 'duplicate_charge', label: 'Duplicate charge' },
  { value: 'cancelled_after_payment', label: 'Cancelled after payment' },
  { value: 'other', label: 'Other' },
];

export const ordersApi = {
  /** Cursor-paged, one row per sub-order (one vendor's part of an order), newest first. */
  list: async (f: OrderListFilter, page: number, signal?: AbortSignal): Promise<Page<AdminSubOrderRow>> =>
    toPage<AdminSubOrderRow>(
      await http.get(
        '/v1/admin/orders',
        {
          state: f.state || undefined,
          vendorAccountId: f.vendorAccountId || undefined,
          placedFromUtc: f.placedFromUtc || undefined,
          placedToUtc: f.placedToUtc || undefined,
          includeArchived: f.includeArchived || undefined,
          archivedOnly: f.archivedOnly || undefined,
          cursor: f.cursor || undefined,
          pageSize: f.pageSize,
        },
        signal,
      ),
      page,
      f.pageSize,
    ),
  byNumber: (orderNumber: string, signal?: AbortSignal) => http.get<OrderDetail>(`/v1/admin/orders/by-number/${encodeURIComponent(orderNumber.trim())}`, undefined, signal),
  archive: (body: OrderArchiveRequest) => http.post<OrderArchiveResult>('/v1/admin/orders/archive', body),
  unarchive: (body: OrderArchiveRequest) => http.post<OrderArchiveResult>('/v1/admin/orders/unarchive', body),
  careThemes: (windowDays: number, signal?: AbortSignal) => http.get<CareThemeReport>('/v1/admin/orders/care/themes', { windowDays }, signal),
};

export const paymentsApi = {
  refundContext: (orderId: string, signal?: AbortSignal) => request<RefundContext>(`/v1/admin/payments/orders/${encodeURIComponent(orderId)}/refund-context`, { signal }),
  refund: (paymentIntentId: string, body: RefundBody) => http.post<RefundResult>(`/v1/admin/payments/${encodeURIComponent(paymentIntentId)}/refund`, body),
};
