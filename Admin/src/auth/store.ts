import { create } from 'zustand';
import { parseClaims, type AdminClaims } from './parseClaims';

/**
 * The token lives in memory and nowhere else.
 *
 * Not localStorage, not sessionStorage, not a cookie this app can read.
 * The cost is real — a refresh signs the operator out until the silent
 * SSO frame completes — and it is paid on purpose: this console can
 * revoke sessions, force payouts and strip MFA from other admins, and a
 * token sitting in localStorage is readable by any script that gets
 * onto the page. The 15-minute expiry only limits the damage; not
 * storing it prevents the theft.
 */
interface AuthState {
  token: string | null;
  claims: AdminClaims | null;
  setToken: (token: string) => void;
  clear: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: null,
  claims: null,
  setToken: (token) => set({ token, claims: parseClaims(token) }),
  clear: () => set({ token: null, claims: null }),
}));

/** Role check for what the UI offers. The server decides what it allows. */
export function hasRole(claims: AdminClaims | null, ...roles: string[]): boolean {
  if (!claims) return false;
  return roles.some((role) => claims.roles.includes(role));
}
