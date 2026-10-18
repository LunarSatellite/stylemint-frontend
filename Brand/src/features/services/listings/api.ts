import { api } from '../../../api/client';
import type { PagedResult } from '../../../api/paging';
import { redactPii } from '../../crm/redact';

/**
 * Hotel stays + travel packages, vendor side — D:\Stylemint\wt\service-bookings-contract.md v1.
 * Numeric enums, camelCase, Kathmandu calendar dates ("2026-10-21") and times ("14:00").
 * Every route 404s with no errorCode until the combined deploy ("being set up"). Another vendor's listing or
 * booking is a 404 WITH an errorCode.
 *
 * PII: the vendor sees guest / traveller names and special requests only — never the buyer's phone, email or
 * account. Every booking response goes through `redactPii` as a second line of defence, and `buyerAccountId`
 * is dropped.
 */

export const ListingKind = { Stay: 1, Package: 2 } as const;
export const ListingStatus = { Draft: 1, Published: 2, Paused: 3, Archived: 4 } as const;
export const listingStatusLabel: Record<number, { label: string; color: string }> = {
  1: { label: 'Draft', color: 'gray' },
  2: { label: 'Published', color: 'forest' },
  3: { label: 'Paused', color: 'amber' },
  4: { label: 'Archived', color: 'slate' },
};

export const RoomTypeStatus = { Active: 1, Archived: 2 } as const;
export const DepartureStatus = { Open: 1, Closed: 2, Cancelled: 3 } as const;
export const departureStatusLabel: Record<number, { label: string; color: string }> = {
  1: { label: 'Open', color: 'forest' },
  2: { label: 'Closed', color: 'amber' },
  3: { label: 'Cancelled', color: 'gray' },
};

export const PaymentMode = { FullPrepay: 1, Deposit: 2, PayAtVenue: 3 } as const;
export const paymentModeLabel: Record<number, string> = {
  1: 'Full payment online',
  2: 'Deposit online, rest at the venue',
  3: 'Pay at the venue',
};
export const PAYMENT_MODES = [1, 2, 3] as const;

export const BookingState = { PendingPayment: 1, Confirmed: 2, CheckedIn: 3, Completed: 4, Cancelled: 5, NoShow: 6, Expired: 7 } as const;
export const bookingStateLabel: Record<number, { label: string; color: string }> = {
  1: { label: 'Awaiting payment', color: 'amber' },
  2: { label: 'Confirmed', color: 'blue' },
  3: { label: 'In progress', color: 'grape' },
  4: { label: 'Completed', color: 'forest' },
  5: { label: 'Cancelled', color: 'gray' },
  6: { label: 'No-show', color: 'signal' },
  7: { label: 'Expired', color: 'gray' },
};
/** For stays the in-progress state reads "Checked in". */
export const stateLabelFor = (state: number, kind: number) =>
  state === BookingState.CheckedIn && kind === ListingKind.Stay ? { label: 'Checked in', color: 'grape' } : bookingStateLabel[state] ?? { label: 'Unknown', color: 'gray' };

export const cancelledByLabel: Record<number, string> = { 1: 'the guest', 2: 'you', 3: 'StyleMint', 4: 'StyleMint (automatic)' };
export const refundStateLabel: Record<number, string> = { 0: 'No refund', 1: 'Refund pending', 2: 'Refunded', 3: 'Refund failed — StyleMint is retrying' };
export const TravellerType = { Adult: 1, Child: 2 } as const;

export interface VendorSummary {
  vendorAccountId: string;
  name: string;
  logoUrl: string | null;
}

export interface CancellationPolicy {
  freeCancellationDays: number;
  lateCancellationFeePercent: number;
  freeUntilDate?: string | null;
  summary: string | null;
}

export interface ItineraryDay {
  day: number;
  title: string;
  description: string | null;
}

export interface RoomTypeVendor {
  roomTypeId: string;
  name: string;
  description: string | null;
  maxAdults: number;
  maxGuests: number;
  beds: string | null;
  sizeSqm: number | null;
  photoUrls: string[];
  amenities: string[];
  baseRate: number;
  totalUnits: number;
  status: number;
}

export interface RoomTypeWrite {
  name: string;
  description: string | null;
  maxAdults: number;
  maxGuests: number;
  beds: string | null;
  sizeSqm: number | null;
  photoUrls: string[];
  amenities: string[];
  totalUnits: number;
  baseRate: number;
}

