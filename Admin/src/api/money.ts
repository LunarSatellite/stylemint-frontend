/**
 * Payouts (queue: Payouts module; actions: Admin module). Amounts are decimal major units.
 *
 * Riders (couriers) are paid through the same ledger and engine as creators and vendors, as a third payee role
 * (`PayeeKind.Courier = 3`, rider-payout contract v1). The courier balance / earnings / ledger reads and the cash
 * and fare actions are under `/v1/admin/payouts/couriers` and `/v1/admin/payouts/courier-earnings`; they answer a bare
 * 404 until that backend is deployed.
 */
import { http } from './client';
import type { FareLines, RiderFareBreakdown } from './fare';
import { toPage, type Page } from './paging';

export const PAYOUT_STATE: Record<number, string> = { 1: 'Requested', 2: 'Processing', 3: 'Paid', 4: 'Failed', 5: 'Held', 6: 'Awaiting transfer' };
export const PAYOUT_TONE: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'forest', 4: 'signal', 5: 'violet', 6: 'blue' };
export const PAYEE_KIND: Record<number, string> = { 1: 'Creator', 2: 'Vendor', 3: 'Courier' };
export const PAYOUT_MODE: Record<number, string> = { 1: 'Automatic weekly', 2: 'On demand' };
export const PAYOUT_DESTINATION: Record<number, string> = { 1: 'NIMB Bank', 2: 'Laxmi Bank', 3: 'PayPal', 4: 'eSewa' };
/** `AwaitingManualTransfer` - the finance desk sends the money by hand and records the reference. */
export const AWAITING_TRANSFER = 6;
export const COURIER_ROLE = 3;

export interface Payout {
  id: string;
  payeeProfileId: string;
  payeeKind: number;
  mode: number;
  destination: number;
  destinationRef: string;
  requestedAmountValue: number;
  requestedAmountCurrency: string;
  feeAmountValue: number;
  feeAmountCurrency: string;
  netAmountValue: number;
  netAmountCurrency: string;
  requestedUtc: string;
  pendingUntilUtc: string;
  state: number;
  providerPayoutId: string | null;
  failureCode: string | null;
  failureMessage: string | null;
  paidUtc: string | null;
}

/** `GET /v1/admin/payouts/{id}/transfer-detail` - the only response with the full account number (audited, step-up). */
export interface PayoutTransferDetail {
  payoutId: string;
  payeeAccountId: string;
  payeeKind: number;
  state: number;
  mode: number;
  destination: number;
  destinationId: string | null;
  destinationLabel: string | null;
  accountIdentifier: string;
  branchOrIfsc: string | null;
  destinationVerified: boolean | null;
  netAmount: number;
  requestedAmount: number;
  feeAmount: number;
  currency: string;
  requestedUtc: string;
  pendingUntilUtc: string;
}

// ── Couriers (rider-payout contract v1 §2, §4) ─────────────────────────────

export const EARNING_STATUS: Record<number, string> = { 1: 'Pending', 2: 'On hold', 3: 'Available', 4: 'Reversed' };
export const EARNING_TONE: Record<number, string> = { 1: 'gray', 2: 'amber', 3: 'forest', 4: 'signal' };
export const LEDGER_KIND: Record<number, string> = {
  1: 'Commission',
  2: 'Vendor net',
  3: 'Reversal',
  4: 'Payout',
  5: 'Fee',
  6: 'Boost fee',
  7: 'Retainer fee',
  8: 'Affiliate commission',
  9: 'Tip',
  10: 'Delivery fare',
  11: 'Cash collected',
  12: 'Cash handed in',
  13: 'Cash netted',
  14: 'Cash offset',
};
export const LEDGER_STATE: Record<number, string> = { 1: 'Pending', 2: 'Settled', 3: 'Reversed' };

export interface CourierBalance {
  pendingEarnings: number;
  onHoldEarnings: number;
  availableEarnings: number;
  cashToRemit: number;
  /** availableEarnings - cashToRemit: what a payout pays. Negative = the rider owes the platform. */
  netPayable: number;
  lifetimeEarnings: number;
  currency: string;
  settleAfterHours: number | null;
  onDemandMinAmount: number | null;
  onDemandMaxAmount: number | null;
  onDemandFeePercent: number | null;
  hasDefaultDestination: boolean;
  inFlightPayout: Payout | null;
}

export interface AdminCourierBalanceRow {
  accountId: string;
  availableEarnings: number;
  pendingEarnings: number;
  cashToRemit: number;
  netPayable: number;
  currency: string;
}

export interface CourierEarningRow {
  entryId: string;
  hopId: string;
  packageId: string | null;
  subOrderId: string | null;
  trackingNumber: string | null;
  amount: number;
  currency: string;
  status: number;
  holdReason: string | null;
  completedUtc: string | null;
  settleAfterUtc: string | null;
  settledUtc: string | null;
  reversedUtc: string | null;
  cashCollected: number | null;
  /** The ledger's `{ lines }`, or (once the road fare ships) possibly the full rider fare breakdown. */
  fareBreakdown: FareLines | RiderFareBreakdown | null;
}

