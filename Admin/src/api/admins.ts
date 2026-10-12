/** Admin accounts, the caller's own account (`/me`), TOTP and sessions - StyleMint.Modules.Admin. */
import { http } from './client';
import { toPage, type Page } from './paging';

/** AdminRole enum - numbers in bodies, names in the JWT and in route segments. */
export const ROLE_BY_NUMBER: Record<number, string> = {
  1: 'SuperAdmin',
  2: 'KycReviewer',
  3: 'ContentMod',
  4: 'SupportAgent',
  5: 'PayoutsOps',
  6: 'Readonly',
};

export const ADMIN_STATE_LABEL: Record<number, string> = { 1: 'Active', 2: 'Disabled' };

export interface AdminRoleAssignment {
  id: string;
  adminAccountId: string;
  role: number;
  assignedUtc: string;
  assignedByAdminId: string;
}

export interface AdminAccount {
  id: string;
  /** Null for an admin who was invited and has only ever used Google, Facebook or a password. */
  ssoSubject: string | null;
  email: string;
  displayName: string;
  state: number;
  lastLoginUtc: string | null;
  /**
   * From the admin-login backend (wt/admin-login-contract.md); absent until it is deployed. `signInMethods` is a
   * subset of google / facebook / password / sso; `lastSignInUtc` is null until their first sign-in since that release.
   */
  signInMethods?: string[] | null;
  lastSignInMethod?: string | null;
  lastSignInUtc?: string | null;
  createdUtc: string;
  updatedUtc: string;
  rowVersion: string | null;
  roles: AdminRoleAssignment[];
}

export interface AdminSessionRow {
  id: string;
  adminAccountId: string;
  jti: string;
  issuedUtc: string;
  expiresUtc: string;
  lastSeenUtc: string;
  sourceIp: string;
  userAgent: string;
  mfaAssertedUtc: string | null;
  mfaAcr: string | null;
  revokedUtc: string | null;
  lastStepUpUtc: string | null;
}

export interface AdminMfaStatus {
  hasTotp: boolean;
  totpConfirmed: boolean;
  totpLastVerifiedUtc: string | null;
  totpLocked: boolean;
  sessionLastStepUpUtc: string | null;
  sessionStepUpFresh: boolean;
  stepUpMaxAgeMinutes: number;
}

export interface AdminMfaEnrollment {
  credentialId: string;
  secretBase32: string;
  provisioningUri: string;
  digits: number;
  periodSeconds: number;
}

const enc = encodeURIComponent;

export const meApi = {
  me: (signal?: AbortSignal) => http.get<AdminAccount>('/v1/admin/me', undefined, signal),
  sessions: (signal?: AbortSignal) => http.get<AdminSessionRow[]>('/v1/admin/me/sessions', undefined, signal),
  mfa: (signal?: AbortSignal) => http.get<AdminMfaStatus>('/v1/admin/me/mfa', undefined, signal),
  /** The body is required by the server, even empty. */
  enrollTotp: (label?: string) => http.post<AdminMfaEnrollment>('/v1/admin/auth/mfa/totp/enroll', label ? { label } : {}),
  confirmTotp: (code: string) => http.post<unknown>('/v1/admin/auth/mfa/totp/confirm', { code: code.replace(/\s+/g, '') }),
  /** Step-up required. */
  removeTotp: () => http.del<void>('/v1/admin/auth/mfa/totp'),
};

export const adminsApi = {
  list: async (page: number, pageSize: number, signal?: AbortSignal): Promise<Page<AdminAccount>> =>
    toPage<AdminAccount>(await http.get('/v1/admin/admins', { pageNumber: page, pageSize }, signal), page, pageSize),
  sessions: (id: string, signal?: AbortSignal) => http.get<AdminSessionRow[]>(`/v1/admin/admins/${enc(id)}/sessions`, undefined, signal),
  // All below are step-up endpoints.
  grantRole: (id: string, role: string) => http.post<AdminAccount>(`/v1/admin/admins/${enc(id)}/roles/${enc(role)}`),
  revokeRole: (id: string, role: string) => http.del<AdminAccount>(`/v1/admin/admins/${enc(id)}/roles/${enc(role)}`),
  disable: (id: string) => http.post<void>(`/v1/admin/admins/${enc(id)}/disable`),
  enable: (id: string) => http.post<void>(`/v1/admin/admins/${enc(id)}/enable`),
  revokeAllSessions: (id: string, reason: string) => http.post<number>(`/v1/admin/admins/${enc(id)}/sessions/revoke-all`, undefined, { reason }),
  removeMfa: (id: string, reason: string) => http.del<void>(`/v1/admin/admins/${enc(id)}/mfa?reason=${enc(reason)}`),
  /** SuperAdmin + step-up. Creates (or re-enables) the admin with these roles and emails a set-password invitation. */
  invite: (body: InviteAdminBody) => http.post<InviteAdminResult | undefined>('/v1/admin/admins/invite', body),
};

export interface InviteAdminResult {
  adminAccountId: string;
  email: string;
  displayName: string;
  roles: number[];
  roleNames?: string[];
  invitationExpiresUtc: string;
  emailDelivered: boolean;
  /** Only when the email could not be delivered: shown once so the Super Admin can pass it on. Never stored. */
  invitationUrl: string | null;
}

export interface InviteAdminBody {
  email: string;
  displayName: string;
  /** AdminRole numbers (enums are numbers on the wire; the endpoint also takes names). At least one. */
  roles: number[];
}

export const SIGN_IN_METHOD_LABEL: Record<string, string> = {
  google: 'Google',
  facebook: 'Facebook',
  password: 'Password',
  sso: 'Single sign-on',
};

export const ROLE_NUMBER: Record<string, number> = Object.fromEntries(Object.entries(ROLE_BY_NUMBER).map(([n, name]) => [name, Number(n)]));

/** "Signs in with", from the new field when the server has it, else guessed from the SSO subject as before. */
export function signInMethodsOf(a: Pick<AdminAccount, 'signInMethods' | 'ssoSubject'>): string[] | null {
  if (Array.isArray(a.signInMethods)) return a.signInMethods.map((m) => SIGN_IN_METHOD_LABEL[m.toLowerCase()] ?? m);
  if (!a.ssoSubject) return null;
  return [a.ssoSubject.startsWith('lead360:') ? 'Lead360 console' : 'Single sign-on'];
}
