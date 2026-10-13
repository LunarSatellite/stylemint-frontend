import type { ReactNode } from 'react';
import { Box, Card, Group, Skeleton, Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { surfaces } from '../theme';

export type Tone = 'forest' | 'amber' | 'signal' | 'gray';

const rails: Record<Tone, string> = {
  forest: 'linear-gradient(180deg, #6fc2a0, #159a6a)',
  amber: 'linear-gradient(180deg, #ffd65c, #e3a600)',
  signal: 'linear-gradient(180deg, #ff7a6d, #de1f0e)',
  gray: 'linear-gradient(180deg, #769287, #43665b)',
};

/** A headline number with a tone rail — the Voyager CX tile, simplified. Links when `to` is given. */
export function KpiTile({
  label,
  value,
  hint,
  tone = 'forest',
  to,
  loading,
  right,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  to?: string;
  loading?: boolean;
  right?: ReactNode;
}) {
  const body = (
    <Card
      padding="md"
      pl="lg"
      data-interactive={to ? 'true' : undefined}
      style={{ position: 'relative', overflow: 'hidden', height: '100%' }}
    >
      <Box
        aria-hidden
        style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: '0 3px 3px 0', background: rails[tone] }}
      />
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start" mih={20}>
          <Text size="xs" tt="uppercase" fw={700} c={surfaces.textMuted} lh={1.3} style={{ letterSpacing: '0.06em' }}>
            {label}
          </Text>
          {right}
        </Group>
        {loading ? (
          <Skeleton height={30} width="60%" />
        ) : (
          <Text fz={28} fw={700} lh={1.05} style={{ letterSpacing: '-0.02em' }}>
            {value}
          </Text>
        )}
        {hint && (
          <Text size="xs" c={surfaces.textMuted}>
            {hint}
          </Text>
        )}
      </Stack>
    </Card>
  );
  return to ? (
    <Link to={to} style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
      {body}
    </Link>
  ) : (
    body
  );
}
