import type { ReactNode } from 'react';
import { Alert, Box, Button, Card, Center, Code, Group, Loader, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle, IconCloudOff, IconInbox, IconLock, IconRefresh, IconSearchOff } from '@tabler/icons-react';
import { ApiError } from '@/api/errors';
import { accentRail } from '@/theme';

/**
 * Every data surface renders one of four states. Keeping them in one place is what stops a screen from showing an
 * empty table when the real answer is "you are not allowed to see this" or "the server is unreachable" -
 * "could not load" is never drawn as "none".
 */
export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <Center py="xl" data-testid="state-loading" role="status" aria-live="polite">
      <Stack align="center" gap="xs">
        <Loader size="sm" color="forest" />
        <Text size="sm" c="dimmed">
          {label}
        </Text>
      </Stack>
    </Center>
  );
}

export function EmptyBlock({
  title = 'Nothing here yet',
  body,
  filtered = false,
  action,
}: {
  title?: string;
  body?: string;
  /** The list is empty because of the search or filters, not because there is nothing. */
  filtered?: boolean;
  action?: ReactNode;
}) {
  const Icon = filtered ? IconSearchOff : IconInbox;
  return (
    <Center py="xl" data-testid="state-empty">
      <Stack align="center" gap={6} maw={440} ta="center">
        <Icon size={28} opacity={0.6} aria-hidden />
        <Text fw={600}>{filtered ? 'No matches' : title}</Text>
        <Text size="sm" c="dimmed">
          {filtered ? 'Nothing matches the search or filters. Clear them to see everything.' : body}
        </Text>
        {action}
      </Stack>
    </Center>
  );
}

/** The endpoint this screen needs is not on the server yet: said plainly instead of pretending it is empty. */
export function NotAvailableBlock({ what, detail }: { what: string; detail?: string }) {
  return (
    <Alert variant="light" color="slate" icon={<IconCloudOff size={18} />} title={`${what} isn’t available on this server yet`} data-testid="state-unavailable">
      <Text size="sm">
        {detail ?? 'The API does not offer this yet. It will appear here as soon as the backend ships it - nothing has been hidden.'}
      </Text>
    </Alert>
  );
}

export function ForbiddenBlock({ body }: { body?: string }) {
  return (
    <Alert variant="light" color="gray" icon={<IconLock size={18} />} title="Your roles don’t include this" data-testid="state-forbidden">
      <Text size="sm">{body ?? 'Ask a Super Admin to grant the role this work needs. Nothing on this page has been changed.'}</Text>
    </Alert>
  );
}

export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiError = error instanceof ApiError ? error : null;

  if (apiError?.isOffline) {
    return (
      <Alert variant="light" color="amber" icon={<IconCloudOff size={18} />} title="Can’t reach the server" data-testid="state-offline">
        <Stack gap="sm" align="flex-start">
          <Text size="sm">Check your connection. Nothing was changed.</Text>
          {onRetry && (
            <Button size="xs" variant="light" color="amber" leftSection={<IconRefresh size={14} />} onClick={onRetry}>
              Try again
            </Button>
          )}
        </Stack>
      </Alert>
    );
  }

  if (apiError?.isForbidden) return <ForbiddenBlock />;

  return (
    <Alert variant="light" color="signal" icon={<IconAlertTriangle size={18} />} title="Couldn’t load this" data-testid="state-error">
      <Stack gap="sm" align="flex-start">
        <Text size="sm">{apiError?.message ?? (error instanceof Error ? error.message : String(error))}</Text>
        {apiError?.correlationId && (
          <Text size="xs" c="dimmed">
            Reference <Code>{apiError.correlationId}</Code>
          </Text>
        )}
        {onRetry && (
          <Button size="xs" variant="light" color="signal" leftSection={<IconRefresh size={14} />} onClick={onRetry}>
            Try again
          </Button>
        )}
      </Stack>
    </Alert>
  );
}

/** A titled card with the accent rule, as Voyager's section cards. */
export function SectionCard({
  title,
  description,
  action,
  children,
  padding,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  padding?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 0;
}) {
  return (
    <Card padding={padding ?? 'lg'}>
      <Group justify="space-between" align="flex-start" mb="md" wrap="wrap" gap="sm" px={padding === 0 ? 'lg' : 0} pt={padding === 0 ? 'lg' : 0}>
        <Group gap={10} align="center" wrap="nowrap">
          <Box aria-hidden w={3} h={17} style={{ borderRadius: 3, background: accentRail, flexShrink: 0 }} />
          <div>
            <Title order={3} style={{ letterSpacing: '-0.01em' }}>
              {title}
            </Title>
            {description && (
              <Text size="sm" c="dimmed" mt={4}>
                {description}
              </Text>
            )}
          </div>
        </Group>
        {action}
      </Group>
      {children}
    </Card>
  );
}
