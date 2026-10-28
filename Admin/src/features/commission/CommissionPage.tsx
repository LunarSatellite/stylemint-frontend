import { useEffect, useMemo, useState } from 'react';
import { ActionIcon, Badge, Box, Button, Card, Group, NumberInput, SimpleGrid, Skeleton, Stack, Table, Text, TextInput, Tooltip } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconHistory, IconSearch } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import {
  COMMISSION_MAX,
  COMMISSION_MIN,
  commissionApi,
  inheritedName,
  parseRate,
  pathText,
  toTree,
  withInheritance,
  type CommissionCategories,
  type CommissionCategoryRow,
  type CommissionSummary,
  type CommissionTreeRow,
} from '@/api/commission';
import { ApiError, messageOf } from '@/api/errors';
import { useAuth } from '@/auth/guards';
import { IdText, When } from '@/components/Bits';
import { DetailDrawer } from '@/components/DetailDrawer';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader } from '@/components/PageHeader';
import { EmptyBlock, ErrorBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { fmtMoney } from '@/lib/format';

export const NOT_DEPLOYED =
  'Platform commission ships with the backend branch feat/platform-commission (GET /v1/admin/commission/categories and /v1/admin/commission/summary) and fills in here once it is deployed. Until then StyleMint takes 0% on product sales.';

export const EXPLAINER = "StyleMint's commission on product sales, charged on the full price. Categories without a rate charge 0%. Applies to orders placed after a change.";
export const EMI_NOTE = 'On EMI orders it is taken from every payment, not at the start.';

const KEY = ['commission', 'categories'] as const;
const DEFAULT_DAYS = 30;
const TOP_CATEGORIES = 5;

const missing = (error: unknown) => error instanceof ApiError && error.isMissingEndpoint;

/** YYYY-MM-DD in local time (toISOString would shift the day in UTC+5:45). */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromYmd(s: string) {
  return new Date(`${s}T00:00:00`);
}
function validYmd(s: string | null, fallback: string) {
  return s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromYmd(s).getTime()) ? s : fallback;
}
function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
function dayEnd(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x.toISOString();
}
function defaultRange() {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - (DEFAULT_DAYS - 1));
  return { from: ymd(from), to: ymd(to) };
}

