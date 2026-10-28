import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Alert, Badge, Button, Group, Modal, Select, SimpleGrid, Stack, Table, Tabs, Text, TextInput, Textarea, VisuallyHidden } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconAlertTriangle, IconCheck, IconSearch } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { newIdempotencyKey } from '@/api/client';
import { ApiError, messageOf } from '@/api/errors';
import { PAYMENT_METHOD } from '@/api/orders';
import {
  METHOD_COD,
  METHOD_ESEWA,
  moneyOf,
  NOTE_MAX,
  REFERENCE_MAX,
  REFUND_ALREADY_SETTLED,
  REFUND_NOT_MANUAL,
  REFUND_STATE_TONE,
  REFUND_VIEW_LABEL,
  REFUND_VIEWS,
  refundMethodLabel,
  refundReasonLabel,
  refundsApi,
  refundStateLabel,
  type AdminRefund,
  type RefundsSummary,
  type RefundView,
} from '@/api/refunds';
import { useAuth } from '@/auth/guards';
import { withStepUp } from '@/auth/stepUp';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader } from '@/components/PageHeader';
import { EmptyBlock, ErrorBlock, LoadingBlock, NotAvailableBlock } from '@/components/StateBlocks';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';
import { fmtMoney } from '@/lib/format';

export const NOT_DEPLOYED =
  'The refunds desk ships with the backend branch feat/refunds-desk (GET /v1/admin/refunds) and fills in here once it is deployed.';

const missing = (error: unknown) => error instanceof ApiError && error.isMissingEndpoint;

const METHOD_OPTIONS = Object.entries(PAYMENT_METHOD).map(([value, label]) => ({ value, label }));

const isView = (v: string): v is RefundView => (REFUND_VIEWS as readonly string[]).includes(v);

/** YYYY-MM-DD in local time (toISOString would shift the day in UTC+5:45). */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
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

const money = (r: Pick<AdminRefund, 'amount'>) => {
  const m = moneyOf(r.amount);
  return fmtMoney(m.amount, m.currency);
};

/** What the desk has to do, in one sentence (contract §5). */
export function refundInstruction(r: AdminRefund): string {
  const amount = money(r);
  if (r.method === METHOD_ESEWA) {
    return r.providerReference
      ? `Refund ${amount} in the eSewa merchant portal for transaction ${r.providerReference}.`
      : `Refund ${amount} in the eSewa merchant portal. The transaction id is missing, so find the payment by order ${r.orderNumber ?? 'number'}.`;
  }
  if (r.method === METHOD_COD) {
    const name = r.buyer?.displayName || 'name not on file';
    const phone = r.buyer?.phone || 'no phone on file';
    return `Send ${amount} to the buyer (${name}, ${phone}) by eSewa or bank.`;
  }
  return `Refund ${amount} to the buyer by hand, then record the reference here.`;
}

function StateBadge({ state }: { state: string }) {
  return (
    <Badge variant="light" color={REFUND_STATE_TONE[state] ?? 'gray'}>
      {refundStateLabel(state)}
    </Badge>
  );
}

function MethodBadge({ r }: { r: Pick<AdminRefund, 'method' | 'methodName'> }) {
  return (
    <Badge variant="outline" color="slate">
      {refundMethodLabel(r.method, r.methodName)}
    </Badge>
  );
}

const EMPTY: Record<RefundView, { title: string; body: string }> = {
  ToSettle: { title: 'Nothing to settle', body: 'Every refund that has to be paid by hand is done.' },
  Completed: { title: 'No completed refunds', body: 'Refunds show here once they are paid.' },
  All: { title: 'No refunds yet', body: 'Refunds show here when an order is cancelled or returned.' },
};

/**
 * The refunds desk. eSewa has no refund API and cash on delivery refunds go to the buyer directly, so those refunds
 * wait here until someone pays them by hand and records the reference. Marking one refunded completes it: the
 * seller's earnings are reversed and the buyer is told.
 */
