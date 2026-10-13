import { Alert, Avatar, Badge, Button, Card, Group, SimpleGrid, Stack, Tabs, Text } from '@mantine/core';
import { IconCash, IconInfoCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useCursorList } from '../../api/useCursorList';
import { DataList } from '../../components/DataList';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatDateTime, formatMoney, formatNumber, initialsOf, labelOf } from '../../lib/format';
import { useTab } from '../../lib/useTab';
import { analyticsApi, TopReelsSort, type TopReel } from '../analytics/api';
import { ledgerKindLabel, ledgerStateLabel, moneyApi, type LedgerEntry } from './api';

/** A ledger note is machine text ("BoostDecision:…", "Refund … (reason)"); show the human part only. */
function entryDetail(e: LedgerEntry): string | null {
  if (!e.note) return null;
  if (e.note.startsWith('BoostDecision:')) return 'Paid boost on one of your reels';
  if (/^Payout [0-9a-f]+ cancelled/i.test(e.note)) return 'Payout cancelled — money returned';
  const refund = /^Refund [0-9a-f]+ \((.+)\)$/i.exec(e.note);
  if (refund) return `Buyer refund (${refund[1].replace(/[_.]/g, ' ')})`;
  return e.note;
}

function EntriesList() {
  const list = useCursorList({ key: ['earnings', 'entries'], fetchPage: moneyApi.entries });
  if (list.query.isPending) return <ListSkeleton rows={4} height={44} />;
  if (list.query.error)
    return <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load your earnings history" />;
  const items = list.query.data?.items ?? [];
  return (
    <>
      {items.length === 0 ? (
        <EmptyBlock
          title="No earnings yet"
          body="When someone buys a product you tagged in a reel, your commission shows here — pending first, then settled after the return window."
        />
      ) : (
        <Stack gap={0} data-testid="earnings-entries">
          {items.map((e) => {
            const detail = entryDetail(e);
            return (
              <Group key={e.id} justify="space-between" py="xs" wrap="nowrap" style={{ borderBottom: '1px solid var(--sm-row-line)' }}>
                <div style={{ minWidth: 0 }}>
                  <Group gap={6}>
                    <Text size="sm" fw={600}>
                      {labelOf(ledgerKindLabel, e.kind)}
                    </Text>
                    <Badge size="xs" variant="light" color={e.state === 2 ? 'forest' : e.state === 3 ? 'gray' : 'amber'}>
                      {labelOf(ledgerStateLabel, e.state)}
                    </Badge>
                  </Group>
                  <Text size="xs" c="dimmed">
                    {formatDateTime(e.occurredUtc)}
                    {detail ? ` · ${detail}` : ''}
                  </Text>
                </div>
                <Text size="sm" fw={650} c={e.amountValue < 0 ? 'var(--sm-danger-text)' : 'var(--sm-good-text)'} style={{ flexShrink: 0 }}>
                  {e.amountValue > 0 ? '+' : ''}
                  {formatMoney({ amount: e.amountValue, currency: e.amountCurrency }, { decimals: 2 })}
                </Text>
              </Group>
            );
          })}
        </Stack>
      )}
      <Pager
        page={list.page}
        pageSize={list.pageSize}
        total={list.total}
        shown={items.length}
        hasPrev={list.hasPrev}
        hasNext={list.hasNext}
        onPrev={list.prev}
        onNext={list.next}
        busy={list.query.isFetching}
      />
    </>
  );
}

function ByReel() {
  const reels = useQuery({ queryKey: ['earnings', 'by-reel'], queryFn: () => analyticsApi.topReels({ sortBy: TopReelsSort.HighestEarnings, limit: 25 }) });
  if (reels.isPending) return <ListSkeleton rows={4} />;
  if (reels.error) return <ErrorBlock error={reels.error} onRetry={() => void reels.refetch()} title="Could not load commission per reel" />;
  const rows = reels.data.filter((r) => r.earnings.amount > 0 || r.sales > 0);
  if (rows.length === 0)
    return <EmptyBlock title="No reel has earned yet in the last 30 days" body="Tag products in your reels — each sale from a reel shows up here." />;
  return (
    <>
      <Text size="xs" c="dimmed" mb="sm">
        Last 30 days, settled commission net of returns, for your most-watched reels.
      </Text>
      <DataList<TopReel>
        items={rows}
        rowKey={(r) => r.reelId}
        caption="Commission per reel"
        cardTitle={(r) => (
          <Text fw={600} size="sm" lineClamp={2}>
            {r.title || 'Untitled reel'}
          </Text>
        )}
        cardRight={(r) => <Text fw={650}>{formatMoney(r.earnings)}</Text>}
        columns={[
          {
            key: 'reel',
            header: 'Reel',
            hideOnCard: true,
            render: (r) => (
              <Text component={Link} to={`/reels/${r.reelId}`} size="sm" fw={600} lineClamp={1} c="inherit">
                {r.title || 'Untitled reel'}
              </Text>
            ),
          },
          { key: 'published', header: 'Published', render: (r) => formatDate(r.publishedAtUtc) },
          { key: 'views', header: 'Views', align: 'right', render: (r) => formatNumber(r.views) },
          { key: 'sales', header: 'Sales', align: 'right', render: (r) => formatNumber(r.sales) },
          { key: 'earnings', header: 'Commission', align: 'right', hideOnCard: true, render: (r) => <b>{formatMoney(r.earnings)}</b> },
        ]}
      />
    </>
  );
}