/** Management shape for both kinds; kind-specific fields are null on the other kind. */
export interface Listing {
  listingId: string;
  kind: number;
  status: number;
  title: string;
  description: string | null;
  vendor?: VendorSummary;
  city: string;
  area: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrls: string[];
  amenities: string[];
  cancellationPolicy: CancellationPolicy | null;
  paymentModes: number[];
  depositPercent: number;
  currency: string;
  // Stay
  starRating?: number | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  minNights?: number | null;
  maxNights?: number | null;
  houseRules?: string | null;
  fromPricePerNight?: number | null;
  roomTypes?: RoomTypeVendor[];
  // Package
  destination?: string | null;
  durationDays?: number | null;
  durationNights?: number | null;
  meetingPoint?: string | null;
  maxGroupSize?: number | null;
  itinerary?: ItineraryDay[];
  inclusions?: string[];
  exclusions?: string[];
  fromPrice?: number | null;
  // management
  createdUtc: string;
  updatedUtc: string;
  publishedUtc: string | null;
  upcomingDepartures?: number;
  bookingsUpcoming?: number;
}

export interface ListingWrite {
  kind?: number;
  title: string;
  description: string | null;
  city: string;
  area: string | null;
  addressLine: string | null;
  latitude: number | null;
  longitude: number | null;
  photoUrls: string[];
  amenities: string[];
  freeCancellationDays: number;
  lateCancellationFeePercent: number;
  paymentModes: number[];
  depositPercent: number;
  starRating?: number | null;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  minNights?: number | null;
  maxNights?: number | null;
  houseRules?: string | null;
  destination?: string | null;
  durationDays?: number | null;
  meetingPoint?: string | null;
  maxGroupSize?: number | null;
  itinerary?: ItineraryDay[];
  inclusions?: string[];
  exclusions?: string[];
}

export interface CalendarDay {
  date: string;
  price: number;
  baseRate: number;
  isOverride: boolean;
  closed: boolean;
  totalUnits: number;
  booked: number;
  held: number;
  available: number;
}

export interface CalendarWrite {
  from: string;
  to: string;
  price?: number | null;
  clearPrice?: boolean;
  closed?: boolean | null;
}

export interface Departure {
  departureId: string;
  date: string;
  endDate: string | null;
  seatsTotal: number;
  seatsAvailable: number;
  adultPrice: number;
  childPrice: number | null;
  status: number;
  seatsBooked: number;
  bookings: number;
  createdUtc: string;
}

export interface DepartureWrite {
  date: string;
  seatsTotal: number;
  adultPrice: number;
  childPrice: number | null;
}

export interface PriceLine {
  label: string;
  date: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Traveller {
  fullName: string;
  type: number;
  age: number | null;
}

export interface Booking {
  id: string;
  number: string;
  kind: number;
  state: number;
  listingId: string;
  listingTitle: string;
  roomTypeId: string | null;
  roomTypeName: string | null;
  departureId: string | null;
  vendor?: VendorSummary;
  startDate: string;
  endDate: string;
  nights: number | null;
  rooms: number | null;
  adults: number;
  children: number;
  guestName: string;
  travellers: Traveller[];
  specialRequests: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  addressLine: string | null;
  city: string | null;
  meetingPoint: string | null;
  currency: string;
  lines: PriceLine[];
  totalPrice: number;
  paymentMode: number;
  depositPercent: number;
  payNowAmount: number;
  paidOnline: number;
  balanceDue: number;
  balanceReceivedUtc: string | null;
  balanceReceivedAmount: number | null;
  holdExpiresUtc: string | null;
  cancellationPolicy: CancellationPolicy | null;
  cancelledBy: number | null;
  cancelReason: string | null;
  cancellationFee: number | null;
  refundAmount: number | null;
  refundState: number;
  commissionPercent: number | null;
  commissionAmount: number | null;
  vendorNetAmount: number | null;
  settledUtc: string | null;
  createdUtc: string;
  confirmedUtc: string | null;
  checkedInUtc: string | null;
  completedUtc: string | null;
  cancelledUtc: string | null;
  noShowUtc: string | null;
  canCancel: boolean;
  canCheckIn: boolean;
  canComplete: boolean;
  canMarkNoShow: boolean;
  canMarkBalanceReceived: boolean;
}

export interface BookingSummary {
  upcoming: number;
  inHouse: number;
  pendingPayment: number;
  balanceToCollect: number;
  currency: string;
}

export type BookingFilter = {
  state?: number;
  kind?: number;
  listingId?: string;
  from?: string;
  to?: string;
  q?: string;
};

/** The vendor never sees who the buyer is beyond the names on the booking. */
export function sanitizeBooking(b: Booking): Booking {
  const { buyerAccountId: _drop, ...rest } = redactPii(b) as Booking & { buyerAccountId?: unknown };
  return rest as Booking;
}

const base = '/v1/vendor/services';
const enc = encodeURIComponent;

export const listingsApi = {
  uploadMedia: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<{ url: string }>(`${base}/media`, form);
  },
  list: (kind?: number, status?: number) => api.get<Listing[]>(`${base}/listings`, { kind, status }),
  get: (id: string) => api.get<Listing>(`${base}/listings/${enc(id)}`),
  create: (body: ListingWrite) => api.post<Listing>(`${base}/listings`, body),
  update: (id: string, body: ListingWrite) => api.put<Listing>(`${base}/listings/${enc(id)}`, body),
  publish: (id: string) => api.post<Listing>(`${base}/listings/${enc(id)}/publish`),
  pause: (id: string) => api.post<Listing>(`${base}/listings/${enc(id)}/pause`),
  archive: (id: string) => api.post<Listing>(`${base}/listings/${enc(id)}/archive`),

