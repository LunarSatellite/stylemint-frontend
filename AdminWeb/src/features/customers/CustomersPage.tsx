import { Avatar, Badge, Button, Group, Select, Stack, Text, TextInput } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconPlayerPause, IconPlayerPlay, IconSearch } from '@tabler/icons-react';
import { ACCOUNT_STATUS, ACCOUNT_TONE, customersApi, type CustomerRow } from '@/api/people';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, TwoLine, When, YesNo } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';
import { maskEmail, maskPhone } from '@/lib/format';

/** Buyers. There is no customer detail endpoint, so the drawer shows the list row and the actions. */
export function CustomersPage() {
  const list = useListState(['status'] as const);
  const query = useQuery({
    queryKey: ['customers', 'list', list.search, list.filters.status, list.page, list.pageSize],
    queryFn: ({ signal }) => customersApi.list({ search: list.search, status: list.filters.status, page: list.page, pageSize: Math.min(100, list.pageSize) }, signal),
    placeholderData: keepPreviousData,
  });

  const columns: Column<CustomerRow>[] = [
    {
      key: 'name',
      header: 'Customer',
      render: (c) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar src={c.avatarUrl} radius="xl" size={32} alt="">
            {c.displayName.slice(0, 1)}
          </Avatar>
          <TwoLine primary={c.displayName || 'No name'} secondary={c.primaryEmail ? maskEmail(c.primaryEmail) : c.primaryPhone ? maskPhone(c.primaryPhone) : null} />
        </Group>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (c) => (
        <Badge variant="light" color={ACCOUNT_TONE[c.status]}>
          {ACCOUNT_STATUS[c.status] ?? c.status}
        </Badge>
      ),
    },
    {
      key: 'verified',
      header: 'Verified',
      visibleFrom: 'md',
      render: (c) => (
        <Group gap={4}>
          {c.emailVerified && (
            <Badge size="xs" variant="outline">
              Email
            </Badge>
          )}
          {c.phoneVerified && (
            <Badge size="xs" variant="outline">
              Phone
            </Badge>
          )}
          {!c.emailVerified && !c.phoneVerified && (
            <Text size="sm" c="dimmed">
              —
            </Text>
          )}
        </Group>
      ),
    },
    { key: 'active', header: 'Last active', visibleFrom: 'sm', render: (c) => <When value={c.lastActiveUtc} relative /> },
    { key: 'joined', header: 'Joined', visibleFrom: 'lg', render: (c) => <When value={c.createdUtc} /> },
  ];

  return (
    <>
      <PageHeader title="Customers" description="Buyers on StyleMint. Search by name, email or phone; suspend an account that abuses the platform." />
      <DataTable
        label="Customers"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(c) => c.id}
        onRowClick={(c) => list.open(c.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        filtered={list.filtered}
        emptyTitle="No customers yet"
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <TextInput label="Search" placeholder="Name, email or phone" leftSection={<IconSearch size={14} />} w={300} value={list.searchInput} onChange={(e) => list.setSearchInput(e.currentTarget.value)} />
            <Select
              label="Status"
              w={170}
              clearable
              placeholder="Any status"
              data={Object.entries(ACCOUNT_STATUS).map(([value, label]) => ({ value, label }))}
              value={list.filters.status || null}
              onChange={(v) => list.setFilter('status', v)}
            />
          </Group>
        }
      />
      <CustomerDrawer customer={query.data?.items.find((c) => c.id === list.selected) ?? null} open={!!list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function CustomerDrawer({ customer: c, open: opened, onClose }: { customer: CustomerRow | null; open: boolean; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['customers'] });
  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title={c?.displayName ?? 'Customer'}
      badges={
        c && (
          <Badge variant="light" color={ACCOUNT_TONE[c.status]}>
            {ACCOUNT_STATUS[c.status]}
          </Badge>
        )
      }
      actions={
        c &&
        can('suspendCustomers') &&
        (c.status === 1 ? (
          <Button
            size="sm"
            variant="light"
            color="signal"
            leftSection={<IconPlayerPause size={16} />}
            onClick={() =>
              open({
                title: `Suspend ${c.displayName}`,
                consequence: 'They are signed out and cannot sign in, buy or post until reinstated. Open orders continue.',
                confirmLabel: 'Suspend account',
                danger: true,
                fields: [{ name: 'reason', kind: 'textarea', label: 'Reason (kept in the audit log)', required: true, minLength: 5 }],
                run: (v) => customersApi.suspend(c.id, v.reason!.trim()),
                success: 'Account suspended.',
                onDone: refresh,
              })
            }
          >
            Suspend
          </Button>
        ) : c.status === 2 ? (
          <Button
            size="sm"
            leftSection={<IconPlayerPlay size={16} />}
            onClick={() =>
              open({
                title: `Reinstate ${c.displayName}`,
                consequence: 'They can sign in and use StyleMint again.',
                confirmLabel: 'Reinstate account',
                run: () => customersApi.reinstate(c.id),
                success: 'Account reinstated.',
                onDone: refresh,
              })
            }
          >
            Reinstate
          </Button>
        ) : null)
      }
    >
      {dialog}
      {!c ? (
        <Text size="sm" c="dimmed">
          This customer isn’t on the current page any more. Close and search for them again.
        </Text>
      ) : (
        <Stack gap="lg">
          <SectionCard title="Account">
            <FieldGrid
              fields={[
                { label: 'Email', value: c.primaryEmail ? maskEmail(c.primaryEmail) : null },
                { label: 'Email verified', value: <YesNo value={c.emailVerified} /> },
                { label: 'Phone', value: c.primaryPhone ? maskPhone(c.primaryPhone) : null },
                { label: 'Phone verified', value: <YesNo value={c.phoneVerified} /> },
                { label: 'Country', value: c.countryCode },
                { label: 'Language', value: c.locale },
                { label: 'Time zone', value: c.timezone },
                { label: 'Last active', value: <When value={c.lastActiveUtc} /> },
                { label: 'Joined', value: <When value={c.createdUtc} /> },
                { label: 'Account ID', value: <IdText value={c.id} /> },
              ]}
            />
          </SectionCard>
        </Stack>
      )}
    </DetailDrawer>
  );
}
