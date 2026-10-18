import { useEffect, useState } from 'react';
import { Alert, Badge, Button, Group, Loader, SimpleGrid, Stack, Table, Tabs, Text, TextInput } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconPackage, IconRoute, IconSearch, IconShieldHalf } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import {
  deliveryApi,
  HOP_STATE,
  OFFER_STATE,
  PACKAGE_STATE,
  PLAN_STATUS,
  PROMISE_STATE,
  REPLAN_REASON,
  ROUTING_TIER,
  type HopOffer,
  type PackageAwaiting,
  type PackageHop,
  type RoutingPlan,
} from '@/api/delivery';
import { FareAmount } from '@/components/FareBreakdown';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, When, YesNo } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader } from '@/components/PageHeader';
import { EmptyBlock, ErrorBlock, SectionCard } from '@/components/StateBlocks';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';
import { fmtMoney, fmtNumber, fmtPercent } from '@/lib/format';

/**
 * Delivery operations: parcels no rider has picked up, routing offers that went nowhere, and the routing and
 * fulfilment tools to unstick them. The routing, fulfilment and guardian endpoints are Super Admin only on the server.
 */
export function DeliveryPage() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'awaiting';
  return (
    <>
      <PageHeader title="Delivery ops" description="Parcels waiting for a rider, stuck offers and routing health. Open a parcel to replan it or pick a rider." />
      <Tabs value={tab} onChange={(v) => v && setParams(new URLSearchParams({ tab: v }), { replace: true })} keepMounted={false} variant="outline">
        <Tabs.List mb="md">
          <Tabs.Tab value="awaiting" leftSection={<IconPackage size={16} />}>
            Waiting for a rider
          </Tabs.Tab>
          {can('manageDelivery') && (
            <>
              <Tabs.Tab value="stuck" leftSection={<IconRoute size={16} />}>
                Stuck offers
              </Tabs.Tab>
              <Tabs.Tab value="guardian" leftSection={<IconShieldHalf size={16} />}>
                Guardian
              </Tabs.Tab>
            </>
          )}
        </Tabs.List>
        <Tabs.Panel value="awaiting">
          <AwaitingCourier />
        </Tabs.Panel>
        {can('manageDelivery') && (
          <>
            <Tabs.Panel value="stuck">
              <StuckOffers />
            </Tabs.Panel>
            <Tabs.Panel value="guardian">
              <Guardian />
            </Tabs.Panel>
          </>
        )}
      </Tabs>
    </>
  );
}

function AwaitingCourier() {
  const list = useListState([] as const, { pageSize: 25 });
  const [lookup, setLookup] = useState('');
  const [subOrder, setSubOrder] = useState<string | null>(null);
  const query = useQuery({
    queryKey: ['delivery', 'awaiting', list.page, list.pageSize],
    queryFn: ({ signal }) => deliveryApi.awaitingCourier(list.page, list.pageSize, signal),
    placeholderData: keepPreviousData,
  });
  const columns: Column<PackageAwaiting>[] = [
    { key: 'tracking', header: 'Parcel', render: (p) => <span className="sm-mono">{p.trackingNumber}</span> },
    {
      key: 'waiting',
      header: 'Waiting',
      render: (p) => (
        <Badge variant="light" color={p.waitingHours > 24 ? 'signal' : p.waitingHours > 4 ? 'amber' : 'gray'}>
          {fmtNumber(p.waitingHours, 1)} h
        </Badge>
      ),
    },
    { key: 'route', header: 'From → to', visibleFrom: 'sm', render: (p) => <span className="sm-mono">{`${p.originGeohash.slice(0, 5)} → ${p.destinationGeohash.slice(0, 5)}`}</span> },
    { key: 'local', header: 'Same area', visibleFrom: 'md', render: (p) => <YesNo value={p.sameLocality} /> },
    { key: 'created', header: 'Created', visibleFrom: 'md', render: (p) => <When value={p.createdUtc} /> },
  ];
  return (
    <Stack gap="md">
      <DataTable
        label="Parcels waiting for a rider"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(p) => p.packageId}
        onRowClick={(p) => list.open(p.packageId)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        emptyTitle="Every parcel has a rider"
        emptyBody="Nothing is waiting for a courier."
        toolbar={
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (lookup.trim()) setSubOrder(lookup.trim());
            }}
          >
            <Group gap="xs" align="flex-end">
              <TextInput label="Find a parcel by vendor-order ID" placeholder="Sub-order ID" leftSection={<IconSearch size={14} />} w={320} value={lookup} onChange={(e) => setLookup(e.currentTarget.value)} />
              <Button type="submit" variant="default" disabled={!lookup.trim()}>
                Find
              </Button>
            </Group>
          </form>
        }
      />
      {subOrder && <PackageLookup subOrderId={subOrder} onOpen={(id) => list.open(id)} />}
      <PackageDrawer packageId={list.selected} row={query.data?.items.find((p) => p.packageId === list.selected)} onClose={() => list.open(null)} />
    </Stack>
  );
}