/** "12.5%" - up to two decimals, no trailing zeros. */
export function fmtRate(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${Number(n.toFixed(2))}%`;
}

/** What the input shows for a saved rate. */
const rateText = (n: number | null) => (n === null ? '' : String(Number(n.toFixed(2))));

/**
 * StyleMint's platform commission on product sales, per product category: the rate of each category (a category
 * without one inherits its parent's, else 0%), who changed it last, its history, and what StyleMint earned in a date
 * range. Rates are snapshotted on each order line when the order is placed, so a change only affects new orders.
 */
export function CommissionPage() {
  const { can } = useAuth();
  const canEdit = can('holdPayouts');
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const defaults = defaultRange();
  const from = validYmd(params.get('from'), defaults.from);
  const to = validYmd(params.get('to'), defaults.to);
  const fromUtc = dayStart(fromYmd(from));
  const toUtc = dayEnd(fromYmd(to));

  const [search, setSearch] = useState('');
  /** Typed but unsaved rates, by category id. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [historyFor, setHistoryFor] = useState<CommissionCategoryRow | null>(null);

  // The picker holds a half-picked range locally; the address bar only gets complete ranges.
  const [picker, setPicker] = useState<[Date | null, Date | null]>([fromYmd(from), fromYmd(to)]);
  useEffect(() => setPicker([fromYmd(from), fromYmd(to)]), [from, to]);
  const commitRange = (value: [Date | null, Date | null]) => {
    setPicker(value);
    const [f, t] = value;
    if (!f || !t) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('from', ymd(f));
        next.set('to', ymd(t));
        return next;
      },
      { replace: true },
    );
  };

  const categories = useQuery({ queryKey: KEY, queryFn: ({ signal }) => commissionApi.categories(signal) });
  const summary = useQuery({
    queryKey: ['commission', 'summary', fromUtc, toUtc],
    queryFn: ({ signal }) => commissionApi.summary(fromUtc, toUtc, signal),
  });

  const save = useMutation({
    mutationFn: ({ categoryId, ratePercent }: { categoryId: string; ratePercent: number | null; name: string }) => commissionApi.setRate(categoryId, ratePercent),
    onMutate: async ({ categoryId, ratePercent }) => {
      await queryClient.cancelQueries({ queryKey: KEY });
      const previous = queryClient.getQueryData<CommissionCategories>(KEY);
      if (previous)
        queryClient.setQueryData<CommissionCategories>(
          KEY,
          withInheritance({ ...previous, categories: previous.categories.map((c) => (c.categoryId === categoryId ? { ...c, ratePercent } : c)) }),
        );
      setDrafts((d) => {
        const next = { ...d };
        delete next[categoryId];
        return next;
      });
      return { previous };
    },
    onError: (error, vars, context) => {
      if (context?.previous) queryClient.setQueryData(KEY, context.previous);
      notifications.show({ color: 'signal', title: `Could not save ${vars.name}`, message: messageOf(error) });
    },
    onSuccess: (_data, vars) => {
      notifications.show({
        color: 'forest',
        title: 'Commission saved',
        message: vars.ratePercent === null ? `${vars.name} no longer has its own rate.` : `${vars.name}: ${fmtRate(vars.ratePercent)} on orders placed from now.`,
      });
    },
    onSettled: (_data, _error, vars) => {
      void queryClient.invalidateQueries({ queryKey: KEY });
      void queryClient.invalidateQueries({ queryKey: ['commission', 'history', vars.categoryId] });
    },
  });

  const tree = useMemo(() => toTree(categories.data?.categories ?? []), [categories.data]);
  const term = search.trim().toLowerCase();
  const shown = term ? tree.filter((r) => r.name.toLowerCase().includes(term) || pathText(r).toLowerCase().includes(term)) : tree;

  const header = (
    <PageHeader
      title="Commission"
      description={
        <>
          {EXPLAINER} {EMI_NOTE}
        </>
      }
    />
  );

  if (missing(categories.error)) {
    return (
      <>
        {header}
        <NotAvailableBlock what="Platform commission" detail={NOT_DEPLOYED} />
      </>
    );
  }

  const submit = (row: CommissionCategoryRow, raw: string) => {
    const rate = parseRate(raw);
    if (rate === null) return;
    save.mutate({ categoryId: row.categoryId, ratePercent: rate, name: row.name });
  };

  return (
    <>
      {header}
      <Stack gap="md">
        <Group gap="md" align="flex-end" wrap="wrap">
          <DatePickerInput type="range" label="Date range" w={260} maxDate={new Date()} allowSingleDateInRange value={picker} onChange={commitRange} />
          <Text size="sm" c="dimmed" mb={6}>
            Earned counts commission that has settled with the seller’s earning.
          </Text>
        </Group>
        <SummaryTiles summary={summary.data} loading={summary.isLoading} error={summary.error} onRetry={() => void summary.refetch()} />

        <SectionCard
          title="Rates by category"
          description={`A category without its own rate uses its parent’s; with none up the tree it is ${fmtRate(categories.data?.defaultRatePercent ?? 0)}. Rates run from ${COMMISSION_MIN} to ${COMMISSION_MAX}%.`}
          action={
            <TextInput
              aria-label="Search categories"
              placeholder="Search categories"
              leftSection={<IconSearch size={14} />}
              w={260}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />
          }
        >
          {categories.error ? (
            <ErrorBlock error={categories.error} onRetry={() => void categories.refetch()} />
          ) : !categories.data ? (
            <Stack gap="xs">
              <Skeleton height={36} />
              <Skeleton height={36} />
              <Skeleton height={36} />
            </Stack>
          ) : tree.length === 0 ? (
            <EmptyBlock title="No categories" body="There are no product categories yet. Add them in the catalogue first." />
          ) : shown.length === 0 ? (
            <EmptyBlock title="No matches" body={`No category name contains “${search.trim()}”.`} />
          ) : (
            <Table.ScrollContainer minWidth={720}>
              <Table aria-label="Commission by category" verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Category</Table.Th>
                    <Table.Th w={canEdit ? 230 : 110}>Rate</Table.Th>
                    <Table.Th>Charged now</Table.Th>
                    <Table.Th>Last changed</Table.Th>
                    <Table.Th />
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {shown.map((row) => (
                    <CategoryRow
                      key={row.categoryId}
                      row={row}
                      indent={!term}
                      canEdit={canEdit}
                      draft={drafts[row.categoryId]}
                      saving={save.isPending && save.variables?.categoryId === row.categoryId}
                      onDraft={(v) => setDrafts((d) => ({ ...d, [row.categoryId]: v }))}
                      onSave={(raw) => submit(row, raw)}
                      onClear={() => save.mutate({ categoryId: row.categoryId, ratePercent: null, name: row.name })}
                      onHistory={() => setHistoryFor(row)}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </SectionCard>
      </Stack>
      <HistoryDrawer category={historyFor} onClose={() => setHistoryFor(null)} />
    </>
  );
}

function CategoryRow({
  row,
  indent,
  canEdit,
  draft,
  saving,
  onDraft,
  onSave,
  onClear,
  onHistory,
}: {
  row: CommissionTreeRow;
  indent: boolean;
  canEdit: boolean;
  draft: string | undefined;
  saving: boolean;
  onDraft: (value: string) => void;
  onSave: (raw: string) => void;
  onClear: () => void;
  onHistory: () => void;
}) {
  const value = draft ?? rateText(row.ratePercent);
  const dirty = draft !== undefined && draft.trim() !== rateText(row.ratePercent);
  const parsed = parseRate(value);
  const invalid = dirty && value.trim() !== '' && parsed === null;
  const from = inheritedName(row);
  const path = pathText(row);
  return (
    <Table.Tr data-testid={`commission-row-${row.categoryId}`}>
      <Table.Td>
        <Box pl={indent ? row.depth * 20 : 0}>
          <Text size="sm" fw={row.depth === 0 ? 600 : 500}>
            {row.name}
          </Text>
          {!indent && path !== row.name && (
            <Text size="xs" c="dimmed">
              {path}
            </Text>
          )}
        </Box>
      </Table.Td>
      <Table.Td>
        {canEdit ? (
          <Group gap={6} wrap="nowrap" align="flex-start">
            <NumberInput
              aria-label={`Rate for ${row.name} (%)`}
              placeholder="Not set"
              size="xs"
              w={96}
              min={COMMISSION_MIN}
              max={COMMISSION_MAX}
              decimalScale={2}
              allowNegative={false}
              clampBehavior="none"
              rightSection={
                <Text size="xs" c="dimmed">
                  %
                </Text>
              }
              value={value}
              error={invalid ? `${COMMISSION_MIN}–${COMMISSION_MAX}, two decimals` : undefined}
              onChange={(v) => onDraft(String(v))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dirty && parsed !== null) onSave(value);
              }}
            />
            <Button size="compact-xs" mt={4} disabled={!dirty || parsed === null} loading={saving} onClick={() => onSave(value)} aria-label={`Save rate for ${row.name}`}>
              Save
            </Button>
            {row.ratePercent !== null && (
              <Button size="compact-xs" mt={4} variant="subtle" color="slate" disabled={saving} onClick={onClear} aria-label={`Clear rate for ${row.name}`}>
                Clear
              </Button>
            )}
          </Group>
        ) : (
          <Text size="sm" c={row.ratePercent === null ? 'dimmed' : undefined}>
            {row.ratePercent === null ? 'Not set' : fmtRate(row.ratePercent)}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={600} span data-testid="effective-rate">
          {fmtRate(row.effectiveRatePercent)}
        </Text>
        {row.ratePercent === null && (
          <Text size="xs" c="dimmed" data-testid="inherited-from">
            {from ? `inherited from ${from}` : 'default'}
          </Text>
        )}
      </Table.Td>
      <Table.Td>
        {row.updatedUtc ? (
          <Stack gap={0}>
            <When value={row.updatedUtc} />
            {(row.updatedByName || row.updatedBy) && (
              <Text size="xs" c="dimmed" component="div">
                {row.updatedByName ?? <IdText value={row.updatedBy} />}
              </Text>
            )}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            Never
          </Text>
        )}
      </Table.Td>
      <Table.Td style={{ textAlign: 'right' }}>
        <Tooltip label="History">
          <ActionIcon variant="subtle" color="slate" aria-label={`History of ${row.name}`} onClick={onHistory}>
            <IconHistory size={16} />
          </ActionIcon>
        </Tooltip>
      </Table.Td>
    </Table.Tr>
  );
}

function SummaryTiles({ summary: s, loading, error, onRetry }: { summary: CommissionSummary | undefined; loading: boolean; error: unknown; onRetry: () => void }) {
  if (error && !missing(error)) return <ErrorBlock error={error} onRetry={onRetry} />;
  if (error) return null; // the rates say the endpoint is missing, or the summary alone is not deployed yet
  const currency = s?.currency ?? 'NPR';
  const top = [...(s?.byCategory ?? [])].sort((a, b) => b.amount - a.amount).slice(0, TOP_CATEGORIES);
  return (
    <Stack gap="xs" data-testid="commission-summary">
      <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="sm">
        <MetricTile
          label="Earned"
          value={fmtMoney(s?.earned.amount, currency)}
          hint={s ? `${s.earned.count.toLocaleString()} ${s.earned.count === 1 ? 'entry' : 'entries'} settled` : undefined}
          tone="forest"
          loading={loading}
        />
        <MetricTile label="Pending" value={fmtMoney(s?.pending.amount, currency)} hint="Settles with the seller’s earning" tone="amber" loading={loading} />
        <MetricTile label="Reversed" value={fmtMoney(s?.reversed.amount, currency)} hint="Given back on refunds and returns" tone="gray" loading={loading} />
      </SimpleGrid>
      {top.length > 0 && (
        <Card padding="sm">
          <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb={6} style={{ letterSpacing: '0.06em' }}>
            Top categories
          </Text>
          <Group gap="xs" aria-label="Top categories">
            {top.map((c) => (
              <Badge key={c.categoryId} variant="light" color="slate" size="lg" tt="none" data-testid="top-category">
                {c.name}: {fmtMoney(c.amount, currency)}
              </Badge>
            ))}
          </Group>
        </Card>
      )}
    </Stack>
  );
}

function HistoryDrawer({ category, onClose }: { category: CommissionCategoryRow | null; onClose: () => void }) {
  const id = category?.categoryId ?? '';
  const q = useQuery({
    queryKey: ['commission', 'history', id],
    queryFn: ({ signal }) => commissionApi.history(id, signal),
    enabled: !!category,
  });
  return (
    <DetailDrawer opened={!!category} onClose={onClose} size="md" title={category ? `${category.name} — history` : 'History'} subtitle="Every rate this category has had. Orders keep the rate they were placed with.">
      {missing(q.error) ? (
        <NotAvailableBlock what="Rate history" detail={NOT_DEPLOYED} />
      ) : q.error ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : !q.data ? (
        <Stack gap="xs">
          <Skeleton height={32} />
          <Skeleton height={32} />
        </Stack>
      ) : q.data.length === 0 ? (
        <EmptyBlock title="Never changed" body="This category has never had its own rate." />
      ) : (
        <Table aria-label="Rate history">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Rate</Table.Th>
              <Table.Th>When</Table.Th>
              <Table.Th>By</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.data.map((h, i) => (
              <Table.Tr key={`${h.changedUtc ?? ''}-${i}`}>
                <Table.Td>{h.ratePercent === null ? <Text size="sm" c="dimmed">Cleared</Text> : fmtRate(h.ratePercent)}</Table.Td>
                <Table.Td>{h.changedUtc ? <When value={h.changedUtc} /> : '—'}</Table.Td>
                <Table.Td>{h.changedByName ?? (h.changedBy ? <IdText value={h.changedBy} /> : '—')}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </DetailDrawer>
  );
}
