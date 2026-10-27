import { useEffect, useState, type MouseEvent } from 'react';
import { Alert, Anchor, Badge, Button, Group, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { IconDownload, IconInfoCircle, IconReceipt, IconSearch } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/api/errors';
import { PAYMENT_METHOD } from '@/api/orders';
import {
  methodLabel,
  PAYMENT_METHOD_ESEWA,
  PAYMENT_PURPOSE,
  PAYMENT_STATE,
  PAYMENT_STATE_TONE,
  paymentsCsv,
  paymentsListApi,
  purposeLabel,
  stateLabel,
  type AdminPaymentRow,
  type PaymentsSummary,
} from '@/api/payments';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader } from '@/components/PageHeader';
import { EmptyBlock, ErrorBlock, NotAvailableBlock } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';
import { fmtMoney } from '@/lib/format';
import { OrderDrawer } from '@/features/orders/OrderDrawer';

export const NOT_DEPLOYED =
  'The payments list ships with the backend branch feat/admin-payments (GET /v1/admin/payments and /v1/admin/payments/summary) and fills in here once it is deployed.';

export const ESEWA_TEST_MODE = 'eSewa is in test mode — these are test payments; no real money was received.';

const DEFAULT_DAYS = 30;

const missing = (error: unknown) => error instanceof ApiError && error.isMissingEndpoint;

/** YYYY-MM-DD in local time (toISOString would shift the day in UTC+5:45). */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromYmd(s: string) {
  return new Date(`${s}T00:00:00`);
}
/** A YYYY-MM-DD from the address bar, or the fallback when it is missing or not a date. */
function validYmd(s: string, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(fromYmd(s).getTime()) ? s : fallback;
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

const STATE_OPTIONS = Object.entries(PAYMENT_STATE).map(([value, label]) => ({ value, label }));
const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label }));
const PURPOSE_OPTIONS = Object.entries(PAYMENT_PURPOSE).map(([value, label]) => ({ value, label }));

