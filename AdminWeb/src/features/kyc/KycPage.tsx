import { Badge, Group, Select, Switch, Tabs, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { IconBuildingStore, IconMotorbike, IconUser, IconVideo } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { APPLICANT_KIND, DECISION_LABEL, DECISION_TONE, kycApi, REVIEW_STATE, REVIEW_STATE_LABEL, type KycApplicantKind, type KycReviewItem } from '@/api/kyc';
import { useAuth } from '@/auth/guards';
import { IdText, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useListState } from '@/hooks/useListState';
import { RiderQueue } from '@/features/riders/RiderQueue';
import { KycDetailDrawer } from './KycDetail';

const TABS = [
  { value: 'vendors', label: 'Vendors', kind: APPLICANT_KIND.Vendor, icon: IconBuildingStore },
  { value: 'creators', label: 'Creators', kind: APPLICANT_KIND.Creator, icon: IconVideo },
  { value: 'customers', label: 'Customers (EMI)', kind: APPLICANT_KIND.Customer, icon: IconUser },
  { value: 'riders', label: 'Riders', kind: null, icon: IconMotorbike },
] as const;

/**
 * One review queue with a tab per applicant: vendors, creators and buyers applying for EMI come from the admin KYC
 * queue; riders (delivery partners) are reviewed through the courier endpoints, because the KYC queue has no courier
 * applicant kind.
 */
export function KycPage() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.value === params.get('tab')) ?? TABS[0]).value;
  const { can } = useAuth();

  const setTab = (value: string | null) => {
    if (!value) return;
    setParams(new URLSearchParams({ tab: value }), { replace: true });
  };

  return (
    <>
      <PageHeader
        title="KYC & applications"
        description="Every identity review in one place. Oldest due first - claim one, compare the documents, decide with a reason."
      />
      <Tabs value={tab} onChange={setTab} keepMounted={false} variant="outline" radius="md">
        <Tabs.List mb="md">
          {TABS.filter((t) => t.kind !== null || can('viewRiders')).map((t) => (
            <Tabs.Tab key={t.value} value={t.value} leftSection={<t.icon size={16} aria-hidden />}>
              {t.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>
        {TABS.map((t) => (
          <Tabs.Panel key={t.value} value={t.value}>
            {t.kind === null ? <RiderQueue embedded /> : <KycQueue kind={t.kind} label={t.label} />}
          </Tabs.Panel>
        ))}
      </Tabs>
    </>
  );
}

function isOverdue(item: KycReviewItem) {
  return item.state !== REVIEW_STATE.Decided && new Date(item.dueByUtc).getTime() < Date.now();
}

export function KycQueue({ kind, label }: { kind: KycApplicantKind; label: string }) {
  const list = useListState(['state', 'overdue'] as const, { state: String(REVIEW_STATE.Pending) });
  const { claims } = useAuth();
  const state = list.filters.state === 'all' ? null : Number(list.filters.state) || null;
  const overdueOnly = list.filters.overdue === '1';

  const query = useQuery({
    queryKey: ['kyc', 'queue', kind, state, overdueOnly, list.page, list.pageSize],
    queryFn: ({ signal }) => kycApi.queue({ applicantKind: kind, state: state as never, overdueOnly, page: list.page, pageSize: list.pageSize }, signal),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });

  const columns: Column<KycReviewItem>[] = [
    {
      key: 'applicant',
      header: 'Application',
      render: (r) => (
        <Group gap={6} wrap="nowrap">
          <IdText value={r.accountId} />
        </Group>
      ),
    },
    { key: 'submitted', header: 'Submitted', render: (r) => <When value={r.submittedUtc} relative /> },
    {
      key: 'due',
      header: 'Due by',
      render: (r) => (
        <Group gap={6} wrap="nowrap">
          <When value={r.dueByUtc} />
          {isOverdue(r) && (
            <Badge size="xs" color="signal" variant="filled">
              Overdue
            </Badge>
          )}
        </Group>
      ),
    },
    {
      key: 'state',
      header: 'State',
      render: (r) => (
        <Badge variant="light" color={r.state === REVIEW_STATE.Decided ? 'gray' : r.state === REVIEW_STATE.InReview ? 'blue' : 'amber'}>
          {REVIEW_STATE_LABEL[r.state]}
        </Badge>
      ),
    },
    {
      key: 'reviewer',
      header: 'Reviewer',
      visibleFrom: 'md',
      render: (r) =>
        r.assignedReviewerId ? (
          r.assignedReviewerId === claims?.adminAccountId ? (
            <Text size="sm" fw={600}>
              You
            </Text>
          ) : (
            <IdText value={r.assignedReviewerId} />
          )
        ) : (
          <Text size="sm" c="dimmed">
            Unassigned
          </Text>
        ),
    },
    {
      key: 'decision',
      header: 'Decision',
      visibleFrom: 'sm',
      render: (r) =>
        r.decision ? (
          <Badge variant="light" color={DECISION_TONE[String(r.decision)]}>
            {DECISION_LABEL[String(r.decision)]}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
  ];

  return (
    <>
      <DataTable
        label={`${label} KYC queue`}
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
        filtered={overdueOnly || (list.filters.state !== String(REVIEW_STATE.Pending) && list.filters.state !== 'all')}
        emptyTitle="Queue is clear"
        emptyBody={`No ${label.toLowerCase()} applications are waiting in this state.`}
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <Select
              label="State"
              size="sm"
              w={180}
              data={[
                { value: String(REVIEW_STATE.Pending), label: 'Pending' },
                { value: String(REVIEW_STATE.InReview), label: 'In review' },
                { value: String(REVIEW_STATE.Decided), label: 'Decided' },
                { value: 'all', label: 'All states' },
              ]}
              value={list.filters.state || String(REVIEW_STATE.Pending)}
              onChange={(v) => list.setFilter('state', v === String(REVIEW_STATE.Pending) ? null : v)}
              allowDeselect={false}
            />
            <Switch label="Overdue only" checked={overdueOnly} onChange={(e) => list.setFilter('overdue', e.currentTarget.checked ? '1' : null)} mb={6} />
            {query.data?.total !== undefined && (
              <Text size="sm" c="dimmed" mb={6} ml="auto">
                {query.data.total.toLocaleString()} {query.data.total === 1 ? 'application' : 'applications'}
              </Text>
            )}
          </Group>
        }
      />
      <KycDetailDrawer itemId={list.selected} onClose={() => list.open(null)} />
    </>
  );
}
