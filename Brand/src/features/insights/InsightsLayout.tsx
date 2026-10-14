import { Suspense, useMemo, useState } from 'react';
import { Box, Group, ScrollArea, Select, Switch, Text } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconCalendar } from '@tabler/icons-react';
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { ListSkeleton } from '../../components/StateBlocks';
import { RangeContext } from './components';
import { formatPeriod, MAX_DAYS, PRESETS, rangeFromSearch, searchFor, type InsightsRange, type PresetKey } from './period';
import { INSIGHTS_SECTIONS, RANGE_STORAGE_KEY } from './sections';

const RANGE_PARAMS = ['range', 'from', 'to', 'compare'];

function readStored(): string {
  try {
    return sessionStorage.getItem(RANGE_STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function store(search: string) {
  try {
    sessionStorage.setItem(RANGE_STORAGE_KEY, search);
  } catch {
    /* private mode: the range just is not remembered */
  }
}

/**
 * The selected range lives in the URL (shareable, survives reload). Opening a section from the
 * sidebar (no range in the URL) reuses the range picked last in this tab.
 */
function useInsightsRange(): [InsightsRange, string, (next: URLSearchParams) => void] {
  const [params, setParams] = useSearchParams();
  const hasRange = RANGE_PARAMS.some((k) => params.has(k));
  const search = hasRange ? params.toString() : readStored();
  // `now` is fixed per range choice, so query keys and periods stay stable between renders.
  const range = useMemo(() => rangeFromSearch(new URLSearchParams(search)), [search]);
  const set = (next: URLSearchParams) => {
    store(next.toString());
    setParams(next, { replace: true });
  };
  return [range, search, set];
}

function RangeControls({ range, onChange }: { range: InsightsRange; onChange: (p: URLSearchParams) => void }) {
  const lastDay = new Date(range.current.to.getTime() - 1);
  const [draft, setDraft] = useState<[Date | null, Date | null]>([range.current.from, lastDay]);
  const minDate = new Date(Date.now() - MAX_DAYS * 86_400_000);

  return (
    <Group gap="sm" wrap="wrap" align="flex-end">
      <Select
        aria-label="Date range"
        size="sm"
        w={170}
        leftSection={<IconCalendar size={15} />}
        data={PRESETS}
        value={range.preset}
        allowDeselect={false}
        comboboxProps={{ withinPortal: true }}
        onChange={(v) => {
          const preset = (v ?? '30d') as PresetKey;
          if (preset === 'custom') {
            onChange(searchFor({ preset, from: range.current.from, to: lastDay, compare: range.compare }));
          } else {
            onChange(searchFor({ preset, compare: range.compare }));
          }
        }}
      />
      {range.preset === 'custom' && (
        <DatePickerInput
          type="range"
          aria-label="Custom dates"
          size="sm"
          w={240}
          value={draft}
          maxDate={new Date()}
          minDate={minDate}
          valueFormat="D MMM YYYY"
          allowSingleDateInRange
          onChange={(v) => {
            setDraft(v);
            if (v[0] && v[1]) onChange(searchFor({ preset: 'custom', from: v[0], to: v[1], compare: range.compare }));
          }}
        />
      )}
      <Switch
        size="sm"
        label="Compare to previous period"
        checked={range.compare}
        onChange={(e) => {
          const compare = e.currentTarget.checked;
          onChange(
            range.preset === 'custom'
              ? searchFor({ preset: 'custom', from: range.current.from, to: lastDay, compare })
              : searchFor({ preset: range.preset, compare }),
          );
        }}
        styles={{ body: { alignItems: 'center' } }}
        mb={6}
      />
    </Group>
  );
}

function SectionChips({ search }: { search: string }) {
  return (
    <Box hiddenFrom="sm" mb="md">
      <ScrollArea type="never">
        <Box component="nav" aria-label="Insights sections">
          <Group gap={6} wrap="nowrap">
            {INSIGHTS_SECTIONS.map((s) => (
              <NavLink key={s.key} to={{ pathname: s.to, search: search ? `?${search}` : '' }} className="sm-crm-chip">
                {s.short}
              </NavLink>
            ))}
          </Group>
        </Box>
      </ScrollArea>
    </Box>
  );
}

export default function InsightsLayout() {
  const location = useLocation();
  const [range, search, setRange] = useInsightsRange();
  const section = INSIGHTS_SECTIONS.find((s) => location.pathname.startsWith(s.to)) ?? INSIGHTS_SECTIONS[0];

  return (
    <RangeContext.Provider value={range}>
      <PageHeader
        title={section.label}
        description={section.description}
        meta={
          <Text size="xs" c="dimmed" data-testid="range-caption">
            {formatPeriod(range.current)}
            {range.compare ? ` · compared with ${formatPeriod(range.previous)}` : ''}
          </Text>
        }
        actions={<RangeControls key={search} range={range} onChange={setRange} />}
      />
      <SectionChips search={search} />
      <Suspense fallback={<ListSkeleton rows={4} height={90} />}>
        <Outlet />
      </Suspense>
    </RangeContext.Provider>
  );
}
