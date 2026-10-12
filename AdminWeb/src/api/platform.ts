/** Feature flags, platform config, audit log, privacy (Admin + Identity modules). */
import { http } from './client';
import { toPage, type Page } from './paging';

export interface FeatureFlagOverride {
  id: string;
  audience: number;
  roleKind: number | null;
  accountId: string | null;
  enabled: boolean;
}

export interface FeatureFlag {
  id: string;
  key: string;
  defaultEnabled: boolean;
  description: string | null;
  createdUtc: string;
  updatedUtc: string;
  overrides: FeatureFlagOverride[];
}

export const ROLE_KIND: Record<number, string> = { 1: 'Customer', 2: 'Creator', 3: 'Vendor' };

export interface PlatformConfigEntry {
  id: string;
  key: string;
  valueJson: string;
  description: string;
  createdUtc: string;
  updatedUtc: string;
}

/** Keys that can lock every admin out, or loosen admin sign-in, if set wrongly. */
export const SENSITIVE_CONFIG = ['admin.security.ip_allowlist', 'admin.security.mfa.required_amr', 'admin.security.mfa.min_acr'];

export interface AuditEntry {
  id: string;
  adminAccountId: string;
  action: string;
  targetKind: string;
  targetId: string;
  reason: string | null;
  payloadJson: string;
  sourceIp: string;
  userAgent: string;
  occurredUtc: string;
}

export const AUDIT_ACTIONS = [
  'kyc.assigned',
  'kyc.decided.approved',
  'kyc.decided.rejected_retryable',
  'kyc.decided.rejected_terminal',
  'kyc.document.link_issued',
  'moderation.assigned',
  'moderation.decided',
  'payment.refund.issued',
  'payout.held',
  'payout.released',
  'payout.force_marked_paid',
  'payout.force_marked_failed',
  'feature_flag.upserted',
  'feature_flag.override.set',
  'feature_flag.override.cleared',
  'platform_config.updated',
  'admin.sso_login',
  'admin.role.assigned',
  'admin.role.revoked',
  'admin.account.disabled',
  'admin.account.enabled',
  'admin.session.opened',
  'admin.session.revoked',
  'admin.session.revoked_all',
  'admin.mfa.enrolled',
  'admin.mfa.confirmed',
  'admin.mfa.verified',
  'admin.mfa.failed',
  'admin.mfa.removed',
  'admin.mfa.force_removed',
  'privacy.data_rights.identity_verified',
  'privacy.data_rights.started',
  'privacy.data_rights.completed',
  'privacy.data_rights.rejected',
  'support.return_evidence.viewed',
  'orders.archived',
  'orders.unarchived',
];

export const AUDIT_TARGETS = [
  'CreatorApplication',
  'VendorApplication',
  'KycReviewItem',
  'ModerationItem',
  'PaymentIntent',
  'Payout',
  'FeatureFlag',
  'PlatformConfig',
  'AdminAccount',
  'AdminSession',
  'AdminMfaCredential',
  'DataRightsRequest',
  'ReturnRequest',
  'Order',
];

export const DATA_RIGHTS_TYPE: Record<number, string> = {
  1: 'Access',
  2: 'Correction',
  3: 'Erasure',
  4: 'Restriction',
  5: 'Portability',
  6: 'Objection',
  7: 'Automated decision',
};
export const DATA_RIGHTS_STATUS: Record<number, string> = { 1: 'Submitted', 2: 'Identity verified', 3: 'In progress', 4: 'Completed', 5: 'Rejected', 6: 'Expired' };

export interface DataRightsRequest {
  id: string;
  accountId: string;
  requestType: number;
  status: number;
  description: string;
  submittedUtc: string;
  dueAtUtc: string;
  identityVerifiedUtc: string | null;
  inProgressUtc: string | null;
  completedUtc: string | null;
  rejectedUtc: string | null;
  rejectionReason: string | null;
  fulfilmentReference: string | null;
}

export interface PrivacyDashboard {
  dataExportRequests: number;
  optOutsFromRecommendations: number;
  activePauses: number;
  consentWithdrawals: number;
  weeklyTrend: { date: string; dataExportRequests: number; optOutsFromRecommendations: number; activePauses: number; consentWithdrawals: number }[];
}

const enc = encodeURIComponent;

export const flagsApi = {
  list: (signal?: AbortSignal) => http.get<FeatureFlag[]>('/v1/admin/feature-flags', undefined, signal),
  /** Creates or updates. A null description CLEARS an existing one, so always send the current text. */
  upsert: (key: string, defaultEnabled: boolean, description: string | null) => http.put<FeatureFlag>(`/v1/admin/feature-flags/${enc(key)}`, { defaultEnabled, description }),
  /** roleKind is a STRING name here (Customer | Creator | Vendor); exactly one of roleKind / accountId. */
  setOverride: (key: string, body: { roleKind?: string | null; accountId?: string | null; enabled: boolean }) => http.put<FeatureFlag>(`/v1/admin/feature-flags/${enc(key)}/overrides`, body),
  clearOverride: (key: string, body: { roleKind?: string | null; accountId?: string | null; enabled: boolean }) => http.del<FeatureFlag>(`/v1/admin/feature-flags/${enc(key)}/overrides`, body),
};

export const configApi = {
  list: (signal?: AbortSignal) => http.get<PlatformConfigEntry[]>('/v1/admin/platform-config', undefined, signal),
  set: (key: string, valueJson: string, description: string | null) => http.put<PlatformConfigEntry>(`/v1/admin/platform-config/${enc(key)}`, { valueJson, description }),
};

export const auditApi = {
  list: async (
    f: { adminAccountId?: string; action?: string; targetKind?: string; targetId?: string; fromUtc?: string; toUtc?: string; page: number; pageSize: number },
    signal?: AbortSignal,
  ): Promise<Page<AuditEntry>> =>
    toPage<AuditEntry>(
      await http.get(
        '/v1/admin/audit',
        {
          adminAccountId: f.adminAccountId || undefined,
          action: f.action || undefined,
          targetKind: f.targetKind || undefined,
          targetId: f.targetId || undefined,
          fromUtc: f.fromUtc || undefined,
          toUtc: f.toUtc || undefined,
          pageNumber: f.page,
          pageSize: f.pageSize,
        },
        signal,
      ),
      f.page,
      f.pageSize,
    ),
};

export const privacyApi = {
  dashboard: (signal?: AbortSignal) => http.get<PrivacyDashboard>('/v1/admin/privacy/dashboard', undefined, signal),
  queue: async (status: string, page: number, pageSize: number, signal?: AbortSignal): Promise<Page<DataRightsRequest>> => {
    const take = Math.min(100, pageSize);
    return toPage<DataRightsRequest>(await http.get('/v1/admin/privacy/data-rights-requests', { status: status || undefined, skip: (page - 1) * take, take }, signal), page, take);
  },
  verifyIdentity: (id: string) => http.post<void>(`/v1/admin/privacy/data-rights-requests/${enc(id)}/verify-identity`),
  start: (id: string) => http.post<void>(`/v1/admin/privacy/data-rights-requests/${enc(id)}/start`),
  complete: (id: string, fulfilmentReference: string | null) => http.post<void>(`/v1/admin/privacy/data-rights-requests/${enc(id)}/complete`, { fulfilmentReference }),
  reject: (id: string, reason: string) => http.post<void>(`/v1/admin/privacy/data-rights-requests/${enc(id)}/reject`, { reason }),
};
