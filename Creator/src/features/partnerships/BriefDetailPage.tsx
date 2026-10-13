import { useState } from 'react';
import { Alert, Anchor, Badge, Button, Grid, Group, List, SimpleGrid, Stack, Text, Textarea } from '@mantine/core';
import { IconSend } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError, messageOf } from '../../api/client';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { ErrorBlock, LoadingBlock } from '../../components/StateBlocks';
import { formatCompact, formatDateTime, labelOf } from '../../lib/format';
import { toastSuccess } from '../../lib/notify';
import { ApplicationState, applicationStateColor, applicationStateLabel, campaignGoalLabel, commissionRange, partnershipsApi, type Brief } from './api';
import { WithdrawButton } from './BriefsPage';
import { useBrandLookup } from './useBrandNames';

function applyError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'state.conflict') return 'You already applied to this campaign.';
    if (e.code === 'rule.violation') return 'Applications for this campaign are closed.';
    if (e.status === 429) return 'Too many applications in a minute. Wait a moment and try again.';
    if (e.status === 404) return 'This campaign is no longer open.';
  }
  return messageOf(e);
}

function ApplyBox({ brief }: { brief: Brief }) {
  const qc = useQueryClient();
  const apps = useQuery({ queryKey: ['partnerships', 'applications', 'for-brief'], queryFn: () => partnershipsApi.applications(null) });
  const mine = (apps.data?.items ?? []).find((a) => a.brandBriefRootId === brief.rootBriefId && (a.state === ApplicationState.Pending || a.state === ApplicationState.Accepted));
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const apply = useMutation({
    mutationFn: () => partnershipsApi.apply(brief.id, message.trim() || null),
    onSuccess: () => {
      toastSuccess('Application sent. The brand will let you know.');
      setMessage('');
      void qc.invalidateQueries({ queryKey: ['partnerships'] });
    },
    onError: (e) => setError(applyError(e)),
  });
  if (mine)
    return (
      <Stack gap="xs">
        <Group gap="xs">
          <Text size="sm">Your application:</Text>
          <Badge variant="light" color={applicationStateColor[mine.state] ?? 'gray'}>
            {labelOf(applicationStateLabel, mine.state)}
          </Badge>
        </Group>
        <Text size="xs" c="dimmed">
          Sent {formatDateTime(mine.submittedUtc)}
        </Text>
        <Group>
          <WithdrawButton app={mine} />
        </Group>
      </Stack>
    );
  return (
    <Stack gap="sm">
      {error && (
        <Alert color="signal" variant="light" role="alert">
          {error}
        </Alert>
      )}
      <Textarea
        label="Message to the brand (optional)"
        placeholder="Share an idea for a reel, or why your audience fits."
        maxLength={1000}
        autosize
        minRows={3}
        value={message}
        onChange={(e) => setMessage(e.currentTarget.value)}
      />
      <Group justify="flex-end">
        <Button leftSection={<IconSend size={16} />} loading={apply.isPending} onClick={() => apply.mutate()}>
          Apply
        </Button>
      </Group>
    </Stack>
  );
}

