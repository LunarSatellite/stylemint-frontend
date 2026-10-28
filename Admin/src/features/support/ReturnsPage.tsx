import { useEffect, useState } from 'react';
import { Alert, Anchor, Avatar, Badge, Box, Button, Group, Image, List, SegmentedControl, SimpleGrid, Skeleton, Stack, Tabs, Text, TextInput, Timeline } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { IconAlertTriangle, IconCircleCheck, IconExternalLink, IconReceipt, IconSearch } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '@/api/errors';
import { FARE_PAYER, label, PICKUP_STAGE, REASON_CATEGORY } from '@/api/returnPickups';
import {
  CANCEL_REASON,
  RETURN_RESOLUTION,
  RETURN_STATE_LABEL,
  RETURN_TABS,
  RETURN_TONE,
  returnsApi,
  type ReturnItem,
  type ReturnsSummary,
} from '@/api/support';
import { PickupStageBadge, ReturnPickupFacts, ReturnPickupsList } from './ReturnPickups';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock, SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';
import { fmtMoney, humanize } from '@/lib/format';

/**
 * Returns across all vendors: what buyers asked to return and what was returned. Read-only here: vendors approve or
 * reject their own returns; support watches every state and checks the evidence (scan-to-receive, chain of custody,
 * product passport) when a vendor and buyer disagree.
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
            : 'Every return across all vendors — requested, accepted and waiting for the item, returned, rejected or cancelled. Newest first.'
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

/** YYYY-MM-DD in local time (toISOString would shift the day in UTC+5:45). */
function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function fromYmd(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
/** Start of the local day, as UTC. */
function dayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.toISOString();
}
/** Start of the next local day: the API's upper bound is exclusive. */
function nextDayStart(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() + 1);
  return x.toISOString();
}

const missing = (e: unknown) => e instanceof ApiError && e.isMissingEndpoint;

const money = (amount: number | null | undefined, currency: string | null | undefined) =>
  amount === null || amount === undefined ? null : fmtMoney(amount, currency ?? 'NPR');

export function StateBadge({ state }: { state: number }) {
  return (
    <Badge variant="light" color={RETURN_TONE[state] ?? 'gray'}>
      {RETURN_STATE_LABEL[state] ?? `State ${state}`}
    </Badge>
  );
}

const reasonLabel = (r: ReturnItem) =>
  r.reasonCategoryLabel && r.reasonCategory !== 'Unspecified'
    ? r.reasonCategoryLabel
    : r.reasonCategory
      ? label(REASON_CATEGORY, r.reasonCategory)
      : null;

const cancelReasonLabel = (v: string | null | undefined) => (v ? (CANCEL_REASON[v] ?? humanize(v)) : null);

/** The refund produced, or what the returned line is worth while it is still open. */
function RefundCell({ r }: { r: ReturnItem }) {
  const refunded = money(r.refundAmount, r.currency);
  if (refunded)
    return (
      <TwoLine
        primary={
          <Text span size="sm" fw={600} style={{ whiteSpace: 'nowrap' }}>
            {refunded}
          </Text>
        }
        secondary={r.refundStatus ? humanize(r.refundStatus) : undefined}
      />
    );
  const worth = money(r.lineAmount, r.currency);
  return worth ? (
    <Text span size="sm" c="dimmed" style={{ whiteSpace: 'nowrap' }} title="Value of the returned items; nothing refunded yet">
      {worth}
    </Text>
  ) : (
    <Text span c="dimmed">
      —
    </Text>
  );
}

