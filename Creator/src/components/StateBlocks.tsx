import type { ReactNode } from 'react';
import { Alert, Button, Center, Loader, Skeleton, Stack, Text } from '@mantine/core';
import { IconAlertTriangle, IconCloudOff, IconInbox, IconLock, IconRefresh } from '@tabler/icons-react';
import { ApiError } from '../api/client';

/**
 * Every data surface renders one of these. "Could not load" is never shown as "nothing here":
 * an error is an error, and empty is only said when the server answered with nothing.
 */
export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <Center py="xl" data-testid="state-loading">
      <Stack align="center" gap="xs">
        <Loader size="sm" color="forest" />
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Stack>
    </Center>
  );
}

export function ListSkeleton({ rows = 5, height = 52 }: { rows?: number; height?: number }) {
  return (
    <Stack gap="sm" data-testid="state-loading" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={height} radius="md" />
      ))}
    </Stack>
  );
}

export function EmptyBlock({
  title = 'Nothing here yet',
  body,
  action,
}: {
  title?: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Center py="xl" data-testid="state-empty">
      <Stack align="center" gap={6} maw={440} ta="center">
        <IconInbox size={30} opacity={0.55} aria-hidden />
        <Text fw={600}>{title}</Text>
        {body && (
          <Text size="sm" c="dimmed">
            {body}
          </Text>
        )}
        {action}
      </Stack>
    </Center>
  );
}

export function ErrorBlock({
  error,
  onRetry,
  title = 'Could not load this',
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
}) {
  const apiError = error instanceof ApiError ? error : null;
  if (apiError?.isOffline) {
    return (
      <Alert variant="light" color="amber" icon={<IconCloudOff size={18} />} title="You seem to be offline" data-testid="state-offline">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">We could not reach StyleMint. Check your connection and try again.</Text>
          {onRetry && (
            <Button size="xs" variant="light" color="amber" leftSection={<IconRefresh size={14} />} onClick={onRetry}>
              Try again
            </Button>
          )}
        </Stack>
      </Alert>
    );
  }
  if (apiError?.status === 403) {
    return (
      <Alert variant="light" color="gray" icon={<IconLock size={18} />} title="Not available for your account" data-testid="state-forbidden">
        <Text size="sm">{apiError.message || 'Your creator account does not have access to this.'}</Text>
      </Alert>
    );
  }
  return (
    <Alert variant="light" color="signal" icon={<IconAlertTriangle size={18} />} title={title} data-testid="state-error" role="alert">
      <Stack gap="sm" align="flex-start">
        <Text size="sm">{apiError?.message ?? (error instanceof Error ? error.message : 'Something went wrong.')}</Text>
        {onRetry && (
          <Button size="xs" variant="light" color="signal" leftSection={<IconRefresh size={14} />} onClick={onRetry}>
            Try again
          </Button>
        )}
      </Stack>
    </Alert>
  );
}

interface QueryLike<T> {
  isPending: boolean;
  error: unknown;
  data: T | undefined;
  refetch: () => unknown;
}

/** Loading → error → empty → content, from one query. */
export function QueryState<T>({
  query,
  isEmpty,
  empty,
  skeleton,
  errorTitle,
  children,
}: {
  query: QueryLike<T>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  skeleton?: ReactNode;
  errorTitle?: string;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{skeleton ?? <ListSkeleton />}</>;
  if (query.error || query.data === undefined)
    return (
      <ErrorBlock error={query.error ?? new Error('No data')} title={errorTitle} onRetry={() => void query.refetch()} />
    );
  if (isEmpty?.(query.data)) return <>{empty ?? <EmptyBlock />}</>;
  return <>{children(query.data)}</>;
}
