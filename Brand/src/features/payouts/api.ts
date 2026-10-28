import { api } from '../../api/client';
import type { PagedResult } from '../../api/paging';

/** Payouts module (EarningsController, PayoutsController, PayoutDestinationsController). Vendor = role 2. */
export const VENDOR_ROLE = 2;

/** Rules from Payouts/Entity/Payout/Payout.cs — no endpoint exposes them. */
export const PAYOUT_MIN = 10_000;
export const PAYOUT_MAX = 70_000;
export const PAYOUT_FEE_RATE = 0.02;
export const PAYOUT_HOLD_DAYS = 3;
export const payoutFee = (amount: number) => Math.ceil(amount * PAYOUT_FEE_RATE * 100) / 100;

export interface LedgerBalance {
  availableValue: number;
  pendingValue: number;
  lifetimeValue: number;
  currency: string;
}

export const LedgerEntryKind = { Commission: 1, VendorNet: 2, Reversal: 3, PayoutDebit: 4, FeeDebit: 5, BoostFeeDebit: 6 } as const;
export const ledgerKindLabel: Record<number, string> = {
  1: 'Commission',
  2: 'Sale',
  3: 'Reversal',
  4: 'Payout',
  5: 'Fee',
  6: 'Boost fee',
};
export const ledgerStateLabel: Record<number, string> = { 1: 'Pending', 2: 'Settled', 3: 'Reversed' };

export interface LedgerEntry {
  id: string;
  payeeKind: number;
  amountValue: number;
  amountCurrency: string;
  kind: number;
  state: number;
  orderId: string | null;
  subOrderId: string | null;
  payoutId: string | null;
  occurredUtc: string;
  settledUtc: string | null;
  note: string | null;
  /**
   * On a sale (VendorNet) row: StyleMint's platform commission already taken out of `amountValue`, and its rate
   * (platform-commission contract v1.0). Absent on an older backend, and on rows without one.
   */
  platformCommissionAmount?: number | null;
  platformCommissionRatePercent?: number | null;
}

/** "StyleMint commission (10%) deducted: Rs 250.00", or null when the row carries none. */
export function platformCommissionText(e: Pick<LedgerEntry, 'platformCommissionAmount' | 'platformCommissionRatePercent' | 'amountCurrency'>, format: (amount: number, currency: string) => string): string | null {
  const c = e.platformCommissionAmount;
  if (typeof c !== 'number' || !Number.isFinite(c) || c === 0) return null;
  const r = e.platformCommissionRatePercent;
  const rate = typeof r === 'number' && Number.isFinite(r) ? ` (${Number(r.toFixed(2))}%)` : '';
  return `StyleMint commission${rate} deducted: ${format(Math.abs(c), e.amountCurrency)}`;
}

export const PayoutState = { Requested: 1, Processing: 2, Paid: 3, Failed: 4, Held: 5 } as const;
export const payoutStateLabel: Record<number, string> = { 1: 'Requested', 2: 'Processing', 3: 'Paid', 4: 'Failed', 5: 'On hold' };
export const payoutStateColor: Record<number, string> = { 1: 'blue', 2: 'amber', 3: 'forest', 4: 'signal', 5: 'gray' };

export const DestinationKind = { NimbBank: 1, LaxmiBank: 2, PayPal: 3, Esewa: 4 } as const;
export const destinationKindLabel: Record<number, string> = {
  1: 'Nepal Investment Mega Bank',
  2: 'Laxmi Sunrise Bank',
  3: 'PayPal',
  4: 'eSewa',
};
export const isBankKind = (kind: number) => kind === 1 || kind === 2;

export interface Payout {
  id: string;
  payeeKind: number;
  mode: number;
  destination: number;
  destinationRef: string;
  requestedAmountValue: number;
  requestedAmountCurrency: string;
  feeAmountValue: number;
  netAmountValue: number;
  netAmountCurrency: string;
  requestedUtc: string;
  pendingUntilUtc: string;
  state: number;
  failureMessage: string | null;
  paidUtc: string | null;
}

export interface PayoutDestination {
  id: string;
  kind: number;
  label: string;
  accountIdentifierMasked: string;
  branchOrIfsc: string | null;
  isDefault: boolean;
  verified: boolean;
  createdUtc: string;
}

export const payoutsApi = {
  balance: () => api.get<LedgerBalance>('/v1/earnings/balance', { role: VENDOR_ROLE }),
  entries: (cursor: string | null) =>
    api.get<PagedResult<LedgerEntry>>('/v1/earnings/entries', { role: VENDOR_ROLE, cursor: cursor ?? undefined, pageSize: 25 }),
  /** Not role-filtered server-side; filtered to vendor payouts here. */
  payouts: async (cursor: string | null) => {
    const page = await api.get<PagedResult<Payout>>('/v1/payouts', { cursor: cursor ?? undefined, pageSize: 25 });
    return { ...page, items: page.items.filter((p) => p.payeeKind === VENDOR_ROLE) };
  },
  requestPayout: (destinationId: string, requestedAmount: number) =>
    api.post<Payout>('/v1/payouts/on-demand', { role: VENDOR_ROLE, destinationId, requestedAmount }),
  cancelPayout: (id: string) => api.post<void>(`/v1/payouts/${id}/cancel`),
  destinations: () => api.get<PayoutDestination[]>('/v1/payout-destinations', { role: VENDOR_ROLE }),
  addDestination: (body: { kind: number; label: string; accountIdentifier: string; branchOrIfsc: string | null; makeDefault: boolean }) =>
    api.post<PayoutDestination>('/v1/payout-destinations', { role: VENDOR_ROLE, ...body }),
  makeDefault: (id: string) => api.post<PayoutDestination>(`/v1/payout-destinations/${id}/default`),
  removeDestination: (id: string) => api.del<void>(`/v1/payout-destinations/${id}`),
};
