import type { ReactNode } from 'react';
import { Alert, SimpleGrid, Stack, Text } from '@mantine/core';
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
import { dashboardApi, summaryTiles } from '@/api/dashboard';
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
    label: 'Moderation open',
    capability: 'viewModeration',
    to: '/moderation',
    icon: <IconEyeOff size={16} />,
    load: async (signal) => ({ count: (await moderationApi.queue({ state: '1', page: 1, pageSize: 1 }, signal)).total ?? 0 }),
    tone: busy,
  },
  {
    id: 'orders-today',
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
    label: 'Parcels without a rider',
    capability: 'viewDelivery',
    to: '/delivery',
    icon: <IconPackage size={16} />,
    load: async (signal) => ({ count: (await deliveryApi.awaitingCourier(1, 1, signal)).total ?? 0 }),
    tone: busy,
  },
  {
    id: 'tickets',
    label: 'Open tickets',
    capability: 'viewSupport',
    to: '/support',
    icon: <IconHeadset size={16} />,
    load: async (signal) => ({ count: (await ticketsApi.list([], 1, 1, signal)).total ?? 0 }),
    tone: busy,
  },
  {
    id: 'returns',
    label: 'Returns submitted',
    capability: 'viewSupport',
    to: '/returns',
    icon: <IconReceiptRefund size={16} />,
    load: async (signal) => ({ count: (await returnsApi.queue('1', 1, 1, signal)).total ?? 0 }),
    tone: busy,
  },
  {
    id: 'payouts-requested',
    label: 'Payouts requested',
    capability: 'viewPayouts',
    to: '/payouts?state=1',
    icon: <IconCash size={16} />,
    load: async (signal) => ({ count: (await payoutsApi.queue('1', 1, 1, signal)).total ?? 0 }),
    tone: () => 'gray',
  },
  {
    id: 'payouts-held',
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

function CounterTile({ counter }: { counter: Counter }) {
  const q = useQuery({ queryKey: ['dashboard', 'counter', counter.id], queryFn: ({ signal }) => counter.load(signal), staleTime: 60_000, retry: 1 });
  const value = q.error ? '—' : q.data ? `${fmtNumber(q.data.count)}${q.data.atLeast ? '+' : ''}` : '';
  return (
    <MetricTile
      label={counter.label}
      value={value}
      loading={q.isLoading}
      tone={q.error ? 'gray' : q.data && counter.tone ? counter.tone(q.data.count) : 'forest'}
      hint={q.error ? 'Couldn’t count - open the queue' : counter.hint}
      to={counter.to}
      icon={counter.icon}
    />
  );
}

export function DashboardPage() {
  const { can, claims } = useAuth();
  const summary = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: ({ signal }) => dashboardApi.summary(signal), staleTime: 60_000 });
  const counters = COUNTERS.filter((c) => can(c.capability));
  const tiles = summary.data ? summaryTiles(summary.data) : [];
  const firstName = claims?.name?.split(/\s+/)[0];

  return (
    <Stack gap="lg">
      <PageHeader title={firstName ? `Good to see you, ${firstName}` : 'Dashboard'} description="What needs attention across the marketplace, counted live from each queue. Select a tile to open it." />

      {counters.length > 0 && (
        <SectionCard title="Work waiting">
          <SimpleGrid cols={{ base: 1, xs: 2, md: 3, xl: 4 }} spacing="md">
            {counters.map((c) => (
              <CounterTile key={c.id} counter={c} />
            ))}
          </SimpleGrid>
        </SectionCard>
      )}

      <SectionCard title="Platform summary" description="Marketplace totals from the admin summary.">
        {summary.isLoading ? (
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
            {[0, 1, 2, 3].map((i) => (
              <MetricTile key={i} label="…" value="" loading />
            ))}
          </SimpleGrid>
        ) : summary.error ? (
          <ErrorBlock error={summary.error} onRetry={() => void summary.refetch()} />
        ) : summary.data === null ? (
          <Alert variant="light" color="slate" title="The summary isn’t on this server yet">
            <Text size="sm">
              Totals such as sales, active vendors and new customers appear here once the backend ships <code>GET /v1/admin/dashboard/summary</code>. The work counts above are live already.
            </Text>
          </Alert>
        ) : tiles.length === 0 ? (
          <Text size="sm" c="dimmed">
            The summary has no figures yet.
          </Text>
        ) : (
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }} spacing="md">
            {tiles.map((t) => (
              <MetricTile key={t.key} label={t.label} value={t.money ? fmtMoney(t.value, t.currency) : fmtNumber(t.value, Number.isInteger(t.value) ? 0 : 1)} tone="gray" />
            ))}
          </SimpleGrid>
        )}
      </SectionCard>
    </Stack>
  );
}
