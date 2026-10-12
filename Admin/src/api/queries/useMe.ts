import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import { qk, staleTime } from '../queryKeys';
import type { AdminAccount } from './useAdminAccounts';

/** `/v1/admin/me` returns the same shape as a row in the admin list. */
export function useMe() {
  return useQuery({
    queryKey: qk.me(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<AdminAccount>('/v1/admin/me', { signal });
      return data;
    },
    staleTime: staleTime.me,
  });
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

export function useMeMfa() {
  return useQuery({
    queryKey: qk.meMfa(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<AdminMfaStatus>('/v1/admin/me/mfa', { signal });
      return data;
    },
    staleTime: staleTime.me,
  });
}

export interface AdminSession {
  id: string;
  adminAccountId: string;
  jti: string;
  issuedUtc: string;
  expiresUtc: string;
  lastSeenUtc: string | null;
  sourceIp: string | null;
  userAgent: string | null;
  mfaAssertedUtc: string | null;
  mfaAcr: string | null;
  revokedUtc: string | null;
  revokedReason: number | null;
  revokedByAdminId: string | null;
  lastStepUpUtc: string | null;
  rowVersion: string;
}

/** Also a bare array rather than the paged envelope. */
export function useMeSessions() {
  return useQuery({
    queryKey: qk.meSessions(),
    queryFn: async ({ signal }) => {
      const { data } = await api.get<AdminSession[]>('/v1/admin/me/sessions', { signal });
      return data;
    },
    staleTime: staleTime.me,
  });
}
