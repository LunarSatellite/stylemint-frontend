import { useEffect, useState } from 'react';
import { Badge, Button, Group, Select, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { IconArchive, IconSearch } from '@tabler/icons-react';
import { useNavigate, useParams } from 'react-router-dom';
import { channelLabel, ordersApi, SUB_ORDER_STATE, SUB_ORDER_TONE, type AdminSubOrderRow } from '@/api/orders';
import { useAuth } from '@/auth/guards';
import { IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';
import { fmtMoney } from '@/lib/format';
import { BulkArchiveDialog } from './BulkArchiveDialog';
import { OrderDrawer } from './OrderDrawer';

const VISIBILITY = [
  { value: '', label: 'Live orders' },
  { value: 'include', label: 'Including hidden' },
  { value: 'only', label: 'Hidden only' },
];

/** YYYY-MM-DD in local time (toISOString would shift the day in UTC+5:45). */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromYmd(s: string) {
  return new Date(`${s}T00:00:00`);
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

/**
 * Every vendor's orders, newest first. One row per vendor part of an order (a sub-order), because that is the unit
 * that moves through fulfilment; the drawer shows the whole order. The API has no free-text search, so look an order
 * up by its number.
 */
export function OrdersPage() {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const list = useListState(['state', 'vendor', 'from', 'to', 'archived'] as const, { pageSize: 25 });
  const f = list.filters;
  const resetKey = `${f.state}|${f.vendor}|${f.from}|${f.to}|${f.archived}|${list.pageSize}`;
  const cursors = useCursorPages(resetKey, list.page, list.setPage);
  const [lookup, setLookup] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);

  const query = useQuery({
    queryKey: ['orders', 'list', resetKey, cursors.cursor, list.page],
    queryFn: ({ signal }) =>
      ordersApi.list(
        {
          state: f.state,
          vendorAccountId: f.vendor,
          placedFromUtc: f.from ? dayStart(fromYmd(f.from)) : undefined,
          placedToUtc: f.to ? dayEnd(fromYmd(f.to)) : undefined,
          includeArchived: f.archived === 'include',
          archivedOnly: f.archived === 'only',
          cursor: cursors.cursor,
          pageSize: list.pageSize,
        },
        list.page,
        signal,
      ),
    enabled: cursors.ready,
    placeholderData: keepPreviousData,
  });

  useEffect(() => {
    if (query.data) cursors.remember(list.page, query.data.nextCursor);
  }, [query.data, list.page, cursors]);

  const openNumber = orderNumber ?? list.selected;
  const openOrder = (n: string | null) => {
    if (orderNumber) navigate(`/orders${window.location.search}`, { replace: true });
    list.open(n);
  };

  const columns: Column<AdminSubOrderRow>[] = [
    {
      key: 'order',
      header: 'Order',
      render: (r) => (
        <Group gap={6} wrap="nowrap">
          <TwoLine primary={<span className="sm-mono">{r.orderNumber}</span>} secondary={r.receiverName} />
          {r.archivedUtc && (
            <Badge size="xs" variant="outline" color="gray">
              Hidden
            </Badge>
          )}
        </Group>
      ),
    },
    { key: 'vendor', header: 'Vendor', render: (r) => r.vendorName ?? <IdText value={r.vendorAccountId} /> },
    {
      key: 'state',
      header: 'State',
      render: (r) => (
        <Badge variant="light" color={SUB_ORDER_TONE[r.state]}>
          {SUB_ORDER_STATE[r.state] ?? r.state}
        </Badge>
      ),
    },
    { key: 'items', header: 'Items', align: 'right', visibleFrom: 'lg', render: (r) => r.itemCount },
    { key: 'total', header: 'Total', align: 'right', render: (r) => <Text size="sm" style={{ whiteSpace: 'nowrap' }}>{fmtMoney(r.subtotalAmount, r.subtotalCurrency)}</Text> },
    { key: 'channel', header: 'Fulfilment', visibleFrom: 'lg', render: (r) => channelLabel(r.fulfillmentChannel) },
    { key: 'placed', header: 'Placed', visibleFrom: 'sm', render: (r) => <When value={r.placedUtc} relative /> },
  ];

  return (
    <>
      <PageHeader
        title="Orders"
        description="All vendors’ orders. Open one for the buyer, lines, delivery, refunds and hiding test orders."
        actions={
          <>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (lookup.trim()) openOrder(lookup.trim());
              }}
            >
              <Group gap="xs" wrap="nowrap">
                <TextInput aria-label="Find an order by number" placeholder="Order number" leftSection={<IconSearch size={14} />} value={lookup} onChange={(e) => setLookup(e.currentTarget.value)} w={220} />
                <Button type="submit" variant="default" disabled={!lookup.trim()}>
                  Open
                </Button>
              </Group>
            </form>
            {can('archiveOrders') && (
              <Button variant="light" leftSection={<IconArchive size={16} />} onClick={() => setBulkOpen(true)}>
                Hide orders…
              </Button>
            )}
          </>
        }
      />
      <DataTable
        label="Orders"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading || !cursors.ready}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(r) => r.id}
        onRowClick={(r) => openOrder(r.orderNumber)}
        selectedKey={query.data?.items.find((r) => r.orderNumber === openNumber)?.id ?? null}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        pagerMode="cursor"
        filtered={list.filtered}
        emptyTitle="No orders yet"
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <Select
              label="State"
              w={190}
              clearable
              placeholder="Any state"
              data={Object.entries(SUB_ORDER_STATE).map(([value, label]) => ({ value, label }))}
              value={f.state || null}
              onChange={(v) => list.setFilter('state', v)}
            />
            <DatePickerInput
              type="range"
              label="Placed"
              placeholder="Any date"
              clearable
              w={250}
              maxDate={new Date()}
              value={[f.from ? fromYmd(f.from) : null, f.to ? fromYmd(f.to) : null]}
              onChange={([from, to]) => {
                list.setFilter('from', from ? ymd(from) : null);
                list.setFilter('to', to ? ymd(to) : null);
              }}
            />
            <Select label="Visibility" w={170} data={VISIBILITY} value={f.archived} onChange={(v) => list.setFilter('archived', v || null)} allowDeselect={false} />
            {f.vendor && (
              <Group gap={6} mb={6}>
                <Text size="sm" c="dimmed">
                  Vendor
                </Text>
                <IdText value={f.vendor} />
                <Button size="compact-xs" variant="subtle" onClick={() => list.setFilter('vendor', null)}>
                  Clear
                </Button>
              </Group>
            )}
            {query.data?.total !== undefined && (
              <Text size="sm" c="dimmed" mb={6} ml="auto">
                {query.data.total.toLocaleString()} vendor orders
              </Text>
            )}
          </Group>
        }
      />
      <OrderDrawer orderNumber={openNumber} onClose={() => openOrder(null)} />
      {can('archiveOrders') && <BulkArchiveDialog opened={bulkOpen} onClose={() => setBulkOpen(false)} vendorAccountId={f.vendor || undefined} />}
    </>
  );
}
