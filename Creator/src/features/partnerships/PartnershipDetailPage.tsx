import type { ReactNode } from 'react';
import { Alert, Anchor, Badge, Button, Card, Group, List, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconSparkles } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton, LoadingBlock } from '../../components/StateBlocks';
import { formatCompact, formatDate, formatMoney, formatPercent, labelOf } from '../../lib/format';
import { BrandRecordCard } from './BrandsPage';
import { commissionRange, partnershipsApi, partnershipStateColor, partnershipStateLabel, pendingActor, type TermsVersion } from './api';
import { InviteActions } from './PartnershipsPage';

/** A content rule with its inline links rendered as real links (never as HTML). */
function RuleText({ text, links }: { text: string; links: { url: string; startIndex: number; endIndex: number }[] }) {
  const sorted = [...links].filter((l) => l.startIndex >= 0 && l.endIndex <= text.length && l.endIndex > l.startIndex).sort((a, b) => a.startIndex - b.startIndex);
  const parts: ReactNode[] = [];
  let at = 0;
  sorted.forEach((l, i) => {
    if (l.startIndex < at) return;
    parts.push(text.slice(at, l.startIndex));
    const safe = /^https?:\/\//i.test(l.url);
    parts.push(
      safe ? (
        <Anchor key={i} href={l.url} target="_blank" rel="noopener noreferrer">
          {text.slice(l.startIndex, l.endIndex)}
        </Anchor>
      ) : (
        text.slice(l.startIndex, l.endIndex)
      ),
    );
    at = l.endIndex;
  });
  parts.push(text.slice(at));
  return <>{parts}</>;
}

function Terms({ terms }: { terms: TermsVersion }) {
  return (
    <Stack gap="md">
      <div>
        <Text fw={650} size="sm" mb={4}>
          {terms.body.whoCanJoin.heading || 'Who can join'}
        </Text>
        <List size="sm" spacing={4}>
          {terms.body.whoCanJoin.bullets.map((b, i) => (
            <List.Item key={i}>{b}</List.Item>
          ))}
        </List>
      </div>
      <div>
        <Text fw={650} size="sm" mb={4}>
          {terms.body.reelContentRules.heading || 'Reel content rules'}
        </Text>
        <List size="sm" spacing={4}>
          {terms.body.reelContentRules.bullets.map((b, i) => (
            <List.Item key={i}>
              <RuleText text={b.text} links={b.inlineLinks} />
            </List.Item>
          ))}
        </List>
      </div>
      <Text size="xs" c="dimmed">
        Version {terms.versionNumber}, published {formatDate(terms.publishedUtc)}
      </Text>
    </Stack>
  );
}

