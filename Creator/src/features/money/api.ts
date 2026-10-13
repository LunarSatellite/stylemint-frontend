import { api } from '../../api/client';
import type { PagedResult } from '../../api/paging';
import type { Money } from '../../lib/format';

/**
 * Earnings & payouts. Payouts module (EarningsController, PayoutsController, PayoutDestinationsController),
 * SocialGraph TipsController, CreatorStudio CreatorBoostOffersController. Shapes copied from the backend
 * DTOs; every enum is an integer on the wire. Creator = PayeeKind 1.
 *
 * `/v1/creator/earnings/payout-methods` (Identity) is a separate registry that no payout reads — on-demand
 * and the weekly batch both use `/v1/payout-destinations`, so this app manages destinations only.
 */
export const CREATOR_ROLE = 1;

/** Payouts/Entity/Payout/Payout.cs constants — no endpoint exposes them. */
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

/** Month-to-date settled commission (UTC calendar month). */
export interface EarningsSummary {
  thisMonthSalesCount: number;
  thisMonthEarningsAmount: number;
  avgEarningsPerSaleAmount: number;
  thisMonthReelCount: number;
  highestReelEarningsAmount: number;
  currency: string;
}

export const LedgerEntryKind = { Commission: 1, VendorNet: 2, Reversal: 3, PayoutDebit: 4, FeeDebit: 5, BoostFeeDebit: 6 } as const;
export const ledgerKindLabel: Record<number, string> = {
  1: 'Commission',
  2: 'Sale proceeds',
  3: 'Reversal',
  4: 'Payout',
  5: 'Payout fee',
  6: 'Boost fee',
};
export const ledgerStateLabel: Record<number, string> = { 1: 'Pending', 2: 'Settled', 3: 'Reversed' };

export interface LedgerEntry {
  id: string;
  payeeKind: number;
  /** Signed; debits are negative. */
  amountValue: number;
  amountCurrency: string;
  kind: number;
  state: number;
  orderId: string | null;
  subOrderId: string | null;
  subOrderLineId: string | null;
  payoutId: string | null;
  reversesEntryId: string | null;
  occurredUtc: string;
  settledUtc: string | null;
  note: string | null;
}

export const PayoutState = { Requested: 1, Processing: 2, Paid: 3, Failed: 4, Held: 5 } as const;
export const payoutStateLabel: Record<number, string> = { 1: 'Requested', 2: 'Processing', 3: 'Paid', 4: 'Failed', 5: 'On hold' };
export const payoutStateColor: Record<number, string> = { 1: 'blue', 2: 'amber', 3: 'forest', 4: 'signal', 5: 'gray' };
export const payoutModeLabel: Record<number, string> = { 1: 'Weekly', 2: 'On request' };

/** Closed set — there is no Khalti or other bank on the backend. Banks need a branch; wallets must not send one. */
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
  /** NOT masked by the server — always pass through `maskAccount` before display. */
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

export interface TipHistoryItem {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  receiverId: string;
  receiverName: string;
  /** Gross tip (before the 3% platform fee). */
  amount: Money;
  reelId: string | null;
  createdAt: string;
}

export interface TipBalance {
  availableBalance: Money;
  totalReceived: Money;
  totalSent: Money;
  pendingBalance: Money;
}

export const BoostOfferState = { Pending: 1, Accepted: 2, Expired: 3 } as const;
export interface BoostOffer {
  id: string;
  reelId: string;
  state: number;
  issuedUtc: string;
  expiresUtc: string;
  acceptedUtc: string | null;
  serverNowUtc: string;
}

/** "****5678" — the server returns a payout's destination unmasked. */
export function maskAccount(ref: string | null | undefined): string {
  if (!ref) return '';
  const value = ref.trim();
  const at = value.indexOf('@');
  if (at > 1) return `${value[0]}${'*'.repeat(Math.min(6, at - 1))}${value.slice(at)}`;
  if (value.length <= 4) return '****';
  return `****${value.slice(-4)}`;
}

export const moneyApi = {
  balance: () => api.get<LedgerBalance>('/v1/earnings/balance', { role: CREATOR_ROLE }),
  summary: () => api.get<EarningsSummary>('/v1/earnings/summary'),
  entries: (cursor: string | null) =>
    api.get<PagedResult<LedgerEntry>>('/v1/earnings/entries', { role: CREATOR_ROLE, cursor: cursor ?? undefined, pageSize: 25 }),
  /** Not role-filtered server-side (an account can be creator and vendor): keep creator payouts only. */
  payouts: async (cursor: string | null) => {
    const page = await api.get<PagedResult<Payout>>('/v1/payouts', { cursor: cursor ?? undefined, pageSize: 25 });
    return { ...page, items: page.items.filter((p) => p.payeeKind === CREATOR_ROLE) };
  },
  requestPayout: (destinationId: string, requestedAmount: number) =>
    api.post<Payout>('/v1/payouts/on-demand', { role: CREATOR_ROLE, destinationId, requestedAmount }),
  cancelPayout: (id: string) => api.post<void>(`/v1/payouts/${id}/cancel`),
  destinations: () => api.get<PayoutDestination[]>('/v1/payout-destinations', { role: CREATOR_ROLE }),
  addDestination: (body: { kind: number; label: string; accountIdentifier: string; branchOrIfsc: string | null; makeDefault: boolean }) =>
    api.post<PayoutDestination>('/v1/payout-destinations', { role: CREATOR_ROLE, ...body }),
  makeDefault: (id: string) => api.post<PayoutDestination>(`/v1/payout-destinations/${id}/default`),
  removeDestination: (id: string) => api.del<void>(`/v1/payout-destinations/${id}`),
  tipBalance: () => api.get<TipBalance>('/v1/tips/balance', { currency: 'NPR' }),
  /** Tippers are buyers: names only, any contact detail is dropped and messages masked. */
  tipsReceived: (cursor: string | null) =>
    api.get<PagedResult<TipHistoryItem>>('/v1/tips/history', { type: 'received', cursor: cursor ?? undefined, pageSize: 20 }, { privacy: 'mask-text' }),
  boostOffer: (id: string) => api.get<BoostOffer>(`/v1/creator/boost-offers/${id}`),
  acceptBoostOffer: (id: string) => api.post<BoostOffer>(`/v1/creator/boost-offers/${id}/accept`),
};
