import { __resetSessionForTests, establish } from '../../auth/session';
import { ACCOUNT_ID, authResponse } from '../../test/utils';
import type { Appointment, Branch, Lead, OpeningHours } from './bank/api';
import type { Booking, Listing } from './listings/api';

export const PROFILE_PATH = `/v1/accounts/${ACCOUNT_ID}/vendor-profile`;

/** A signed-in vendor session (no network: roles are in the token, no password check). */
export async function signInVendor() {
  __resetSessionForTests();
  await establish(authResponse(['Vendor']), { remember: false, checkPassword: false });
}

/** The vendor profile route for `mockApi`; `category` undefined = an older server without the field. */
export function profileRoute(category?: number) {
  return {
    [`GET ${PROFILE_PATH}`]: {
      body: {
        id: 'vp-1',
        accountId: ACCOUNT_ID,
        businessName: 'Test vendor',
        businessType: 3,
        status: 2,
        isVerified: true,
        updatedUtc: '2026-10-18T00:00:00Z',
        ...(category === undefined ? {} : { serviceCategory: category, serviceLicenceNumber: category === 3 ? 'NRB-A-012' : null }),
      },
    },
  };
}

export const page = <T>(items: T[], extra: Record<string, unknown> = {}) => ({
  items,
  totalCount: items.length,
  nextCursor: null,
  previousCursor: null,
  pageSize: 20,
  hasMore: false,
  ...extra,
});

export function lead(patch: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    reference: 'ENQ-7F3A2C',
    kind: 1,
    status: 1,
    statusChangedUtc: null,
    productId: 'bp-1',
    productType: 4,
    productName: 'Home Loan',
    branchId: null,
    branchName: null,
    answers: [{ key: 'loanAmount', label: 'Loan amount (NPR)', value: '2500000' }],
    message: 'Can I apply jointly?',
    contact: { name: 'Sita Sharma', phone: '+9779841000000', email: 'sita@example.com', preferredMethod: 1 },
    consent: { version: 'bank-contact-v1', text: 'I agree that StyleMint shares my name, phone number and email address with Himalayan Bank.', acceptedUtc: '2026-10-18T04:00:00Z' },
    appointment: null,
    closedReason: null,
    withdrawnUtc: null,
    noteCount: 0,
    createdUtc: '2026-10-18T04:00:00Z',
    updatedUtc: '2026-10-18T04:00:00Z',
    ...patch,
  };
}

export function appointment(patch: Partial<Appointment> = {}): Appointment {
  return {
    id: 'apt-1',
    leadId: 'lead-2',
    reference: 'APT-91B0C4',
    bankId: 'bank-1',
    bankName: 'Himalayan Bank',
    branchId: 'br-1',
    branchName: 'New Road Branch',
    branchAddress: 'New Road, Ward 22, Kathmandu',
    slotId: 'slot-1',
    date: '2026-10-21',
    startTime: '10:00',
    endTime: '10:30',
    startUtc: '2026-10-21T04:15:00+00:00',
    endUtc: '2026-10-21T04:45:00+00:00',
    status: 1,
    cancelledBy: null,
    cancelReason: null,
    purpose: 'Open a savings account',
    productId: null,
    productType: 1,
    productName: null,
    contact: { name: 'Ram Thapa', phone: '+9779800000001', email: null, preferredMethod: 1 },
    createdUtc: '2026-10-18T04:00:00Z',
    ...patch,
  };
}

export function branch(patch: Partial<Branch> = {}): Branch {
  return {
    id: 'br-1',
    bankId: 'bank-1',
    name: 'New Road Branch',
    addressLine: 'New Road, Ward 22',
    city: 'Kathmandu',
    district: 'Kathmandu',
    province: 'Bagmati',
    latitude: 27.7041,
    longitude: 85.311,
    phone: '01-4227540',
    openingHours: [0, 1, 2, 3, 4, 5, 6].map((d): OpeningHours => (d === 6 ? { dayOfWeek: 6, opens: null, closes: null, closed: true } : { dayOfWeek: d, opens: '10:00', closes: '17:00', closed: false })),
    appointmentsEnabled: true,
    isActive: true,
    createdUtc: '2026-10-01T00:00:00Z',
    updatedUtc: '2026-10-01T00:00:00Z',
    ...patch,
  };
}

