import { api, ApiError } from '../api/client';

/** Identity's DevicePlatform — 3 = Web. */
const DEVICE_PLATFORM_WEB = 3;
const DEVICE_KEY = 'sm.shop.device';
export const APP_VERSION = 'shop-web/0.1.0';

/** Identity's OtpDestinationType. */
export const IdentifierType = { Email: 1, Phone: 2 } as const;

/** AuthResponseVm — identical for OTP verify, social sign-in and refresh. */
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
  const os = /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : '';
  return `${browser}${os ? ` on ${os}` : ''} (StyleMint Shop)`.slice(0, 100);
}

export function deviceBinding() {
  return {
    deviceFingerprint: deviceFingerprint(),
    devicePlatform: DEVICE_PLATFORM_WEB,
    deviceModel: browserModel(),
    deviceAppVersion: APP_VERSION,
  };
}

/**
 * Nepali mobile → E.164. Strips spaces/dashes, drops a leading 0 / 977 / 00977, prefixes +977. A number typed
 * with another country code (+91…) is kept as typed. Same rule as Seller Center.
 */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/[^\d]/g, '');
  if (!digits) return null;
  if (hasPlus) {
    if (digits.startsWith('977')) return nepal(digits.slice(3));
    return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
  }
  if (digits.startsWith('00977')) digits = digits.slice(5);
  else if (digits.startsWith('977') && digits.length > 10) digits = digits.slice(3);
  digits = digits.replace(/^0+/, '');
  return nepal(digits);
}

function nepal(national: string): string | null {
  return /^\d{7,10}$/.test(national) ? `+977${national}` : null;
}

export const authApi = {
  requestOtp: (phone: string) =>
    api.post<OtpRequested>('/v1/auth/login-otp/request', { identifierType: IdentifierType.Phone, identifier: phone }, { anonymous: true }),

  verifyOtp: (phone: string, code: string) =>
    api.post<AuthResponse>(
      '/v1/auth/login-otp/verify',
      { identifierType: IdentifierType.Phone, identifier: phone, code, ...deviceBinding() },
      { anonymous: true },
    ),

  refresh: (refreshToken: string) => api.post<AuthResponse>('/v1/auth/refresh', { refreshToken }, { anonymous: true }),

  logout: (refreshToken: string) => api.post<void>('/v1/auth/logout', { refreshToken }),
};

/** What the buyer is told when an OTP step fails. */
export function otpError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'That did not work. Please try again.';
  if (error.isOffline) return 'Could not reach StyleMint. Check your internet connection and try again.';
  if (error.status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (error.status === 400 || error.status === 401) return error.message || 'That code is not right. Check it and try again.';
  return error.message;
}
