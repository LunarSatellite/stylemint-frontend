/**
 * Customers (Identity AdminCustomersController), vendor/creator verification badges (Identity
 * AdminProfileVerificationController), vendor/creator applications (Onboarding AdminKycController), and the vendor
 * directory (`/v1/admin/vendors`, wt/admin-api-contract.md).
 */
import { http } from './client';
import { ApiError } from './errors';
import { toPage, type Page } from './paging';

export const ACCOUNT_STATUS: Record<number, string> = { 1: 'Active', 2: 'Suspended', 3: 'Deactivated', 4: 'Deleted', 5: 'Purged' };
export const ACCOUNT_TONE: Record<number, string> = { 1: 'forest', 2: 'signal', 3: 'gray', 4: 'gray', 5: 'gray' };

export interface CustomerRow {
  id: string;
  displayName: string;
  primaryEmail: string | null;
  primaryPhone: string | null;
  avatarUrl: string | null;
  countryCode: string | null;
  locale: string;
  timezone: string;
  status: number;
  emailVerified: boolean;
  phoneVerified: boolean;
  lastActiveUtc: string | null;
  createdUtc: string;
}

export interface ProfileVerification {
  accountId: string;
  isVerified: boolean;
  verifiedUtc: string | null;
}

export const APPLICATION_STATE: Record<number, string> = { 1: 'Draft', 2: 'Submitted', 3: 'Under review', 4: 'Approved', 5: 'Rejected' };
export const BUSINESS_TYPE: Record<number, string> = {
  1: 'Individual',
  2: 'Sole proprietorship',
  3: 'Limited liability company',
  4: 'Corporation',
  5: 'Partnership',
  6: 'Non-profit',
};
export const CATALOG_SIZE: Record<number, string> = { 1: 'Under 10 products', 2: '10–50', 3: '50–100', 4: '100–500', 5: 'Over 500' };

export interface VendorApplication {
  id: string;
  accountId: string;
  state: number;
  brandName: string;
  website: string | null;
  legalBusinessName: string;
  countryCode: string;
  businessType: number;
  taxId: string | null;
  businessRegistrationNumber: string | null;
  commissionMinPercent: number;
  commissionMaxPercent: number;
  submittedAtUtc: string | null;
  expectedDecisionByUtc: string | null;
  decisionAtUtc: string | null;
  reviewerAccountId: string | null;
  rejectionReason: string | null;
  createdUtc: string;
  updatedUtc: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  catalogSize: number | null;
  priceRangeMinAmount: number | null;
  priceRangeMaxAmount: number | null;
  priceRangeCurrency: string | null;
  brandStory: string | null;
  bankAccount: {
    accountHolderName: string;
    bankName: string;
    accountType: number;
    lastFourAccountDigits: string;
  } | null;
}

/** Vendor directory (wt/admin-api-contract.md §1). New endpoints: enum names as strings, money as { amount, currency }. */
export interface Money {
  amount: number;
  currency: string;
}

export interface VendorRow {
  accountId: string;
  businessName: string | null;
  logoUrl: string | null;
  contact: { emailMasked: string | null; phoneMasked: string | null } | null;
  applicationStatus: 'Draft' | 'Pending' | 'UnderReview' | 'Approved' | 'Rejected' | string | null;
  kyc: { kycItemId: string; state: string; decision: string | null; submittedUtc: string; decidedUtc: string | null } | null;
  isVerified: boolean;
  verifiedUtc: string | null;
  accountStatus: string | null;
  isSuspended: boolean;
  createdUtc: string;
  products: { active: number; total: number } | null;
  orders30d: { count: number; gmv: Money } | null;
  payoutHold: { isOnHold: boolean; heldCount: number; heldAmount: Money } | null;
}

export interface VendorKycEntry {
  kycItemId: string;
  state: string;
  decision: string | null;
  decisionReasonCode: string | null;
  decisionNote: string | null;
  submittedUtc: string;
  dueByUtc: string;
  decidedUtc: string | null;
}

