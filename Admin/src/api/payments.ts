/**
 * Every payment buyers made (Admin module `v1/admin/payments`, admin-payments contract v1.0 §1): the list and the
 * date-range summary. Read-only. Money is decimal MAJOR units with a separate currency ("NPR"). Enums come as a number
 * AND a `…Name` string; the labels here win, the server name is the fallback for a value this console does not know
 * yet (e.g. connectIPS).
 *
 * Both answer a bare 404 until the backend branch `feat/admin-payments` is deployed.
 *
 * Not to be confused with `paymentsApi` in ./orders (refund context + refund for one order).
 */
import { http } from './client';
import { PAYMENT_METHOD } from './orders';
import { toPage, type Page } from './paging';

/** PaymentIntentState (StyleMint.Modules.Payments/Enums/PaymentIntentState.cs). */
export const PAYMENT_STATE: Record<number, string> = { 1: 'Initiated', 2: 'Authorized', 3: 'Captured', 4: 'Failed', 5: 'Cancelled', 6: 'Refunded' };
export const PAYMENT_STATE_TONE: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'forest', 4: 'signal', 5: 'gray', 6: 'violet' };
export const PAYMENT_CAPTURED = 3;
export const PAYMENT_METHOD_ESEWA = 3;

/** What a payment paid for (contract §1 `purpose`). */
export const PAYMENT_PURPOSE: Record<string, string> = {
  Order: 'Order',
  EmiDownPayment: 'EMI down payment',
  EmiInstalment: 'EMI instalment',
  EmiPayoff: 'EMI payoff',
  Booking: 'Service booking',
  TryOn: 'Virtual try-on',
  Other: 'Other',
};

export const methodLabel = (method: number, methodName?: string | null) => PAYMENT_METHOD[method] ?? methodName ?? String(method);
export const stateLabel = (state: number, stateName?: string | null) => PAYMENT_STATE[state] ?? stateName ?? String(state);
export const purposeLabel = (purpose: string | null | undefined) => (purpose ? (PAYMENT_PURPOSE[purpose] ?? purpose) : PAYMENT_PURPOSE.Other!);

export interface AdminPaymentRow {
  /** Payment intent id. */
  id: string;
  createdUtc: string;
  capturedUtc: string | null;
  method: number;
  methodName: string;
  state: number;
  stateName: string;
  amount: number;
  currency: string;
  purpose: string;
  orderId: string | null;
  orderNumber: string | null;
  /** EMI plan, when purpose is Emi*. */
  agreementId: string | null;
  buyerAccountId: string;
  buyerName: string | null;
  /** Provider intent / capture id (eSewa transaction uuid / ref). */
  providerReference: string | null;
  failureMessage: string | null;
}

export interface PaymentsFilter {
  state?: string;
  method?: string;
  purpose?: string;
  fromUtc?: string;
  toUtc?: string;
  q?: string;
  page: number;
  pageSize: number;
}

export interface AmountCount {
  amount: number;
  count: number;
}

export interface PaymentsSummary {
  fromUtc: string;
  toUtc: string;
  currency: string;
  /** Captured intents in range, by capturedUtc. Cash on delivery counts only once captured. */
  received: AmountCount;
  pending: AmountCount;
  failed: { count: number };
  refunded?: AmountCount | null;
  byMethod: { method: number; methodName: string; amount: number; count: number }[];
}

const num = (v: string | undefined) => (v ? Number(v) : undefined);

export const paymentsListApi = {
  /** `GET /v1/admin/payments` - page-numbered (1-based), newest first. Envelope `{ items, page, pageSize, totalCount }`. */
  list: async (f: PaymentsFilter, signal?: AbortSignal): Promise<Page<AdminPaymentRow>> => {
    const pageSize = Math.min(100, Math.max(1, f.pageSize));
    return toPage<AdminPaymentRow>(
      await http.get(
        '/v1/admin/payments',
        {
          state: num(f.state),
          method: num(f.method),
          purpose: f.purpose || undefined,
          fromUtc: f.fromUtc || undefined,
          toUtc: f.toUtc || undefined,
          q: f.q?.trim() || undefined,
          page: f.page,
          pageSize,
        },
        signal,
      ),
      f.page,
      pageSize,
    );
  },
  /** `GET /v1/admin/payments/summary` - totals for the date range. */
  summary: (fromUtc: string, toUtc: string, signal?: AbortSignal) => http.get<PaymentsSummary>('/v1/admin/payments/summary', { fromUtc, toUtc }, signal),
};

// ── CSV ─────────────────────────────────────────────────────────────────────

export const PAYMENT_CSV_COLUMNS = [
  'Created (UTC)',
  'Captured (UTC)',
  'Amount',
  'Currency',
  'Method',
  'Status',
  'Purpose',
  'Order number',
  'Order id',
  'EMI plan id',
  'Provider reference',
  'Buyer account id',
  'Buyer name',
  'Payment id',
  'Failure message',
] as const;

function cell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  let s = String(value);
  // A spreadsheet runs a cell that starts with = + - @ as a formula; numbers are left alone.
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The rows as CSV (header first, CRLF line ends, RFC 4180 quoting). */
export function paymentsCsv(rows: AdminPaymentRow[]): string {
  const lines = [PAYMENT_CSV_COLUMNS.map(cell).join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.createdUtc,
        r.capturedUtc,
        r.amount,
        r.currency,
        methodLabel(r.method, r.methodName),
        stateLabel(r.state, r.stateName),
        purposeLabel(r.purpose),
        r.orderNumber,
        r.orderId,
        r.agreementId,
        r.providerReference,
        r.buyerAccountId,
        r.buyerName,
        r.id,
        r.failureMessage,
      ]
        .map(cell)
        .join(','),
    );
  }
  return lines.join('\r\n');
}
