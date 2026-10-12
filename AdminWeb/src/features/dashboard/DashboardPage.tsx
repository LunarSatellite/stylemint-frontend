import type { ReactNode } from 'react';
import { useState } from 'react';
import { Alert, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import {
  IconCash,
  IconEyeOff,
  IconHeadset,
  IconMotorbike,
  IconPackage,
  IconReceipt,
  IconReceiptRefund,
  IconShieldCheck,
  IconUserCheck,
} from '@tabler/icons-react';
import { couriersApi } from '@/api/couriers';
import { dashboardApi, type DashboardSummary } from '@/api/dashboard';
import { deliveryApi } from '@/api/delivery';
import { kycApi, REVIEW_STATE } from '@/api/kyc';
import { payoutsApi } from '@/api/money';
import { moderationApi } from '@/api/moderation';
import { ordersApi } from '@/api/orders';
import { privacyApi } from '@/api/platform';
import { returnsApi, ticketsApi } from '@/api/support';
import { useAuth } from '@/auth/guards';
import type { Capability } from '@/auth/roles';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader } from '@/components/PageHeader';
import { When } from '@/components/Bits';
import { ErrorBlock, SectionCard } from '@/components/StateBlocks';
import { fmtMoney, fmtNumber } from '@/lib/format';

interface Counter {
  id: string;
  label: string;
  capability: Capability;
  to: string;
  icon: ReactNode;
  /** A count, or a count with "+" when it is a lower bound. */
  load: (signal: AbortSignal) => Promise<{ count: number; atLeast?: boolean }>;
  /** The same number from the dashboard summary, when the server has it (null = that source failed). */
  fromSummary?: (s: DashboardSummary) => number | null | undefined;
  tone?: (n: number) => 'forest' | 'amber' | 'signal' | 'gray';
  hint?: string;
}

const busy = (n: number) => (n === 0 ? 'forest' : 'amber');

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Work waiting, counted from the queues themselves - each asks for one row and reads the total. */
const COUNTERS: Counter[] = [
  {
    id: 'kyc-pending',
    fromSummary: (s) => s.queues?.kycPending ? s.queues.kycPending.total - s.queues.kycPending.courier : null,
    label: 'KYC waiting',
    capability: 'viewKyc',
    to: '/kyc',
    icon: <IconShieldCheck size={16} />,
    load: async (signal) => ({ count: (await kycApi.queue({ state: REVIEW_STATE.Pending, page: 1, pageSize: 1 }, signal)).total ?? 0 }),
    tone: busy,
    hint: 'Vendors, creators and buyers',
  },
  {
    id: 'kyc-overdue',
    fromSummary: (s) => s.queues?.kycPending?.overdue,
    label: 'KYC overdue',
    capability: 'viewKyc',
    to: '/kyc?overdue=1&state=all',
    icon: <IconShieldCheck size={16} />,
    load: async (signal) => ({ count: (await kycApi.queue({ overdueOnly: true, page: 1, pageSize: 1 }, signal)).total ?? 0 }),
    tone: (n) => (n === 0 ? 'forest' : 'signal'),
    hint: 'Past the 3-day promise',
  },
  {
    id: 'riders',
    fromSummary: (s) => s.queues?.couriersAwaitingReview,
    label: 'Riders to verify',
    capability: 'viewRiders',
    to: '/kyc?tab=riders',
    icon: <IconMotorbike size={16} />,
    load: async (signal) => {
      const page = await couriersApi.list('2', 1, 200, signal);
      return { count: page.items.length, atLeast: page.items.length >= 200 };
    },
    tone: busy,
    hint: 'Identity in review',
  },
  {
    id: 'moderation',
    fromSummary: (s) => s.queues?.moderationOpen,
    label: 'Moderation open',
    capability: 'viewModeration',
    to: '/moderation',
    icon: <IconEyeOff size={16} />,
    load: async (signal) => ({ count: (await moderationApi.queue({ state: '1', page: 1, pageSize: 1 }, signal)).total ?? 0 }),
    tone: busy,
  },
  {
    id: 'orders-today',
    fromSummary: (s) => s.windows?.today?.orders,
    label: 'Orders today',
    capability: 'viewOrders',
    to: '/orders',
    icon: <IconReceipt size={16} />,
    load: async (signal) => ({ count: (await ordersApi.list({ placedFromUtc: startOfToday(), pageSize: 1 }, 1, signal)).total ?? 0 }),
    tone: () => 'gray',
    hint: 'Vendor orders placed since midnight',
  },
  {
    id: 'orders-paid',
    label: 'Waiting for vendors',
    capability: 'viewOrders',
    to: '/orders?state=2',
    icon: <IconReceipt size={16} />,
    load: async (signal) => ({ count: (await ordersApi.list({ state: '2', pageSize: 1 }, 1, signal)).total ?? 0 }),
    tone: busy,
    hint: 'Paid, not yet accepted',
  },
  {
    id: 'packages',
    fromSummary: (s) => s.queues?.stuckDeliveries?.awaitingCourier,
    label: 'Parcels without a rider',
    capability: 'viewDelivery',
    to: '/delivery',
    icon: <IconPackage size={16} />,
    load: async (signal) => ({ count: (await deliveryApi.awaitingCourier(1, 1, signal)).total ?? 0 }),
    tone: busy,
  },
  {
    id: 'tickets',
    fromSummary: (s) => s.queues?.openTickets,
    label: 'Open tickets',
    capability: 'viewSupport',
    to: '/support',
    icon: <IconHeadset size={16} />,
    load: async (signal) => ({ count: (await ticketsApi.list([], 1, 1, signal)).total ?? 0 }),
    tone: busy,
  },
  {
    id: 'returns',
    fromSummary: (s) => s.queues?.openReturns,
    label: 'Returns submitted',
    capability: 'viewSupport',
    to: '/returns',
    icon: <IconReceiptRefund size={16} />,
    load: async (signal) => ({ count: (await returnsApi.queue('1', 1, 1, signal)).total ?? 0 }),
    tone: busy,
  },
  {
    id: 'payouts-requested',
    fromSummary: (s) => s.queues?.payoutsPending?.requested,
    label: 'Payouts requested',
    capability: 'viewPayouts',
    to: '/payouts?state=1',
    icon: <IconCash size={16} />,
    load: async (signal) => ({ count: (await payoutsApi.queue('1', 1, 1, signal)).total ?? 0 }),
    tone: () => 'gray',
  },
  {
    id: 'payouts-held',
    fromSummary: (s) => s.queues?.payoutsPending?.held,
    label: 'Payouts on hold',
    capability: 'viewPayouts',
    to: '/payouts?state=5',
    icon: <IconCash size={16} />,
    load: async (signal) => ({ count: (await payoutsApi.queue('5', 1, 1, signal)).total ?? 0 }),
    tone: busy,
  },
  {
    id: 'privacy',
    label: 'Privacy requests',
    capability: 'viewDataRights',
    to: '/privacy',
    icon: <IconUserCheck size={16} />,
    load: async (signal) => ({ count: (await privacyApi.queue('1', 1, 1, signal)).total ?? 0 }),
    tone: busy,
    hint: 'Submitted, not yet verified',
  },
];