export function stayListing(patch: Partial<Listing> = {}): Listing {
  return {
    listingId: 'lst-1',
    kind: 1,
    status: 1,
    title: 'Hotel Yak & Yeti',
    description: 'Heritage hotel',
    city: 'Kathmandu',
    area: 'Durbar Marg',
    addressLine: 'Durbar Marg, Ward 1',
    latitude: 27.711,
    longitude: 85.318,
    photoUrls: [],
    amenities: ['wifi'],
    cancellationPolicy: { freeCancellationDays: 3, lateCancellationFeePercent: 50, summary: 'Free cancellation until 3 days before.' },
    paymentModes: [1, 2, 3],
    depositPercent: 30,
    currency: 'NPR',
    starRating: 5,
    checkInTime: '14:00',
    checkOutTime: '12:00',
    minNights: 1,
    maxNights: 30,
    houseRules: 'No smoking',
    fromPricePerNight: 4500,
    roomTypes: [
      {
        roomTypeId: 'rt-1',
        name: 'Deluxe Double',
        description: null,
        maxAdults: 2,
        maxGuests: 3,
        beds: '1 King',
        sizeSqm: 28,
        photoUrls: [],
        amenities: [],
        baseRate: 4500,
        totalUnits: 5,
        status: 1,
      },
    ],
    createdUtc: '2026-10-01T00:00:00Z',
    updatedUtc: '2026-10-01T00:00:00Z',
    publishedUtc: null,
    bookingsUpcoming: 2,
    ...patch,
  };
}

export function booking(patch: Partial<Booking> = {}): Booking {
  return {
    id: 'bk-1',
    number: 'BK-7F3A9C21',
    kind: 1,
    state: 2,
    listingId: 'lst-1',
    listingTitle: 'Hotel Yak & Yeti',
    roomTypeId: 'rt-1',
    roomTypeName: 'Deluxe Double',
    departureId: null,
    startDate: '2026-10-21',
    endDate: '2026-10-23',
    nights: 2,
    rooms: 1,
    adults: 2,
    children: 1,
    guestName: 'Sita Sharma',
    travellers: [],
    specialRequests: 'Late arrival',
    checkInTime: '14:00',
    checkOutTime: '12:00',
    addressLine: 'Durbar Marg',
    city: 'Kathmandu',
    meetingPoint: null,
    currency: 'NPR',
    lines: [
      { label: 'Deluxe Double · 21 Oct', date: '2026-10-21', quantity: 1, unitPrice: 4500, amount: 4500 },
      { label: 'Deluxe Double · 22 Oct', date: '2026-10-22', quantity: 1, unitPrice: 4500, amount: 4500 },
    ],
    totalPrice: 9000,
    paymentMode: 2,
    depositPercent: 30,
    payNowAmount: 2700,
    paidOnline: 2700,
    balanceDue: 6300,
    balanceReceivedUtc: null,
    balanceReceivedAmount: null,
    holdExpiresUtc: null,
    cancellationPolicy: { freeCancellationDays: 3, lateCancellationFeePercent: 50, freeUntilDate: '2026-10-18', summary: 'Free cancellation until 18 Oct 2026. After that 50% of the total is charged.' },
    cancelledBy: null,
    cancelReason: null,
    cancellationFee: null,
    refundAmount: null,
    refundState: 0,
    commissionPercent: 10,
    commissionAmount: null,
    vendorNetAmount: null,
    settledUtc: null,
    createdUtc: '2026-10-15T04:00:00Z',
    confirmedUtc: '2026-10-15T04:05:00Z',
    checkedInUtc: null,
    completedUtc: null,
    cancelledUtc: null,
    noShowUtc: null,
    canCancel: true,
    canCheckIn: false,
    canComplete: false,
    canMarkNoShow: false,
    canMarkBalanceReceived: false,
    ...patch,
  };
}
