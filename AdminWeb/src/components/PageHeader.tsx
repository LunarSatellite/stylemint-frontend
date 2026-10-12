import { useEffect, type ReactNode } from 'react';
import { Anchor, Box, Breadcrumbs, Group, Stack, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';
import { accentRail, surfaces } from '@/theme';

export const PRODUCT_TITLE = 'StyleMint Admin';

/** Names the browser tab after the page, so a screen reader announces where navigation landed. */
export function useDocumentTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const before = document.title;
    document.title = `${title} - ${PRODUCT_TITLE}`;
    return () => {
      document.title = before;
    };
  }, [title]);
}

export interface Crumb {
  label: string;
  to?: string;
}

/** The top of every screen: accent rule, title, a line of description, and the page's actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  meta,
  crumbs,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  meta?: ReactNode;
  crumbs?: Crumb[];
}) {
  useDocumentTitle(title);
  return (
    <Stack gap="xs" mb="lg">
      {crumbs && crumbs.length > 0 && (
        <Breadcrumbs separatorMargin={6} aria-label="Breadcrumb" fz="sm">
          {crumbs.map((c) =>
            c.to ? (
              <Anchor key={c.label} component={Link} to={c.to} size="sm" c="dimmed">
                {c.label}
              </Anchor>
            ) : (
              <Text key={c.label} size="sm" c="dimmed">
                {c.label}
              </Text>
            ),
          )}
        </Breadcrumbs>
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
