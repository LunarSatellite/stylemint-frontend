/**
 * Service vendors: hotels, travel agencies, banks.
 * - Category + licence on vendor applications: D:\Stylemint\wt\service-banks-contract.md v1 §1.
 * - Bookings overview, admin cancel / refund retry, commission settings: D:\Stylemint\wt\service-bookings-contract.md
 *   v1 §4 "Admin" (`AdminSubjectPolicy`: reads SuperAdmin/PayoutsOps/SupportAgent/Readonly, writes SuperAdmin/PayoutsOps).
 * Numeric enums. Every route answers a bare 404 until the combined deploy (`isMissingEndpoint`).
 */
import { http } from './client';
import { toPage, type Page } from './paging';

export const SERVICE_CATEGORY: Record<number, string> = { 0: 'Product seller', 1: 'Hotel', 2: 'Travel agency', 3: 'Bank' };
export const SERVICE_CATEGORY_BANK = 3;

export const LISTING_KIND: Record<number, string> = { 1: 'Stay', 2: 'Travel package' };
export const BOOKING_STATE: Record<number, string> = {
  1: 'Awaiting payment',
  2: 'Confirmed',
  3: 'Checked in / in progress',
  4: 'Completed',
  5: 'Cancelled',
  6: 'No-show',
  7: 'Expired',
};
export const BOOKING_STATE_TONE: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'grape', 4: 'forest', 5: 'gray', 6: 'signal', 7: 'gray' };
export const PAYMENT_MODE: Record<number, string> = { 1: 'Full prepay', 2: 'Deposit + rest at venue', 3: 'Pay at venue' };
export const CANCELLED_BY: Record<number, string> = { 1: 'Guest', 2: 'Vendor', 3: 'Admin', 4: 'System' };
export const REFUND_STATE: Record<number, string> = { 0: 'None', 1: 'Pending', 2: 'Completed', 3: 'Failed' };
export const REFUND_FAILED = 3;

export interface BookingLine {
  label: string;
  date: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface AdminBooking {
  id: string;
  number: string;
  kind: number;
  state: number;
  listingId: string;
  listingTitle: string;
  roomTypeName: string | null;
  departureId: string | null;
  vendor: { vendorAccountId: string; name: string; logoUrl: string | null } | null;
  startDate: string;
  endDate: string;
  nights: number | null;
  rooms: number | null;
  adults: number;
  children: number;
  guestName: string;
  travellers: { fullName: string; type: number; age: number | null }[];
  specialRequests: string | null;
  currency: string;
  lines: BookingLine[];
  totalPrice: number;
  paymentMode: number;
  depositPercent: number;
  paidOnline: number;
  balanceDue: number;
  balanceReceivedAmount: number | null;
  cancellationPolicy: { summary: string | null } | null;
  cancelledBy: number | null;
  cancelReason: string | null;
  cancellationFee: number | null;
  refundAmount: number | null;
  refundState: number;
  commissionPercent: number | null;
  commissionAmount: number | null;
  vendorNetAmount: number | null;
  settledUtc: string | null;
  buyerAccountId: string | null;
  createdUtc: string;
  confirmedUtc: string | null;
  completedUtc: string | null;
  cancelledUtc: string | null;
}

export interface CommissionSettings {
  defaultPercent: number;
  categories: { category: number; percent: number; isDefault: boolean }[];
  vendors: { vendorAccountId: string; vendorName: string | null; percent: number; note: string | null; updatedUtc: string }[];
}

export interface BookingQuery {
  q?: string;
  state?: string;
  kind?: string;
  vendorAccountId?: string;
  from?: string;
  to?: string;
  cursor: string | null;
  pageSize: number;
  page: number;
}

const enc = encodeURIComponent;

export const bookingsAdminApi = {
  list: async (f: BookingQuery, signal?: AbortSignal): Promise<Page<AdminBooking>> =>
    toPage<AdminBooking>(
      await http.get(
        '/v1/admin/bookings',
        {
          q: f.q || undefined,
          state: f.state || undefined,
          kind: f.kind || undefined,
          vendorAccountId: f.vendorAccountId || undefined,
          from: f.from || undefined,
          to: f.to || undefined,
          cursor: f.cursor || undefined,
          pageSize: Math.min(50, f.pageSize),
        },
        signal,
      ),
      f.page,
      f.pageSize,
    ),
  get: (id: string, signal?: AbortSignal) => http.get<AdminBooking>(`/v1/admin/bookings/${enc(id)}`, undefined, signal),
  cancel: (id: string, reason: string, waiveFee: boolean) => http.post<AdminBooking>(`/v1/admin/bookings/${enc(id)}/cancel`, { reason, waiveFee }),
  retryRefund: (id: string) => http.post<AdminBooking>(`/v1/admin/bookings/${enc(id)}/refund/retry`),

  commission: (signal?: AbortSignal) => http.get<CommissionSettings>('/v1/admin/bookings/commission', undefined, signal),
  setCategory: (category: number, percent: number) => http.put<CommissionSettings>(`/v1/admin/bookings/commission/categories/${category}`, { percent }),
  resetCategory: (category: number) => http.del<CommissionSettings>(`/v1/admin/bookings/commission/categories/${category}`),
  setVendor: (vendorAccountId: string, percent: number, note: string | null) =>
    http.put<CommissionSettings>(`/v1/admin/bookings/commission/vendors/${enc(vendorAccountId)}`, { percent, note }),
  removeVendor: (vendorAccountId: string) => http.del<CommissionSettings>(`/v1/admin/bookings/commission/vendors/${enc(vendorAccountId)}`),
};

/** Commission percent rules (0–50, `commission.invalid` otherwise). */
export function validPercent(raw: string): number | null {
  const n = Number(raw);
  if (raw.trim() === '' || !Number.isFinite(n) || n < 0 || n > 50) return null;
  return Math.round(n * 100) / 100;
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isGuid = (s: string) => GUID.test(s.trim());
