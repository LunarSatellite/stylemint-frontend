import { createContext, lazy, Suspense, useContext, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { Alert, Badge, Box, Button, Card, Group, SimpleGrid, Skeleton, Stack, Table, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconArrowDown, IconArrowUp, IconArrowsSort, IconClockHour4, IconDownload } from '@tabler/icons-react';
import { isMissingEndpoint } from '../../api/client';
import { KpiTile, type Tone } from '../../components/KpiTile';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { useIsPhone } from '../../lib/useIsPhone';
import { csvFileName, downloadCsv, toCsv, type CsvValue } from './csv';
import type { KpiSpec } from './model';
import { isoDay, type InsightsRange } from './period';

// ------------------------------------------------------------------ range context

export const RangeContext = createContext<InsightsRange | null>(null);

export function useRange(): InsightsRange {
  const r = useContext(RangeContext);
  if (!r) throw new Error('useRange outside the Insights layout');
  return r;
}

/** A stable query-key part for the selected range (days, not milliseconds, so it does not change every render). */
export function rangeKey(r: InsightsRange): string {
  return `${r.preset}|${isoDay(r.current.from)}|${isoDay(r.current.to)}`;
}

// ------------------------------------------------------------------ lazy charts

const LazyTrend = lazy(() => import('./charts').then((m) => ({ default: m.TrendChart })));
const LazyBars = lazy(() => import('./charts').then((m) => ({ default: m.BarsChart })));
const LazyDonut = lazy(() => import('./charts').then((m) => ({ default: m.ShareDonut })));

function ChartSkeleton({ height }: { height: number }) {
  return <Skeleton height={height} radius="md" data-testid="chart-loading" />;
}

type TrendProps = ComponentProps<typeof LazyTrend>;
type BarsProps = ComponentProps<typeof LazyBars>;
type DonutProps = ComponentProps<typeof LazyDonut>;

export function TrendChart(props: TrendProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height ?? 240} />}>
      <LazyTrend {...props} />
    </Suspense>
  );
}

export function BarsChart(props: BarsProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={props.height ?? 220} />}>
      <LazyBars {...props} />
    </Suspense>
  );
}

export function ShareDonut(props: DonutProps) {
  return (
    <Suspense fallback={<ChartSkeleton height={150} />}>
      <LazyDonut {...props} />
    </Suspense>
  );
}

// ------------------------------------------------------------------ deltas and tiles

/**
 * "+12%" / "-4%" / "+1.2 pts" / "new". `invert` for numbers where down is good (returns, refunds).
 */
export function DeltaBadge({
  value,
  unit = 'percent',
  invert = false,
  isNew = false,
}: {
  value: number | null | undefined;
  unit?: 'percent' | 'points';
  invert?: boolean;
  isNew?: boolean;
}) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return isNew ? (
      <Badge size="sm" variant="light" color="blue" data-testid="delta">
        new
      </Badge>
    ) : null;
  }
  const flat = Math.abs(value) < (unit === 'points' ? 0.05 : 0.5);
  const good = invert ? value < 0 : value > 0;
  const text =
    unit === 'points'
      ? `${value > 0 ? '+' : ''}${value.toFixed(1)} pts`
      : `${value > 0 ? '+' : ''}${Math.abs(value) >= 100 ? value.toFixed(0) : value.toFixed(Math.abs(value) < 10 ? 1 : 0)}%`;
  return (
    <Badge size="sm" variant="light" color={flat ? 'gray' : good ? 'forest' : 'signal'} data-testid="delta">
      {flat ? '±0%' : text}
    </Badge>
  );
}

/** A KPI tile with the change against the previous period (when comparing). */
export function MetricTile({
  label,
  value,
  previous,
  delta,
  unit = 'percent',
  invert,
  isNew,
  hint,
  tone,
  loading,
  error,
  compare = true,
}: {
  label: string;
  value: ReactNode;
  previous?: ReactNode;
  delta?: number | null;
  unit?: 'percent' | 'points';
  invert?: boolean;
  isNew?: boolean;
  hint?: ReactNode;
  tone?: Tone;
  loading?: boolean;
  error?: boolean;
  compare?: boolean;
}) {
  return (
    <KpiTile
      label={label}
      value={error ? '—' : value}
      loading={loading}
      tone={tone}
      right={compare && !error ? <DeltaBadge value={delta} unit={unit} invert={invert} isNew={isNew} /> : undefined}
      hint={
        error ? (
          'Could not load'
        ) : compare && previous !== undefined ? (
          <>
            Previous: {previous}
            {hint ? <> · {hint}</> : null}
          </>
        ) : (
          hint
        )
      }
    />
  );
}

// ------------------------------------------------------------------ widget states

/** Shown when the endpoint is not deployed yet (404 with no error code) — not an error, not "empty". */
export function NotYetBlock({ what }: { what: string }) {
  return (
    <Alert variant="light" color="gray" icon={<IconClockHour4 size={18} />} title="Coming soon" data-testid="state-not-yet">
      <Text size="sm">{what} will appear here as soon as StyleMint switches this report on for your shop.</Text>
    </Alert>
  );
}

