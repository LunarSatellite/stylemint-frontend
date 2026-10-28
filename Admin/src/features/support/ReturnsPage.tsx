import { Alert, Avatar, Badge, Button, Group, List, SegmentedControl, Select, Skeleton, Stack, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { IconAlertTriangle, IconCircleCheck, IconReceipt } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';
import { FARE_PAYER, label, REASON_CATEGORY } from '@/api/returnPickups';
import { RETURN_RESOLUTION, RETURN_STATE, RETURN_TONE, returnsApi, type ReturnItem } from '@/api/support';
import { PickupStageBadge, ReturnPickupFacts, ReturnPickupsList } from './ReturnPickups';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock, SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';

/**
 * Returns buyers have asked for. Read-only here: vendors approve or reject their own returns; support watches the
 * queue and checks the evidence (scan-to-receive, chain of custody, product passport) when a vendor and buyer disagree.
 */
export function ReturnsPage() {
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'pickups' ? 'pickups' : 'requests';
  return (
    <>
      <PageHeader
        title="Returns"
        description={
          view === 'pickups'
            ? 'Rider pickups for returns: stage, rider, fare and who pays. Read-only.'
            : 'Return requests across all vendors, newest first. Vendors decide; open one to check the evidence.'
        }
      />
      <SegmentedControl
        mb="md"
        value={view}
        onChange={(v) => setParams(v === 'pickups' ? { view: 'pickups' } : {}, { replace: true })}
        data={[
          { value: 'requests', label: 'Requests' },
          { value: 'pickups', label: 'Rider pickups' },
        ]}
        aria-label="Returns view"
      />
      {view === 'pickups' ? <ReturnPickupsList /> : <ReturnRequestsList />}
    </>
  );
}

function ReturnRequestsList() {
  const list = useListState(['state'] as const, { state: '1' });
  const state = list.filters.state || '1';
  const query = useQuery({
    queryKey: ['returns', state, list.page, list.pageSize],
    queryFn: ({ signal }) => returnsApi.queue(state, list.page, list.pageSize, signal),
    placeholderData: keepPreviousData,
  });

  const columns: Column<ReturnItem>[] = [
    {
      key: 'product',
      header: 'Item',
      render: (r) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar src={r.thumbnailUrlSnapshot} radius="sm" size={36} alt="">
            {r.productTitleSnapshot.slice(0, 1)}
          </Avatar>
          <TwoLine primary={r.productTitleSnapshot} secondary={`${r.quantity} × ${r.variantLabelSnapshot ?? ''}`} />
        </Group>
      ),
    },
    { key: 'order', header: 'Order', render: (r) => <span className="sm-mono">{r.orderNumber}</span> },
    { key: 'resolution', header: 'Wants', visibleFrom: 'md', render: (r) => RETURN_RESOLUTION[r.resolution] ?? '—' },
    {
      key: 'state',
      header: 'State',
      render: (r) => (
        <Badge variant="light" color={RETURN_TONE[r.state]}>
          {RETURN_STATE[r.state]}
        </Badge>
      ),
    },
    { key: 'pickup', header: 'Pickup', visibleFrom: 'md', render: (r) => <PickupStageBadge stage={r.pickupStage} /> },
    { key: 'submitted', header: 'Submitted', visibleFrom: 'sm', render: (r) => <When value={r.submittedUtc} relative /> },
  ];

  return (
    <>
      <DataTable
        label="Returns"
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
        filtered={state !== '1'}
        emptyTitle="No returns waiting"
        emptyBody="Nothing has been submitted that a vendor hasn’t handled."
        toolbar={
          <Select
            label="State"
            w={180}
            data={Object.entries(RETURN_STATE).map(([value, label]) => ({ value, label }))}
            value={state}
            onChange={(v) => list.setFilter('state', v === '1' ? null : v)}
            allowDeselect={false}
          />
        }
      />
      <ReturnDrawer item={query.data?.items.find((r) => r.id === list.selected) ?? null} opened={!!list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function ReturnDrawer({ item: r, opened, onClose }: { item: ReturnItem | null; opened: boolean; onClose: () => void }) {
  const evidence = useQuery({ queryKey: ['returns', 'evidence', r?.id], queryFn: ({ signal }) => returnsApi.evidence(r!.id, signal), enabled: !!r, staleTime: 60_000 });
  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title={r?.productTitleSnapshot ?? 'Return'}
      subtitle={r ? `Order ${r.orderNumber}` : undefined}
      badges={
        r && (
          <Badge variant="light" color={RETURN_TONE[r.state]}>
            {RETURN_STATE[r.state]}
          </Badge>
        )
      }
      actions={
        r && (
          <Button size="sm" variant="default" leftSection={<IconReceipt size={16} />} component={Link} to={`/orders/${encodeURIComponent(r.orderNumber)}`}>
            Open order
          </Button>
        )
      }
    >
      {!r ? (
        <Text size="sm" c="dimmed">
          This return isn’t on the current page any more.
        </Text>
      ) : (
        <Stack gap="lg">
          <SectionCard title="Request">
            <FieldGrid
              fields={[
                { label: 'Reason given', value: r.reason, wide: true },
                { label: 'Reason type', value: r.reasonCategory ? label(REASON_CATEGORY, r.reasonCategory) : null },
                { label: 'Pickup fee paid by', value: r.pickupFarePayer ? label(FARE_PAYER, r.pickupFarePayer) : null },
                { label: 'Wants', value: RETURN_RESOLUTION[r.resolution] },
                { label: 'Quantity', value: String(r.quantity) },
                { label: 'Submitted', value: <When value={r.submittedUtc} /> },
                { label: 'Resolved', value: <When value={r.resolvedUtc} /> },
                { label: 'Vendor’s rejection note', value: r.rejectionNote, wide: true },
                { label: 'Buyer', value: <IdText value={r.customerAccountId} /> },
                { label: 'Vendor', value: <IdText value={r.vendorAccountId} /> },
              ]}
            />
          </SectionCard>
          {(r.state === 2 || r.state === 4 || r.state === 5 || r.pickupStage) && (
            <SectionCard title="Rider pickup" description="Read-only. Codes are never shown.">
              <ReturnPickupFacts returnRequestId={r.id} />
            </SectionCard>
          )}
          <SectionCard title="Evidence" description="What the systems recorded about this item. Viewing it is audited.">
            {evidence.isLoading ? (
              <Skeleton height={120} radius="md" />
            ) : evidence.error ? (
              <ErrorBlock error={evidence.error} onRetry={() => void evidence.refetch()} />
            ) : evidence.data ? (
              <Stack gap="md">
                {evidence.data.hasDiscrepancy ? (
                  <Alert color="amber" variant="light" icon={<IconAlertTriangle size={16} />} title="The records disagree" />
                ) : evidence.data.hasEvidence ? (
                  <Alert color="forest" variant="light" icon={<IconCircleCheck size={16} />} title="No discrepancy found in the records" />
                ) : (
                  <Alert color="gray" variant="light" title="No recorded evidence for this item" />
                )}
                {evidence.data.findings.length > 0 && (
                  <List spacing={6} size="sm">
                    {evidence.data.findings.map((f) => (
                      <List.Item key={f.code}>
                        <Badge size="xs" variant="light" color={f.kind === 'discrepancy' ? 'amber' : 'forest'} mr={6}>
                          {f.kind}
                        </Badge>
                        {f.statement}
                      </List.Item>
                    ))}
                  </List>
                )}
                {evidence.data.facts.length > 0 && (
                  <FieldGrid fields={evidence.data.facts.map((f) => ({ label: f.label, value: f.value }))} />
                )}
                <Group gap={6}>
                  {evidence.data.sources.map((s) => (
                    <Badge key={s.source} variant="dot" color={s.available ? 'forest' : 'gray'} title={s.detail ?? undefined}>
                      {s.source}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            ) : null}
          </SectionCard>
        </Stack>
      )}
    </DetailDrawer>
  );
}