function PackageLookup({ subOrderId, onOpen }: { subOrderId: string; onOpen: (packageId: string) => void }) {
  const q = useQuery({ queryKey: ['delivery', 'by-sub-order', subOrderId], queryFn: ({ signal }) => deliveryApi.packageBySubOrder(subOrderId, signal), retry: false });
  return (
    <SectionCard title="Parcel lookup">
      {q.isLoading ? (
        <Loader size="sm" />
      ) : q.error ? (
        <ErrorBlock error={q.error} />
      ) : q.data ? (
        <Stack gap="sm">
          <FieldGrid
            cols={3}
            fields={[
              { label: 'Tracking', value: <span className="sm-mono">{q.data.trackingNumber}</span> },
              { label: 'State', value: PACKAGE_STATE[q.data.state] },
              { label: 'Deliver by', value: <When value={q.data.deliverByUtc} /> },
              { label: 'From', value: q.data.originAddressLine },
              { label: 'To', value: q.data.destinationAddressLine },
              { label: 'Declared value', value: fmtMoney(q.data.declaredValueAmount, q.data.declaredValueCurrency) },
              { label: 'Weight', value: `${fmtNumber(q.data.weightGrams / 1000, 2)} kg` },
              { label: 'Fragile', value: <YesNo value={q.data.isFragile} /> },
              { label: 'Sealed', value: <YesNo value={q.data.hasSeal} /> },
            ]}
          />
          {q.data.hops && q.data.hops.length > 0 && <PackageHops hops={q.data.hops} />}
          <Group>
            <Button size="xs" variant="light" onClick={() => onOpen(q.data!.id)}>
              Open routing for this parcel
            </Button>
          </Group>
        </Stack>
      ) : null}
    </SectionCard>
  );
}

