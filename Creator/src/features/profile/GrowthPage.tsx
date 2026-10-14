import { Accordion, Badge, Group, Progress, SimpleGrid, Stack, Stepper, Text, ThemeIcon } from '@mantine/core';
import { IconBolt, IconCheck, IconLock } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatCompact, formatDate, formatMoney, formatPercent, labelOf } from '../../lib/format';
import { JOURNEY_PHASES, studioApi } from '../studio/api';
import { profileApi, tierColor, tierLabel } from './api';

function TierCard() {
  const tier = useQuery({ queryKey: ['profile', 'tier'], queryFn: profileApi.tier });
  if (tier.isPending) return <ListSkeleton rows={2} height={60} />;
  if (tier.error) return <ErrorBlock error={tier.error} onRetry={() => void tier.refetch()} title="Could not load your tier" />;
  const t = tier.data;
  return (
    <SectionCard
      title={
        <Group gap="xs">
          <span>Your tier</span>
          <Badge size="lg" color={tierColor[t.currentTier] ?? 'gray'} variant="filled">
            {labelOf(tierLabel, t.currentTier)}
          </Badge>
          {t.isFeatured && (
            <Badge variant="light" color="forest">
              Featured
            </Badge>
          )}
        </Group>
      }
      description={`Since ${formatDate(t.tierAchievedUtc)} · next review ${formatDate(t.nextReviewUtc)}`}
    >
      <Stack gap="md">
        {t.nextTier ? (
          <Text size="sm">
            To reach <b>{labelOf(tierLabel, t.nextTier)}</b>: {t.nextTierProgress ?? 'keep posting and partnering.'}
          </Text>
        ) : (
          <Text size="sm">You are at the top tier.</Text>
        )}
        <SimpleGrid cols={{ base: 2, md: 3 }}>
          <KpiTile label="Reels published" value={formatCompact(t.metrics.totalReelsPublished)} />
          <KpiTile label="Partnerships done" value={formatCompact(t.metrics.completedPartnerships)} />
          <KpiTile label="Engagement" value={formatPercent(t.metrics.avgEngagementRate)} />
          <KpiTile label="Followers" value={formatCompact(t.metrics.followerCount)} tone="gray" />
          <KpiTile label="Sales driven" value={formatMoney(t.metrics.totalRevenue)} tone="gray" />
          <KpiTile label="Brand reply promise" value={`${t.slaResponseHours} h`} tone="gray" hint="How fast brands answer you at this tier" />
        </SimpleGrid>
      </Stack>
    </SectionCard>
  );
}

function Journey() {
  const lp = useQuery({ queryKey: ['studio', 'launchpad'], queryFn: studioApi.launchpad });
  if (lp.isPending) return <ListSkeleton rows={3} />;
  if (lp.error) return <ErrorBlock error={lp.error} onRetry={() => void lp.refetch()} title="Could not load your journey" />;
  const { journey, milestones, lessons, forecast } = lp.data;
  const phase = Math.max(0, JOURNEY_PHASES.indexOf(journey.currentPhase as (typeof JOURNEY_PHASES)[number]));
  return (
    <Stack gap="md">
      <SectionCard title="Your creator journey">
        <Stepper active={phase} size="sm" allowNextStepsSelect={false} styles={{ steps: { flexWrap: 'wrap', rowGap: 8 } }}>
          {JOURNEY_PHASES.map((p) => (
            <Stepper.Step key={p} label={p} />
          ))}
        </Stepper>
        {forecast && (
          <Text size="sm" mt="md">
            <b>{forecast.projectedMonthLabel}:</b> {forecast.recommendation}
          </Text>
        )}
      </SectionCard>
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        <SectionCard title="Milestones">
          {milestones.length === 0 ? (
            <EmptyBlock title="Milestones unlock as you grow" body="Publish your first reels to start." />
          ) : (
            <Stack gap="sm">
              {milestones.map((m) => (
                <div key={m.key}>
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap={8} wrap="nowrap">
                      <ThemeIcon size={20} radius="xl" color={m.isCompleted ? 'forest' : 'slate'} variant={m.isCompleted ? 'filled' : 'light'}>
                        {m.isCompleted ? <IconCheck size={12} /> : <IconLock size={12} />}
                      </ThemeIcon>
                      <Text size="sm" fw={600}>
                        {m.name}
                      </Text>
                    </Group>
                    <Text size="xs" c="dimmed">
                      {Math.round(m.completionPercent)}%
                    </Text>
                  </Group>
                  <Text size="xs" c="dimmed" ml={28}>
                    {m.description}
                  </Text>
                  <Progress value={m.completionPercent} size="sm" ml={28} mt={4} color="forest" aria-label={`${m.name} progress`} />
                </div>
              ))}
            </Stack>
          )}
        </SectionCard>
        <SectionCard title="Lessons for you">
          {lessons.length === 0 ? (
            <EmptyBlock title="No lessons yet" />
          ) : (
            <Accordion variant="separated" radius="md">
              {lessons.map((l) => (
                <Accordion.Item key={l.id} value={l.id}>
                  <Accordion.Control>
                    <Text size="sm" fw={600}>
                      {l.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {l.category} · {l.readingTimeMinutes} min read
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                      {l.content}
                    </Text>
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion>
          )}
        </SectionCard>
      </SimpleGrid>
    </Stack>
  );
}

function Unlocked() {
  const u = useQuery({ queryKey: ['profile', 'unlocked'], queryFn: profileApi.unlocked });
  if (u.isPending) return <ListSkeleton rows={2} height={32} />;
  if (u.error) return <ErrorBlock error={u.error} onRetry={() => void u.refetch()} title="Could not load unlocked features" />;
  if (u.data.length === 0) return <EmptyBlock title="Nothing unlocked yet" body="Badges you earn unlock extra tools." />;
  return (
    <Stack gap="xs">
      {u.data.map((f) => (
        <Group key={f.featureKey} gap="sm" wrap="nowrap" align="flex-start">
          <ThemeIcon variant="light" color="forest" radius="xl">
            <IconBolt size={14} />
          </ThemeIcon>
          <div>
            <Text size="sm" fw={600}>
              {f.featureName}
            </Text>
            <Text size="xs" c="dimmed">
              {f.description} · from the “{f.unlockedByBadge}” badge
            </Text>
          </div>
        </Group>
      ))}
    </Stack>
  );
}

export default function GrowthPage() {
  return (
    <>
      <PageHeader title="Tier & milestones" description="Where you are as a creator, and what unlocks next." />
      <Stack gap="md">
        <TierCard />
        <Journey />
        <SectionCard title="Unlocked features">
          <Unlocked />
        </SectionCard>
      </Stack>
    </>
  );
}
