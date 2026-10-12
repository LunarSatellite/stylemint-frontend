import { useEffect, type ReactNode } from 'react';
import { Anchor, Box, Group, Stack, Text, Title } from '@mantine/core';
import { IconChevronLeft } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { accentRail, surfaces } from '../theme';

export const PRODUCT_TITLE = 'StyleMint Seller Center';

export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    document.title = `${title} · ${PRODUCT_TITLE}`;
    return () => {
      document.title = PRODUCT_TITLE;
    };
  }, [title]);
}

/** The top of every page: accent rail, title, optional description, actions that wrap on a phone. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  back?: { to: string; label: string };
}) {
  useDocumentTitle(title);
  return (
    <Stack gap={6} mb="lg">
      {back && (
        <Anchor
          component={Link}
          to={back.to}
          size="sm"
          c="dimmed"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 2, alignSelf: 'flex-start' }}
        >
          <IconChevronLeft size={16} aria-hidden /> {back.label}
        </Anchor>
      )}
      <Group justify="space-between" align="flex-end" wrap="wrap" gap="md">
        <Group gap={14} align="flex-start" wrap="nowrap" style={{ minWidth: 0 }}>
          <Box aria-hidden w={4} mt={6} h={34} style={{ borderRadius: 4, background: accentRail, flexShrink: 0 }} />
          <Stack gap={4} style={{ minWidth: 0 }}>
            <Title order={1} style={{ letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>
              {title}
            </Title>
            {description && (
              <Text size="sm" c={surfaces.textMuted} maw={680}>
                {description}
              </Text>
            )}
            {meta}
          </Stack>
        </Group>
        {actions && (
          <Group gap="sm" wrap="wrap">
            {actions}
          </Group>
        )}
      </Group>
    </Stack>
  );
}
