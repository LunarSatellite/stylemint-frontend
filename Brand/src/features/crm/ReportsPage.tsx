import type { ReactNode } from 'react';
import { Anchor, Box, Group, SimpleGrid, Stack, Text, Tooltip } from '@mantine/core';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatMoney, formatMoneyCompact, formatNumber } from '../../lib/format';
import { crmApi } from './api';
import { RequireCap } from './components';
import { CRM_KEY } from './hooks';

/** Simple bars — the same plain-element chart style as the Home trend. */
function Bars({ points, format }: { points: { label: string; value: number }[]; format: (v: number) => string }) {
  if (points.length === 0) return null;
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  return (
    <figure style={{ margin: 0 }}>
      <Group gap={3} align="flex-end" wrap="nowrap" h={110} role="img" aria-label={points.map((p) => `${p.label}: ${format(p.value)}`).join(', ')}>
        {points.map((p) => (
          <Tooltip key={p.label} label={`${p.label}: ${format(p.value)}`}>
            <Box
              style={{
                flex: 1,
                minWidth: 3,
                height: `${Math.max(2, (Math.abs(p.value) / max) * 100)}%`,
                borderRadius: '4px 4px 1px 1px',
                background: p.value > 0 ? 'linear-gradient(180deg, #45ae86, #03875a)' : p.value < 0 ? '#ff7a6d' : 'var(--sm-border)',
              }}
            />
          </Tooltip>
        ))}
      </Group>
      <Group justify="space-between" mt={6}>
        <Text size="xs" c="dimmed">
          {points[0].label}
        </Text>
        <Text size="xs" c="dimmed">
          {points[points.length - 1].label}
        </Text>
      </Group>
    </figure>
  );
}

/** One report card: its own loading / error / empty, so one failing source does not blank the page. */
function Panel<T>({
  title,
  description,
  query,
  isEmpty,
  emptyText,
  children,
}: {
  title: string;
  description?: string;
  query: UseQueryResult<T>;
  isEmpty?: (d: T) => boolean;
  emptyText?: string;
  children: (d: T) => ReactNode;
}) {
  return (
    <SectionCard title={title} description={description}>
      {query.isPending ? (
        <ListSkeleton rows={2} height={48} />
      ) : query.error || query.data === undefined ? (
        <ErrorBlock error={query.error ?? new Error('No data')} title={`Could not load ${title.toLowerCase()}`} onRetry={() => void query.refetch()} />
      ) : isEmpty?.(query.data) ? (
        <EmptyBlock title={emptyText ?? 'Not enough data yet'} />
      ) : (
        children(query.data)
      )}
    </SectionCard>
  );
}

