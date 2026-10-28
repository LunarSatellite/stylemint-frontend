import { useEffect } from 'react';
import { Anchor, Badge, Image, Select, SimpleGrid, Skeleton, Stack, Table, Text } from '@mantine/core';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ApiError } from '@/api/errors';
import { FAILURE_CODE, FARE_PAYER, label, PICKUP_STAGE, PICKUP_STAGE_TONE, returnPickupsApi, type ReturnPickupDto, type WireMoney } from '@/api/returnPickups';
import { FieldGrid, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { ErrorBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';
import { fmtMoney, humanize } from '@/lib/format';

const missing = (e: unknown) => e instanceof ApiError && e.isMissingEndpoint;
const money = (m: WireMoney | null | undefined) => (m ? fmtMoney(m.amount, m.currency) : null);

export function PickupStageBadge({ stage }: { stage: string | null | undefined }) {
  if (!stage) return <Text span c="dimmed">—</Text>;
  return (
    <Badge variant="light" color={PICKUP_STAGE_TONE[stage] ?? 'gray'}>
      {label(PICKUP_STAGE, stage)}
    </Badge>
  );
}

function fareText(p: ReturnPickupDto) {
  if (!p.fare) return null;
  const amount = money(p.fare.amount);
  if (amount) return p.fare.isFinal ? amount : `${amount} (not final)`;
  return null;
}

/** The pickup's facts (stage, rider, fare, payer, attempts, photos, hops, proofs). Read-only. */
export function ReturnPickupFacts({ returnRequestId }: { returnRequestId: string }) {
  const q = useQuery({
    queryKey: ['return-pickups', 'detail', returnRequestId],
    queryFn: ({ signal }) => returnPickupsApi.get(returnRequestId, signal),
    staleTime: 30_000,
  });
  if (q.isLoading) return <Skeleton height={120} radius="md" />;
  if (q.error) {
    if (missing(q.error)) return <NotAvailableBlock what="Return pickup details" />;
    if (q.error instanceof ApiError && q.error.status === 404)
      return (
        <Text size="sm" c="dimmed">
          No rider pickup for this return.
        </Text>
      );
    return <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />;
  }
  const p = q.data;
  if (!p) return null;
  const hops = p.hops ?? [];
  const proofs = p.proofs ?? [];
  return (
    <Stack gap="md" data-testid="admin-return-pickup">
      <FieldGrid
        fields={[
          { label: 'Stage', value: <PickupStageBadge stage={p.stage} /> },
          { label: 'Mode', value: p.mode ? humanize(p.mode) : null },
          { label: 'Parcel', value: p.trackingNumber ? <span className="sm-mono">{p.trackingNumber}</span> : null },
          {
            label: 'Rider',
            value: p.rider
              ? `${p.rider.displayName}${p.rider.rating !== null && p.rider.rating !== undefined ? ` · ★ ${p.rider.rating.toFixed(1)}` : ''}${p.rider.vehicle ? ` · ${p.rider.vehicle}` : ''}`
              : null,
          },
          { label: 'Fare payer', value: p.fare?.payer ? label(FARE_PAYER, p.fare.payer) : null },
          { label: 'Fare', value: fareText(p) },
          { label: 'Buyer cap (up to)', value: money(p.fare?.upTo) },
          {
            label: 'Failed attempts',
            value: p.attempts
              ? `${p.attempts.failed} of ${p.attempts.max}${p.attempts.lastFailureCode ? ` · last: ${label(FAILURE_CODE, p.attempts.lastFailureCode)}` : ''}`
              : null,
          },
          { label: 'Requested', value: <When value={p.requestedUtc} /> },
          { label: 'Request expires', value: <When value={p.requestExpiresUtc} /> },
          { label: 'Collected', value: <When value={p.pickedUpUtc} /> },
          { label: 'Received by seller', value: <When value={p.receivedUtc} /> },
        ]}
      />
      {p.collectionPhotoUrls && p.collectionPhotoUrls.length > 0 && (
        <Stack gap={6}>
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            Collection photos
          </Text>
          <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs">
            {p.collectionPhotoUrls.map((u) => (
              <Anchor key={u} href={u} target="_blank" rel="noopener noreferrer">
                <Image src={u} alt="Collection photo" h={72} radius="sm" fit="cover" />
              </Anchor>
            ))}
          </SimpleGrid>
        </Stack>
      )}
      {hops.length > 0 && (
        <Table withTableBorder striped fz="sm" aria-label="Hops">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Hop</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Rider</Table.Th>
              <Table.Th>Last change</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {hops.map((h, i) => (
              <Table.Tr key={h.id ?? h.hopId ?? i}>
                <Table.Td>{i + 1}</Table.Td>
                <Table.Td>
                  {humanize(h.status ?? h.state ?? null)}
                  {h.failureCode ? ` · ${label(FAILURE_CODE, h.failureCode)}` : ''}
                </Table.Td>
                <Table.Td>{h.courierDisplayName ?? '—'}</Table.Td>
                <Table.Td>
                  <When value={h.completedUtc ?? h.failedUtc ?? h.pickedUpUtc ?? h.acceptedUtc ?? h.createdUtc ?? null} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {proofs.length > 0 && (
        <Table withTableBorder striped fz="sm" aria-label="Proofs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Proof</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Created</Table.Th>
              <Table.Th>Confirmed</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {proofs.map((pr, i) => (
              <Table.Tr key={pr.id ?? i}>
                <Table.Td>{pr.purpose === 'ReturnPickup' ? 'Buyer hand-over' : pr.purpose === 'Delivery' ? 'Seller receipt' : humanize(pr.purpose ?? null)}</Table.Td>
                <Table.Td>{humanize(pr.status ?? null)}</Table.Td>
                <Table.Td>
                  <When value={pr.createdUtc ?? null} />
                </Table.Td>
                <Table.Td>
                  <When value={pr.confirmedUtc ?? null} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  );
}

/** Every return pickup, filterable by stage (cursor list). Read-only: support works through tickets. */
export function ReturnPickupsList() {
  const list = useListState(['view', 'stage'] as const, { pageSize: 25 });
  const cursors = useCursorPages(`${list.filters.stage}|${list.pageSize}`, list.page, list.setPage);
  const query = useQuery({
    queryKey: ['return-pickups', list.filters.stage, cursors.cursor, list.page, list.pageSize],
    queryFn: ({ signal }) => returnPickupsApi.list({ stage: list.filters.stage, cursor: cursors.cursor, page: list.page, pageSize: list.pageSize }, signal),
    enabled: cursors.ready,
    placeholderData: keepPreviousData,
    retry: false,
  });
  useEffect(() => {
    if (query.data) cursors.remember(list.page, query.data.nextCursor);
  }, [query.data, list.page, cursors]);

  if (missing(query.error)) return <NotAvailableBlock what="Return pickups" />;

  const columns: Column<ReturnPickupDto>[] = [
    {
      key: 'parcel',
      header: 'Parcel',
      render: (p) => <TwoLine primary={<span className="sm-mono">{p.trackingNumber ?? '—'}</span>} secondary={p.mode ? humanize(p.mode) : undefined} />,
    },
    { key: 'stage', header: 'Stage', render: (p) => <PickupStageBadge stage={p.stage} /> },
    { key: 'rider', header: 'Rider', visibleFrom: 'sm', render: (p) => p.rider?.displayName ?? '—' },
    { key: 'payer', header: 'Fare payer', visibleFrom: 'md', render: (p) => (p.fare?.payer ? label(FARE_PAYER, p.fare.payer) : '—') },
    { key: 'fare', header: 'Fare', visibleFrom: 'md', render: (p) => fareText(p) ?? (money(p.fare?.upTo) ? `up to ${money(p.fare?.upTo)}` : '—') },
    { key: 'attempts', header: 'Failed', visibleFrom: 'lg', render: (p) => (p.attempts ? `${p.attempts.failed}/${p.attempts.max}` : '—') },
    { key: 'requested', header: 'Requested', visibleFrom: 'sm', render: (p) => <When value={p.requestedUtc} relative /> },
  ];
  const selected = query.data?.items.find((p) => p.returnRequestId === list.selected) ?? null;

  return (
    <>
      <DataTable
        label="Return pickups"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading || !cursors.ready}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(p) => p.returnRequestId}
        onRowClick={(p) => list.open(p.returnRequestId)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        pagerMode="cursor"
        filtered={!!list.filters.stage}
        emptyTitle="No return pickups"
        emptyBody="Rider pickups appear here once a seller approves a return."
        toolbar={
          <Select
            label="Stage"
            w={220}
            clearable
            placeholder="Any"
            data={Object.entries(PICKUP_STAGE).map(([value, l]) => ({ value, label: l }))}
            value={list.filters.stage || null}
            onChange={(v) => list.setFilter('stage', v)}
          />
        }
      />
      <DetailDrawer
        opened={!!list.selected}
        onClose={() => list.open(null)}
        title={selected?.trackingNumber ?? 'Return pickup'}
        badges={selected && <PickupStageBadge stage={selected.stage} />}
      >
        {list.selected && (
          <SectionCard title="Return pickup" description="Read-only. Codes are never shown.">
            <ReturnPickupFacts returnRequestId={list.selected} />
          </SectionCard>
        )}
      </DetailDrawer>
    </>
  );
}
