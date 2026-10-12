/** Payouts (queue: Payouts module; actions: Admin module). Amounts are decimal major units. */
import { http } from './client';
import { toPage, type Page } from './paging';

export const PAYOUT_STATE: Record<number, string> = { 1: 'Requested', 2: 'Processing', 3: 'Paid', 4: 'Failed', 5: 'Held' };
export const PAYOUT_TONE: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'forest', 4: 'signal', 5: 'violet' };
export const PAYEE_KIND: Record<number, string> = { 1: 'Creator', 2: 'Vendor' };
export const PAYOUT_MODE: Record<number, string> = { 1: 'Automatic weekly', 2: 'On demand' };
export const PAYOUT_DESTINATION: Record<number, string> = { 1: 'NIMB Bank', 2: 'Laxmi Bank', 3: 'PayPal', 4: 'eSewa' };

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

const enc = encodeURIComponent;

export const payoutsApi = {
  /** skip/take; `nextCursor` is always null here, so the page number drives skip. */
  queue: async (state: string | undefined, page: number, pageSize: number, signal?: AbortSignal): Promise<Page<Payout>> =>
    toPage<Payout>(await http.get('/v1/admin/payouts', { state: state || undefined, skip: (page - 1) * pageSize, take: pageSize }, signal), page, pageSize),
  hold: (id: string, reason: string) => http.post<void>(`/v1/admin/payouts/${enc(id)}/hold`, { reason }),
  release: (id: string, reason: string) => http.post<void>(`/v1/admin/payouts/${enc(id)}/release`, { reason }),
  /** SuperAdmin + step-up. */
  forcePaid: (id: string, reason: string) => http.post<void>(`/v1/admin/payouts/${enc(id)}/force-paid`, { reason }),
  /** SuperAdmin + step-up. */
  forceFailed: (id: string, reason: string) => http.post<void>(`/v1/admin/payouts/${enc(id)}/force-failed`, { reason }),
};
