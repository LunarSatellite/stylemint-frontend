import type { ReactNode } from 'react';
import { Box, Drawer, Group, ScrollArea, Stack, Text, Title } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import { accentRail } from '@/theme';

/**
 * The detail half of the list/detail pattern: a right-hand drawer over the list, full width on a phone. The list
 * keeps its page and filters underneath, and the open item is in the address (`?open=<id>`), so it survives a reload
 * and can be shared.
 */
export function DetailDrawer({
  opened,
  onClose,
  title,
  subtitle,
  badges,
  actions,
  children,
  size = 'xl',
}: {
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  /** Buttons for the item, pinned at the top. */
  actions?: ReactNode;
  children: ReactNode;
  size?: 'md' | 'lg' | 'xl' | string;
}) {
  const narrow = useMediaQuery('(max-width: 48em)');
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      position="right"
      size={narrow ? '100%' : size === 'xl' ? 'min(900px, 92vw)' : size}
      scrollAreaComponent={ScrollArea.Autosize}
      title={
        <Group gap={12} wrap="nowrap" align="flex-start">
          <Box aria-hidden w={3} h={30} mt={2} style={{ borderRadius: 3, background: accentRail, flexShrink: 0 }} />
          <Stack gap={2}>
            <Title order={2} fz="lg" style={{ overflowWrap: 'anywhere' }}>
              {title}
            </Title>
            {subtitle && (
              <Text size="sm" c="dimmed">
                {subtitle}
              </Text>
            )}
            {badges && (
              <Group gap={6} mt={4}>
                {badges}
              </Group>
            )}
          </Stack>
        </Group>
      }
      styles={{ header: { alignItems: 'flex-start', borderBottom: '1px solid var(--sm-border)' }, body: { paddingTop: 16 } }}
    >
      <Stack gap="lg">
        {actions && (
          <Group gap="sm" wrap="wrap">
            {actions}
          </Group>
        )}
        {children}
      </Stack>
    </Drawer>
  );
}