function ReturnRequestsList() {
  const list = useListState(['state', 'from', 'to'] as const, { pageSize: 25 });
  const [, setParams] = useSearchParams();
  const state = RETURN_TABS.some((t) => t.value === list.filters.state) ? list.filters.state : '';
  const from = fromYmd(list.filters.from);
  const to = fromYmd(list.filters.to);
  const fromUtc = from ? dayStart(from) : undefined;
  const toUtc = to ? nextDayStart(to) : undefined;
  const search = list.search;

  const query = useQuery({
    queryKey: ['returns', 'list', state, search, fromUtc, toUtc, list.page, list.pageSize],
    queryFn: ({ signal }) => returnsApi.queue({ state, search, fromUtc, toUtc, page: list.page, pageSize: list.pageSize }, signal),
    placeholderData: keepPreviousData,
  });
  const summary = useQuery({
    queryKey: ['returns', 'summary', search, fromUtc, toUtc],
    queryFn: ({ signal }) => returnsApi.summary({ search, fromUtc, toUtc }, signal),
    retry: false,
  });

  // The picker holds a half-picked range locally; the address bar gets complete ranges, or none.
  const [picker, setPicker] = useState<[Date | null, Date | null]>([from, to]);
  useEffect(() => setPicker([fromYmd(list.filters.from), fromYmd(list.filters.to)]), [list.filters.from, list.filters.to]);
  const commitRange = (value: [Date | null, Date | null]) => {
    setPicker(value);
    const [a, b] = value;
    if ((a && !b) || (!a && b)) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (a && b) {
          next.set('from', ymd(a));
          next.set('to', ymd(b));
        } else {
          next.delete('from');
          next.delete('to');
        }
        next.delete('page');
        return next;
      },
      { replace: true },
    );
  };

  const filtered = search !== '' || !!fromUtc;

  const columns: Column<ReturnItem>[] = [
    {
      key: 'product',
      header: 'Item',
      render: (r) => (
        <Group gap="sm" wrap="nowrap" align="flex-start">
          <Avatar src={r.thumbnailUrlSnapshot} radius="sm" size={40} alt="">
            {r.productTitleSnapshot.slice(0, 1)}
          </Avatar>
          <Stack gap={2}>
            <TwoLine primary={r.productTitleSnapshot} secondary={`${r.variantLabelSnapshot ? `${r.variantLabelSnapshot} · ` : ''}× ${r.quantity}`} />
            {/* Phones: the hidden columns fold into the item cell, card-style. */}
            <Group gap={6} hiddenFrom="sm" wrap="wrap">
              <Text span size="xs" className="sm-mono">
                {r.orderNumber}
              </Text>
              <StateBadge state={r.state} />
              {r.pickupStage && <PickupStageBadge stage={r.pickupStage} />}
            </Group>
            <Text size="xs" c="dimmed" hiddenFrom="sm">
              {[reasonLabel(r), r.vendorDisplayName, money(r.refundAmount ?? r.lineAmount, r.currency)].filter(Boolean).join(' · ')}
            </Text>
          </Stack>
        </Group>
      ),
    },
    { key: 'order', header: 'Order', visibleFrom: 'sm', render: (r) => <span className="sm-mono">{r.orderNumber}</span> },
    { key: 'buyer', header: 'Buyer', visibleFrom: 'md', render: (r) => r.buyerDisplayName ?? <IdText value={r.customerAccountId} /> },
    { key: 'seller', header: 'Seller', visibleFrom: 'md', render: (r) => r.vendorDisplayName ?? <IdText value={r.vendorAccountId} /> },
    {
      key: 'reason',
      header: 'Reason',
      visibleFrom: 'lg',
      render: (r) => (
        <Box maw={220}>
          <TwoLine primary={reasonLabel(r) ?? '—'} secondary={r.reason ? <span title={r.reason}>{r.reason.length > 60 ? `${r.reason.slice(0, 57)}…` : r.reason}</span> : undefined} />
        </Box>
      ),
    },
    { key: 'resolution', header: 'Wants', visibleFrom: 'lg', render: (r) => RETURN_RESOLUTION[r.resolution] ?? '—' },
    { key: 'state', header: 'State', visibleFrom: 'sm', render: (r) => <StateBadge state={r.state} /> },
    { key: 'pickup', header: 'Pickup', visibleFrom: 'md', render: (r) => <PickupStageBadge stage={r.pickupStage} /> },
    { key: 'refund', header: 'Refund', align: 'right', visibleFrom: 'sm', render: (r) => <RefundCell r={r} /> },
    {
      key: 'dates',
      header: 'Submitted / returned',
      visibleFrom: 'sm',
      render: (r) => <TwoLine primary={<When value={r.submittedUtc} relative />} secondary={r.completedUtc ? <When value={r.completedUtc} /> : undefined} />,
    },
  ];

  const tab = RETURN_TABS.find((t) => t.value === state) ?? RETURN_TABS[0];

  return (
    <>
      <SummaryTabs value={state} summary={summary.data} loading={summary.isLoading} onChange={(v) => list.setFilter('state', v || null)} />
      {summary.error && !missing(summary.error) && (
        <Box mb="md">
          <ErrorBlock error={summary.error} onRetry={() => void summary.refetch()} />
        </Box>
      )}
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
        filtered={filtered}
        emptyTitle={state ? `No ${tab.label.toLowerCase()} returns` : 'No returns yet'}
        emptyBody={state ? 'Nothing is in this state right now.' : 'Returns appear here as soon as a buyer asks to return an item.'}
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              placeholder="Order number"
              leftSection={<IconSearch size={14} />}
              w={240}
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.currentTarget.value)}
            />
            <DatePickerInput type="range" label="Submitted between" placeholder="Any date" w={260} maxDate={new Date()} allowSingleDateInRange clearable value={picker} onChange={commitRange} />
            {filtered && (
              <Button
                variant="subtle"
                size="compact-sm"
                mb={6}
                onClick={() => {
                  list.setSearchInput('');
                  setParams(
                    (prev) => {
                      const next = new URLSearchParams(prev);
                      for (const k of ['q', 'from', 'to', 'page']) next.delete(k);
                      return next;
                    },
                    { replace: true },
                  );
                }}
              >
                Clear filters
              </Button>
            )}
          </Group>
        }
      />
      <ReturnDrawer item={query.data?.items.find((r) => r.id === list.selected) ?? null} opened={!!list.selected} onClose={() => list.open(null)} />
    </>
  );
}