export interface VendorDetail {
  accountId: string;
  businessName: string | null;
  displayName: string | null;
  businessType: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  tagline: string | null;
  description: string | null;
  websiteUrl: string | null;
  accountStatus: string | null;
  isSuspended: boolean;
  isVerified: boolean;
  verifiedUtc: string | null;
  createdUtc: string;
  lastActiveUtc: string | null;
  contact: { emailMasked: string | null; phoneMasked: string | null; email: string | null; phone: string | null; emailVerified: boolean; phoneVerified: boolean } | null;
  profile: {
    status: string;
    submittedUtc: string | null;
    approvalUtc: string | null;
    rejectionUtc: string | null;
    rejectionReason: string | null;
    commissionRangeMin: number | null;
    commissionRangeMax: number | null;
    pickupCity: string | null;
    pickupAddressLine: string | null;
    isPickupEnabled: boolean;
  } | null;
  application: {
    applicationId: string;
    state: string;
    brandName: string;
    legalBusinessName: string;
    countryCode: string | null;
    city: string | null;
    submittedUtc: string | null;
    decisionUtc: string | null;
    rejectionReason: string | null;
  } | null;
  kyc: { latest: VendorKycEntry | null; history: VendorKycEntry[] } | null;
  stores: { id: string; name: string; kind: string; addressLine: string | null; city: string | null; phone: string | null; isActive: boolean }[];
  team: { memberAccountId: string; displayName: string; role: string; status: string; invitedUtc: string | null; acceptedUtc: string | null }[];
  products: { active: number; outOfStock: number; draft: number; suspended: number; archived: number; total: number } | null;
  orders: {
    last30d: { count: number; gmv: Money };
    recent: { subOrderId: string; orderId: string; orderNumber: string; state: string; itemCount: number; subtotal: Money; placedUtc: string }[];
  } | null;
  payouts: {
    isOnHold: boolean;
    heldCount: number;
    heldAmount: Money;
    pendingCount: number;
    pendingAmount: Money;
    paidLast30dAmount: Money;
    lastPaidUtc: string | null;
    recent: { payoutId: string; state: string; netAmount: Money; requestedUtc: string; paidUtc: string | null }[];
  } | null;
}

export const VENDOR_STATUS_FILTER = [
  { value: 'pending', label: 'Application submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'draft', label: 'Application started' },
  { value: 'verified', label: 'Verified badge' },
  { value: 'suspended', label: 'Suspended' },
];

export const VENDOR_SORT = [
  { value: 'created_desc', label: 'Newest' },
  { value: 'created_asc', label: 'Oldest' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
  { value: 'gmv30d_desc', label: 'Sales (30 days)' },
  { value: 'orders30d_desc', label: 'Orders (30 days)' },
  { value: 'products_desc', label: 'Most products' },
];

const enc = encodeURIComponent;

export const customersApi = {
  list: async (q: { search?: string; status?: string; page: number; pageSize: number }, signal?: AbortSignal): Promise<Page<CustomerRow>> =>
    toPage<CustomerRow>(
      await http.get('/v1/admin/customers', { search: q.search || undefined, status: q.status || undefined, pageNumber: q.page, pageSize: q.pageSize }, signal),
      q.page,
      q.pageSize,
    ),
  suspend: (id: string, reason: string) => http.post<void>(`/v1/admin/customers/${enc(id)}/suspend`, { reason }),
  reinstate: (id: string) => http.post<void>(`/v1/admin/customers/${enc(id)}/reinstate`),
};

export const verificationApi = {
  verifyVendor: (accountId: string) => http.post<ProfileVerification>(`/v1/admin/vendors/${enc(accountId)}/verify`),
  unverifyVendor: (accountId: string) => http.post<ProfileVerification>(`/v1/admin/vendors/${enc(accountId)}/unverify`),
  verifyCreator: (accountId: string) => http.post<ProfileVerification>(`/v1/admin/creators/${enc(accountId)}/verify`),
  unverifyCreator: (accountId: string) => http.post<ProfileVerification>(`/v1/admin/creators/${enc(accountId)}/unverify`),
};

export const applicationsApi = {
  /** Cursor-paged (PagedResult). */
  vendors: async (state: string | undefined, cursor: string | null, pageSize: number, page: number, signal?: AbortSignal): Promise<Page<VendorApplication>> =>
    toPage<VendorApplication>(await http.get('/v1/admin/kyc/vendor/queue', { state: state || undefined, cursor: cursor || undefined, pageSize }, signal), page, pageSize),
};

export const vendorsApi = {
  /** `GET /v1/admin/vendors` (feat/admin-api-gaps). Throws ApiError with isMissingEndpoint until it is deployed. */
  list: async (q: { search?: string; status?: string; sort?: string; page: number; pageSize: number }, signal?: AbortSignal): Promise<Page<VendorRow>> =>
    toPage<VendorRow>(
      await http.get('/v1/admin/vendors', { search: q.search || undefined, status: q.status || undefined, sort: q.sort || undefined, pageNumber: q.page, pageSize: Math.min(100, q.pageSize) }, signal),
      q.page,
      q.pageSize,
    ),
  detail: (accountId: string, signal?: AbortSignal) => http.get<VendorDetail>(`/v1/admin/vendors/${enc(accountId)}`, undefined, signal),
  suspend: (accountId: string, reason: string) => http.post<VendorRow>(`/v1/admin/vendors/${enc(accountId)}/suspend`, { reason }),
  reinstate: (accountId: string, note: string | null) => http.post<VendorRow>(`/v1/admin/vendors/${enc(accountId)}/reinstate`, { note }),
};

export function isMissing(error: unknown): boolean {
  return error instanceof ApiError && error.isMissingEndpoint;
}
