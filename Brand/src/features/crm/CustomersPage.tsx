import { useState } from 'react';
import { Avatar, Badge, Button, Card, Chip, Group, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconMapPin, IconRefresh, IconSearch, IconStarFilled, IconUsersGroup } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatMoney, formatNumber, fromNow, initialsOf } from '../../lib/format';
import { useIsPhone } from '../../lib/useIsPhone';
import { crmApi, type Customer } from './api';
import { ConsentBadge, IfCan, PrivacyNote, RequireCap } from './components';
import { CRM_KEY, usePagedQuery } from './hooks';

type Sort = 'lastOrder' | 'ltv' | 'orders' | 'name';

/** "Synced 5 minutes ago" / "Importing your past orders…" from `crm/seller/me`. */
function SyncStatus() {
  const me = useQuery({ queryKey: [CRM_KEY, 'seller-me'], queryFn: crmApi.sellerMe, staleTime: 60_000, retry: false });
  if (!me.data) return null;
  const running = me.data.backfill?.state === 'Running' || me.data.backfill?.state === 'NotStarted';
  return (
    <Group gap={6} data-testid="crm-sync-status">
      {running ? (
        <Badge variant="light" color="amber" leftSection={<IconRefresh size={11} />}>
          Importing your past orders…
        </Badge>
      ) : (
        <Text size="xs" c="dimmed">
          {formatNumber(me.data.customerCount)} customers{me.data.lastSyncedUtc ? ` · updated ${fromNow(me.data.lastSyncedUtc)}` : ''}
        </Text>
      )}
    </Group>
  );
}

function Tags({ tags }: { tags: string[] }) {
  if (tags.length === 0) return null;
  return (
    <Group gap={4}>
      {tags.slice(0, 3).map((t) => (
        <Badge key={t} size="xs" variant="outline" color="slate">
          {t}
        </Badge>
      ))}
      {tags.length > 3 && (
        <Text size="xs" c="dimmed">
          +{tags.length - 3}
        </Text>
      )}
    </Group>
  );
}

function CustomerCard({ c }: { c: Customer }) {
  return (
    <Card component={Link} to={`/crm/customers/${c.id}`} padding="md" withBorder data-interactive="true" style={{ color: 'inherit', textDecoration: 'none' }}>
      <Group wrap="nowrap" align="flex-start" gap="sm">
        <Avatar radius="xl" color={c.erased ? 'gray' : 'forest'} src={c.avatarUrl ?? undefined}>
          {initialsOf(c.name)}
        </Avatar>
        <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
          <Group justify="space-between" wrap="nowrap" gap="xs">
            <Text fw={650} truncate>
              {c.name}
            </Text>
            <ConsentBadge consent={c.marketingConsent} />
          </Group>
          <Text size="xs" c="dimmed">
            {[c.city, c.orderCount !== null ? `${formatNumber(c.orderCount)} orders` : null, c.lastOrderAt ? `last ${fromNow(c.lastOrderAt)}` : null]
              .filter(Boolean)
              .join(' · ') || 'No orders yet'}
          </Text>
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm" fw={600}>
              {c.lifetimeValue !== null ? formatMoney({ amount: c.lifetimeValue, currency: c.currency }) : '—'}
            </Text>
            <Tags tags={c.tags} />
          </Group>
        </Stack>
      </Group>
    </Card>
  );
}

