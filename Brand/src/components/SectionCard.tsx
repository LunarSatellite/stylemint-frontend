import type { ReactNode } from 'react';
import { Box, Card, Group, Text, Title } from '@mantine/core';
import { accentRail } from '../theme';

export function SectionCard({
  title,
  description,
  action,
  children,
  id,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  id?: string;
}) {
  return (
    <Card id={id}>
      <Group justify="space-between" align="flex-start" mb="md" wrap="wrap" gap="sm">
        <Group gap={10} align="center" wrap="nowrap" style={{ minWidth: 0 }}>
          <Box aria-hidden w={3} h={17} style={{ borderRadius: 3, background: accentRail, flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <Title order={3} style={{ letterSpacing: '-0.01em' }}>
              {title}
            </Title>
            {description && (
              <Text size="sm" c="dimmed" mt={2}>
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
