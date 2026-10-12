import type { ReactNode } from 'react';
import { Box, Card, Group, Skeleton, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { surfaces } from '@/theme';

type TileTone = 'forest' | 'amber' | 'signal' | 'gray';

const rails: Record<TileTone, string> = {
  forest: 'linear-gradient(180deg, #6fc2a0, #159a6a)',
  amber: 'linear-gradient(180deg, #ffd65c, #e3a600)',
  signal: 'linear-gradient(180deg, #ff7a6d, #de1f0e)',
  gray: 'linear-gradient(180deg, #769287, #43665b)',
};

/** A KPI: a rail, a quiet uppercase label and one large number. Links when there is somewhere to go. */
export function MetricTile({
  label,
  value,
  hint,
  tone = 'forest',
  to,
  loading,
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: TileTone;
  to?: string;
  loading?: boolean;
  icon?: ReactNode;
}) {
  const inner = (
    <>
      <Box aria-hidden style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: '0 3px 3px 0', background: rails[tone] }} />
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" gap="xs">
          <Text size="xs" tt="uppercase" fw={700} c={surfaces.textMuted} lh={1.3} style={{ letterSpacing: '0.06em' }}>
            {label}
          </Text>
          {icon && <Box c={surfaces.textMuted}>{icon}</Box>}
        </Group>
        {loading ? (
          <Skeleton height={30} width="60%" radius="sm" />
        ) : (
          <Text fz={28} fw={700} lh={1.1} style={{ letterSpacing: '-0.02em' }}>
            {value}
          </Text>
        )}
        {hint && (
          <Text size="xs" c="dimmed">
            {hint}
          </Text>
        )}
      </Stack>
    </>
  );
  if (to) {
    return (
      <Card padding="md" pl="lg" component={Link} to={to} data-interactive="true" style={{ position: 'relative', overflow: 'hidden', textDecoration: 'none', color: 'inherit' }} aria-label={`${label}: open`}>
        {inner}
      </Card>
    );
  }
  return (
    <Card padding="md" pl="lg" style={{ position: 'relative', overflow: 'hidden' }}>
      {inner}
    </Card>
  );
}