interface QueryLike<T> {
  isPending: boolean;
  error: unknown;
  data: T | undefined;
  refetch: () => unknown;
}

/**
 * One independent block of Insights: its own loading skeleton, "could not load" with retry,
 * "coming soon" for an endpoint that is not live yet, and an empty state only when the server
 * answered with nothing.
 */
export function Widget<T>({
  title,
  description,
  action,
  query,
  isEmpty,
  empty,
  notYet,
  skeleton,
  children,
  testId,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  query: QueryLike<T>;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  /** What the report shows, for the "coming soon" text. Defaults to the title. */
  notYet?: string;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
  testId?: string;
}) {
  let body: ReactNode;
  if (query.isPending) body = skeleton ?? <ListSkeleton rows={3} height={44} />;
  else if (query.error && isMissingEndpoint(query.error)) body = <NotYetBlock what={notYet ?? (typeof title === 'string' ? title : 'This report')} />;
  else if (query.error || query.data === undefined)
    body = <ErrorBlock error={query.error ?? new Error('No data')} title="Could not load this" onRetry={() => void query.refetch()} />;
  else if (isEmpty?.(query.data)) body = empty ?? <EmptyBlock title="Nothing in this period" />;
  else body = children(query.data);
  return (
    <Box data-testid={testId}>
      <SectionCard title={title} description={description} action={action}>
        {body}
      </SectionCard>
    </Box>
  );
}

// ------------------------------------------------------------------ sortable table / phone cards

export interface Column<T> {
  key: string;
  header: string;
  /** Cell content; defaults to the sort value. */
  render?: (row: T) => ReactNode;
  /** Sort key; columns without one are not sortable. */
  sortValue?: (row: T) => number | string | null | undefined;
  /** CSV cell; defaults to the sort value. `false` leaves the column out of the CSV. */
  csv?: ((row: T) => CsvValue) | false;
  align?: 'left' | 'right';
  /** Hidden on the phone card (kept in the table and the CSV). */
  hideOnPhone?: boolean;
}