function Reports() {
  const contacts = useQuery({ queryKey: [CRM_KEY, 'analytics', 'contacts'], queryFn: crmApi.contactStats });
  const deals = useQuery({ queryKey: [CRM_KEY, 'analytics', 'deals'], queryFn: crmApi.dealStats });
  const nps = useQuery({ queryKey: [CRM_KEY, 'analytics', 'nps'], queryFn: () => crmApi.npsAnalytics(6) });
  const churn = useQuery({ queryKey: [CRM_KEY, 'analytics', 'churn'], queryFn: crmApi.churnAnalytics });
  const activity = useQuery({ queryKey: [CRM_KEY, 'analytics', 'activity'], queryFn: crmApi.activityAnalytics });
  const revenue = useQuery({ queryKey: [CRM_KEY, 'analytics', 'revenue'], queryFn: crmApi.revenueAnalytics });
  const c = contacts.data;
  const growth = c && c.createdLastMonth > 0 ? Math.round(((c.createdThisMonth - c.createdLastMonth) / c.createdLastMonth) * 100) : null;
  return (
    <>
      <PageHeader title="Reports" description="How your customer base, feedback and wholesale deals are doing." />
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
          <KpiTile label="Customers" value={formatNumber(c?.total)} loading={contacts.isPending} hint={contacts.error ? 'Could not load' : undefined} />
          <KpiTile
            label="New this month"
            value={formatNumber(c?.createdThisMonth)}
            loading={contacts.isPending}
            hint={growth !== null ? `${growth >= 0 ? '+' : ''}${growth}% vs last month` : undefined}
            tone="gray"
          />
          <KpiTile
            label="NPS (6 months)"
            value={nps.data && nps.data.totalResponded > 0 ? Math.round(nps.data.npsScore) : '—'}
            loading={nps.isPending}
            hint={nps.data ? `${formatNumber(nps.data.totalResponded)} answers` : nps.error ? 'Could not load' : undefined}
            tone="amber"
          />
          <KpiTile
            label="Open wholesale value"
            value={formatMoneyCompact(deals.data?.totalPipelineValue ?? null)}
            loading={deals.isPending}
            hint={deals.data ? `${formatNumber(deals.data.openCount)} open deals` : deals.error ? 'Could not load' : undefined}
            tone="gray"
          />
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Panel
            title="Customer activity"
            description="Orders, reviews, questions and messages per day (30 days)."
            query={activity}
            isEmpty={(d) => d.totalSignals30d === 0}
            emptyText="No activity in the last 30 days"
          >
            {(d) => (
              <Stack gap="xs">
                <Text size="sm">
                  <b>{formatNumber(d.totalSignals7d)}</b> this week · <b>{formatNumber(d.totalSignals30d)}</b> in 30 days
                </Text>
                <Bars points={d.dailyTrend.map((p) => ({ label: p.dateLabel, value: p.count }))} format={(v) => formatNumber(v)} />
              </Stack>
            )}
          </Panel>

          <Panel title="NPS by month" query={nps} isEmpty={(d) => d.totalResponded === 0} emptyText="No survey answers yet">
            {(d) => (
              <Stack gap="xs">
                <Text size="sm">
                  {formatNumber(d.promoters)} promoters · {formatNumber(d.passives)} passives · {formatNumber(d.detractors)} detractors ·{' '}
                  {Math.round(d.responseRate > 1 ? d.responseRate : d.responseRate * 100)}% answered
                </Text>
                <Bars points={d.monthlyTrend.map((p) => ({ label: p.monthLabel, value: p.npsScore }))} format={(v) => String(Math.round(v))} />
              </Stack>
            )}
          </Panel>

          <Panel title="Customers at risk" description="Likely not to buy again in the next 30 days." query={churn} isEmpty={(d) => d.churn30.contactsScored === 0} emptyText="Risk scores are not ready yet">
            {(d) => (
              <Stack gap="xs">
                <Text size="sm">
                  <b>{formatNumber(d.churn30.highRiskCount)}</b> high · {formatNumber(d.churn30.mediumRiskCount)} medium · {formatNumber(d.churn30.lowRiskCount)} low risk
                </Text>
                {d.topAtRisk.slice(0, 5).map((r) => (
                  <Group key={r.contactId} justify="space-between" wrap="nowrap">
                    <Anchor component={Link} to={`/crm/customers/${r.contactId}`} size="sm" truncate>
                      {r.fullName}
                    </Anchor>
                    <Text size="sm" c="signal">
                      {Math.round(r.churnProbabilityPct)}%
                    </Text>
                  </Group>
                ))}
              </Stack>
            )}
          </Panel>

          <Panel title="Wholesale deals" query={deals} isEmpty={(d) => d.openCount + d.closedWonCount + d.closedLostCount === 0} emptyText="No wholesale deals yet">
            {(d) => (
              <SimpleGrid cols={2} spacing="sm">
                <Text size="sm">
                  Won: <b>{formatNumber(d.closedWonCount)}</b>
                </Text>
                <Text size="sm">
                  Lost: <b>{formatNumber(d.closedLostCount)}</b>
                </Text>
                <Text size="sm">
                  Win rate: <b>{Math.round(d.winRate > 1 ? d.winRate : d.winRate * 100)}%</b>
                </Text>
                <Text size="sm">
                  Average deal: <b>{formatMoney(d.avgDealSize)}</b>
                </Text>
                {revenue.data && (
                  <>
                    <Text size="sm">
                      Expected this month: <b>{formatMoney(revenue.data.expectedThisMonth)}</b>
                    </Text>
                    <Text size="sm">
                      Won all time: <b>{formatMoney(revenue.data.totalWonAllTime)}</b>
                    </Text>
                  </>
                )}
              </SimpleGrid>
            )}
          </Panel>
        </SimpleGrid>
      </Stack>
    </>
  );
}

export default function ReportsPage() {
  return (
    <RequireCap cap="reports.view">
      <Reports />
    </RequireCap>
  );
}