export default function BriefDetailPage() {
  const { id = '' } = useParams();
  const brief = useQuery({ queryKey: ['partnerships', 'brief', id], queryFn: () => partnershipsApi.brief(id) });
  const brandOf = useBrandLookup();
  if (brief.isPending) return <LoadingBlock label="Loading the campaign…" />;
  if (brief.error)
    return (
      <>
        <PageHeader title="Campaign" back={{ to: '/briefs', label: 'Briefs & campaigns' }} />
        <ErrorBlock
          error={brief.error}
          onRetry={() => void brief.refetch()}
          title={brief.error instanceof ApiError && brief.error.status === 404 ? 'This campaign is closed or no longer available' : 'Could not load this campaign'}
        />
      </>
    );
  const b = brief.data;
  const brand = brandOf(b.vendorProfileId);
  const d = b.body.brandDirection;
  return (
    <>
      <PageHeader
        title={b.title}
        back={{ to: '/briefs', label: 'Briefs & campaigns' }}
        description={brand?.businessName}
        meta={
          <Group gap="xs">
            <Badge variant="light">{labelOf(campaignGoalLabel, b.primaryGoal)}</Badge>
            {b.applicationsCloseUtc && (
              <Text size="xs" c="dimmed">
                Applications close {formatDateTime(b.applicationsCloseUtc)}
              </Text>
            )}
          </Group>
        }
      />
      <SimpleGrid cols={{ base: 2, md: 4 }} mb="md">
        <KpiTile label="Commission" value={commissionRange(b.commissionRange.minPercent, b.commissionRange.maxPercent)} />
        <KpiTile label="Reels a week" value={b.body.suggestedCadence.reelsPerWeek || '—'} tone="gray" />
        <KpiTile label="Expected reach" value={`${formatCompact(b.roiProjection.estimatedReachLow)}–${formatCompact(b.roiProjection.estimatedReachHigh)}`} tone="gray" />
        <KpiTile label="Expected sales" value={`${formatCompact(b.roiProjection.estimatedSalesLow)}–${formatCompact(b.roiProjection.estimatedSalesHigh)}`} tone="gray" />
      </SimpleGrid>
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
        <Stack gap="md">
          {d?.campaignStory && (
            <SectionCard title="The story">
              <Text size="sm" style={{ whiteSpace: 'pre-line' }}>
                {d.campaignStory}
              </Text>
            </SectionCard>
          )}
          {b.body.suggestedHooks.length > 0 && (
            <SectionCard title="Hook ideas">
              <Stack gap="xs">
                {b.body.suggestedHooks.map((h, i) => (
                  <div key={i}>
                    <Text size="sm" fw={600}>
                      “{h.text}”
                    </Text>
                    <Text size="xs" c="dimmed">
                      {h.rationale}
                    </Text>
                  </div>
                ))}
              </Stack>
            </SectionCard>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <SectionCard title="Do say">
              {b.body.doSayPoints.length ? (
                <List size="sm" spacing={4}>
                  {b.body.doSayPoints.map((x) => (
                    <List.Item key={x}>{x}</List.Item>
                  ))}
                </List>
              ) : (
                <Text size="sm" c="dimmed">—</Text>
              )}
            </SectionCard>
            <SectionCard title="Don’t say">
              {b.body.dontSayPoints.length ? (
                <List size="sm" spacing={4}>
                  {b.body.dontSayPoints.map((x) => (
                    <List.Item key={x}>{x}</List.Item>
                  ))}
                </List>
              ) : (
                <Text size="sm" c="dimmed">—</Text>
              )}
            </SectionCard>
          </SimpleGrid>
          {d?.presentation && (
            <SectionCard title="How to show the brand">
              <Stack gap={6}>
                {d.presentation.toneOfVoice && <Text size="sm">Tone: {d.presentation.toneOfVoice}</Text>}
                {d.presentation.brandNameUsage && <Text size="sm">Brand name: {d.presentation.brandNameUsage}</Text>}
                {d.presentation.logoAndMarkUsage && <Text size="sm">Logo: {d.presentation.logoAndMarkUsage}</Text>}
                {d.presentation.mandatoryMentions?.length ? <Text size="sm">Always mention: {d.presentation.mandatoryMentions.join(', ')}</Text> : null}
              </Stack>
            </SectionCard>
          )}
          {(b.body.audioThemes.length > 0 || (d?.referenceAssets?.length ?? 0) > 0) && (
            <SectionCard title="References">
              {b.body.audioThemes.length > 0 && <Text size="sm">Sound: {b.body.audioThemes.join(', ')}</Text>}
              {d?.referenceAssets?.filter((a) => /^https?:\/\//i.test(a.url)).map((a) => (
                <Anchor key={a.url} href={a.url} target="_blank" rel="noopener noreferrer" size="sm" display="block">
                  {a.label ?? a.url}
                </Anchor>
              ))}
            </SectionCard>
          )}
        </Stack>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
        <Stack gap="md">
          <SectionCard title="Apply">
            <ApplyBox brief={b} />
          </SectionCard>
          {b.body.suggestedCadence.note && (
            <SectionCard title="Posting rhythm">
              <Text size="sm">{b.body.suggestedCadence.note}</Text>
            </SectionCard>
          )}
          <Text size="xs" c="dimmed">
            If the brand picks you, you get an invite in Partnerships. Reels with campaign products go to the brand for approval before they
            are published.
          </Text>
        </Stack>
        </Grid.Col>
      </Grid>
    </>
  );
}