  addRoomType: (listingId: string, body: RoomTypeWrite) => api.post<RoomTypeVendor>(`${base}/listings/${enc(listingId)}/room-types`, body),
  updateRoomType: (roomTypeId: string, body: RoomTypeWrite) => api.put<RoomTypeVendor>(`${base}/room-types/${enc(roomTypeId)}`, body),
  archiveRoomType: (roomTypeId: string) => api.post<RoomTypeVendor>(`${base}/room-types/${enc(roomTypeId)}/archive`),
  calendar: (roomTypeId: string, from: string, to: string) => api.get<CalendarDay[]>(`${base}/room-types/${enc(roomTypeId)}/calendar`, { from, to }),
  setCalendar: (roomTypeId: string, body: CalendarWrite) => api.put<CalendarDay[]>(`${base}/room-types/${enc(roomTypeId)}/calendar`, body),

  departures: (listingId: string, from?: string) => api.get<Departure[]>(`${base}/listings/${enc(listingId)}/departures`, { from }),
  addDeparture: (listingId: string, body: DepartureWrite) => api.post<Departure>(`${base}/listings/${enc(listingId)}/departures`, body),
  updateDeparture: (departureId: string, body: DepartureWrite) => api.put<Departure>(`${base}/departures/${enc(departureId)}`, body),
  closeDeparture: (departureId: string) => api.post<Departure>(`${base}/departures/${enc(departureId)}/close`),
  reopenDeparture: (departureId: string) => api.post<Departure>(`${base}/departures/${enc(departureId)}/reopen`),
  cancelDeparture: (departureId: string, reason: string) => api.post<Departure>(`${base}/departures/${enc(departureId)}/cancel`, { reason }),
};

export const bookingsApi = {
  list: async (f: BookingFilter, cursor: string | null): Promise<PagedResult<Booking>> => {
    const page = await api.get<PagedResult<Booking>>('/v1/vendor/bookings', { ...f, q: f.q || undefined, cursor: cursor ?? undefined, pageSize: 20 });
    return { ...page, items: (page.items ?? []).map(sanitizeBooking) };
  },
  get: async (id: string) => sanitizeBooking(await api.get<Booking>(`/v1/vendor/bookings/${enc(id)}`)),
  summary: () => api.get<BookingSummary>('/v1/vendor/bookings/summary'),
  checkIn: async (id: string) => sanitizeBooking(await api.post<Booking>(`/v1/vendor/bookings/${enc(id)}/check-in`)),
  complete: async (id: string) => sanitizeBooking(await api.post<Booking>(`/v1/vendor/bookings/${enc(id)}/complete`)),
  noShow: async (id: string) => sanitizeBooking(await api.post<Booking>(`/v1/vendor/bookings/${enc(id)}/no-show`)),
  balanceReceived: async (id: string, amount: number, note?: string | null) =>
    sanitizeBooking(await api.post<Booking>(`/v1/vendor/bookings/${enc(id)}/balance-received`, { amount, note: note || undefined })),
  cancel: async (id: string, reason: string) => sanitizeBooking(await api.post<Booking>(`/v1/vendor/bookings/${enc(id)}/cancel`, { reason })),
};

export const LISTINGS_KEY = ['service-listings'] as const;
export const BOOKINGS_KEY = ['service-bookings'] as const;
