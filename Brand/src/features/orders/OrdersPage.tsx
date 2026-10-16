import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Badge,
  Button,
  Card,
  Checkbox,
  Group,
  ScrollArea,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { IconCheck, IconPrinter, IconRefresh, IconSearch, IconX } from '@tabler/icons-react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDateTime, formatMoney } from '../../lib/format';
import { POLL_MS } from '../../lib/live';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { useIsPhone } from '../../lib/useIsPhone';
import { ORDER_TABS, ordersApi, SubOrderState, type SubOrderListItem } from './api';
import { ChannelBadge, OrderCard, OrderStateBadge } from './components';
import { PlanBadge, planSummary } from './PaymentCard';

function matches(order: SubOrderListItem, term: string) {
  const t = term.trim().toLowerCase().replace(/^#/, '');
  if (!t) return true;
  return order.orderNumber.toLowerCase().includes(t) || order.receiverName.toLowerCase().includes(t);
}

export default function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const tabId = params.get('tab') ?? 'new';
  const tab = ORDER_TABS.find((t) => t.id === tabId) ?? ORDER_TABS[0];
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const counts = useQueries({
    queries: ORDER_TABS.filter((t) => t.id !== 'all').map((t) => ({
      queryKey: ['orders', 'count', t.id],
      queryFn: () => ordersApi.count(t.states),
      refetchInterval: POLL_MS,
    })),
  });
  const countOf = (id: string) => {
    const index = ORDER_TABS.filter((t) => t.id !== 'all').findIndex((t) => t.id === id);
    return index >= 0 ? counts[index]?.data : undefined;
  };

  const searching = search.trim().length > 0;
  // No server-side search: with a search term, read a large page of this tab and filter it here.
  const list = useCursorList({
    key: ['orders', 'list', tab.id],
    resetKey: `${tab.id}|${searching}`,
    fetchPage: (cursor) => ordersApi.list({ states: tab.states, pageSize: searching ? 100 : 25 }, cursor),
    refetchInterval: POLL_MS,
  });
  const allItems = list.query.data?.items;
  const items = useMemo(() => (allItems ?? []).filter((o) => matches(o, search)), [allItems, search]);

  const switchTab = (id: string | null) => {
    setSelected(new Set());
    setParams(id && id !== 'new' ? { tab: id } : {}, { replace: true });
  };

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allSelected = items.length > 0 && items.every((o) => selected.has(o.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((o) => o.id)));

  const selectedOrders = items.filter((o) => selected.has(o.id));
  const acceptable = selectedOrders.filter((o) => o.state === SubOrderState.Paid || o.state === SubOrderState.AwaitingFulfillment);

  const bulkAccept = useMutation({
    mutationFn: (ids: string[]) => ordersApi.bulkAccept(ids),
    onSuccess: (res) => {
      if (res.failureCount === 0) toastSuccess(`${res.successCount} ${res.successCount === 1 ? 'order' : 'orders'} accepted`);
      else
        toastError(
          new Error(
            `${res.successCount} accepted, ${res.failureCount} could not be accepted: ${
              res.items.find((i) => !i.success)?.errorMessage ?? 'unknown reason'
            }`,
          ),
          'Some orders were not accepted',
        );
      setSelected(new Set());
      void qc.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: (e) => toastError(e, 'Could not accept the orders'),
  });

  const onBulkAccept = async () => {
    const ids = acceptable.map((o) => o.id);
    if (!ids.length) return;
    const ok = await confirmAction({
      title: `Accept ${ids.length} ${ids.length === 1 ? 'order' : 'orders'}?`,
      body: 'Customers will be told you are preparing their order.',
      confirmLabel: 'Accept',
    });
    if (ok) bulkAccept.mutate(ids);
  };

  const printSlips = () => {
    const ids = selectedOrders.map((o) => o.id);
    if (ids.length) navigate(`/orders/packing-slips?ids=${ids.join(',')}`);
  };

  const urgentTotal = useQuery({
    queryKey: ['orders', 'count', 'urgent'],
    queryFn: () => ordersApi.count([2, 3, 12, 13]),
    refetchInterval: POLL_MS,
  });

  return (
    <>
      <PageHeader
        title="Orders"
        description={
          urgentTotal.data
            ? `${urgentTotal.data} ${urgentTotal.data === 1 ? 'order needs' : 'orders need'} your action.`
            : 'Accept, pack and hand over your orders.'
        }
        actions={
          <Tooltip label="Refresh">
            <ActionIcon
              variant="default"
              size="lg"
              aria-label="Refresh orders"
              loading={list.query.isFetching}
              onClick={() => void qc.invalidateQueries({ queryKey: ['orders'] })}
            >
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        }
      />

      <Tabs value={tab.id} onChange={switchTab} variant="pills" radius="md" keepMounted={false}>
        <ScrollArea type="never" offsetScrollbars={false} mb="md">
          <Tabs.List style={{ flexWrap: 'nowrap' }}>
            {ORDER_TABS.map((t) => {
              const c = countOf(t.id);
              return (
                <Tabs.Tab
                  key={t.id}
                  value={t.id}
                  rightSection={
                    c !== undefined && t.id !== 'all' ? (
                      <Badge size="sm" variant={t.urgent && c > 0 ? 'filled' : 'light'} color={t.urgent && c > 0 ? 'amber' : 'gray'} circle={c < 10}>
                        {c}
                      </Badge>
                    ) : null
                  }
                >
                  {t.label}
                </Tabs.Tab>
              );
            })}
          </Tabs.List>
        </ScrollArea>
      </Tabs>

      <Group justify="space-between" mb="md" gap="sm" wrap="wrap">
        <TextInput
          placeholder="Search order number or customer"
          leftSection={<IconSearch size={16} />}
          rightSection={
            search ? (
              <ActionIcon variant="subtle" color="gray" onClick={() => setSearch('')} aria-label="Clear search">
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: '1 1 260px', maxWidth: 420 }}
          aria-label="Search orders"
        />
        {selected.size > 0 && (
          <Group gap="xs">
            <Text size="sm" c="dimmed">
              {selected.size} selected
            </Text>
            {acceptable.length > 0 && (
              <Button size="sm" leftSection={<IconCheck size={16} />} loading={bulkAccept.isPending} onClick={() => void onBulkAccept()}>
                Accept {acceptable.length}
              </Button>
            )}
            <Button size="sm" variant="default" leftSection={<IconPrinter size={16} />} onClick={printSlips}>
              Packing slips
            </Button>
            <Button size="sm" variant="subtle" color="gray" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </Group>
        )}
      </Group>

      {list.query.isPending ? (
        <ListSkeleton rows={6} height={isPhone ? 92 : 48} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load your orders" />
      ) : items.length === 0 ? (
        <Card>
          <EmptyBlock
            title={searching ? 'No orders match your search' : tab.id === 'new' ? 'No new orders right now' : 'No orders here'}
            body={
              searching
                ? 'Try the full order number, or the customer’s name as written on the order.'
                : tab.id === 'new'
                  ? 'New orders appear here as soon as a customer pays. This page refreshes by itself.'
                  : undefined
            }
          />
        </Card>
      ) : isPhone ? (
        <Stack gap="sm">
          {items.length > 1 && (
            <Checkbox label="Select all on this page" checked={allSelected} onChange={toggleAll} size="sm" />
          )}
          {items.map((o) => (
            <OrderCard key={o.id} order={o} selected={selected.has(o.id)} onToggle={selected.size > 0 ? () => toggle(o.id) : undefined} />
          ))}
          {selected.size === 0 && items.length > 0 && (
            <Text size="xs" c="dimmed" ta="center">
              Tip: tick “Select all” to accept or print several orders at once.
            </Text>
          )}
        </Stack>
      ) : (
        <Card padding={0}>
          <Table.ScrollContainer minWidth={760}>
            <Table verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <Checkbox aria-label="Select all orders on this page" checked={allSelected} onChange={toggleAll} />
                  </Table.Th>
                  <Table.Th>Order</Table.Th>
                  <Table.Th>Customer</Table.Th>
                  <Table.Th>Placed</Table.Th>
                  <Table.Th>Items</Table.Th>
                  <Table.Th ta="right">Total</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((o) => (
                  <Table.Tr key={o.id} className="sm-row-link" onClick={() => navigate(`/orders/${o.id}`)}>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Checkbox aria-label={`Select order ${o.orderNumber}`} checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                    </Table.Td>
                    <Table.Td>
                      <Anchor component={Link} to={`/orders/${o.id}`} fw={600} size="sm" c="inherit" onClick={(e) => e.stopPropagation()}>
                        #{o.orderNumber}
                      </Anchor>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{o.receiverName}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {formatDateTime(o.placedUtc)}
                      </Text>
                    </Table.Td>
                    <Table.Td>{o.itemCount}</Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm" fw={600}>
                        {formatMoney({ amount: o.subtotalAmount, currency: o.subtotalCurrency })}
                      </Text>
                      {o.paymentPlan && (
                        <Text size="xs" c="dimmed" data-testid={`plan-${o.id}`}>
                          {planSummary(o.paymentPlan)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <OrderStateBadge state={o.state} />
                        <ChannelBadge channel={o.fulfillmentChannel} />
                        <PlanBadge plan={o.paymentPlan} />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}

      {!searching && (
        <Pager
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          shown={items.length}
          hasPrev={list.hasPrev}
          hasNext={list.hasNext}
          onPrev={list.prev}
          onNext={list.next}
          busy={list.query.isFetching}
        />
      )}
      {searching && list.hasNext && (
        <Text size="xs" c="dimmed" mt="sm">
          Searched the latest 100 orders in this tab.
        </Text>
      )}
    </>
  );
}