export function RefundsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const list = useListState(['view', 'method', 'from', 'to'] as const, { pageSize: 25 });
  const view: RefundView = isView(list.filters.view) ? list.filters.view : 'ToSettle';
  const from = fromYmd(list.filters.from);
  const to = fromYmd(list.filters.to);
  const fromUtc = from ? dayStart(from) : undefined;
  const toUtc = to ? dayEnd(to) : undefined;
  const [, setParams] = useSearchParams();
  const [settling, setSettling] = useState<AdminRefund | null>(null);

  const resetKey = [view, list.filters.method, fromUtc, toUtc, list.search, list.pageSize].join('|');
  const cursors = useCursorPages(resetKey, list.page, list.setPage);
  const query = useQuery({
    queryKey: ['refunds', 'list', resetKey, cursors.cursor, list.page],
    queryFn: ({ signal }) =>
      refundsApi.list({ view, method: list.filters.method, fromUtc, toUtc, search: list.search, cursor: cursors.cursor, page: list.page, pageSize: list.pageSize }, signal),
    enabled: cursors.ready,
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (query.data) cursors.remember(list.page, query.data.nextCursor);
  }, [query.data, list.page, cursors]);
  const summary = useQuery({ queryKey: ['refunds', 'summary'], queryFn: ({ signal }) => refundsApi.summary(signal) });

  // The picker holds a half-picked range locally; the address bar gets complete ranges, or none.
  const [picker, setPicker] = useState<[Date | null, Date | null]>([from, to]);
  useEffect(() => setPicker([fromYmd(list.filters.from), fromYmd(list.filters.to)]), [list.filters.from, list.filters.to]);
  const commitRange = (value: [Date | null, Date | null]) => {
    setPicker(value);
    const [a, b] = value;
    if ((a && !b) || (!a && b)) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (a && b) {
          next.set('from', ymd(a));
          next.set('to', ymd(b));
        } else {
          next.delete('from');
          next.delete('to');
        }
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['refunds'] });

  const header = <PageHeader title="Refunds" description="Refunds to pay by hand — eSewa and cash on delivery — and every refund already paid." />;

  if (missing(query.error)) {
    return (
      <>
        {header}
        <NotAvailableBlock what="The refunds desk" detail={NOT_DEPLOYED} />
      </>
    );
  }

  const rows = query.data?.items ?? [];
  const filtered = list.search !== '' || !!list.filters.method || !!fromUtc;
  const selectedRow = list.selected ? (rows.find((r) => r.refundId === list.selected) ?? null) : null;
  const maySettle = can('settleRefunds');

  const columns: Column<AdminRefund>[] = [
    { key: 'requested', header: 'Requested', render: (r) => <When value={r.requestedUtc} /> },
    {
      key: 'order',
      header: 'Order',
      render: (r) =>
        r.orderNumber ? (
          <TwoLine primary={<span className="sm-mono">{r.orderNumber}</span>} secondary={r.subOrderNumber ? <span className="sm-mono">{r.subOrderNumber}</span> : undefined} />
        ) : (
          <Text span c="dimmed">
            —
          </Text>
        ),
    },
    { key: 'reason', header: 'Reason', visibleFrom: 'sm', render: (r) => refundReasonLabel(r.reason) },
    { key: 'method', header: 'Method', render: (r) => <MethodBadge r={r} /> },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (r) => (
        <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
          {money(r)}
        </Text>
      ),
    },
    { key: 'buyer', header: 'Buyer', visibleFrom: 'md', render: (r) => r.buyer?.displayName ?? <IdText value={r.buyer?.accountId} /> },
    { key: 'state', header: 'Status', render: (r) => <StateBadge state={r.state} /> },
    {
      key: 'action',
      header: <VisuallyHidden>Action</VisuallyHidden>,
      align: 'right',
      render: (r) =>
        maySettle && r.needsAction ? (
          <Button
            size="compact-sm"
            variant="light"
            aria-label={`Mark refunded ${r.orderNumber ?? r.refundId}`}
            onClick={(e: MouseEvent) => {
              e.stopPropagation();
              setSettling(r);
            }}
          >
            Mark refunded
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      {header}
      <Stack gap="md" mb="md">
        <SummaryCards summary={summary.data} loading={summary.isLoading} error={summary.error} onRetry={() => void summary.refetch()} />
      </Stack>
      <Tabs value={view} onChange={(v) => v && list.setFilter('view', v === 'ToSettle' ? null : v)} keepMounted={false} variant="outline" mb="md">
        <Tabs.List>
          {REFUND_VIEWS.map((v) => (
            <Tabs.Tab key={v} value={v}>
              {REFUND_VIEW_LABEL[v]}
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      <DataTable
        label="Refunds"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading || !cursors.ready}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(r) => r.refundId}
        onRowClick={(r) => list.open(r.refundId)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        pagerMode="cursor"
        filtered={filtered}
        emptyTitle={EMPTY[view].title}
        emptyBody={EMPTY[view].body}
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              placeholder="Order number or eSewa transaction id"
              leftSection={<IconSearch size={14} />}
              w={300}
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.currentTarget.value)}
            />
            <Select label="Method" w={200} clearable placeholder="Any method" data={METHOD_OPTIONS} value={list.filters.method || null} onChange={(v) => list.setFilter('method', v)} />
            <DatePickerInput type="range" label="Requested between" placeholder="Any date" w={260} maxDate={new Date()} allowSingleDateInRange clearable value={picker} onChange={commitRange} />
            {filtered && (
              <Button
                variant="subtle"
                size="compact-sm"
                mb={6}
                onClick={() => {
                  list.setSearchInput('');
                  setParams(
                    (prev) => {
                      const next = new URLSearchParams(prev);
                      for (const k of ['q', 'method', 'from', 'to', 'page']) next.delete(k);
                      return next;
                    },
                    { replace: true },
                  );
                }}
              >
                Clear filters
              </Button>
            )}
          </Group>
        }
      />
      <RefundDrawer
        refundId={list.selected}
        row={selectedRow}
        onClose={() => list.open(null)}
        onMarkRefunded={maySettle ? setSettling : undefined}
      />
      <MarkRefundedModal refund={settling} onClose={() => setSettling(null)} onChanged={refresh} />
    </>
  );
}

