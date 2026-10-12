import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { hasRole, useAuth } from './store';

/**
 * Gate a route on having a token.
 *
 * The intended path is preserved so the SSO round trip can return the
 * operator where they were going, rather than dumping everyone on the
 * queue after login.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const token = useAuth((s) => s.token);
  const location = useLocation();
  if (!token) return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
}

/**
 * Gate a route on a role.
 *
 * This hides what an operator cannot use; it does not secure it. Every
 * endpoint behind these routes authorises again server side, and must,
 * because the claims this reads come from a token the browser never
 * verified.
 */
export function RequireRole({ roles, children }: { roles: string[]; children: ReactNode }) {
  const claims = useAuth((s) => s.claims);
  if (!hasRole(claims, ...roles)) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
}
