import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '../client';
import { qk, type AdminFilter } from '../queryKeys';
import { correlationIdOf, errorCodeOf, getErrorMessage, retryAfterSeconds } from '../errors';
import { useMutationWithStepUp } from '@/auth/useMutationWithStepUp';
import type { AdminRole } from '@/lib/enums';

/**
 * The writes on an admin account. Every one of them is on the step-up
 * list, so every one goes through `useMutationWithStepUp`.
 *
 * All six are bodyless: the account is in the path, the role is a path
 * enum sent as its integer, and `reason` — where the endpoint takes
 * one — is a query parameter, not a field. Read from the spec, because
 * posting a `{ reason }` body here would be accepted, ignored, and
 * leave an audit entry with no reason on it.
 *
 * `Idempotency-Key` is declared on each of these as a header, and the
 * client interceptor already attaches one. Nothing here sets it again:
 * two keys for one intent is how a retry stops being idempotent.
 */

function useAdminWrite<TVars>(
  request: (vars: TVars) => Promise<unknown>,
  filter: AdminFilter,
  idOf: (vars: TVars) => string,
  success: (vars: TVars) => string,
) {
  const queryClient = useQueryClient();

  return useMutationWithStepUp<unknown, TVars>(request, {
    onSuccess: (_data, vars) => {
      toast.success(success(vars));
    },
    onError: (err) => {
      const code = errorCodeOf(err);
      if (code === 'system.rate_limited') {
        // Never retried for the operator: a repeated force-paid is
        // money sent twice, and the server has just said slow down.
        toast.warning(`Too many requests. Try again in ${retryAfterSeconds(err)}s.`);
        return;
      }
      const correlationId = correlationIdOf(err);
      toast.error(getErrorMessage(code), {
        description: correlationId ? `Ref: ${correlationId}` : undefined,
        duration: 8000,
      });
    },
    onSettled: (_data, _err, vars) => {
      void queryClient.invalidateQueries({ queryKey: qk.admins(filter) });
      void queryClient.invalidateQueries({ queryKey: qk.admin(idOf(vars)) });
    },
  });
}

export interface RoleVars {
  adminAccountId: string;
  role: AdminRole;
  roleName: string;
}

export function useGrantRole(filter: AdminFilter) {
  return useAdminWrite<RoleVars>(
    (v) => api.post(`/v1/admin/admins/${v.adminAccountId}/roles/${v.role}`),
    filter,
    (v) => v.adminAccountId,
    (v) => `${v.roleName} granted.`,
  );
}

export function useRevokeRole(filter: AdminFilter) {
  return useAdminWrite<RoleVars>(
    (v) => api.delete(`/v1/admin/admins/${v.adminAccountId}/roles/${v.role}`),
    filter,
    (v) => v.adminAccountId,
    (v) => `${v.roleName} revoked.`,
  );
}

export interface AccountVars {
  adminAccountId: string;
  displayName: string;
}

export function useDisableAdmin(filter: AdminFilter) {
  return useAdminWrite<AccountVars>(
    (v) => api.post(`/v1/admin/admins/${v.adminAccountId}/disable`),
    filter,
    (v) => v.adminAccountId,
    (v) => `${v.displayName} can no longer sign in.`,
  );
}

export function useEnableAdmin(filter: AdminFilter) {
  return useAdminWrite<AccountVars>(
    (v) => api.post(`/v1/admin/admins/${v.adminAccountId}/enable`),
    filter,
    (v) => v.adminAccountId,
    (v) => `${v.displayName} can sign in again.`,
  );
}

export interface ReasonedVars extends AccountVars {
  /** Goes on the audit entry. A query parameter, not a body field. */
  reason: string;
}

export function useRevokeAllSessions(filter: AdminFilter) {
  return useAdminWrite<ReasonedVars>(
    (v) =>
      api.post(`/v1/admin/admins/${v.adminAccountId}/sessions/revoke-all`, undefined, {
        params: { reason: v.reason },
      }),
    filter,
    (v) => v.adminAccountId,
    (v) => `Signed ${v.displayName} out everywhere.`,
  );
}

export function useRemoveAdminMfa(filter: AdminFilter) {
  return useAdminWrite<ReasonedVars>(
    (v) =>
      api.delete(`/v1/admin/admins/${v.adminAccountId}/mfa`, {
        params: { reason: v.reason },
      }),
    filter,
    (v) => v.adminAccountId,
    (v) => `Removed two-factor authentication for ${v.displayName}. They must enrol again.`,
  );
}
