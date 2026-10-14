import { Anchor, Badge, Grid, Group, List, SimpleGrid, Stack, Text } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { formatDate, formatMoney, formatNumber, humanize } from '../../lib/format';
import { demandDays, INSIGHTS_KEY, insightsApi, IntentChannel } from './api';
import { BarsChart, DataTable, DeltaBadge, formatPercent, MetricTile, Notes, rangeKey, useRange, Widget, type Column } from './components';
import { newInsightsApi, preferInsights, type DemandQuery } from './contracts';
import { deltaPercent, ratio } from './period';

/** Searches for this seller: from the new vendor-matched report, or StyleMint-wide from the older one. */
function useDemand() {
  const range = useRange();
  const days = demandDays(range.current);
  return useQuery({
    queryKey: [INSIGHTS_KEY, 'demand', days],
    queryFn: () =>
      preferInsights(
        () => newInsightsApi.demand(days),
        async () => {
          const [signals, unmet] = await Promise.all([insightsApi.demandSignals(range.current), insightsApi.unmetDemand(range.current)]);
          return { signals, unmet };
        },
      ),
    staleTime: 120_000,
  });
}

function queryColumns(compare: boolean, unmet: boolean): Column<DemandQuery>[] {
  return [
    { key: 'query', header: 'Search', sortValue: (r) => r.query },
    { key: 'searches', header: unmet ? 'Poor results' : 'Searches', align: 'right', sortValue: (r) => (unmet ? r.unmetSearches : r.searches), render: (r) => formatNumber(unmet ? r.unmetSearches : r.searches) },
    ...(compare
      ? [{ key: 'change', header: 'Change', align: 'right' as const, sortValue: (r: DemandQuery) => r.deltaPercent, render: (r: DemandQuery) => <DeltaBadge value={r.deltaPercent} isNew={r.previousSearches === 0 && r.searches > 0} /> }]
      : []),
    { key: 'category', header: 'Matches', sortValue: (r) => r.categoryName ?? humanize(r.matchedOn), render: (r) => r.categoryName ?? humanize(r.matchedOn), hideOnPhone: true },
    { key: 'yours', header: 'Your products', align: 'right', sortValue: (r) => r.yourMatchingProducts, render: (r) => formatNumber(r.yourMatchingProducts) },
  ];
}