function SummaryCards({ summary: s, loading, error, onRetry }: { summary: RefundsSummary | undefined; loading: boolean; error: unknown; onRetry: () => void }) {
  if (error && !missing(error)) return <ErrorBlock error={error} onRetry={onRetry} />;
  if (error) return null; // the list says the endpoint is missing
  const count = (n: number | undefined) => (n === undefined ? undefined : `${n.toLocaleString()} ${n === 1 ? 'refund' : 'refunds'}`);
  const amount = (v: RefundsSummary['toSettle'] | undefined) => {
    if (!v) return '—';
    const m = moneyOf(v.amount);
    return fmtMoney(m.amount, m.currency);
  };
  const byMethod = s?.byMethod ?? [];
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: Math.min(4, 2 + Math.max(1, byMethod.length)) }} spacing="sm" data-testid="refunds-summary">
      <MetricTile label="To settle" value={amount(s?.toSettle)} hint={count(s?.toSettle?.count)} tone={(s?.toSettle?.count ?? 0) > 0 ? 'amber' : 'gray'} loading={loading} />
      <MetricTile label="Settled this month" value={amount(s?.settledThisMonth)} hint={count(s?.settledThisMonth?.count)} tone="forest" loading={loading} />
      {byMethod.length === 0 ? (
        <MetricTile label="To settle by method" value="—" hint={s ? 'Nothing waiting' : undefined} tone="gray" loading={loading} />
      ) : (
        byMethod.map((m) => {
          const mm = moneyOf(m.amount);
          return (
            <div key={m.method} data-testid="method-card">
              <MetricTile label={`To settle · ${refundMethodLabel(m.method, m.methodName)}`} value={fmtMoney(mm.amount, mm.currency)} hint={count(m.count)} tone="amber" />
            </div>
          );
        })
      )}
    </SimpleGrid>
  );
}