export default function PartnershipDetailPage() {
  const { id = '' } = useParams();
  const p = useQuery({ queryKey: ['partnerships', id], queryFn: () => partnershipsApi.get(id) });
  const terms = useQuery({ queryKey: ['partnerships', id, 'terms'], queryFn: () => partnershipsApi.terms(id), retry: false });
  const prediction = useQuery({
    queryKey: ['partnerships', id, 'prediction'],
    queryFn: () => partnershipsApi.predict(id),
    enabled: false, // the server records a prediction on every call: only on request
    staleTime: Infinity,
  });

  if (p.isPending) return <LoadingBlock label="Loading the partnership…" />;
  if (p.error)
    return (
      <>
        <PageHeader title="Partnership" back={{ to: '/partnerships', label: 'Partnerships' }} />
        <ErrorBlock error={p.error} onRetry={() => void p.refetch()} title="Could not load this partnership" />
      </>
    );
  const d = p.data;
  const actor = pendingActor(d);

  return (
    <>
      <PageHeader
        title={d.vendorName ?? 'Partnership'}
        back={{ to: '/partnerships', label: 'Partnerships' }}
        meta={
          <Group gap="xs">
            <Badge variant="light" color={partnershipStateColor[d.state] ?? 'gray'}>
              {labelOf(partnershipStateLabel, d.state)}
            </Badge>
            {d.brandBriefId && (
              <Badge variant="light" color="blue">
                Campaign
              </Badge>
            )}
          </Group>
        }
        actions={<InviteActions p={d} />}
      />
      {actor === 'creator' && (
        <Alert color="amber" variant="light" mb="md" title={`${d.vendorName ?? 'This brand'} invited you`}>
          Accept to tag their products in your reels and earn {commissionRange(d.commissionMinPercent, d.commissionMaxPercent)} commission on sales.
        </Alert>
      )}
      {actor === 'brand' && (
        <Alert color="gray" variant="light" mb="md">
          You asked to partner on {formatDate(d.invitedUtc)}. The brand has not answered yet.
          {d.requestMessage ? ` Your message: “${d.requestMessage}”` : ''}
        </Alert>
      )}
      {d.state === 4 && d.endReason && (
        <Alert color="gray" variant="light" mb="md" title="Paused by the brand">
          {d.endReason}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
        <KpiTile label="Commission" value={commissionRange(d.commissionMinPercent, d.commissionMaxPercent)} hint="Of each sale from your reels" />
        <KpiTile label="Since" value={formatDate(d.respondedUtc ?? d.invitedUtc)} tone="gray" />
        <KpiTile label="Brand rating" value={d.vendorRating != null ? `${d.vendorRating.toFixed(1)} ★` : '—'} tone="gray" />
        <KpiTile label="Status" value={labelOf(partnershipStateLabel, d.state)} tone={d.state === 3 ? 'forest' : 'gray'} />
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <SectionCard title="Brand’s terms" description="What the brand expects from partnered creators.">
          {terms.isPending ? (
            <ListSkeleton rows={3} height={24} />
          ) : terms.error ? (
            terms.error instanceof ApiError && terms.error.status === 404 ? (
              <EmptyBlock title="This brand has not published terms" />
            ) : (
              <ErrorBlock error={terms.error} onRetry={() => void terms.refetch()} title="Could not load the terms" />
            )
          ) : (
            <Terms terms={terms.data} />
          )}
        </SectionCard>
        <Stack gap="md">
          <SectionCard
            title="What this could earn"
            description="An estimate from StyleMint’s model — not a promise."
            action={
              !prediction.data && (
                <Button size="xs" variant="light" leftSection={<IconSparkles size={14} />} loading={prediction.isFetching} onClick={() => void prediction.refetch()}>
                  Estimate
                </Button>
              )
            }
          >
            {prediction.error ? (
              <ErrorBlock error={prediction.error} onRetry={() => void prediction.refetch()} title="Could not estimate" />
            ) : prediction.data ? (
              <Stack gap="sm">
                <SimpleGrid cols={3}>
                  <div>
                    <Text size="xs" c="dimmed">
                      Views
                    </Text>
                    <Text fw={700}>{formatCompact(prediction.data.predictedViews)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Sales
                    </Text>
                    <Text fw={700}>{formatCompact(prediction.data.predictedSales)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      Sales value
                    </Text>
                    <Text fw={700}>{formatMoney({ amount: prediction.data.predictedRevenue, currency: prediction.data.predictedRevenueCurrency })}</Text>
                  </div>
                </SimpleGrid>
                <Text size="xs" c="dimmed">
                  Confidence: {prediction.data.confidenceLevel}. Suggested commission {formatPercent(prediction.data.recommendedCommission, 0)} over{' '}
                  {prediction.data.recommendedDuration} days.
                </Text>
                {prediction.data.riskFactors.length > 0 && (
                  <List size="xs" spacing={2}>
                    {prediction.data.riskFactors.map((r) => (
                      <List.Item key={r}>{r}</List.Item>
                    ))}
                  </List>
                )}
              </Stack>
            ) : (
              <Text size="sm" c="dimmed">
                Get an estimate of views and sales for a campaign with this brand.
              </Text>
            )}
          </SectionCard>
          <BrandRecordCard vendorProfileId={d.vendorProfileId} />
          {d.state === 3 && (
            <Card>
              <Text size="sm">
                Ready to post? <Anchor component={Link} to="/reels/import">Import a reel</Anchor> and tag {d.vendorName ?? 'the brand'}’s products.
              </Text>
            </Card>
          )}
        </Stack>
      </SimpleGrid>
    </>
  );
}