/** All / Requested / Accepted / Returned / Rejected / Cancelled, each with its count from `/summary`. */
function SummaryTabs({ value, summary, loading, onChange }: { value: string; summary: ReturnsSummary | undefined; loading: boolean; onChange: (v: string) => void }) {
  const countOf = (key: string | null): number | undefined => {
    if (!summary) return undefined;
    if (key === null) return summary.total;
    return summary.states.find((s) => s.key === key)?.count ?? 0;
  };
  return (
    <Tabs value={value || 'all'} onChange={(v) => onChange(v && v !== 'all' ? v : '')} keepMounted={false} variant="outline" mb="md">
      <Tabs.List aria-label="Return states" data-testid="returns-tabs">
        {RETURN_TABS.map((t) => {
          const n = countOf(t.key);
          return (
            <Tabs.Tab
              key={t.value || 'all'}
              value={t.value || 'all'}
              data-testid={`returns-tab-${t.key ?? 'all'}`}
              rightSection={
                loading ? (
                  <Skeleton height={16} width={22} radius="xl" />
                ) : n !== undefined ? (
                  <Badge size="sm" variant="light" color={t.value ? (RETURN_TONE[Number(t.value)] ?? 'gray') : 'gray'} data-testid="tab-count">
                    {n.toLocaleString()}
                  </Badge>
                ) : null
              }
            >
              {t.label}
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
    </Tabs>
  );
}

type Step = { title: string; when?: string | null; detail?: string | null; done: boolean; tone?: string };

const COLLECTED = new Set(['Collected', 'AwaitingSellerConfirmation', 'ReceivedBySeller']);

/** submitted → accepted → picked up → received → refunded / rejected / cancelled. */
export function returnTimeline(r: ReturnItem): Step[] {
  const steps: Step[] = [{ title: 'Requested', when: r.submittedUtc, detail: reasonLabel(r), done: true }];
  if (r.state === 3) {
    steps.push({ title: 'Rejected', when: r.resolvedUtc, detail: r.rejectionNote, done: true, tone: 'signal' });
    return steps;
  }
  const accepted = r.state === 2 || r.state === 4 || !!r.pickupMode || !!r.receivedUtc;
  const rider = !!r.pickupMode || !!r.pickupStage;
  const collected = r.state === 4 || !!r.receivedUtc || COLLECTED.has(r.pickupStage ?? '');
  const received = r.state === 4 || !!r.receivedUtc;
  steps.push({ title: 'Accepted — waiting for the item', done: accepted });
  if (rider) steps.push({ title: 'Picked up by rider', detail: r.pickupStage && !collected ? `Now: ${label(PICKUP_STAGE, r.pickupStage)}` : null, done: collected });
  steps.push({ title: 'Received by seller', when: r.receivedUtc ?? (r.state === 4 ? r.completedUtc : null), detail: r.restocked === true ? 'Put back in stock' : r.restocked === false ? 'Not resellable' : null, done: received });
  if (r.state === 5) {
    steps.push({ title: 'Cancelled', when: r.cancelledUtc ?? r.resolvedUtc, detail: [cancelReasonLabel(r.cancelReason), r.cancelNote].filter(Boolean).join(' — ') || null, done: true, tone: 'gray' });
    return steps;
  }
  if (r.resolution === 2) {
    steps.push({ title: 'Returned — replacement', when: r.completedUtc, done: r.state === 4, tone: 'forest' });
  } else {
    const refunded = r.refundStatus === 'Completed';
    steps.push({
      title: refunded ? 'Refunded' : 'Refund',
      when: r.refundCompletedUtc ?? (refunded ? r.completedUtc : null),
      detail: money(r.refundAmount, r.currency) ?? (r.state === 4 && r.refundStatus ? humanize(r.refundStatus) : null),
      done: refunded,
      tone: 'forest',
    });
  }
  return steps;
}

function ReturnTimeline({ r }: { r: ReturnItem }) {
  const steps = returnTimeline(r);
  const active = steps.reduce((last, s, i) => (s.done ? i : last), 0);
  return (
    <Timeline active={active} bulletSize={14} lineWidth={2} data-testid="return-timeline">
      {steps.map((s) => (
        <Timeline.Item key={s.title} title={s.title} color={s.done ? (s.tone ?? 'forest') : 'gray'}>
          {s.when && (
            <Text size="xs" c="dimmed">
              <When value={s.when} />
            </Text>
          )}
          {s.detail && (
            <Text size="xs" c="dimmed">
              {s.detail}
            </Text>
          )}
          {!s.done && !s.when && (
            <Text size="xs" c="dimmed">
              Not yet
            </Text>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

function ReturnDrawer({ item: r, opened, onClose }: { item: ReturnItem | null; opened: boolean; onClose: () => void }) {
  const evidence = useQuery({ queryKey: ['returns', 'evidence', r?.id], queryFn: ({ signal }) => returnsApi.evidence(r!.id, signal), enabled: !!r, staleTime: 60_000 });
  const photos = r?.photoUrls ?? [];
  return (
    <DetailDrawer
      opened={opened}
      onClose={onClose}
      title={r?.productTitleSnapshot ?? 'Return'}
      subtitle={r ? `Order ${r.orderNumber}` : undefined}
      badges={r && <StateBadge state={r.state} />}
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
          <SectionCard title="Timeline">
            <ReturnTimeline r={r} />
          </SectionCard>
          <SectionCard title="Request">
            <FieldGrid
              fields={[
                { label: 'Item', value: `${r.productTitleSnapshot}${r.variantLabelSnapshot ? ` · ${r.variantLabelSnapshot}` : ''}`, wide: true },
                { label: 'Quantity', value: String(r.quantity) },
                { label: 'Wants', value: RETURN_RESOLUTION[r.resolution] },
                { label: 'Reason type', value: reasonLabel(r) },
                { label: 'Reason code', value: r.reasonCode && r.reasonCode !== 'unspecified' ? humanize(r.reasonCode) : null },
                { label: 'Buyer’s note', value: r.reason, wide: true },
                { label: 'Pickup fee paid by', value: r.pickupFarePayer ? label(FARE_PAYER, r.pickupFarePayer) : null },
                { label: 'Submitted', value: <When value={r.submittedUtc} /> },
                { label: 'Resolved', value: <When value={r.resolvedUtc} /> },
                { label: 'Vendor’s rejection note', value: r.rejectionNote, wide: true },
                { label: 'Cancelled', value: r.cancelledUtc ? <When value={r.cancelledUtc} /> : null },
                { label: 'Cancel reason', value: [cancelReasonLabel(r.cancelReason), r.cancelNote].filter(Boolean).join(' — ') || null },
                { label: 'Buyer', value: r.buyerDisplayName ? <TwoLine primary={r.buyerDisplayName} secondary={<IdText value={r.customerAccountId} />} /> : <IdText value={r.customerAccountId} /> },
                { label: 'Seller', value: r.vendorDisplayName ? <TwoLine primary={r.vendorDisplayName} secondary={<IdText value={r.vendorAccountId} />} /> : <IdText value={r.vendorAccountId} /> },
              ]}
            />
          </SectionCard>
          <SectionCard title="Money">
            <FieldGrid
              fields={[
                { label: 'Unit price', value: money(r.unitPriceAmount, r.currency) },
                { label: `Returned items (× ${r.quantity})`, value: money(r.lineAmount, r.currency) },
                { label: 'Pickup fare', value: money(r.pickupFareAmount, r.currency) },
                { label: 'Taken off the refund', value: r.refundBreakdown ? money(r.refundBreakdown.pickupFareDeducted, r.refundBreakdown.currency ?? r.currency) : null },
                { label: 'Refund', value: money(r.refundAmount, r.currency) },
                { label: 'Refund status', value: r.refundStatus ? humanize(r.refundStatus) : null },
                { label: 'Refunded', value: r.refundCompletedUtc ? <When value={r.refundCompletedUtc} /> : null },
                { label: 'Restocked', value: r.restocked === true ? 'Yes' : r.restocked === false ? 'No — not resellable' : null },
              ]}
            />
          </SectionCard>
          {photos.length > 0 && (
            <SectionCard title="Buyer’s photos">
              <SimpleGrid cols={{ base: 3, sm: 4 }} spacing="xs" data-testid="return-photos">
                {photos.map((u) => (
                  <Anchor key={u} href={u} target="_blank" rel="noopener noreferrer">
                    <Image src={u} alt="Return photo" h={80} radius="sm" fit="cover" />
                  </Anchor>
                ))}
              </SimpleGrid>
            </SectionCard>
          )}
          {(r.state === 2 || r.state === 4 || r.state === 5 || r.pickupStage || r.pickupMode) && (
            <SectionCard title="Rider pickup" description="Read-only. Codes are never shown.">
              <Stack gap="sm">
                <ReturnPickupFacts returnRequestId={r.id} />
                <Anchor component={Link} to={`/returns?view=pickups&open=${encodeURIComponent(r.id)}`} size="sm">
                  <Group gap={4} wrap="nowrap">
                    <IconExternalLink size={14} />
                    Open in rider pickups
                  </Group>
                </Anchor>
              </Stack>
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
                {evidence.data.facts.length > 0 && <FieldGrid fields={evidence.data.facts.map((f) => ({ label: f.label, value: f.value }))} />}
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