export default function DemandPage() {
  const range = useRange();
  const key = rangeKey(range);
  const days = demandDays(range.current);
  const demand = useDemand();
  const board = useQuery({ queryKey: [INSIGHTS_KEY, 'intent-board', key], queryFn: () => insightsApi.intentBoard(range.current), staleTime: 120_000 });
  const prices = useQuery({ queryKey: [INSIGHTS_KEY, 'price-suggestions'], queryFn: insightsApi.priceSuggestions, staleTime: 120_000 });
  const vendorMatched = demand.data?.source === 'insights';
  const compare = range.compare && (demand.data?.source !== 'insights' || demand.data.data.previousComplete);

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed" data-testid="demand-basis">
        {vendorMatched
          ? `Searches on StyleMint over the last ${days} days that match your categories and products.`
          : `Searches across all of StyleMint over the last ${days} days.`}{' '}
        A search term is shown only when enough different shoppers used it, so no single buyer can be singled out.
      </Text>

      <Widget title="Demand for what you sell" query={demand} testId="demand-kpis" notYet="Demand matched to your shop">
        {(d) =>
          d.source === 'insights' ? (
            <Stack gap="xs">
              <SimpleGrid cols={{ base: 2, md: 3 }} spacing="md">
                <MetricTile
                  label="Relevant searches"
                  value={formatNumber(d.data.relevantSearches.current)}
                  previous={formatNumber(d.data.relevantSearches.previous)}
                  delta={deltaPercent(d.data.relevantSearches.current, d.data.relevantSearches.previous)}
                  compare={compare}
                />
                <MetricTile
                  label="Found little or nothing"
                  value={formatNumber(d.data.unmetRelevantSearches.current)}
                  previous={formatNumber(d.data.unmetRelevantSearches.previous)}
                  delta={deltaPercent(d.data.unmetRelevantSearches.current, d.data.unmetRelevantSearches.previous)}
                  compare={compare}
                  tone="amber"
                />
                <MetricTile
                  label="Unmet share"
                  value={formatPercent(ratio(d.data.unmetRelevantSearches.current, d.data.relevantSearches.current), { fraction: true })}
                  compare={false}
                  tone="gray"
                  hint="Searches you could win with the right product"
                />
              </SimpleGrid>
              {!d.data.previousComplete && range.compare && (
                <Text size="xs" c="dimmed">
                  StyleMint keeps searches for 35 days, so there is no full previous period to compare with.
                </Text>
              )}
              <Notes notes={d.data.notes} />
            </Stack>
          ) : (
            <SimpleGrid cols={{ base: 2, md: 3 }} spacing="md">
              <MetricTile label="Searches (all of StyleMint)" value={formatNumber(d.data.unmet.window.observedRequests)} compare={false} />
              <MetricTile label="Found little or nothing" value={formatNumber(d.data.unmet.window.unmetRequests)} compare={false} tone="amber" />
              <MetricTile
                label="Unmet share"
                value={formatPercent(ratio(d.data.unmet.window.unmetRequests, d.data.unmet.window.observedRequests), { fraction: true })}
                compare={false}
                tone="gray"
              />
            </SimpleGrid>
          )
        }
      </Widget>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Widget
            title={vendorMatched ? 'What buyers search for in your categories' : 'What buyers search for'}
            query={demand}
            isEmpty={(d) => (d.source === 'insights' ? d.data.searches.length === 0 : d.data.signals.topSearches.length === 0)}
            empty={<Text size="sm" c="dimmed">No searches recorded in this window.</Text>}
            testId="top-searches"
          >
            {(d) => {
              const bars = d.source === 'insights' ? d.data.searches.map((s) => ({ label: s.query, value: s.searches })) : d.data.signals.topSearches.map((s) => ({ label: s.query, value: s.count }));
              return (
                <Stack gap="sm">
                  <BarsChart data={bars.slice(0, 8)} kind="count" label="Searches" horizontal height={Math.max(160, Math.min(8, bars.length) * 30)} />
                  {d.source === 'insights' ? (
                    <DataTable rows={d.data.searches} rowKey={(r) => r.query} exportName="Searches in your categories" initialSort={{ key: 'searches', dir: 'desc' }} minWidth={520} columns={queryColumns(compare, false)} />
                  ) : (
                    <DataTable
                      rows={d.data.signals.topSearches}
                      rowKey={(r) => r.query}
                      exportName="Top searches"
                      initialSort={{ key: 'count', dir: 'desc' }}
                      minWidth={0}
                      columns={[
                        { key: 'query', header: 'Search', sortValue: (r) => r.query },
                        { key: 'count', header: 'Searches', align: 'right', sortValue: (r) => r.count, render: (r) => formatNumber(r.count) },
                      ]}
                    />
                  )}
                </Stack>
              );
            }}
          </Widget>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Widget
            title="Unmet demand"
            description="Searches that found nothing or little — products you could add"
            query={demand}
            isEmpty={(d) => (d.source === 'insights' ? d.data.unmetSearches.length === 0 : d.data.unmet.unmet.length === 0)}
            empty={<Text size="sm" c="dimmed">Every search found good results in this window.</Text>}
            testId="unmet-demand"
          >
            {(d) =>
              d.source === 'insights' ? (
                <DataTable rows={d.data.unmetSearches} rowKey={(r) => r.query} exportName="Unmet demand" initialSort={{ key: 'searches', dir: 'desc' }} minWidth={520} columns={queryColumns(compare, true)} />
              ) : (
                <Stack gap="sm">
                  <Text size="xs" c="dimmed">
                    {formatNumber(d.data.unmet.window.unmetRequests)} of {formatNumber(d.data.unmet.window.observedRequests)} searches went unanswered
                    {d.data.unmet.window.withheldQueries > 0 ? ` · ${formatNumber(d.data.unmet.window.withheldQueries)} rarer terms withheld for privacy` : ''}.
                  </Text>
                  <DataTable
                    rows={d.data.unmet.unmet}
                    rowKey={(r) => r.query}
                    exportName="Unmet demand"
                    initialSort={{ key: 'observations', dir: 'desc' }}
                    minWidth={560}
                    columns={[
                      { key: 'query', header: 'Search', sortValue: (r) => r.query },
                      { key: 'observations', header: 'Times', align: 'right', sortValue: (r) => r.observations, render: (r) => formatNumber(r.observations) },
                      { key: 'shoppers', header: 'Shoppers', align: 'right', sortValue: (r) => r.distinctShoppers, render: (r) => formatNumber(r.distinctShoppers) },
                      {
                        key: 'reason',
                        header: 'Why',
                        hideOnPhone: true,
                        sortValue: (r) => [...r.reasons].sort((a, b) => b.observations - a.observations)[0]?.reason ?? '',
                        render: (r) => {
                          const top = [...r.reasons].sort((a, b) => b.observations - a.observations)[0];
                          return top ? (
                            <Badge variant="light" color="amber">
                              {humanize(top.reason)}
                            </Badge>
                          ) : (
                            '—'
                          );
                        },
                        csv: (r) => r.reasons.map((x) => `${humanize(x.reason)} (${x.observations})`).join('; '),
                      },
                      { key: 'last', header: 'Last seen', sortValue: (r) => r.lastObservedUtc, render: (r) => formatDate(r.lastObservedUtc), hideOnPhone: true },
                    ]}
                  />
                </Stack>
              )
            }
          </Widget>
        </Grid.Col>
      </Grid>

      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 7 }}>
          <Widget
            title="Trending in your categories"
            query={demand}
            notYet="Searches per category"
            isEmpty={(d) => d.source !== 'insights' || d.data.categories.length === 0}
            empty={
              vendorMatched ? (
                <Text size="sm" c="dimmed">
                  No searches matched your categories yet.
                </Text>
              ) : (
                <Text size="sm" c="dimmed" data-testid="state-not-yet">
                  Searches per category will show here once StyleMint switches this report on for your shop.
                </Text>
              )
            }
            testId="demand-categories"
          >
            {(d) =>
              d.source === 'insights' ? (
                <DataTable
                  rows={d.data.categories}
                  rowKey={(r) => r.categoryId}
                  exportName="Demand by category"
                  initialSort={{ key: 'searches', dir: 'desc' }}
                  minWidth={600}
                  columns={[
                    { key: 'name', header: 'Category', sortValue: (r) => r.name },
                    { key: 'searches', header: 'Searches', align: 'right', sortValue: (r) => r.searches, render: (r) => formatNumber(r.searches) },
                    { key: 'unmet', header: 'Poor results', align: 'right', sortValue: (r) => r.unmetSearches, render: (r) => formatNumber(r.unmetSearches), hideOnPhone: true },
                    ...(compare
                      ? [
                          {
                            key: 'change',
                            header: 'Change',
                            align: 'right' as const,
                            sortValue: (r: { deltaPercent: number | null }) => r.deltaPercent,
                            render: (r: { deltaPercent: number | null; previousSearches: number; searches: number }) => (
                              <DeltaBadge value={r.deltaPercent} isNew={r.previousSearches === 0 && r.searches > 0} />
                            ),
                          },
                        ]
                      : []),
                    { key: 'products', header: 'Your products', align: 'right', sortValue: (r) => r.yourProducts },
                    { key: 'sold', header: 'You sold', align: 'right', sortValue: (r) => r.yourUnitsSold, hideOnPhone: true },
                  ]}
                />
              ) : null
            }
          </Widget>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 5 }}>
          <Widget
            title="Sizes, colours and styles buyers want"
            query={demand}
            notYet="Trending sizes and colours"
            isEmpty={(d) => d.source !== 'insights' || (d.data.trendingAttributes.length === 0 && d.data.suggestions.length === 0)}
            empty={
              vendorMatched ? (
                <Text size="sm" c="dimmed">
                  Nothing stands out yet.
                </Text>
              ) : (
                <Text size="sm" c="dimmed" data-testid="state-not-yet">
                  Trending sizes, colours and product ideas will show here once StyleMint switches this report on for your shop.
                </Text>
              )
            }
            testId="demand-attributes"
          >
            {(d) =>
              d.source === 'insights' ? (
                <Stack gap="sm">
                  {d.data.trendingAttributes.length > 0 && (
                    <Group gap={6}>
                      {d.data.trendingAttributes.map((a) => (
                        <Badge key={`${a.kind}:${a.value}`} variant="light" color="forest" rightSection={a.deltaPercent !== null && a.deltaPercent > 0 ? `+${Math.round(a.deltaPercent)}%` : undefined}>
                          {humanize(a.kind)}: {a.value} · {formatNumber(a.searches)}
                        </Badge>
                      ))}
                    </Group>
                  )}
                  {d.data.suggestions.length > 0 && (
                    <div>
                      <Text size="xs" c="dimmed" mb={4}>
                        Products you could add
                      </Text>
                      <List size="sm" spacing={4}>
                        {d.data.suggestions.map((s) => (
                          <List.Item key={s}>{s}</List.Item>
                        ))}
                      </List>
                    </div>
                  )}
                </Stack>
              ) : null
            }
          </Widget>
        </Grid.Col>
      </Grid>

      <Widget
        title="Intent decision board"
        description="Across StyleMint: from search to cart to purchase, per thing buyers want — with what to do about it"
        query={board}
        isEmpty={(d) => d.opportunities.length === 0}
        empty={<Text size="sm" c="dimmed">Not enough shoppers yet to show opportunities.</Text>}
        testId="intent-board"
      >
        {(d) => {
          const by = (c: number) => d.channels.find((x) => x.channel === c)?.signalCount ?? 0;
          return (
            <Stack gap="xs">
              <Text size="xs" c="dimmed">
                {formatNumber(by(IntentChannel.Search))} searches · {formatNumber(by(IntentChannel.UnmetSearch))} with poor results · {formatNumber(by(IntentChannel.Cart))} cart adds ·{' '}
                {formatNumber(by(IntentChannel.Purchase))} purchases
              </Text>
              <DataTable
                rows={d.opportunities}
                rowKey={(r) => r.subject}
                exportName="Intent decision board"
                initialSort={{ key: 'searches', dir: 'desc' }}
                minWidth={820}
                columns={[
                  { key: 'subject', header: 'Buyers want', sortValue: (r) => r.subject },
                  { key: 'searches', header: 'Searches', align: 'right', sortValue: (r) => r.searches, render: (r) => formatNumber(r.searches) },
                  { key: 'unmet', header: 'Poor results', align: 'right', sortValue: (r) => r.unmetSearches, render: (r) => formatNumber(r.unmetSearches), hideOnPhone: true },
                  { key: 'cart', header: 'To cart', align: 'right', sortValue: (r) => r.cartActions, render: (r) => formatNumber(r.cartActions), hideOnPhone: true },
                  { key: 'purchases', header: 'Bought', align: 'right', sortValue: (r) => r.purchases, render: (r) => formatNumber(r.purchases) },
                  { key: 'conversion', header: 'Conversion', align: 'right', sortValue: (r) => r.purchaseConversionPercent, render: (r) => formatPercent(r.purchaseConversionPercent) },
                  { key: 'recommendation', header: 'Suggestion', sortValue: (r) => r.recommendation },
                ]}
              />
              {d.withheldSubjects > 0 && (
                <Text size="xs" c="dimmed">
                  {formatNumber(d.withheldSubjects)} smaller interests are not listed: fewer than {d.minimumCohortSize} shoppers asked for each.
                </Text>
              )}
            </Stack>
          );
        }}
      </Widget>

      <Widget
        title="Price sensitivity"
        description="Price changes StyleMint suggests from how buyers react to your products"
        query={prices}
        isEmpty={(d) => d.length === 0}
        empty={<Text size="sm" c="dimmed">No price suggestions right now — your prices look right for current demand.</Text>}
        testId="price-sensitivity"
      >
        {(d) => (
          <DataTable
            rows={d}
            rowKey={(r) => r.suggestionId}
            exportName="Price suggestions"
            initialSort={{ key: 'demand', dir: 'desc' }}
            minWidth={760}
            columns={[
              {
                key: 'product',
                header: 'Product',
                sortValue: (r) => r.productName,
                render: (r) => (
                  <Anchor component={Link} to={`/products/${r.productId}`} size="sm">
                    {r.productName}
                  </Anchor>
                ),
              },
              { key: 'current', header: 'Price now', align: 'right', sortValue: (r) => r.currentPrice, render: (r) => formatMoney({ amount: r.currentPrice, currency: r.currency }) },
              { key: 'suggested', header: 'Suggested', align: 'right', sortValue: (r) => r.suggestedPrice, render: (r) => formatMoney({ amount: r.suggestedPrice, currency: r.currency }) },
              {
                key: 'change',
                header: 'Change',
                align: 'right',
                sortValue: (r) => r.percentChange,
                render: (r) => (
                  <Badge variant="light" color={r.percentChange < 0 ? 'amber' : 'forest'}>
                    {r.percentChange > 0 ? '+' : ''}
                    {r.percentChange.toFixed(1)}%
                  </Badge>
                ),
              },
              { key: 'demand', header: 'Demand score', align: 'right', sortValue: (r) => r.demandScore, render: (r) => r.demandScore.toFixed(2), hideOnPhone: true },
              { key: 'reason', header: 'Why', sortValue: (r) => r.reason },
            ]}
          />
        )}
      </Widget>
    </Stack>
  );
}
