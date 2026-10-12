import type { ReactNode } from 'react';
import { ActionIcon, Badge, Box, CopyButton, Group, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { IconCheck, IconCopy } from '@tabler/icons-react';
import { fmtDateTime, fmtIso, fmtRelative, humanize, shortId } from '@/lib/format';
import { surfaces } from '@/theme';

const GOOD = /(approved|active|verified|completed|complete|delivered|paid|released|resolved|passed|enabled|live|published|succeeded|success|healthy|reinstated|refunded|closed_won|ok)$/i;
const BAD = /(rejected|failed|failure|suspended|disabled|cancel+ed|banned|removed|blocked|declined|fraud|lost|expired|revoked|error|breach|critical|deleted|hidden)$/i;
const WAIT = /(pending|review|waiting|queued|submitted|held|hold|on_?hold|in_?progress|processing|open|new|draft|assigned|escalated|requested|awaiting|scheduled|stuck|due|partial)/i;

export function toneOf(status: string | null | undefined): string {
  if (!status) return 'gray';
  const s = String(status);
  if (BAD.test(s)) return 'signal';
  if (GOOD.test(s)) return 'forest';
  if (WAIT.test(s)) return 'amber';
  return 'slate';
}

/** A status, coloured by meaning: green done, amber waiting, red negative, grey anything else. */
export function StatusBadge({ value, color, size = 'sm' }: { value: string | number | null | undefined; color?: string; size?: 'xs' | 'sm' | 'md' }) {
  if (value === null || value === undefined || value === '') return <Text c="dimmed">—</Text>;
  return (
    <Badge variant="light" color={color ?? toneOf(String(value))} size={size}>
      {humanize(value)}
    </Badge>
  );
}

/** A date with the exact UTC instant on hover; relative ("3 hours ago") when that is what matters. */
export function When({ value, relative = false }: { value: string | null | undefined; relative?: boolean }) {
  if (!value) return <Text span c="dimmed">—</Text>;
  return (
    <Tooltip label={fmtIso(value) ?? ''}>
      <Text span size="sm" style={{ whiteSpace: 'nowrap' }}>
        <time dateTime={fmtIso(value)}>{relative ? fmtRelative(value) : fmtDateTime(value)}</time>
      </Text>
    </Tooltip>
  );
}

/** An id, shortened, with a copy button for pasting into a ticket. */
export function IdText({ value, full = false }: { value: string | null | undefined; full?: boolean }) {
  if (!value) return <Text span c="dimmed">—</Text>;
  return (
    <Group gap={4} wrap="nowrap" component="span" style={{ display: 'inline-flex' }}>
      <Text span className="sm-mono" title={value}>
        {full ? value : shortId(value)}
      </Text>
      <CopyButton value={value} timeout={1500}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? 'Copied' : 'Copy'}>
            <ActionIcon
              size="xs"
              variant="subtle"
              color={copied ? 'forest' : 'slate'}
              onClick={(e) => {
                e.stopPropagation();
                copy();
              }}
              aria-label={`Copy ${value}`}
            >
              {copied ? <IconCheck size={12} /> : <IconCopy size={12} />}
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}

export interface Field {
  label: string;
  value: ReactNode;
  /** Spans the full row. */
  wide?: boolean;
}

/** Label / value pairs for detail panes. Empty values read as an em dash, never as a blank. */
export function FieldGrid({ fields, cols = 2 }: { fields: Field[]; cols?: number }) {
  return (
    <SimpleGrid cols={{ base: 1, xs: Math.min(cols, 2), md: cols }} spacing="md" verticalSpacing="sm" component="dl" m={0}>
      {fields.map((f) => (
        <Box key={f.label} style={f.wide ? { gridColumn: '1 / -1' } : undefined}>
          <Text component="dt" size="xs" c={surfaces.textMuted} fw={600} tt="uppercase" style={{ letterSpacing: '0.05em' }}>
            {f.label}
          </Text>
          <Text component="dd" size="sm" m={0} mt={2} style={{ overflowWrap: 'anywhere' }}>
            {f.value === null || f.value === undefined || f.value === '' ? <Text span c="dimmed">—</Text> : f.value}
          </Text>
        </Box>
      ))}
    </SimpleGrid>
  );
}

/** Two lines in a table cell: the primary text and a dimmed secondary line. */
export function TwoLine({ primary, secondary }: { primary: ReactNode; secondary?: ReactNode }) {
  return (
    <Stack gap={0}>
      <Text size="sm" fw={600} lineClamp={1}>
        {primary}
      </Text>
      {secondary && (
        <Text size="xs" c="dimmed" lineClamp={1}>
          {secondary}
        </Text>
      )}
    </Stack>
  );
}

export function YesNo({ value }: { value: boolean | null | undefined }) {
  if (value === null || value === undefined) return <Text span c="dimmed">—</Text>;
  return (
    <Badge variant="dot" color={value ? 'forest' : 'gray'} size="sm">
      {value ? 'Yes' : 'No'}
    </Badge>
  );
}
