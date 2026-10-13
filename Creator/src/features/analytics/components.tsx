import { useState } from 'react';
import { Alert, Badge, Group, Select, Stack, Text } from '@mantine/core';
import { DatePickerInput, type DatesRangeValue } from '@mantine/dates';
import { IconArrowDownRight, IconArrowUpRight } from '@tabler/icons-react';
import { checkWindow, RANGE_PRESETS, windowFor, type WindowQuery } from './api';

/** "+12.5%" / "−3%" badge for a KPI delta that is already a percentage. Null → nothing to compare with. */
export function DeltaBadge({ value }: { value: number | null | undefined }) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return (
      <Text size="xs" c="dimmed">
        no earlier data
      </Text>
    );
  }
  const up = value >= 0;
  return (
    <Badge
      size="sm"
      variant="light"
      color={up ? 'forest' : 'signal'}
      leftSection={up ? <IconArrowUpRight size={12} /> : <IconArrowDownRight size={12} />}
      aria-label={`${up ? 'Up' : 'Down'} ${Math.abs(value).toFixed(1)} percent on the previous period`}
    >
      {Math.abs(value).toFixed(1)}%
    </Badge>
  );
}

export interface RangeState {
  preset: string;
  window: WindowQuery;
}

export function useRange(initialDays = 30): [RangeState, (next: RangeState) => void] {
  // The window is computed once per choice (not per render) so the query key stays stable.
  const [state, setState] = useState<RangeState>(() => ({ preset: String(initialDays), window: windowFor(initialDays) }));
  return [state, setState];
}

/** Preset ranges plus a custom date range (max 365 days, checked before the request is made). */
export function RangePicker({ value, onChange }: { value: RangeState; onChange: (next: RangeState) => void }) {
  const [custom, setCustom] = useState<DatesRangeValue>([null, null]);
  const [error, setError] = useState<string | null>(null);
  return (
    <Stack gap={6}>
      <Group gap="sm" wrap="wrap" align="flex-end">
        <Select
          label="Period"
          w={180}
          data={RANGE_PRESETS.map((p) => ({ value: p.value, label: p.label }))}
          value={value.preset}
          allowDeselect={false}
          onChange={(v) => {
            if (!v) return;
            setError(null);
            if (v === 'custom') onChange({ ...value, preset: 'custom' });
            else onChange({ preset: v, window: windowFor(Number(v)) });
          }}
        />
        {value.preset === 'custom' && (
          <DatePickerInput
            type="range"
            label="Dates"
            placeholder="Pick dates"
            value={custom}
            maxDate={new Date()}
            w={260}
            onChange={(range) => {
              setCustom(range);
              const [from, to] = range;
              if (!from || !to) return;
              const end = new Date(to);
              end.setHours(23, 59, 59, 999);
              const problem = checkWindow(from, end);
              setError(problem);
              if (!problem) onChange({ preset: 'custom', window: { fromUtc: from.toISOString(), toUtc: end.toISOString() } });
            }}
          />
        )}
      </Group>
      {error && (
        <Alert color="signal" variant="light" py={6} role="alert">
          {error}
        </Alert>
      )}
    </Stack>
  );
}