/** Starts a browser download of the rows as CSV. */
function downloadCsv(rows: AdminPaymentRow[], fileName: string) {
  if (typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([paymentsCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => {
    if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
  }, 0);
}

function StateBadge({ row }: { row: Pick<AdminPaymentRow, 'state' | 'stateName'> }) {
  return (
    <Badge variant="light" color={PAYMENT_STATE_TONE[row.state] ?? 'gray'}>
      {stateLabel(row.state, row.stateName)}
    </Badge>
  );
}

function MethodBadge({ row }: { row: Pick<AdminPaymentRow, 'method' | 'methodName'> }) {
  return (
    <Badge variant="outline" color="slate">
      {methodLabel(row.method, row.methodName)}
    </Badge>
  );
}

/**
 * Every payment buyers made, newest first: when, how much, by which method, what it paid for and whether it went
 * through. Read-only - refunds are on the order. The date range drives both the tiles and the list.
 */
export function PaymentsPage() {
  const defaults = defaultRange();
  const list = useListState(['state', 'method', 'purpose', 'from', 'to'] as const, { pageSize: 25, from: defaults.from, to: defaults.to });
  const f = { ...list.filters, from: validYmd(list.filters.from, defaults.from), to: validYmd(list.filters.to, defaults.to) };
  const [, setParams] = useSearchParams();
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const fromUtc = dayStart(fromYmd(f.from));
  const toUtc = dayEnd(fromYmd(f.to));

  // The picker holds a half-picked range locally; the address bar only gets complete ranges.
  const [picker, setPicker] = useState<[Date | null, Date | null]>([fromYmd(f.from), fromYmd(f.to)]);
  useEffect(() => setPicker([fromYmd(f.from), fromYmd(f.to)]), [f.from, f.to]);
  const commitRange = (value: [Date | null, Date | null]) => {
    setPicker(value);
    const [from, to] = value;
    if (!from || !to) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('from', ymd(from));
        next.set('to', ymd(to));
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const query = useQuery({
    queryKey: ['payments', 'list', f.state, f.method, f.purpose, fromUtc, toUtc, list.search, list.page, list.pageSize],
    queryFn: ({ signal }) =>
      paymentsListApi.list({ state: f.state, method: f.method, purpose: f.purpose, fromUtc, toUtc, q: list.search, page: list.page, pageSize: list.pageSize }, signal),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ['payments', 'summary', fromUtc, toUtc],
    queryFn: ({ signal }) => paymentsListApi.summary(fromUtc, toUtc, signal),
  });

  const header = <PageHeader title="Payments" description="Every payment buyers made — eSewa, card, cash on delivery — and what it paid for." />;

  if (missing(query.error)) {
    return (
      <>
        {header}
        <NotAvailableBlock what="The payments list" detail={NOT_DEPLOYED} />
      </>
    );
  }

  const rows = query.data?.items ?? [];
  const hasEsewa = rows.some((r) => r.method === PAYMENT_METHOD_ESEWA) || (summary.data?.byMethod ?? []).some((m) => m.method === PAYMENT_METHOD_ESEWA && m.count > 0);
  const filtered = list.search !== '' || !!f.state || !!f.method || !!f.purpose;
  const selected = list.selected ? (rows.find((r) => r.id === list.selected) ?? null) : null;

  const openOrder = (n: string) => setOrderNumber(n);

  const columns: Column<AdminPaymentRow>[] = [
    { key: 'date', header: 'Date', render: (r) => <When value={r.createdUtc} /> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => (
        <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
          {fmtMoney(r.amount, r.currency)}
        </Text>
      ),
    },
    { key: 'method', header: 'Method', render: (r) => <MethodBadge row={r} /> },
    { key: 'state', header: 'Status', render: (r) => <StateBadge row={r} /> },
    { key: 'purpose', header: 'Paid for', visibleFrom: 'sm', render: (r) => purposeLabel(r.purpose) },
    {
      key: 'order',
      header: 'Order',
      render: (r) =>
        r.orderNumber ? (
          <Anchor
            component="button"
            type="button"
            size="sm"
            className="sm-mono"
            aria-label={`Open order ${r.orderNumber}`}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              openOrder(r.orderNumber!);
            }}
          >
            {r.orderNumber}
          </Anchor>
        ) : (
          <Text span c="dimmed">
            —
          </Text>
        ),
    },
    { key: 'plan', header: 'EMI plan', visibleFrom: 'lg', render: (r) => <IdText value={r.agreementId} /> },
    { key: 'ref', header: 'Provider ref', visibleFrom: 'lg', render: (r) => <IdText value={r.providerReference} /> },
    { key: 'buyer', header: 'Buyer', visibleFrom: 'md', render: (r) => (r.buyerName ? <TwoLine primary={r.buyerName} secondary={<IdText value={r.buyerAccountId} />} /> : <IdText value={r.buyerAccountId} />) },
  ];

  return (
    <>
      {header}
      <Stack gap="md" mb="md">
        <Group gap="md" align="flex-end" wrap="wrap">
          <DatePickerInput
            type="range"
            label="Date range"
            w={260}
            maxDate={new Date()}
            allowSingleDateInRange
            value={picker}
            onChange={commitRange}
          />
          <Text size="sm" c="dimmed" mb={6}>
            Received counts by capture date; the list by the date the payment started.
          </Text>
        </Group>
        <SummaryTiles summary={summary.data} loading={summary.isLoading} error={summary.error} onRetry={() => void summary.refetch()} />
        {hasEsewa && (
          <Alert variant="light" color="blue" icon={<IconInfoCircle size={16} />} data-testid="esewa-test-mode">
            {ESEWA_TEST_MODE}
          </Alert>
        )}
      </Stack>
      <DataTable
        label="Payments"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(r) => r.id}
        onRowClick={(r) => list.open(r.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        filtered={filtered}
        emptyTitle="No payments in this range"
        emptyBody="No buyer started a payment between these dates. Widen the date range to see older ones."
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              placeholder="Order number, payment id, provider ref, buyer id"
              leftSection={<IconSearch size={14} />}
              w={300}
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.currentTarget.value)}
            />
            <Select label="Status" w={160} clearable placeholder="Any status" data={STATE_OPTIONS} value={f.state || null} onChange={(v) => list.setFilter('state', v)} />
            <Select label="Method" w={200} clearable placeholder="Any method" data={METHOD_OPTIONS} value={f.method || null} onChange={(v) => list.setFilter('method', v)} />
            <Select label="Paid for" w={180} clearable placeholder="Anything" data={PURPOSE_OPTIONS} value={f.purpose || null} onChange={(v) => list.setFilter('purpose', v)} />
            {filtered && (
              <Button variant="subtle" size="compact-sm" mb={6} onClick={list.clearFilters}>
                Clear filters
              </Button>
            )}
            <Group gap="sm" ml="auto" mb={2} wrap="nowrap">
              {query.data?.total !== undefined && (
                <Text size="sm" c="dimmed">
                  {query.data.total.toLocaleString()} payments
                </Text>
              )}
              <Button
                variant="default"
                leftSection={<IconDownload size={16} />}
                disabled={rows.length === 0}
                onClick={() => downloadCsv(rows, `payments-${f.from}-to-${f.to}${list.page > 1 ? `-page-${list.page}` : ''}.csv`)}
              >
                Export CSV
              </Button>
            </Group>
          </Group>
        }
      />
      <PaymentDrawer payment={selected} opened={!!list.selected} onClose={() => list.open(null)} onOpenOrder={openOrder} />
      <OrderDrawer orderNumber={orderNumber} onClose={() => setOrderNumber(null)} />
    </>
  );
}

