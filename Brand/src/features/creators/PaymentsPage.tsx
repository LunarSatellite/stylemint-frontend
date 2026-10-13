import { useMemo, useState } from 'react';
import { Anchor, Card, Group, SegmentedControl, SimpleGrid, Stack, Table, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Link } from 'react-router-dom';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatMoney, formatNumber } from '../../lib/format';
import { useIsPhone } from '../../lib/useIsPhone';
import { agreementsApi, AgreementStatus } from './agreementsApi';
import { creatorsApi, RetainerState } from './api';
import { CreatorLine, CREATORS_KEY } from './components';
import { lookOf, retainerStateLook } from './labels';

const PERIODS = [
  { value: '30', label: '30 days' },
  { value: '90', label: '90 days' },
  { value: '365', label: '12 months' },
];

export default function PaymentsPage() {
  const phone = useIsPhone();
  const [period, setPeriod] = useState('90');
  const fromUtc = useMemo(() => dayjs().subtract(Number(period), 'day').startOf('day').toISOString(), [period]);
  const perf = useQuery({ queryKey: [CREATORS_KEY, 'performance', period], queryFn: () => creatorsApi.performance(fromUtc, 100) });
  const retainers = useQuery({ queryKey: [CREATORS_KEY, 'retainers'], queryFn: creatorsApi.retainers });
  // Agreements are optional here: they only add a link per creator.
  const agreements = useQuery({
    queryKey: [CREATORS_KEY, 'agreements', 'active-for-payments'],
    queryFn: () => agreementsApi.list({ status: [AgreementStatus.Active, AgreementStatus.Amended] }, null),
    retry: false,
  });
  const agreementsByCreator = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of agreements.data?.items ?? []) m.set(a.creatorAccountId, (m.get(a.creatorAccountId) ?? 0) + 1);
    return m;
  }, [agreements.data]);

  const rows = perf.data ?? [];
  const currency = rows[0]?.currency ?? 'NPR';
  const totalCommission = rows.reduce((s, r) => s + r.commissionPaid, 0);
  const totalRevenue = rows.reduce((s, r) => s + r.attributedRevenue, 0);
  const live = (retainers.data ?? []).filter((r) => r.state === RetainerState.Active || r.state === RetainerState.Cancelling);
  const monthlyRetainers = live.reduce((s, r) => s + r.monthlyAmount, 0);

  return (
    <>
      <PageHeader
        title="Payments to creators"
        description="Commission earned by each creator on your sales, and the monthly retainer fees you pay. StyleMint deducts these from your earnings automatically."
        actions={<SegmentedControl value={period} onChange={setPeriod} data={PERIODS} aria-label="Period" />}
      />
      <Stack gap="lg">
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md">
          <KpiTile label="Commission to creators" value={formatMoney({ amount: totalCommission, currency })} loading={perf.isPending} hint={`Last ${PERIODS.find((p) => p.value === period)?.label}`} />
          <KpiTile label="Sales from creators" value={formatMoney({ amount: totalRevenue, currency })} loading={perf.isPending} tone="gray" />
          <KpiTile
            label="Retainers per month"
            value={formatMoney(monthlyRetainers)}
            loading={retainers.isPending}
            tone="amber"
            hint={`${live.length} running`}
            to="/creators/retainers"
          />
        </SimpleGrid>

        <SectionCard title="Commission by creator">
          {perf.isPending ? (
            <ListSkeleton />
          ) : perf.error ? (
            <ErrorBlock error={perf.error} title="Could not load creator commissions" onRetry={() => void perf.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyBlock title="No creator sales in this period" body="Commission appears here once a buyer orders through a creator’s reel." />
          ) : phone ? (
            <Stack gap="sm" data-testid="payment-cards">
              {rows.map((r) => (
                <Card key={r.creatorAccountId} withBorder padding="sm">
                  <CreatorLine accountId={r.creatorAccountId} name={r.creatorDisplayName} handle={r.creatorHandle} avatarUrl={r.creatorAvatarUrl} />
                  <Group justify="space-between" mt={6}>
                    <Text size="sm">{formatNumber(r.unitsSold)} sold</Text>
                    <Text size="sm" fw={650}>
                      {formatMoney({ amount: r.commissionPaid, currency: r.currency })}
                    </Text>
                  </Group>
                </Card>
              ))}
            </Stack>
          ) : (
            <Table.ScrollContainer minWidth={640}>
              <Table verticalSpacing="sm" data-testid="payment-table">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Creator</Table.Th>
                    <Table.Th ta="right">Items sold</Table.Th>
                    <Table.Th ta="right">Sales</Table.Th>
                    <Table.Th ta="right">Commission</Table.Th>
                    <Table.Th>Agreement</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {rows.map((r) => {
                    const count = agreementsByCreator.get(r.creatorAccountId) ?? 0;
                    return (
                      <Table.Tr key={r.creatorAccountId}>
                        <Table.Td>
                          <CreatorLine accountId={r.creatorAccountId} name={r.creatorDisplayName} handle={r.creatorHandle} avatarUrl={r.creatorAvatarUrl} />
                        </Table.Td>
                        <Table.Td ta="right">{formatNumber(r.unitsSold)}</Table.Td>
                        <Table.Td ta="right">{formatMoney({ amount: r.attributedRevenue, currency: r.currency })}</Table.Td>
                        <Table.Td ta="right" fw={650}>
                          {formatMoney({ amount: r.commissionPaid, currency: r.currency })}
                        </Table.Td>
                        <Table.Td>
                          {agreements.data ? (
                            count > 0 ? (
                              <Anchor component={Link} to={`/creators/agreements?creatorAccountId=${r.creatorAccountId}`} size="sm">
                                {count} active
                              </Anchor>
                            ) : (
                              <Text size="sm" c="dimmed">
                                None
                              </Text>
                            )
                          ) : (
                            <Text size="sm" c="dimmed">
                              —
                            </Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          )}
        </SectionCard>

        <SectionCard title="Retainer fees" description="Fixed monthly fees. They are charged at the start of each period.">
          {retainers.isPending ? (
            <ListSkeleton rows={2} />
          ) : retainers.error ? (
            <ErrorBlock error={retainers.error} title="Could not load retainers" onRetry={() => void retainers.refetch()} />
          ) : !retainers.data.length ? (
            <EmptyBlock title="No retainers" />
          ) : (
            <Stack gap="xs">
              {retainers.data.map((r) => (
                <Group key={r.id} justify="space-between" wrap="nowrap" data-testid="retainer-fee">
                  <CreatorLine accountId={r.creatorAccountId} extra={r.nextBillingUtc ? `next ${formatDate(r.nextBillingUtc)}` : undefined} />
                  <Group gap="xs" wrap="nowrap">
                    <Text size="sm" fw={600}>
                      {formatMoney({ amount: r.monthlyAmount, currency: r.currency })}
                    </Text>
                    <StatusBadge size="sm" {...lookOf(retainerStateLook, r.state)} />
                  </Group>
                </Group>
              ))}
            </Stack>
          )}
        </SectionCard>
        <Text size="xs" c="dimmed">
          Your own payouts and deductions are under <Anchor component={Link} to="/payouts">Payouts & earnings</Anchor>.
        </Text>
      </Stack>
    </>
  );
}