export interface LedgerEntry {
  id: string;
  payeeProfileId: string;
  payeeKind: number;
  amountValue: number;
  amountCurrency: string;
  kind: number;
  state: number;
  payoutId: string | null;
  reversesEntryId: string | null;
  occurredUtc: string;
  settledUtc: string | null;
  note: string | null;
  settleAfterUtc: string | null;
  deliveryHopId: string | null;
  deliveryPackageId: string | null;
  deliverySubOrderId: string | null;
  trackingNumber: string | null;
  externalReference: string | null;
  holdReason: string | null;
}

const enc = encodeURIComponent;

export const payoutsApi = {
  /** skip/take; `nextCursor` is always null here, so the page number drives skip. `role` = PayeeKind (3 = couriers). */
  queue: async (state: string | undefined, page: number, pageSize: number, signal?: AbortSignal, role?: string): Promise<Page<Payout>> =>
    toPage<Payout>(await http.get('/v1/admin/payouts', { state: state || undefined, role: role || undefined, skip: (page - 1) * pageSize, take: pageSize }, signal), page, pageSize),
  /** The finance desk's work list (state 6), newest first. */
  awaitingTransfer: async (role: string | undefined, page: number, pageSize: number, signal?: AbortSignal): Promise<Page<Payout>> =>
    toPage<Payout>(await http.get('/v1/admin/payouts/awaiting-transfer', { role: role || undefined, skip: (page - 1) * pageSize, take: pageSize }, signal), page, pageSize),
  hold: (id: string, reason: string) => http.post<void>(`/v1/admin/payouts/${enc(id)}/hold`, { reason }),
  release: (id: string, reason: string) => http.post<void>(`/v1/admin/payouts/${enc(id)}/release`, { reason }),
  /** SuperAdmin + step-up. */
  forcePaid: (id: string, reason: string) => http.post<void>(`/v1/admin/payouts/${enc(id)}/force-paid`, { reason }),
  /** SuperAdmin + step-up. */
  forceFailed: (id: string, reason: string) => http.post<void>(`/v1/admin/payouts/${enc(id)}/force-failed`, { reason }),
  /** PayoutsOps/SuperAdmin + step-up; audited. The full account number - never cached. */
  transferDetail: (id: string) => http.get<PayoutTransferDetail>(`/v1/admin/payouts/${enc(id)}/transfer-detail`),
  /** AwaitingManualTransfer -> Paid. PayoutsOps/SuperAdmin + step-up. Both fields required. */
  markPaid: (id: string, transferReference: string, note: string) => http.post<void>(`/v1/admin/payouts/${enc(id)}/mark-paid`, { transferReference, note }),
  /** AwaitingManualTransfer -> Failed; the money goes back to the payee's balance. PayoutsOps/SuperAdmin. */
  markFailed: (id: string, reason: string) => http.post<void>(`/v1/admin/payouts/${enc(id)}/mark-failed`, { reason }),
};

const COURIERS = '/v1/admin/payouts/couriers';

export const courierPayoutsApi = {
  /** Couriers with any non-zero figure, largest cash to remit first. skip/take. */
  balances: async (owesCash: boolean, page: number, pageSize: number, signal?: AbortSignal): Promise<Page<AdminCourierBalanceRow>> =>
    toPage<AdminCourierBalanceRow>(await http.get(COURIERS, { owesCash: owesCash || undefined, skip: (page - 1) * pageSize, take: pageSize }, signal), page, pageSize),
  balance: (accountId: string, signal?: AbortSignal) => http.get<CourierBalance>(`${COURIERS}/${enc(accountId)}/balance`, undefined, signal),
  earnings: async (accountId: string, signal?: AbortSignal): Promise<Page<CourierEarningRow>> =>
    toPage<CourierEarningRow>(await http.get(`${COURIERS}/${enc(accountId)}/earnings`, { pageSize: 50 }, signal), 1, 50),
  ledger: async (accountId: string, signal?: AbortSignal): Promise<Page<LedgerEntry>> =>
    toPage<LedgerEntry>(await http.get(`${COURIERS}/${enc(accountId)}/ledger`, { pageSize: 50 }, signal), 1, 50),
  payouts: async (accountId: string, signal?: AbortSignal): Promise<Page<Payout>> =>
    toPage<Payout>(await http.get(`${COURIERS}/${enc(accountId)}/payouts`, { pageSize: 50 }, signal), 1, 50),
  /** Ops recorded the rider handing cash in. PayoutsOps/SuperAdmin. */
  recordCashRemittance: (accountId: string, body: { amount: number; reference: string; note: string | null }) =>
    http.post<CourierBalance>(`${COURIERS}/${enc(accountId)}/cash-remittances`, body),
  /** Settle a Pending / On-hold fare now. */
  releaseEarning: (hopId: string, note: string) => http.post<CourierEarningRow>(`/v1/admin/payouts/courier-earnings/${enc(hopId)}/release`, { note }),
  /** Reverse a fare (a settled one is taken back by a Reversal row). */
  voidEarning: (hopId: string, reason: string) => http.post<CourierEarningRow>(`/v1/admin/payouts/courier-earnings/${enc(hopId)}/void`, { reason }),
};