function SummaryTiles({ summary: s, loading, error, onRetry }: { summary: PaymentsSummary | undefined; loading: boolean; error: unknown; onRetry: () => void }) {
  if (error && !missing(error)) return <ErrorBlock error={error} onRetry={onRetry} />;
  if (error) return null; // the list says the endpoint is missing
  const currency = s?.currency ?? 'NPR';
  const count = (n: number | undefined) => (n === undefined ? undefined : `${n.toLocaleString()} ${n === 1 ? 'payment' : 'payments'}`);
  return (
    <Stack gap="xs" data-testid="payments-summary">
      <SimpleGrid cols={{ base: 2, md: s?.refunded ? 4 : 3 }} spacing="sm">
        <MetricTile label="Received" value={fmtMoney(s?.received.amount, currency)} hint={count(s?.received.count)} tone="forest" loading={loading} />
        <MetricTile label="Pending" value={fmtMoney(s?.pending.amount, currency)} hint={count(s?.pending.count)} tone="amber" loading={loading} />
        <MetricTile label="Failed" value={s ? s.failed.count.toLocaleString() : '—'} hint="Failed or cancelled payments" tone={s && s.failed.count > 0 ? 'signal' : 'gray'} loading={loading} />
        {s?.refunded && <MetricTile label="Refunded" value={fmtMoney(s.refunded.amount, currency)} hint={count(s.refunded.count)} tone="gray" />}
      </SimpleGrid>
      {s && s.byMethod.length > 0 && (
        <Group gap="xs" aria-label="Received by method">
          {s.byMethod.map((m) => (
            <Badge key={m.method} variant="light" color="slate" size="lg" tt="none" data-testid="method-chip">
              {methodLabel(m.method, m.methodName)}: {fmtMoney(m.amount, currency)} · {m.count.toLocaleString()}
            </Badge>
          ))}
        </Group>
      )}
    </Stack>
  );
}

function PaymentDrawer({ payment: p, opened, onClose, onOpenOrder }: { payment: AdminPaymentRow | null; opened: boolean; onClose: () => void; onOpenOrder: (orderNumber: string) => void }) {
  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      size="lg"
      title={p ? fmtMoney(p.amount, p.currency) : 'Payment'}
      subtitle={p ? `${methodLabel(p.method, p.methodName)} · ${purposeLabel(p.purpose)}` : undefined}
      badges={p && <StateBadge row={p} />}
      actions={
        p?.orderNumber && (
          <>
            <Button variant="light" leftSection={<IconReceipt size={16} />} onClick={() => onOpenOrder(p.orderNumber!)}>
              Open order {p.orderNumber}
            </Button>
            <Button variant="subtle" component={Link} to={`/orders/${encodeURIComponent(p.orderNumber)}`}>
              Go to Orders
            </Button>
          </>
        )
      }
    >
      {!p ? (
        <EmptyBlock title="Not on this page" body="This payment is not in the current page of results. Close this and find it with the search or filters." />
      ) : (
        <Stack gap="md">
          {p.failureMessage && (
            <Alert variant="light" color="signal" title="Why it did not go through">
              {p.failureMessage}
            </Alert>
          )}
          <FieldGrid
            fields={[
              { label: 'Amount', value: fmtMoney(p.amount, p.currency) },
              { label: 'Status', value: stateLabel(p.state, p.stateName) },
              { label: 'Method', value: methodLabel(p.method, p.methodName) },
              { label: 'Paid for', value: purposeLabel(p.purpose) },
              { label: 'Started', value: <When value={p.createdUtc} /> },
              { label: 'Captured', value: p.capturedUtc ? <When value={p.capturedUtc} /> : null },
              { label: 'Order', value: p.orderNumber ? <span className="sm-mono">{p.orderNumber}</span> : null },
              { label: 'Order id', value: p.orderId ? <IdText value={p.orderId} full /> : null },
              { label: 'EMI plan', value: p.agreementId ? <IdText value={p.agreementId} full /> : null },
              { label: 'Provider reference', value: p.providerReference ? <IdText value={p.providerReference} full /> : null },
              { label: 'Buyer', value: p.buyerName },
              { label: 'Buyer account', value: <IdText value={p.buyerAccountId} full /> },
              { label: 'Payment id', value: <IdText value={p.id} full />, wide: true },
            ]}
          />
          {p.method === PAYMENT_METHOD_ESEWA && (
            <Text size="xs" c="dimmed">
              {ESEWA_TEST_MODE}
            </Text>
          )}
        </Stack>
      )}
    </DetailDrawer>
  );
}
