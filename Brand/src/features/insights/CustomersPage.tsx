import { Alert, Anchor, Card, SimpleGrid, Stack, Text, ThemeIcon, UnstyledButton } from '@mantine/core';
import {
  IconArrowRight,
  IconBriefcase,
  IconCalendarEvent,
  IconChartBar,
  IconLock,
  IconMessageStar,
  IconSpeakerphone,
  IconUsers,
  IconUsersGroup,
  type IconProps,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { formatDate, formatMoney, formatNumber } from '../../lib/format';
import { crmApi } from '../crm/api';
import { CrmSettingUp, PrivacyNote } from '../crm/components';
import { CRM_KEY, useCrmSession, useVisibleAreas } from '../crm/hooks';
import type { CrmAreaKey } from '../crm/roles';
import { INSIGHTS_KEY } from './api';
import { DataTable, formatPercent, KpiGrid, MetricTile, rangeKey, useRange, Widget } from './components';
import { newInsightsApi, type Metric, type SalesInsights } from './contracts';
import type { KpiSpec } from './model';
import { deltaPercent, pointDelta, ratio } from './period';

const AREA_ICONS: Record<CrmAreaKey, ComponentType<IconProps>> = {
  customers: IconUsers,
  tasks: IconCalendarEvent,
  segments: IconUsersGroup,
  campaigns: IconSpeakerphone,
  feedback: IconMessageStar,
  deals: IconBriefcase,
  reports: IconChartBar,
};

const AREA_HINTS: Record<CrmAreaKey, string> = {
  customers: 'Every buyer, their orders, returns and reviews',
  tasks: 'Follow-ups and meetings',
  segments: 'Groups such as repeat buyers or lapsed customers',
  campaigns: 'Bring buyers back — only those who agreed to hear from you',
  feedback: 'Ratings, NPS and what buyers say',
  deals: 'Bulk and custom orders',
  reports: 'Retention, churn and revenue reports',
};

/** The CRM areas this seller's role can open — a team member without access does not see them. */
function CrmLinks() {
  const areas = useVisibleAreas();
  return (
    <SimpleGrid cols={{ base: 1, xs: 2, md: 3 }} spacing="sm" data-testid="crm-links">
      {areas.map((a) => {
        const Icon = AREA_ICONS[a.key];
        return (
          <UnstyledButton key={a.key} component={Link} to={a.to} aria-label={a.label}>
            <Card padding="sm" withBorder data-interactive="true" h="100%">
              <Stack gap={6}>
                <ThemeIcon variant="light" color="forest" size={32} radius="md">
                  <Icon size={18} />
                </ThemeIcon>
                <Text fw={600} size="sm">
                  {a.label} <IconArrowRight size={12} />
                </Text>
                <Text size="xs" c="dimmed">
                  {AREA_HINTS[a.key]}
                </Text>
              </Stack>
            </Card>
          </UnstyledButton>
        );
      })}
    </SimpleGrid>
  );
}

function Buyers() {
  const all = useQuery({ queryKey: [CRM_KEY, 'insights', 'count-all'], queryFn: () => crmApi.customers({ page: 1, pageSize: 1 }), staleTime: 120_000 });
  const repeat = useQuery({
    queryKey: [CRM_KEY, 'insights', 'count-repeat'],
    queryFn: () => crmApi.customers({ page: 1, pageSize: 1, minOrders: 2 }),
    staleTime: 120_000,
  });
  const reachable = useQuery({
    queryKey: [CRM_KEY, 'insights', 'count-push'],
    queryFn: () => crmApi.customers({ page: 1, pageSize: 1, consent: 'push' }),
    staleTime: 120_000,
  });
  const top = useQuery({
    queryKey: [CRM_KEY, 'insights', 'top-ltv'],
    queryFn: () => crmApi.customers({ page: 1, pageSize: 25, sort: 'ltv' }),
    staleTime: 120_000,
  });

  const total = all.data?.totalCount;
  const repeatCount = repeat.data?.totalCount;
  const repeatRate = ratio(repeatCount, total);

  return (
    <>
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md" data-testid="customer-kpis">
        <MetricTile label="Buyers" value={formatNumber(total)} loading={all.isPending} error={!!all.error} compare={false} hint="Everyone who ordered from you" />
        <MetricTile
          label="Repeat buyers"
          value={formatNumber(repeatCount)}
          loading={repeat.isPending}
          error={!!repeat.error}
          compare={false}
          hint="Two orders or more"
          tone="gray"
        />
        <MetricTile
          label="Repeat rate"
          value={formatPercent(repeatRate, { fraction: true })}
          loading={all.isPending || repeat.isPending}
          error={!!all.error || !!repeat.error}
          compare={false}
        />
        <MetricTile
          label="Can be messaged"
          value={formatNumber(reachable.data?.totalCount)}
          loading={reachable.isPending}
          error={!!reachable.error}
          compare={false}
          hint="Agreed to push messages"
          tone="amber"
        />
      </SimpleGrid>

      <Widget
        title="Your most valuable buyers"
        description="By lifetime spend with your shop"
        query={top}
        isEmpty={(d) => d.items.length === 0}
        empty={<Text size="sm" c="dimmed">No buyers yet.</Text>}
        testId="top-customers"
      >
        {(d) => (
          <Stack gap="xs">
            <DataTable
              rows={d.items}
              rowKey={(r) => r.id}
              exportName="Top buyers"
              initialSort={{ key: 'ltv', dir: 'desc' }}
              minWidth={620}
              columns={[
                {
                  key: 'name',
                  header: 'Buyer',
                  sortValue: (r) => r.name,
                  render: (r) => (
                    <Anchor component={Link} to={`/crm/customers/${r.id}`} size="sm">
                      {r.name}
                    </Anchor>
                  ),
                },
                { key: 'city', header: 'City', sortValue: (r) => r.city, hideOnPhone: true },
                { key: 'orders', header: 'Orders', align: 'right', sortValue: (r) => r.orderCount, render: (r) => formatNumber(r.orderCount) },
                {
                  key: 'ltv',
                  header: 'Lifetime value',
                  align: 'right',
                  sortValue: (r) => r.lifetimeValue,
                  render: (r) => (r.lifetimeValue === null ? '—' : formatMoney({ amount: r.lifetimeValue, currency: r.currency })),
                },
                { key: 'last', header: 'Last order', sortValue: (r) => r.lastOrderAt, render: (r) => formatDate(r.lastOrderAt) },
              ]}
            />
            <PrivacyNote />
          </Stack>
        )}
      </Widget>
    </>
  );
}

/** New vs returning buyers in the period — from the new sales report (no CRM needed). */
function BuyerMix() {
  const range = useRange();
  const mix = useQuery({
    queryKey: [INSIGHTS_KEY, 'buyer-mix', rangeKey(range)],
    queryFn: () => newInsightsApi.sales(range.current, range.grain),
    staleTime: 60_000,
  });
  return (
    <Widget title="New and returning buyers" description="Who bought from you in this period" query={mix} notYet="New and returning buyers" testId="buyer-mix">
      {(d) => <KpiGrid specs={buyerKpis(d.buyers)} compare={range.compare} cols={5} />}
    </Widget>
  );
}

export function buyerKpis(b: SalesInsights['buyers']): KpiSpec[] {
  const count = (key: string, label: string, m: Metric): KpiSpec => ({
    key,
    label,
    value: formatNumber(m.current),
    previous: formatNumber(m.previous),
    delta: deltaPercent(m.current, m.previous),
    unit: 'percent',
    isNew: m.previous === 0 && m.current > 0,
  });
  return [
    count('buyers', 'Buyers', b.buyers),
    count('new', 'New buyers', b.newBuyers),
    count('returning', 'Returning buyers', b.returningBuyers),
    {
      key: 'returningPct',
      label: 'Came back',
      value: formatPercent(b.returningPercent.current),
      previous: formatPercent(b.returningPercent.previous),
      delta: pointDelta(b.returningPercent.current, b.returningPercent.previous),
      unit: 'points',
    },
    {
      key: 'perBuyer',
      label: 'Sales per buyer',
      value: formatMoney(b.salesPerBuyer.current === null ? null : Math.round(b.salesPerBuyer.current)),
      previous: formatMoney(b.salesPerBuyer.previous === null ? null : Math.round(b.salesPerBuyer.previous)),
      delta: deltaPercent(b.salesPerBuyer.current, b.salesPerBuyer.previous),
      unit: 'percent',
    },
  ];
}

export default function CustomersPage() {
  const session = useCrmSession({ acquire: true });
  return (
    <Stack gap="md">
      <BuyerMix />
      {session.status === 'unavailable' ? (
        <CrmSettingUp />
      ) : session.status === 'forbidden' ? (
        <Alert color="gray" variant="light" icon={<IconLock size={18} />} title="Customer details are not available for your account" data-testid="crm-forbidden">
          Ask the shop owner to give your team account access to customers.
        </Alert>
      ) : (
        <>
          <Buyers />
          <Card>
            <Text fw={650} mb="sm">
              Go deeper in your customer CRM
            </Text>
            <CrmLinks />
          </Card>
        </>
      )}
    </Stack>
  );
}