function CounterTile({ counter, summary }: { counter: Counter; summary: DashboardSummary | null | undefined }) {
  // Prefer the server's summary (one request for every tile); count the queue directly when it has no figure.
  const fromSummary = summary && counter.fromSummary ? counter.fromSummary(summary) : undefined;
  const useSummary = typeof fromSummary === 'number';
  const q = useQuery({
    queryKey: ['dashboard', 'counter', counter.id],
    queryFn: ({ signal }) => counter.load(signal),
    staleTime: 60_000,
    retry: 1,
    enabled: summary !== undefined && !useSummary,
  });
  const data = useSummary ? { count: fromSummary as number, atLeast: false } : q.data;
  const value = !useSummary && q.error ? '—' : data ? `${fmtNumber(data.count)}${data.atLeast ? '+' : ''}` : '';
  return (
    <MetricTile
      label={counter.label}
      value={value}
      loading={!data && !q.error}
      tone={!data ? 'gray' : counter.tone ? counter.tone(data.count) : 'forest'}
      hint={!useSummary && q.error ? 'Couldn’t count - open the queue' : counter.hint}
      to={counter.to}
      icon={counter.icon}
    />
  );
}

const WINDOWS = [
  { value: 'today', label: 'Today' },
  { value: 'last7d', label: '7 days' },
  { value: 'last30d', label: '30 days' },
] as const;

export function DashboardPage() {
  const { can, claims } = useAuth();
  const [win, setWin] = useState<'today' | 'last7d' | 'last30d'>('today');
  const summary = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: ({ signal }) => dashboardApi.summary(signal), staleTime: 60_000, retry: 1 });
  const counters = COUNTERS.filter((c) => can(c.capability));
  // undefined while loading; null when the server has no summary or it failed - then tiles count for themselves.
  const s = summary.isLoading ? undefined : summary.data ?? null;
  const w = s?.windows?.[win] ?? null;
  const firstName = claims?.name?.split(/s+/)[0];

  return (
    <Stack gap="lg">
      <PageHeader title={firstName ? `Good to see you, ${firstName}` : 'Dashboard'} description="What needs attention across the marketplace. Select a tile to open its queue." />

      <SectionCard
        title="Marketplace"
        description={s ? <>Nepal time · updated <When value={s.generatedUtc} relative /></> : undefined}
        action={s && <SegmentedControl size="xs" value={win} onChange={(v) => setWin(v as typeof win)} data={[...WINDOWS]} aria-label="Period" />}
      >
        {summary.isLoading ? (
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
            {[0, 1, 2, 3].map((i) => (
              <MetricTile key={i} label="…" value="" loading />
            ))}
          </SimpleGrid>
        ) : summary.error ? (
          <ErrorBlock error={summary.error} onRetry={() => void summary.refetch()} />
        ) : summary.data === null ? (
          <Alert variant="light" color="slate" title="Sales figures aren’t on this server yet">
            <Text size="sm">
              Orders, sales, new customers and new vendors appear here once the backend ships <code>GET /v1/admin/dashboard/summary</code>. The work counts below are live already.
            </Text>
          </Alert>
        ) : (
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
            <MetricTile label="Orders" value={fmtNumber(w?.orders)} hint="Not cancelled, test orders excluded" tone="forest" to={can('viewOrders') ? '/orders' : undefined} />
            <MetricTile label="Sales" value={w?.gmv ? fmtMoney(w.gmv.amount, w.gmv.currency) : '—'} hint="Merchandise value, before shipping and tax" tone="forest" />
            <MetricTile label="New customers" value={fmtNumber(w?.newCustomers)} tone="gray" to={can('viewCustomers') ? '/customers' : undefined} />
            <MetricTile label="New vendors" value={fmtNumber(w?.newVendors)} hint="Approved or applied" tone="gray" to={can('viewVendors') ? '/vendors' : undefined} />
          </SimpleGrid>
        )}
      </SectionCard>

      {counters.length > 0 && (
        <SectionCard title="Work waiting">
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 4 }} spacing="md">
            {counters.map((c) => (
              <CounterTile key={c.id} counter={c} summary={s} />
            ))}
          </SimpleGrid>
        </SectionCard>
      )}
    </Stack>
  );
}
