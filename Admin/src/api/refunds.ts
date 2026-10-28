/**
 * The refunds desk (Admin module `v1/admin/refunds`, refunds-desk contract v1.0 §2). Lists refunds - by default the
 * ones the desk still has to pay by hand (eSewa has no refund API; cash on delivery is paid to the buyer directly) -
 * and records a manual refund with its reference ("mark refunded"). PayoutsOps + SuperAdmin.
 *
 * Every route answers a bare 404 until the backend branch `feat/refunds-desk` is deployed.
 *
 * Wire: `state` and `reason` are strings; `method` is the PaymentMethod number with a `methodName`. Amounts are Money
 * `{ amount, currency }` in the DTO; the summary's amounts are read the same way, and a bare number is accepted too.
 */
import { request, http } from './client';
import { PAYMENT_METHOD } from './orders';
import { toPage, type Page } from './paging';

export const REFUND_VIEWS = ['ToSettle', 'Completed', 'All'] as const;
export type RefundView = (typeof REFUND_VIEWS)[number];
export const REFUND_VIEW_LABEL: Record<RefundView, string> = { ToSettle: 'To settle', Completed: 'Completed', All: 'All' };

/** PaymentMethod (Shared.Infrastructure Core/Payments). */
export const METHOD_ESEWA = 3;
export const METHOD_COD = 4;

export const REFUND_REASON: Record<string, string> = {
  OrderCancelled: 'Order cancelled',
  ReturnCompleted: 'Return',
  AdminRefund: 'Admin refund',
  EmiReversal: 'EMI reversal',
  CheckoutPaidNotOrderable: 'Paid, order not placed',
  Other: 'Other',
};

export const REFUND_STATE: Record<string, string> = { Pending: 'Pending', Failed: 'Failed', Completed: 'Refunded' };
export const REFUND_STATE_TONE: Record<string, string> = { Pending: 'amber', Failed: 'signal', Completed: 'forest' };

export const refundMethodLabel = (method: number, methodName?: string | null) => PAYMENT_METHOD[method] ?? methodName ?? String(method);
export const refundReasonLabel = (reason: string | null | undefined) => (reason ? (REFUND_REASON[reason] ?? reason) : REFUND_REASON.Other!);
export const refundStateLabel = (state: string | number) => REFUND_STATE[String(state)] ?? String(state);

export interface Money {
  amount: number;
  currency: string;
}

/** Money as the DTO sends it, or a bare number (NPR). */
export function moneyOf(value: Money | number | null | undefined, currency = 'NPR'): Money {
  if (typeof value === 'number') return { amount: value, currency };
  if (value && typeof value === 'object') return { amount: Number(value.amount) || 0, currency: value.currency || currency };
  return { amount: 0, currency };
}

export interface AdminRefund {
  refundId: string;
  paymentIntentId: string;
  orderNumber: string | null;
  subOrderNumber: string | null;
  reason: string;
  reasonCode: string | null;
  method: number;
  methodName: string;
  amount: Money | number;
  state: string;
  /** Manual and Pending, or Failed and still owed: the desk has to pay it. */
  needsAction: boolean;
  failureMessage: string | null;
  requestedUtc: string;
  completedUtc: string | null;
  /** The eSewa ref_id / transaction_uuid of the ORIGINAL payment. */
  providerReference: string | null;
  providerRefundId: string | null;
  settledBy: { adminId: string; displayName: string | null } | null;
  settledNote: string | null;
  /** `phone` is the full number (admin only): cash on delivery refunds are sent to it. */
  buyer: { accountId: string; displayName: string | null; phone: string | null } | null;
}

export interface AdminRefundDetail extends AdminRefund {
  /** Every attempt for the same payment intent. */
  history?: AdminRefund[] | null;
}

export interface CountAmount {
  count: number;
  amount: Money | number;
}

export interface RefundsSummary {
  toSettle: CountAmount;
  settledThisMonth: CountAmount;
  /** To settle only. */
  byMethod: { method: number; methodName: string; count: number; amount: Money | number }[];
}

export interface RefundsFilter {
  view: RefundView;
  method?: string;
  fromUtc?: string;
  toUtc?: string;
  search?: string;
  cursor?: string | null;
  /** The page number the cursor stands for (for the pager's "1–25"). */
  page?: number;
  pageSize: number;
}

export interface MarkRefundedBody {
  reference: string;
  note: string | null;
}

export const REFERENCE_MAX = 100;
export const NOTE_MAX = 500;

/** The desk's error codes (contract §2). */
export const REFUND_ALREADY_SETTLED = 'REFUND_ALREADY_SETTLED';
export const REFUND_NOT_MANUAL = 'REFUND_NOT_MANUAL';

const enc = encodeURIComponent;

export const refundsApi = {
  /** `GET /v1/admin/refunds` - cursor paged `PagedResult<AdminRefundDto>`. */
  list: async (f: RefundsFilter, signal?: AbortSignal): Promise<Page<AdminRefund>> =>
    toPage<AdminRefund>(
      await http.get(
        '/v1/admin/refunds',
        {
          view: f.view,
          method: f.method || undefined,
          fromUtc: f.fromUtc || undefined,
          toUtc: f.toUtc || undefined,
          search: f.search?.trim() || undefined,
          cursor: f.cursor || undefined,
          pageSize: f.pageSize,
        },
        signal,
      ),
      f.page ?? 1,
      f.pageSize,
    ),
  /** `GET /v1/admin/refunds/summary` - to settle, settled this month, to settle by method. */
  summary: (signal?: AbortSignal) => http.get<RefundsSummary>('/v1/admin/refunds/summary', undefined, signal),
  /** `GET /v1/admin/refunds/{id}` - the refund plus every attempt for the same payment. */
  get: (refundId: string, signal?: AbortSignal) => http.get<AdminRefundDetail>(`/v1/admin/refunds/${enc(refundId)}`, undefined, signal),
  /**
   * `POST /v1/admin/refunds/{id}/mark-refunded` → 200 AdminRefundDto (Completed). The key is the caller's, so a retry
   * of the same submission is one write. 409 REFUND_ALREADY_SETTLED, 422 REFUND_NOT_MANUAL.
   */
  markRefunded: (refundId: string, body: MarkRefundedBody, idempotencyKey?: string) =>
    request<AdminRefund>(`/v1/admin/refunds/${enc(refundId)}/mark-refunded`, { method: 'POST', body, idempotencyKey }),
};
