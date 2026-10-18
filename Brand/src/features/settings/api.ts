import { api } from '../../api/client';
import type { PagedResult } from '../../api/paging';

/** Identity VendorProfileController — /v1/accounts/{sub}/vendor-profile (404 before approval). */
export interface VendorProfile {
  id: string;
  accountId: string;
  businessName: string;
  businessType: number;
  businessRegistrationNumber: string | null;
  taxId: string | null;
  logoUrl: string | null;
  description: string | null;
  websiteUrl: string | null;
  status: number;
  pickupAddressLine: string | null;
  pickupCity: string | null;
  isPickupEnabled: boolean;
  coverImageUrl: string | null;
  tagline: string | null;
  brandStory: string | null;
  originCity: string | null;
  originCountryCode: string | null;
  foundedYear: number | null;
  isVerified: boolean;
  returnPolicySummary: string | null;
  supportUrl: string | null;
  updatedUtc: string;
  /** service-banks-contract v1: 0 product seller, 1 Hotel, 2 TravelAgency, 3 Bank. Absent on older servers (= 0). */
  serviceCategory?: number;
  serviceLicenceNumber?: string | null;
}

export type ProfilePatch = Partial<{
  businessName: string;
  businessRegistrationNumber: string;
  taxId: string;
  description: string;
  websiteUrl: string;
  tagline: string;
  brandStory: string;
  originCity: string;
  returnPolicySummary: string;
  supportUrl: string;
}>;

export interface VendorStore {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  isActive: boolean;
  createdUtc: string;
  kind: number;
  openingHours: string | null;
  lastConfirmedUtc: string | null;
}

export interface StoreInput {
  name: string;
  addressLine: string;
  city: string;
  latitude?: number | null;
  longitude?: number | null;
  phone?: string | null;
  openingHours?: string | null;
}

export const TeamRole = { Owner: 1, Admin: 2, Member: 3 } as const;
export const teamRoleLabel: Record<number, string> = { 1: 'Owner', 2: 'Admin', 3: 'Member' };

export interface TeamMember {
  id: string;
  vendorAccountId: string;
  memberAccountId: string;
  role: number;
  invitedUtc: string;
  acceptedUtc: string | null;
  removedUtc: string | null;
}

export const settingsApi = {
  profile: (accountId: string) => api.get<VendorProfile>(`/v1/accounts/${accountId}/vendor-profile`),
  updateProfile: (accountId: string, patch: ProfilePatch) => api.patch<VendorProfile>(`/v1/accounts/${accountId}/vendor-profile`, patch),
  setPickup: (accountId: string, body: { enabled: boolean; addressLine?: string; city?: string }) =>
    api.patch<VendorProfile>(`/v1/accounts/${accountId}/vendor-profile/pickup-location`, body),
  uploadLogo: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<{ url: string }>('/v1/vendor/me/logo', form);
  },
  uploadCover: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.upload<{ url: string }>('/v1/vendor/me/cover', form);
  },

  stores: (cursor: string | null) => api.get<PagedResult<VendorStore>>('/v1/vendor/stores', { cursor: cursor ?? undefined, pageSize: 50 }),
  addStore: (body: StoreInput) => api.post<VendorStore>('/v1/vendor/stores', body),
  updateStore: (id: string, body: StoreInput) => api.put<VendorStore>(`/v1/vendor/stores/${id}`, body),
  confirmStore: (id: string) => api.post<VendorStore>(`/v1/vendor/stores/${id}/confirm`),
  archiveStore: (id: string) => api.post<void>(`/v1/vendor/stores/${id}/archive`),

  team: (accountId: string) => api.get<TeamMember[]>(`/v1/accounts/${accountId}/vendor-team`),
  addMember: (accountId: string, memberAccountId: string, role: number) =>
    api.post<TeamMember>(`/v1/accounts/${accountId}/vendor-team`, { memberAccountId, role }),
  changeRole: (accountId: string, membershipId: string, newRole: number) =>
    api.patch<void>(`/v1/accounts/${accountId}/vendor-team/${membershipId}/role`, { newRole }),
  removeMember: (accountId: string, membershipId: string, reason: string | null) =>
    api.del<void>(`/v1/accounts/${accountId}/vendor-team/${membershipId}`, { body: { reason } }),
};