function RefundDrawer({
  refundId,
  row,
  onClose,
  onMarkRefunded,
}: {
  refundId: string | null;
  row: AdminRefund | null;
  onClose: () => void;
  onMarkRefunded?: (r: AdminRefund) => void;
}) {
  const detail = useQuery({
    queryKey: ['refunds', 'detail', refundId],
    queryFn: ({ signal }) => refundsApi.get(refundId!, signal),
    enabled: !!refundId,
  });
  const r: AdminRefund | null = detail.data ?? row;
  const history = (detail.data?.history ?? []).filter(Boolean);

  return (
    <DetailDrawer
      opened={!!refundId}
      onClose={onClose}
      size="lg"
      title={r ? money(r) : 'Refund'}
      subtitle={r ? `${refundMethodLabel(r.method, r.methodName)} · ${refundReasonLabel(r.reason)}${r.orderNumber ? ` · ${r.orderNumber}` : ''}` : undefined}
      badges={r && <StateBadge state={r.state} />}
      actions={
        r &&
        onMarkRefunded &&
        r.needsAction && (
          <Button leftSection={<IconCheck size={16} />} onClick={() => onMarkRefunded(r)}>
            Mark refunded
          </Button>
        )
      }
    >
      {!r ? (
        detail.isLoading ? (
          <LoadingBlock />
        ) : detail.error ? (
          <ErrorBlock error={detail.error} onRetry={() => void detail.refetch()} />
        ) : (
          <EmptyBlock title="Refund not found" body="Close this and find it with the search or filters." />
        )
      ) : (
        <Stack gap="md">
          {r.needsAction && (
            <Alert variant="light" color="amber" title="To do" data-testid="drawer-instruction">
              {refundInstruction(r)}
            </Alert>
          )}
          {r.failureMessage && (
            <Alert variant="light" color="signal" title="Why it failed">
              {r.failureMessage}
            </Alert>
          )}
          <FieldGrid
            fields={[
              { label: 'Amount', value: money(r) },
              { label: 'Status', value: refundStateLabel(r.state) },
              { label: 'Method', value: refundMethodLabel(r.method, r.methodName) },
              { label: 'Reason', value: refundReasonLabel(r.reason) },
              { label: 'Requested', value: <When value={r.requestedUtc} /> },
              { label: 'Completed', value: r.completedUtc ? <When value={r.completedUtc} /> : null },
              { label: 'Order', value: r.orderNumber ? <span className="sm-mono">{r.orderNumber}</span> : null },
              { label: 'Sub-order', value: r.subOrderNumber ? <span className="sm-mono">{r.subOrderNumber}</span> : null },
              { label: 'Buyer', value: r.buyer?.displayName ?? null },
              { label: 'Buyer phone', value: r.buyer?.phone ?? null },
              { label: 'Payment reference', value: r.providerReference ? <IdText value={r.providerReference} full /> : null },
              { label: 'Refund reference', value: r.providerRefundId ? <IdText value={r.providerRefundId} full /> : null },
              { label: 'Settled by', value: r.settledBy?.displayName ?? (r.settledBy ? <IdText value={r.settledBy.adminId} /> : null) },
              { label: 'Note', value: r.settledNote },
              { label: 'Refund id', value: <IdText value={r.refundId} full />, wide: true },
            ]}
          />
          <Stack gap="xs">
            <Text fw={650} size="sm">
              History
            </Text>
            {detail.isLoading ? (
              <LoadingBlock />
            ) : detail.error ? (
              <ErrorBlock error={detail.error} onRetry={() => void detail.refetch()} />
            ) : history.length === 0 ? (
              <Text size="sm" c="dimmed">
                No other attempts for this payment.
              </Text>
            ) : (
              <Table aria-label="Refund history" data-testid="refund-history">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Requested</Table.Th>
                    <Table.Th>Amount</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Detail</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {history.map((h) => (
                    <Table.Tr key={h.refundId}>
                      <Table.Td>
                        <When value={h.requestedUtc} />
                      </Table.Td>
                      <Table.Td>{money(h)}</Table.Td>
                      <Table.Td>
                        <StateBadge state={h.state} />
                      </Table.Td>
                      <Table.Td>
                        <Text size="xs" c="dimmed">
                          {h.failureMessage ?? h.providerRefundId ?? '—'}
                        </Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Stack>
        </Stack>
      )}
    </DetailDrawer>
  );
}

/**
 * "Mark refunded": says what to pay and to whom, takes the reference (1–100) and an optional note (≤ 500). The same
 * submission retried keeps its Idempotency-Key; a changed reference or note is a new write with a new key.
 */
export function MarkRefundedModal({ refund: r, onClose, onChanged }: { refund: AdminRefund | null; onClose: () => void; onChanged: () => void }) {
  const [reference, setReference] = useState('');
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const keyFor = useRef<{ body: string; key: string } | null>(null);

  useEffect(() => {
    setReference('');
    setNote('');
    setTouched(false);
    setBusy(false);
    setError(null);
    keyFor.current = null;
  }, [r?.refundId]);

  const ref = reference.trim();
  const referenceError = !ref ? 'Enter the reference' : ref.length > REFERENCE_MAX ? `Keep it under ${REFERENCE_MAX} characters` : null;
  const noteError = note.trim().length > NOTE_MAX ? `Keep the note under ${NOTE_MAX} characters` : null;

  const close = () => {
    if (!busy) onClose();
  };

  const submit = async () => {
    if (!r) return;
    setTouched(true);
    if (referenceError || noteError) return;
    const body = { reference: ref, note: note.trim() || null };
    const bodyKey = JSON.stringify(body);
    if (!keyFor.current || keyFor.current.body !== bodyKey) keyFor.current = { body: bodyKey, key: newIdempotencyKey() };
    const key = keyFor.current.key;
    setBusy(true);
    setError(null);
    try {
      await withStepUp(() => refundsApi.markRefunded(r.refundId, body, key));
      notifications.show({ color: 'forest', title: 'Refund recorded', message: `Marked refunded with reference ${ref}. The buyer is told.` });
      onChanged();
      onClose();
    } catch (caught) {
      if (caught instanceof ApiError && caught.code === REFUND_ALREADY_SETTLED) {
        notifications.show({ color: 'amber', title: 'Already refunded', message: 'Someone already marked this refund as refunded. The list is up to date now.' });
        onChanged();
        onClose();
      } else if (caught instanceof ApiError && caught.code === REFUND_NOT_MANUAL) {
        setError('This refund is still with the payment provider. Wait for it to finish — there is nothing to pay by hand.');
        onChanged();
      } else if (caught instanceof ApiError && caught.code === 'mfa.step_up_cancelled') {
        setError('Cancelled — nothing was recorded.');
      } else {
        const cid = caught instanceof ApiError && caught.correlationId ? ` (reference ${caught.correlationId})` : '';
        setError(`${messageOf(caught)}${cid}`);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={r !== null} onClose={close} title={<Text fw={650}>Mark refunded</Text>} size="md" closeOnClickOutside={!busy}>
      {r && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
          noValidate
        >
          <Stack gap="md">
            <Alert variant="light" color="blue" data-testid="refund-instruction">
              {refundInstruction(r)}
            </Alert>
            <FieldGrid
              fields={[
                { label: 'Amount', value: money(r) },
                { label: 'Order', value: r.orderNumber ? <span className="sm-mono">{r.orderNumber}</span> : null },
                { label: 'Buyer', value: r.buyer?.displayName ?? null },
                { label: 'Method', value: refundMethodLabel(r.method, r.methodName) },
              ]}
            />
            <Text size="sm">Pay it first, then record the reference here. The seller’s earnings are reversed and the buyer is told.</Text>
            <TextInput
              label="Reference"
              description={r.method === METHOD_ESEWA ? 'eSewa portal refund reference' : 'eSewa or bank transaction id'}
              required
              value={reference}
              onChange={(e) => setReference(e.currentTarget.value)}
              error={touched ? referenceError : null}
              data-autofocus
            />
            <Textarea
              label="Note (optional)"
              autosize
              minRows={2}
              maxRows={6}
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
              error={touched ? noteError : null}
            />
            {error && (
              <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert" data-testid="refund-error">
                {error}
              </Alert>
            )}
            <Group justify="flex-end" gap="sm">
              <Button variant="default" onClick={close} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                Mark refunded
              </Button>
            </Group>
          </Stack>
        </form>
      )}
    </Modal>
  );
}