function compareValues(a: unknown, b: unknown): number {
  const an = a === null || a === undefined || a === '';
  const bn = b === null || b === undefined || b === '';
  if (an && bn) return 0;
  if (an) return 1;
  if (bn) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export function sortRows<T>(rows: readonly T[], column: Column<T> | undefined, dir: 'asc' | 'desc'): T[] {
  if (!column?.sortValue) return [...rows];
  const sv = column.sortValue;
  const sorted = [...rows].sort((x, y) => compareValues(sv(x), sv(y)));
  if (dir === 'desc') {
    // Keep missing values last in both directions.
    const present = sorted.filter((r) => {
      const v = sv(r);
      return !(v === null || v === undefined || v === '');
    });
    const missing = sorted.slice(present.length);
    return [...present.reverse(), ...missing];
  }
  return sorted;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  exportName,
  initialSort,
  pageSize = 10,
  minWidth = 640,
  caption,
}: {
  rows: readonly T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Title for the CSV file; the export button shows when given. */
  exportName?: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
  pageSize?: number;
  minWidth?: number;
  caption?: string;
}) {
  const phone = useIsPhone();
  const range = useContext(RangeContext);
  const [sort, setSort] = useState(initialSort ?? null);
  const [showAll, setShowAll] = useState(false);
  const sortColumn = columns.find((c) => c.key === sort?.key);
  const sorted = useMemo(() => sortRows(rows, sortColumn, sort?.dir ?? 'desc'), [rows, sortColumn, sort?.dir]);
  const visible = showAll ? sorted : sorted.slice(0, pageSize);

  const toggle = (key: string) =>
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'desc' ? 'asc' : 'desc' } : { key, dir: 'desc' }));

  const exportCsv = () => {
    const cols = columns
      .filter((c) => c.csv !== false)
      .map((c) => ({
        header: c.header,
        value: (row: T): CsvValue => {
          if (typeof c.csv === 'function') return c.csv(row);
          const v = c.sortValue?.(row);
          return v === undefined ? null : v;
        },
      }));
    const name = csvFileName(exportName ?? 'export', range ? isoDay(range.current.from) : undefined, range ? isoDay(range.current.to) : undefined);
    downloadCsv(name, toCsv(cols, sorted));
  };

  const cell = (c: Column<T>, row: T): ReactNode => {
    if (c.render) return c.render(row);
    const v = c.sortValue?.(row);
    return v === null || v === undefined || v === '' ? '—' : String(v);
  };

  const toolbar = (
    <Group justify="space-between" mb="xs" gap="xs">
      <Text size="xs" c="dimmed">
        {rows.length} {rows.length === 1 ? 'row' : 'rows'}
        {sortColumn ? ` · sorted by ${sortColumn.header.toLowerCase()}` : ''}
      </Text>
      {exportName && (
        <Button size="compact-xs" variant="subtle" color="slate" leftSection={<IconDownload size={13} />} onClick={exportCsv}>
          Export CSV
        </Button>
      )}
    </Group>
  );

  const more =
    sorted.length > pageSize ? (
      <Group justify="center" mt="sm">
        <Button size="xs" variant="subtle" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show fewer' : `Show all ${sorted.length}`}
        </Button>
      </Group>
    ) : null;

  if (phone) {
    const [first, ...rest] = columns;
    const sortable = columns.filter((c) => c.sortValue);
    return (
      <div>
        {toolbar}
        {sortable.length > 1 && (
          <Group gap={6} mb="xs" wrap="wrap" aria-label="Sort by">
            {sortable.map((c) => (
              <Button
                key={c.key}
                size="compact-xs"
                variant={sort?.key === c.key ? 'light' : 'default'}
                onClick={() => toggle(c.key)}
                rightSection={sort?.key === c.key ? sort.dir === 'desc' ? <IconArrowDown size={12} /> : <IconArrowUp size={12} /> : null}
              >
                {c.header}
              </Button>
            ))}
          </Group>
        )}
        <Stack gap="xs" data-testid="insights-cards">
          {visible.map((row) => (
            <Card key={rowKey(row)} padding="sm" withBorder>
              <Text fw={600} size="sm" mb={4} style={{ overflowWrap: 'anywhere' }}>
                {cell(first, row)}
              </Text>
              <Stack gap={2}>
                {rest
                  .filter((c) => !c.hideOnPhone)
                  .map((c) => (
                    <Group key={c.key} justify="space-between" gap="xs" wrap="nowrap">
                      <Text size="xs" c="dimmed">
                        {c.header}
                      </Text>
                      <Box ta="right" style={{ fontSize: 'var(--mantine-font-size-sm)', minWidth: 0 }}>
                        {cell(c, row)}
                      </Box>
                    </Group>
                  ))}
              </Stack>
            </Card>
          ))}
        </Stack>
        {more}
      </div>
    );
  }

  return (
    <div>
      {toolbar}
      <Table.ScrollContainer minWidth={minWidth}>
        <Table highlightOnHover verticalSpacing="xs" horizontalSpacing="sm" data-testid="insights-table">
          {caption && <caption className="sr-only">{caption}</caption>}
          <Table.Thead>
            <Table.Tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                const ariaSort = active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : c.sortValue ? 'none' : undefined;
                return (
                  <Table.Th key={c.key} ta={c.align} aria-sort={ariaSort}>
                    {c.sortValue ? (
                      <Tooltip label="Sort" openDelay={600}>
                        <UnstyledButton
                          onClick={() => toggle(c.key)}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 650, fontSize: 'inherit' }}
                        >
                          {c.header}
                          {active ? (
                            sort!.dir === 'desc' ? (
                              <IconArrowDown size={13} aria-hidden />
                            ) : (
                              <IconArrowUp size={13} aria-hidden />
                            )
                          ) : (
                            <IconArrowsSort size={13} opacity={0.4} aria-hidden />
                          )}
                        </UnstyledButton>
                      </Tooltip>
                    ) : (
                      c.header
                    )}
                  </Table.Th>
                );
              })}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {visible.map((row) => (
              <Table.Tr key={rowKey(row)}>
                {columns.map((c) => (
                  <Table.Td key={c.key} ta={c.align}>
                    {cell(c, row)}
                  </Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      {more}
    </div>
  );
}

/** A small label + value pair used inside widgets. */
export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={700} size="lg" lh={1.3}>
        {value}
      </Text>
      {hint && (
        <Text size="xs" c="dimmed">
          {hint}
        </Text>
      )}
    </div>
  );
}

/** "3.4%" from a fraction or a percent value. */
export function formatPercent(value: number | null | undefined, { fraction = false, digits = 1 }: { fraction?: boolean; digits?: number } = {}): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const pct = fraction ? value * 100 : value;
  return `${pct.toFixed(Math.abs(pct) >= 100 ? 0 : digits)}%`;
}

/** A row of KPI tiles from view-model specs. */
export function KpiGrid({ specs, compare, testId, cols = 4 }: { specs: KpiSpec[]; compare: boolean; testId?: string; cols?: number }) {
  return (
    <SimpleGrid cols={{ base: 2, md: cols }} spacing="md" data-testid={testId}>
      {specs.map((k) => (
        <MetricTile
          key={k.key}
          label={k.label}
          value={k.value}
          previous={k.previous}
          delta={k.delta}
          unit={k.unit}
          invert={k.invert}
          isNew={k.isNew}
          hint={k.hint}
          compare={compare}
        />
      ))}
    </SimpleGrid>
  );
}

/** The server's footnotes about what a number does and does not include. */
export function Notes({ notes }: { notes: readonly string[] | undefined }) {
  if (!notes || notes.length === 0) return null;
  return (
    <Stack gap={2} mt="xs" data-testid="insights-notes">
      {notes.map((n) => (
        <Text key={n} size="xs" c="dimmed">
          {n}
        </Text>
      ))}
    </Stack>
  );
}
