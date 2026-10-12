import { Badge, Group, Select, Text, TextInput } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { IconSearch } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import { COURIER_STATE, COURIER_TONE, couriersApi, TIER, VEHICLE, type CourierProfile } from '@/api/couriers';
import { TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { useListState } from '@/hooks/useListState';
import { fmtNumber, maskPhone } from '@/lib/format';
import { RiderDrawer } from './RiderDrawer';

const STATE_OPTIONS = Object.entries(COURIER_STATE).map(([value, label]) => ({ value, label }));

/**
 * Riders, one state at a time (the API lists a single state per call, oldest first, without a total). In the KYC
 * page it opens on "KYC in review"; on the Riders page on "Active".
 */
export function RiderQueue({ embedded = false }: { embedded?: boolean }) {
  const list = useListState(['state'] as const, { state: embedded ? '2' : '5', pageSize: 50 });
  const state = list.filters.state || (embedded ? '2' : '5');
  const navigate = useNavigate();

  const query = useQuery({
    queryKey: ['couriers', 'list', state, list.page, list.pageSize],
    queryFn: ({ signal }) => couriersApi.list(state, list.page, list.pageSize, signal),
    placeholderData: keepPreviousData,
    staleTime: 15_000,
  });

  // The list has no server search; filtering the loaded page by name/phone/email is honest about its scope.
  const needle = list.searchInput.trim().toLowerCase();
  const page = query.data && needle
    ? {
        ...query.data,
        items: query.data.items.filter((c) =>
          [c.accountDisplayName, c.accountEmail, c.accountPhone, c.id, c.accountId].some((v) => v?.toLowerCase().includes(needle)),
        ),
      }
    : query.data;

  const columns: Column<CourierProfile>[] = [
    {
      key: 'rider',
      header: 'Rider',
      render: (c) => <TwoLine primary={c.accountDisplayName ?? 'Name unknown'} secondary={c.accountPhone ? maskPhone(c.accountPhone) : c.accountEmail} />,
    },
    {
      key: 'state',
      header: 'State',
      render: (c) => (
        <Badge variant="light" color={COURIER_TONE[c.state]}>
          {COURIER_STATE[c.state] ?? c.state}
        </Badge>
      ),
    },
    { key: 'tier', header: 'Tier', render: (c) => TIER[c.currentTier] ?? '—' },
    { key: 'vehicle', header: 'Vehicle', visibleFrom: 'md', render: (c) => (c.vehicle ? VEHICLE[c.vehicle] : '—') },
    {
      key: 'reliability',
      header: 'Reliability',
      visibleFrom: 'md',
      render: (c) => (c.reliabilityScore === null ? <Text c="dimmed">—</Text> : fmtNumber(c.reliabilityScore * (c.reliabilityScore <= 1 ? 100 : 1), 0)),
    },
    {
      key: 'online',
      header: 'Online',
      visibleFrom: 'lg',
      render: (c) => (
        <Badge variant="dot" color={c.isOnline ? 'forest' : 'gray'} size="sm">
          {c.isOnline ? 'Online' : 'Offline'}
        </Badge>
      ),
    },
    { key: 'created', header: 'Applied', visibleFrom: 'sm', render: (c) => <When value={c.createdUtc} relative /> },
  ];

  return (
    <>
      <DataTable
        label="Riders"
        columns={columns}
        page={page}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(c) => c.id}
        onRowClick={(c) => list.open(c.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        pagerMode="cursor"
        filtered={!!needle}
        emptyTitle={`No riders ${COURIER_STATE[Number(state)]?.toLowerCase() ?? 'here'}`}
        emptyBody="Pick another state to see more riders."
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <Select
              label="State"
              size="sm"
              w={190}
              data={STATE_OPTIONS}
              value={state}
              onChange={(v) => list.setFilter('state', v)}
              allowDeselect={false}
            />
            <TextInput
              label="Filter this page"
              size="sm"
              w={260}
              leftSection={<IconSearch size={14} />}
              placeholder="Name, phone or email"
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.currentTarget.value)}
            />
          </Group>
        }
      />
      <RiderDrawer
        courierId={list.selected}
        onClose={() => list.open(null)}
        onOpenFull={embedded ? (id) => navigate(`/riders?open=${encodeURIComponent(id)}&state=${state}`) : undefined}
      />
    </>
  );
}
