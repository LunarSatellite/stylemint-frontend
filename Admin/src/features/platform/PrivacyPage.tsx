import { Badge, Button, Group, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { DATA_RIGHTS_STATUS, DATA_RIGHTS_TYPE, privacyApi, type DataRightsRequest } from '@/api/platform';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';
import { fmtNumber } from '@/lib/format';

const TONE: Record<number, string> = { 1: 'amber', 2: 'blue', 3: 'blue', 4: 'forest', 5: 'signal', 6: 'gray' };

/** Data-rights requests (access, erasure, correction…), due date first: verify identity, start, complete or reject. */
export function PrivacyPage() {
  const { can } = useAuth();
  const list = useListState(['status'] as const);
  const q = useQuery({
    queryKey: ['privacy', list.filters.status, list.page, list.pageSize],
    queryFn: ({ signal }) => privacyApi.queue(list.filters.status, list.page, list.pageSize, signal),
    placeholderData: keepPreviousData,
  });
  const dash = useQuery({ queryKey: ['privacy', 'dashboard'], queryFn: ({ signal }) => privacyApi.dashboard(signal), enabled: can('viewPrivacyDashboard') });
  const columns: Column<DataRightsRequest>[] = [
    { key: 'type', header: 'Request', render: (r) => <Text size="sm" fw={600}>{DATA_RIGHTS_TYPE[r.requestType]}</Text> },
    { key: 'status', header: 'Status', render: (r) => <Badge variant="light" color={TONE[r.status]}>{DATA_RIGHTS_STATUS[r.status]}</Badge> },
    {
      key: 'due',
      header: 'Due',
      render: (r) => (
        <Group gap={6} wrap="nowrap">
          <When value={r.dueAtUtc} />
          {r.status < 4 && new Date(r.dueAtUtc).getTime() < Date.now() && (
            <Badge size="xs" color="signal" variant="filled">
              Overdue
            </Badge>
          )}
        </Group>
      ),
    },
    { key: 'submitted', header: 'Submitted', visibleFrom: 'sm', render: (r) => <When value={r.submittedUtc} relative /> },
    { key: 'account', header: 'Account', visibleFrom: 'md', render: (r) => <IdText value={r.accountId} /> },
  ];
  return (
    <>
      <PageHeader title="Privacy requests" description="People exercising their data rights. Verify who they are before you act; finish before the due date." />
      <Stack gap="lg">
        {can('viewPrivacyDashboard') && (
          <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
            <MetricTile label="Data exports" value={dash.data ? fmtNumber(dash.data.dataExportRequests) : '—'} loading={dash.isLoading} tone="gray" />
            <MetricTile label="Opted out of recommendations" value={dash.data ? fmtNumber(dash.data.optOutsFromRecommendations) : '—'} loading={dash.isLoading} tone="gray" />
            <MetricTile label="Paused accounts" value={dash.data ? fmtNumber(dash.data.activePauses) : '—'} loading={dash.isLoading} tone="gray" />
            <MetricTile label="Consents withdrawn" value={dash.data ? fmtNumber(dash.data.consentWithdrawals) : '—'} loading={dash.isLoading} tone="gray" />
          </SimpleGrid>
        )}
        <DataTable
          label="Privacy requests"
          columns={columns}
          page={q.data}
          isLoading={q.isLoading}
          isFetching={q.isFetching}
          error={q.error}
          onRetry={() => void q.refetch()}
          rowKey={(r) => r.id}
          onRowClick={(r) => list.open(r.id)}
          selectedKey={list.selected}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          filtered={!!list.filters.status}
          emptyTitle="No requests"
          toolbar={<Select label="Status" w={190} clearable placeholder="Any status" data={Object.entries(DATA_RIGHTS_STATUS).map(([value, label]) => ({ value, label }))} value={list.filters.status || null} onChange={(v) => list.setFilter('status', v)} />}
        />
      </Stack>
      <RequestDrawer request={q.data?.items.find((r) => r.id === list.selected) ?? null} opened={!!list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function RequestDrawer({ request: r, opened, onClose }: { request: DataRightsRequest | null; opened: boolean; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const done = () => void queryClient.invalidateQueries({ queryKey: ['privacy'] });
  const work = can('workDataRights') && r && r.status < 4;
  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title={r ? `${DATA_RIGHTS_TYPE[r.requestType]} request` : 'Request'}
      badges={r && <Badge variant="light" color={TONE[r.status]}>{DATA_RIGHTS_STATUS[r.status]}</Badge>}
      actions={
        work && (
          <>
            {r.status === 1 && (
              <Button size="sm" onClick={() => open({ title: 'Confirm their identity', consequence: 'Record that you have verified this person owns the account (for example by a code to their verified email).', confirmLabel: 'Identity verified', run: () => privacyApi.verifyIdentity(r.id), success: 'Identity verified.', onDone: done })}>
                Identity verified…
              </Button>
            )}
            {r.status === 2 && (
              <Button size="sm" variant="light" onClick={() => open({ title: 'Start work', consequence: 'Marks the request as in progress.', confirmLabel: 'Start', run: () => privacyApi.start(r.id), success: 'Started.', onDone: done })}>
                Start
              </Button>
            )}
            {(r.status === 2 || r.status === 3) && (
              <Button
                size="sm"
                onClick={() =>
                  open({
                    title: 'Complete the request',
                    consequence: 'Marks it fulfilled. Record where the export or change can be found.',
                    confirmLabel: 'Complete',
                    fields: [{ name: 'ref', kind: 'text', label: 'Fulfilment reference (ticket, file, email)' }],
                    run: (v) => privacyApi.complete(r.id, v.ref?.trim() || null),
                    success: 'Request completed.',
                    onDone: done,
                  })
                }
              >
                Complete…
              </Button>
            )}
            <Button
              size="sm"
              variant="light"
              color="signal"
              onClick={() =>
                open({
                  title: 'Reject the request',
                  consequence: 'The person is told the request was refused, with your reason. Only reject for a lawful reason.',
                  confirmLabel: 'Reject',
                  danger: true,
                  fields: [{ name: 'reason', kind: 'textarea', label: 'Reason', required: true, minLength: 10 }],
                  run: (v) => privacyApi.reject(r.id, v.reason!.trim()),
                  success: 'Request rejected.',
                  onDone: done,
                })
              }
            >
              Reject…
            </Button>
          </>
        )
      }
    >
      {dialog}
      {r && (
        <SectionCard title="Request">
          <FieldGrid
            fields={[
              { label: 'What they asked', value: r.description, wide: true },
              { label: 'Submitted', value: <When value={r.submittedUtc} /> },
              { label: 'Due', value: <When value={r.dueAtUtc} /> },
              { label: 'Identity verified', value: <When value={r.identityVerifiedUtc} /> },
              { label: 'Started', value: <When value={r.inProgressUtc} /> },
              { label: 'Completed', value: <When value={r.completedUtc} /> },
              { label: 'Rejected', value: <When value={r.rejectedUtc} /> },
              { label: 'Rejection reason', value: r.rejectionReason, wide: true },
              { label: 'Fulfilment reference', value: r.fulfilmentReference },
              { label: 'Account', value: <IdText value={r.accountId} /> },
            ]}
          />
        </SectionCard>
      )}
    </DetailDrawer>
  );
}