function CustomerTable({ items }: { items: Customer[] }) {
  const navigate = useNavigate();
  const withTags = items.some((c) => c.tags.length > 0);
  return (
    <Card padding={0}>
      <Table.ScrollContainer minWidth={760}>
        <Table highlightOnHover verticalSpacing="sm" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Customer</Table.Th>
              <Table.Th ta="right">Orders</Table.Th>
              <Table.Th ta="right">Lifetime value</Table.Th>
              <Table.Th>Last order</Table.Th>
              <Table.Th>Reviews</Table.Th>
              <Table.Th>Marketing</Table.Th>
              {withTags && <Table.Th>Tags</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((c) => (
              <Table.Tr
                key={c.id}
                className="sm-crm-row"
                onClick={() => navigate(`/crm/customers/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') navigate(`/crm/customers/${c.id}`);
                }}
                tabIndex={0}
                aria-label={`Open ${c.name}`}
              >
                <Table.Td>
                  <Group gap="sm" wrap="nowrap">
                    <Avatar size={32} radius="xl" color="forest" src={c.avatarUrl ?? undefined}>
                      {initialsOf(c.name)}
                    </Avatar>
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} truncate>
                        {c.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {c.city ?? '—'}
                      </Text>
                    </div>
                  </Group>
                </Table.Td>
                <Table.Td ta="right">{formatNumber(c.orderCount)}</Table.Td>
                <Table.Td ta="right">{c.lifetimeValue !== null ? formatMoney({ amount: c.lifetimeValue, currency: c.currency }) : '—'}</Table.Td>
                <Table.Td>{c.lastOrderAt ? formatDate(c.lastOrderAt) : '—'}</Table.Td>
                <Table.Td>
                  {c.reviewAverage !== null ? (
                    <Group gap={4} wrap="nowrap">
                      <IconStarFilled size={13} color="#e3a600" aria-hidden />
                      <Text size="sm">
                        {c.reviewAverage.toFixed(1)}
                        {c.reviewCount ? ` (${c.reviewCount})` : ''}
                      </Text>
                    </Group>
                  ) : (
                    '—'
                  )}
                </Table.Td>
                <Table.Td>
                  <ConsentBadge consent={c.marketingConsent} />
                </Table.Td>
                {withTags && (
                  <Table.Td>
                    <Tags tags={c.tags} />
                  </Table.Td>
                )}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
    </Card>
  );
}

function CustomersList() {
  const phone = useIsPhone();
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const [city, setCity] = useState('');
  const [debouncedCity] = useDebouncedValue(city.trim(), 300);
  const [consent, setConsent] = useState<'all' | 'push' | 'email'>('all');
  const [repeat, setRepeat] = useState(false);
  const [sort, setSort] = useState<Sort>('lastOrder');
  const list = usePagedQuery({
    key: ['customers'],
    resetKey: [debounced, debouncedCity, consent, repeat, sort].join('|'),
    pageSize: 25,
    fetchPage: (page, pageSize) =>
      crmApi.customers({
        search: debounced || undefined,
        city: debouncedCity || undefined,
        consent: consent === 'all' ? undefined : consent,
        minOrders: repeat ? 2 : undefined,
        sort,
        page,
        pageSize,
      }),
  });
  const filtered = !!debounced || !!debouncedCity || consent !== 'all' || repeat;
  return (
    <>
      <PageHeader
        title="Customers"
        description="Everyone who bought from your shop on StyleMint, with their orders, returns and reviews."
        actions={
          <IfCan cap="segments.view">
            <Button component={Link} to="/crm/segments" variant="default" leftSection={<IconUsersGroup size={16} />}>
              Segments
            </Button>
          </IfCan>
        }
      />
      <Stack gap="md">
        <SyncStatus />
        <PrivacyNote />
        <Group gap="sm" wrap="wrap" align="flex-end">
          <TextInput
            style={{ flex: '1 1 240px' }}
            leftSection={<IconSearch size={16} />}
            placeholder="Search by name"
            aria-label="Search customers"
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
          />
          <TextInput
            style={{ flex: '1 1 150px' }}
            leftSection={<IconMapPin size={16} />}
            placeholder="City"
            aria-label="Filter by city"
            value={city}
            onChange={(e) => setCity(e.currentTarget.value)}
          />
          <Select
            style={{ flex: '1 1 170px' }}
            aria-label="Marketing consent"
            data={[
              { value: 'all', label: 'Everyone' },
              { value: 'push', label: 'Gets app offers' },
              { value: 'email', label: 'Gets email offers' },
            ]}
            value={consent}
            onChange={(v) => setConsent((v as 'all' | 'push' | 'email') ?? 'all')}
            allowDeselect={false}
          />
          <Select
            style={{ flex: '1 1 170px' }}
            aria-label="Sort customers"
            data={[
              { value: 'lastOrder', label: 'Latest order first' },
              { value: 'ltv', label: 'Highest spend first' },
              { value: 'orders', label: 'Most orders first' },
              { value: 'name', label: 'Name A–Z' },
            ]}
            value={sort}
            onChange={(v) => setSort((v as Sort) ?? 'lastOrder')}
            allowDeselect={false}
          />
          <Chip checked={repeat} onChange={setRepeat} variant="light">
            Repeat buyers
          </Chip>
        </Group>
        {list.query.isPending ? (
          <ListSkeleton rows={6} height={phone ? 96 : 52} />
        ) : list.query.error ? (
          <ErrorBlock error={list.query.error} title="Could not load customers" onRetry={() => void list.query.refetch()} />
        ) : list.items.length === 0 ? (
          <EmptyBlock
            title={filtered ? 'No customers match' : 'No customers yet'}
            body={filtered ? 'Try another name or filter.' : 'Buyers appear here after their first order from your shop.'}
          />
        ) : phone ? (
          <Stack gap="sm" data-testid="customer-cards">
            {list.items.map((c) => (
              <CustomerCard key={c.id} c={c} />
            ))}
          </Stack>
        ) : (
          <CustomerTable items={list.items} />
        )}
        <Pager
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          shown={list.items.length}
          hasPrev={list.hasPrev}
          hasNext={list.hasNext}
          onPrev={list.prev}
          onNext={list.next}
          busy={list.query.isFetching}
        />
      </Stack>
    </>
  );
}

export default function CustomersPage() {
  return (
    <RequireCap cap="customers.view">
      <CustomersList />
    </RequireCap>
  );
}
