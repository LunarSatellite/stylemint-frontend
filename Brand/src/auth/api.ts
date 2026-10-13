import { api } from '../api/client';
import type { IdentifierTypeValue } from './identifier';

/** Identity's DevicePlatform — 3 = Web. */
const DEVICE_PLATFORM_WEB = 3;
const DEVICE_KEY = 'sm.seller.device';
export const APP_VERSION = 'seller-web/0.1.0';

/** AuthResponseVm — identical for login, OTP verify and refresh. */
export interface AuthResponse {
  accountId: string;
  sessionId: string;
  accessToken: string;
  accessExpiresUtc: string;
  refreshToken: string;
  refreshExpiresUtc: string;
  tokenType: string;
  isNewAccount: boolean;
  displayNameConfirmed: boolean;
}

export interface OtpRequested {
  otpId: string;
  accountId: string;
  expiresUtc: string;
  devPlaintextCode: string | null;
  isNewAccount: boolean;
}

export interface RegistrationStatus {
  accountId: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  hasPassword: boolean;
  hasPasskey: boolean;
  termsAccepted: boolean;
  isComplete: boolean;
}

export interface AccountDto {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  locale?: string;
  timezone?: string;
}

export interface UserSession {
  id: string;
  accountId: string;
  deviceId: string;
  issuedUtc: string;
  expiresUtc: string;
  lastActivityUtc: string;
  ipAddress: string | null;
  userAgent: string | null;
  /** 1 Active, 2 Revoked, 3 Expired */
  status: number;
  revokedUtc: string | null;
}

/** A stable per-browser id so the backend registers this browser as one device (not a secret). */
export function deviceFingerprint(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = `web-${crypto.randomUUID()}`;
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'web-ephemeral';
  }
}

function browserModel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : '';
  return `${browser}${os ? ` on ${os}` : ''} (Seller Center)`.slice(0, 100);
}

export function deviceBinding() {
  return {
    deviceFingerprint: deviceFingerprint(),
    devicePlatform: DEVICE_PLATFORM_WEB,
    deviceModel: browserModel(),
    deviceAppVersion: APP_VERSION,
  };
}

export const authApi = {
  login: (identifierType: IdentifierTypeValue, identifier: string, password: string) =>
    api.post<AuthResponse>('/v1/auth/login', { identifierType, identifier, password, ...deviceBinding() }, { anonymous: true }),

  requestOtp: (identifierType: IdentifierTypeValue, identifier: string) =>
    api.post<OtpRequested>('/v1/auth/login-otp/request', { identifierType, identifier }, { anonymous: true }),

  verifyOtp: (identifierType: IdentifierTypeValue, identifier: string, code: string) =>
    api.post<AuthResponse>('/v1/auth/login-otp/verify', { identifierType, identifier, code, ...deviceBinding() }, { anonymous: true }),

  refresh: (refreshToken: string) =>
    api.post<AuthResponse>('/v1/auth/refresh', { refreshToken }, { anonymous: true }),

  /** Note: today the backend's logout-by-refresh-token revokes every session of the account. */
  logoutEverywhere: () => api.post<void>('/v1/auth/logout', { allSessions: true }),
  logout: (refreshToken: string) => api.post<void>('/v1/auth/logout', { refreshToken }),

  registrationStatus: (accountId: string) => api.get<RegistrationStatus>(`/v1/registration/${accountId}/status`),

  account: (accountId: string) => api.get<AccountDto>(`/v1/accounts/${accountId}`),

  /** Authenticated first password. 409 state.duplicate when one already exists. Never the anonymous registration route. */
  createPassword: (accountId: string, newPassword: string) =>
    api.put<void>(`/v1/accounts/${accountId}/password`, { newPassword }),

  changePassword: (accountId: string, currentPassword: string, newPassword: string) =>
    api.post<void>(`/v1/accounts/${accountId}/password/change`, { currentPassword, newPassword }),

  sessions: (accountId: string) => api.get<UserSession[]>(`/v1/accounts/${accountId}/sessions`, { activeOnly: true }),

  revokeSession: (accountId: string, sessionId: string) =>
    api.post<void>(`/v1/accounts/${accountId}/sessions/${sessionId}/revoke`, { reason: 1 }),

  revokeAllSessions: (accountId: string) => api.post<number>(`/v1/accounts/${accountId}/sessions/revoke-all`),
};