/** The parcel's legs, each with the rider and what the rider is paid for it (click a fare for its breakdown). */
function PackageHops({ hops }: { hops: PackageHop[] }) {
  return (
    <Table.ScrollContainer minWidth={560}>
      <Table aria-label="Legs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Leg</Table.Th>
            <Table.Th>Rider</Table.Th>
            <Table.Th>Tier</Table.Th>
            <Table.Th>State</Table.Th>
            <Table.Th>Rider fare</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {[...hops]
            .sort((a, b) => a.hopIndex - b.hopIndex)
            .map((h) => (
              <Table.Tr key={h.id}>
                <Table.Td>{h.hopIndex + 1}</Table.Td>
                <Table.Td>
                  <IdText value={h.courierProfileId} />
                </Table.Td>
                <Table.Td>{ROUTING_TIER[h.tier] ?? h.tier}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={h.state === 7 ? 'forest' : h.state >= 8 ? 'signal' : 'amber'}>
                    {HOP_STATE[h.state] ?? h.state}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <FareAmount amount={h.courierPayoutAmount} currency={h.courierPayoutCurrency} breakdown={h.fareBreakdown} />
                </Table.Td>
              </Table.Tr>
            ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}

function PackageDrawer({ packageId, row, onClose }: { packageId: string | null; row?: PackageAwaiting; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const [plan, setPlan] = useState<RoutingPlan | null>(null);
  useEffect(() => setPlan(null), [packageId]);
  const manage = can('manageDelivery');
  const candidates = useQuery({ queryKey: ['delivery', 'candidates', packageId], queryFn: ({ signal }) => deliveryApi.candidates(packageId!, signal), enabled: !!packageId && manage });
  const assessment = useQuery({ queryKey: ['delivery', 'assessment', packageId], queryFn: ({ signal }) => deliveryApi.assessment(packageId!, signal), enabled: !!packageId && manage });
  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['delivery'] });

  return (
    <DetailDrawer opened={!!packageId} onClose={onClose} title={row ? <span className="sm-mono">{row.trackingNumber}</span> : 'Parcel'} subtitle={row ? `Waiting ${fmtNumber(row.waitingHours, 1)} hours` : undefined}>
      {dialog}
      {!manage ? (
        <Alert variant="light" color="slate">
          Routing and fulfilment tools are Super Admin only. Ask one to replan this parcel.
        </Alert>
      ) : (
        <Stack gap="lg">
          <Group>
            <Button
              size="sm"
              onClick={() =>
                open({
                  title: 'Replan this parcel',
                  consequence: 'Routing runs again and issues new offers to riders, even if some are still pending.',
                  confirmLabel: 'Replan',
                  fields: [
                    { name: 'reason', kind: 'select', label: 'Why', required: true, options: Object.entries(REPLAN_REASON).map(([value, label]) => ({ value, label })), defaultValue: '3' },
                    { name: 'note', kind: 'textarea', label: 'Note' },
                  ],
                  run: (v) => deliveryApi.replan(packageId!, Number(v.reason), v.note?.trim() || null),
                  success: (r) => `Replanned: ${PLAN_STATUS[(r as RoutingPlan).status] ?? 'done'}.`,
                  onDone: (r) => {
                    setPlan(r as RoutingPlan);
                    refresh();
                  },
                })
              }
            >
              Replan…
            </Button>
          </Group>
          {plan && (
            <Alert variant="light" color={plan.status === 5 ? 'amber' : 'forest'} title={PLAN_STATUS[plan.status]}>
              {plan.eligibility.reason}
              {plan.escalationReason ? ` · ${plan.escalationReason}` : ''}
            </Alert>
          )}
          <SectionCard title="Eligible riders" description="Best first leg, scored. Offer the parcel to one rider directly.">
            {candidates.isLoading ? (
              <Loader size="sm" />
            ) : candidates.error ? (
              <ErrorBlock error={candidates.error} onRetry={() => void candidates.refetch()} />
            ) : !candidates.data || candidates.data.length === 0 ? (
              <EmptyBlock title="No eligible rider" body="No rider is in range and eligible right now." />
            ) : (
              <Table.ScrollContainer minWidth={560}>
                <Table aria-label="Eligible riders">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Rider</Table.Th>
                      <Table.Th>Tier</Table.Th>
                      <Table.Th>Score</Table.Th>
                      <Table.Th>Rating</Table.Th>
                      <Table.Th>Payout</Table.Th>
                      <Table.Th />
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {candidates.data.map((c) => (
                      <Table.Tr key={c.courierProfileId}>
                        <Table.Td>
                          <IdText value={c.courierProfileId} />
                        </Table.Td>
                        <Table.Td>{ROUTING_TIER[c.tier] ?? c.tier}</Table.Td>
                        <Table.Td>{fmtNumber(c.score * 100, 0)}</Table.Td>
                        <Table.Td>{fmtNumber(c.rating, 1)} ★</Table.Td>
                        <Table.Td>
                          <FareAmount amount={c.proposedPayoutAmount} currency={c.proposedPayoutCurrency} breakdown={c.fareBreakdown} />
                        </Table.Td>
                        <Table.Td>
                          <Button
                            size="compact-xs"
                            variant="light"
                            onClick={() =>
                              open({
                                title: 'Offer to this rider',
                                consequence: 'Sends this rider a 90-second offer for the parcel.',
                                confirmLabel: 'Send offer',
                                fields: [{ name: 'note', kind: 'textarea', label: 'Note' }],
                                run: (v) => deliveryApi.offerTo(packageId!, c.courierProfileId, v.note?.trim() || null),
                                success: 'Offer sent.',
                                onDone: (r) => {
                                  setPlan(r as RoutingPlan);
                                  refresh();
                                },
                              })
                            }
                          >
                            Offer
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            )}
          </SectionCard>
          <SectionCard title="Fulfilment options" description="Which tier to route by, with the evidence behind the delivery promise.">
            {assessment.isLoading ? (
              <Loader size="sm" />
            ) : assessment.error ? (
              <ErrorBlock error={assessment.error} onRetry={() => void assessment.refetch()} />
            ) : assessment.data ? (
              <Stack gap="sm">
                <Text size="sm">
                  <b>{PROMISE_STATE[assessment.data.promise.state]}.</b> {assessment.data.promise.explanation}
                </Text>
                <Text size="sm" c="dimmed">
                  {assessment.data.recommendationReason}
                </Text>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
                  {assessment.data.options.map((o) => (
                    <MetricTile
                      key={o.key}
                      label={`${ROUTING_TIER[o.tier] ?? o.tier}${o.key === assessment.data!.recommendedOptionKey ? ' · recommended' : ''}`}
                      value={`${o.candidateCount} rider${o.candidateCount === 1 ? '' : 's'}`}
                      hint={`${o.proposedCourierPayoutAmount != null ? fmtMoney(o.proposedCourierPayoutAmount, o.currency) : 'No payout estimate'} · ${o.evidence.isSufficient ? `on time ${fmtPercent(o.evidence.observedOnTimeRate, 0, { fraction: true })}` : 'too little history'}`}
                      tone={o.key === assessment.data!.recommendedOptionKey ? 'forest' : 'gray'}
                    />
                  ))}
                </SimpleGrid>
                <Group>
                  {assessment.data.options.map((o) => (
                    <Button
                      key={o.key}
                      size="xs"
                      variant={o.key === assessment.data!.recommendedOptionKey ? 'filled' : 'default'}
                      onClick={() =>
                        open({
                          title: `Route by ${ROUTING_TIER[o.tier]}`,
                          consequence: 'Records the decision and replans the parcel with that tier. If replanning fails the decision still stands.',
                          confirmLabel: 'Commit',
                          fields: [{ name: 'note', kind: 'textarea', label: 'Note' }],
                          run: (v) => deliveryApi.commit(packageId!, o.key, v.note?.trim() || null),
                          success: 'Fulfilment option committed.',
                          onDone: refresh,
                        })
                      }
                    >
                      Use {ROUTING_TIER[o.tier]}
                    </Button>
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

function StuckOffers() {
  const list = useListState([] as const, { pageSize: 25 });
  const cursors = useCursorPages(String(list.pageSize), list.page, list.setPage);
  const since = new Date(Date.now() - 86_400_000).toISOString().slice(0, 13) + ':00:00Z';
  const metrics = useQuery({ queryKey: ['delivery', 'metrics', since], queryFn: ({ signal }) => deliveryApi.routingMetrics(since, signal) });
  const query = useQuery({
    queryKey: ['delivery', 'stuck', cursors.cursor, list.page, list.pageSize],
    queryFn: ({ signal }) => deliveryApi.stuckOffers(cursors.cursor, list.page, Math.min(100, list.pageSize), signal),
    enabled: cursors.ready,
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (query.data) cursors.remember(list.page, query.data.nextCursor);
  }, [query.data, list.page, cursors]);
  const columns: Column<HopOffer>[] = [
    { key: 'package', header: 'Parcel', render: (o) => <IdText value={o.packageId} /> },
    { key: 'rider', header: 'Offered to', render: (o) => <IdText value={o.courierProfileId} /> },
    { key: 'tier', header: 'Tier', visibleFrom: 'md', render: (o) => ROUTING_TIER[o.tier] ?? o.tier },
    {
      key: 'state',
      header: 'State',
      render: (o) => (
        <Badge variant="light" color={o.state === 4 ? 'signal' : 'amber'}>
          {OFFER_STATE[o.state]}
        </Badge>
      ),
    },
    { key: 'payout', header: 'Rider fare', visibleFrom: 'sm', render: (o) => <FareAmount amount={o.proposedPayoutAmount} currency={o.proposedPayoutCurrency} breakdown={o.fareBreakdown} /> },
    { key: 'offered', header: 'Offered', render: (o) => <When value={o.offeredUtc} relative /> },
  ];
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <MetricTile label="Offers (24 h)" value={metrics.data ? fmtNumber(metrics.data.totalOffers) : '—'} loading={metrics.isLoading} tone="gray" />
        <MetricTile label="Accepted" value={metrics.data ? fmtPercent(metrics.data.acceptanceRate, 0, { fraction: true }) : '—'} loading={metrics.isLoading} tone="forest" />
        <MetricTile label="Expired" value={metrics.data ? fmtPercent(metrics.data.expiryRate, 0, { fraction: true }) : '—'} loading={metrics.isLoading} tone="amber" />
        <MetricTile label="Pending now" value={metrics.data ? fmtNumber(metrics.data.pending) : '—'} loading={metrics.isLoading} tone="gray" />
      </SimpleGrid>
      <DataTable
        label="Stuck offers"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading || !cursors.ready}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(o) => o.id}
        onRowClick={(o) => list.open(o.packageId)}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        pagerMode="cursor"
        emptyTitle="Nothing stuck"
        emptyBody="No offer has been pending or expired for more than 15 minutes."
      />
      <PackageDrawer packageId={list.selected} onClose={() => list.open(null)} />
    </Stack>
  );
}

function Guardian() {
  const [dialog, open] = useActionDialog();
  const [dimension, setDimension] = useState('Route');
  const ledger = useQuery({ queryKey: ['delivery', 'interventions', dimension], queryFn: ({ signal }) => deliveryApi.interventions(dimension, signal) });
  return (
    <Stack gap="md">
      {dialog}
      <Group>
        <Button
          onClick={() =>
            open({
              title: 'Run a guardian sweep',
              consequence: 'Looks at parcels close to their delivery deadline and writes recovery proposals buyers can accept. Safe to run any time.',
              confirmLabel: 'Run sweep',
              fields: [{ name: 'max', kind: 'number', label: 'Parcels to examine at most', min: 1, max: 1000, defaultValue: '200' }],
              run: (v) => deliveryApi.guardianSweep(Number(v.max) || 200),
              success: (r) => {
                const s = r as { candidatesExamined: number; parcelsWithLiveRemedies: number; haltedAfterFailure: boolean };
                return `Examined ${s.candidatesExamined}; ${s.parcelsWithLiveRemedies} now have remedies${s.haltedAfterFailure ? ' (stopped early after a failure)' : ''}.`;
              },
            })
          }
        >
          Run sweep…
        </Button>
        {['Route', 'Courier', 'Tier'].map((d) => (
          <Button key={d} size="xs" variant={dimension === d ? 'light' : 'subtle'} onClick={() => setDimension(d)}>
            By {d.toLowerCase()}
          </Button>
        ))}
      </Group>
      <SectionCard title="What happened after interventions" description="Outcomes of recovery offers, by group. Groups below the minimum sample are shown but not judged.">
        {ledger.isLoading ? (
          <Loader size="sm" />
        ) : ledger.error ? (
          <ErrorBlock error={ledger.error} onRetry={() => void ledger.refetch()} />
        ) : !ledger.data || ledger.data.length === 0 ? (
          <EmptyBlock title="No interventions yet" />
        ) : (
          <Stack gap="md">
            {ledger.data.slice(0, 30).map((l) => (
              <div key={`${l.dimensionValue}-${l.riskReasonCode}`}>
                <Text size="sm" fw={600}>
                  {l.dimensionValue} · {l.riskReasonCode}
                </Text>
                <Text size="xs" c="dimmed">
                  {l.statement}
                </Text>
              </div>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  );
}