function TipsList() {
  const balance = useQuery({ queryKey: ['earnings', 'tips', 'balance'], queryFn: moneyApi.tipBalance });
  const list = useCursorList({ key: ['earnings', 'tips', 'received'], fetchPage: moneyApi.tipsReceived });
  const items = list.query.data?.items ?? [];
  return (
    <Stack gap="md">
      {balance.error ? (
        <ErrorBlock error={balance.error} onRetry={() => void balance.refetch()} title="Could not load your tips total" />
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 2 }}>
          <KpiTile label="Tips received" value={balance.data ? formatMoney(balance.data.totalReceived) : ''} loading={balance.isPending} hint="After StyleMint’s 3% fee" />
          <KpiTile label="Tips on the way" value={balance.data ? formatMoney(balance.data.pendingBalance) : ''} loading={balance.isPending} tone="amber" />
        </SimpleGrid>
      )}
      <Alert color="gray" variant="light" icon={<IconInfoCircle size={16} />}>
        Tips are kept separately from your commission balance and are not part of on-request payouts yet.
      </Alert>
      {list.query.isPending ? (
        <ListSkeleton rows={3} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load your tips" />
      ) : items.length === 0 ? (
        <EmptyBlock title="No tips yet" body="Fans can tip you from your reels in the StyleMint app." />
      ) : (
        <Stack gap={0} data-testid="tips-list">
          {items.map((t) => (
            <Group key={t.id} justify="space-between" py="xs" wrap="nowrap" style={{ borderBottom: '1px solid var(--sm-row-line)' }}>
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <Avatar size={32} radius="xl" src={t.senderAvatarUrl ?? undefined} color="forest">
                  {initialsOf(t.senderName)}
                </Avatar>
                <div style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>
                    {t.senderName}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatDateTime(t.createdAt)}
                    {t.reelId ? ' · on a reel' : ''}
                  </Text>
                </div>
              </Group>
              <Text size="sm" fw={650} c="var(--sm-good-text)">
                +{formatMoney(t.amount)}
              </Text>
            </Group>
          ))}
        </Stack>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
    </Stack>
  );
}

export default function EarningsPage() {
  const balance = useQuery({ queryKey: ['earnings', 'balance'], queryFn: moneyApi.balance });
  const summary = useQuery({ queryKey: ['earnings', 'summary'], queryFn: moneyApi.summary });
  const [tab, setTab] = useTab(['history', 'reels', 'tips'] as const, 'history');
  const b = balance.data;
  const s = summary.data;
  const currency = b?.currency ?? 'NPR';

  return (
    <>
      <PageHeader
        title="Earnings"
        description="Commission from sales of products you tagged, after returns. Pending money settles once the return window closes."
        actions={
          <Button component={Link} to="/payouts" leftSection={<IconCash size={16} />}>
            Payouts
          </Button>
        }
      />
      {balance.error ? (
        <ErrorBlock error={balance.error} onRetry={() => void balance.refetch()} title="Could not load your balance" />
      ) : (
        <SimpleGrid cols={{ base: 1, xs: 3 }} spacing="md" mb="md">
          <KpiTile label="Available" value={b ? formatMoney({ amount: b.availableValue, currency }) : ''} loading={balance.isPending} hint="Ready to pay out" to="/payouts" />
          <KpiTile label="Pending" value={b ? formatMoney({ amount: b.pendingValue, currency }) : ''} loading={balance.isPending} tone="amber" hint="In the return window" />
          <KpiTile label="Earned in total" value={b ? formatMoney({ amount: b.lifetimeValue, currency }) : ''} loading={balance.isPending} tone="gray" />
        </SimpleGrid>
      )}
      <Card mb="md">
        <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="xs" style={{ letterSpacing: '0.06em' }}>
          This month so far
        </Text>
        {summary.error ? (
          <ErrorBlock error={summary.error} onRetry={() => void summary.refetch()} title="Could not load this month’s summary" />
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
            {[
              ['Commission', s ? formatMoney({ amount: s.thisMonthEarningsAmount, currency: s.currency }) : '…'],
              ['Sales', s ? formatNumber(s.thisMonthSalesCount) : '…'],
              ['Per sale', s ? formatMoney({ amount: s.avgEarningsPerSaleAmount, currency: s.currency }) : '…'],
              ['Best reel', s ? formatMoney({ amount: s.highestReelEarningsAmount, currency: s.currency }) : '…'],
            ].map(([label, value]) => (
              <div key={label}>
                <Text size="xs" c="dimmed">
                  {label}
                </Text>
                <Text fw={700} fz="lg">
                  {value}
                </Text>
              </div>
            ))}
          </SimpleGrid>
        )}
      </Card>
      <Card>
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="history">History</Tabs.Tab>
            <Tabs.Tab value="reels">By reel</Tabs.Tab>
            <Tabs.Tab value="tips">Tips</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="history">{tab === 'history' && <EntriesList />}</Tabs.Panel>
          <Tabs.Panel value="reels">{tab === 'reels' && <ByReel />}</Tabs.Panel>
          <Tabs.Panel value="tips">{tab === 'tips' && <TipsList />}</Tabs.Panel>
        </Tabs>
      </Card>
    </>
  );
}
