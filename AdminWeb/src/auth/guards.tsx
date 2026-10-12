import { useCallback, type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Button, Center, Stack, Text, Title } from '@mantine/core';
import { IconLock } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { can as canFor, type Capability } from './roles';
import { useSession } from './session';

/** The signed-in admin and what their roles allow. */
export function useAuth() {
  const { session } = useSession();
  const roles = session?.claims.roles ?? [];
  const can = useCallback((capability: Capability) => canFor(roles, capability), [roles]);
  return { session, claims: session?.claims ?? null, roles, can };
}

/** Routes behind sign-in. The intended address is kept so sign-in returns to it. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session } = useSession();
  const location = useLocation();
  if (!session) {
    const next = `${location.pathname}${location.search}`;
    return <Navigate to={`/login${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`} replace />;
  }
  return <>{children}</>;
}

/**
 * Hides a page the operator's roles do not open, with a plain explanation instead of a broken screen. The server is
 * the authority; this only stops the console from offering what it would refuse.
 */
export function RequireCapability({ capability, children }: { capability: Capability; children: ReactNode }) {
  const { can } = useAuth();
  if (!can(capability)) return <ForbiddenPage />;
  return <>{children}</>;
}

export function ForbiddenPage() {
  return (
    <Center mih="50vh" data-testid="forbidden-page">
      <Stack align="center" gap="sm" maw={460} ta="center">
        <IconLock size={36} opacity={0.6} aria-hidden />
        <Title order={2}>This page isn’t part of your role</Title>
        <Text c="dimmed" size="sm">
          Your admin roles don’t include this area. If you need it for your work, ask a Super Admin to grant the right role - it takes effect the next time you sign in.
        </Text>
        <Button component={Link} to="/" variant="light">
          Back to the dashboard
        </Button>
      </Stack>
    </Center>
  );
}

/** Shows children only when the operator holds the capability - for buttons and menu entries. */
export function Can({ capability, children, fallback = null }: { capability: Capability; children: ReactNode; fallback?: ReactNode }) {
  const { can } = useAuth();
  return <>{can(capability) ? children : fallback}</>;
}
