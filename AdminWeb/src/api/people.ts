/**
 * Customers (Identity AdminCustomersController), vendor/creator verification badges (Identity
 * AdminProfileVerificationController), vendor/creator applications (Onboarding AdminKycController), and the vendor
 * directory that the backend is adding (`/v1/admin/vendors`, see wt/admin-api-contract.md once it exists).
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

/**
 * The vendor directory row as the backend agent is adding it. Fields beyond `accountId` and a name are optional on
 * purpose: the console shows what arrives and does not break on what does not.
 */
export interface VendorRow {
  accountId: string;
  id?: string;
  brandName?: string | null;
  displayName?: string | null;
  legalName?: string | null;
  legalBusinessName?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  countryCode?: string | null;
  isVerified?: boolean | null;
  verifiedUtc?: string | null;
  status?: number | string | null;
  productCount?: number | null;
  orderCount?: number | null;
  createdUtc?: string | null;
  approvedUtc?: string | null;
}

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
  /** `GET /v1/admin/vendors` - being added by the backend. Throws ApiError with isMissingEndpoint until it ships. */
  list: async (q: { search?: string; verified?: string; page: number; pageSize: number }, signal?: AbortSignal): Promise<Page<VendorRow>> =>
    toPage<VendorRow>(
      await http.get('/v1/admin/vendors', { search: q.search || undefined, verified: q.verified || undefined, pageNumber: q.page, pageSize: q.pageSize }, signal),
      q.page,
      q.pageSize,
    ),
  detail: (accountId: string, signal?: AbortSignal) => http.get<VendorRow & Record<string, unknown>>(`/v1/admin/vendors/${enc(accountId)}`, undefined, signal),
};

export function isMissing(error: unknown): boolean {
  return error instanceof ApiError && error.isMissingEndpoint;
}
