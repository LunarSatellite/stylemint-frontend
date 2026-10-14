import { useEffect, useState } from 'react';
import { ReelThumb } from './ReelThumb';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Grid,
  Group,
  Menu,
  Modal,
  Radio,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  Timeline,
} from '@mantine/core';
import {
  IconBrandInstagram,
  IconChevronDown,
  IconCircleCheck,
  IconDots,
  IconExternalLink,
  IconEyeOff,
  IconSend,
  IconTrash,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, messageOf } from '../../api/client';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton, LoadingBlock } from '../../components/StateBlocks';
import { TrendBars } from '../../components/TrendBars';
import { formatCompact, formatDate, formatDateTime, formatDuration, formatMoney, formatPercent, formatPercentValue, labelOf } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { useTab } from '../../lib/useTab';
import { analyticsApi } from '../analytics/api';
import { ReelIdeas } from '../studio/ReelIdeas';
import {
  APPROVAL_NOTE_MAX,
  approvalStateColor,
  approvalStateLabel,
  CAPTION_MAX,
  CAPTION_RECOMMENDED,
  canPublishFrom,
  canUnpublishFrom,
  isCampaignReelError,
  platformLabel,
  reelsApi,
  reelStateColor,
  reelStateLabel,
  type Reel,
} from './api';
import { TagsPanel } from './tagging';

type AiChoice = 'keep' | 'yes' | 'no';

function PublishModal({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const qc = useQueryClient();
  const [ai, setAi] = useState<AiChoice>(reel.isAiGenerated == null ? 'no' : 'keep');
  const [mode, setMode] = useState<'publish' | 'approval'>('publish');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const tags = reel.taggedProducts?.length ?? 0;

  const done = () => {
    void qc.invalidateQueries({ queryKey: ['reels'] });
    onClose();
  };
  const publish = useMutation({
    mutationFn: () => reelsApi.publish(reel.id, ai === 'keep' ? undefined : ai === 'yes'),
    onSuccess: () => {
      toastSuccess('Your reel is live on StyleMint');
      done();
    },
    onError: (e) => {
      if (isCampaignReelError(e)) {
        setMode('approval');
        setError(null);
      } else setError(messageOf(e));
    },
  });
  const submit = useMutation({
    mutationFn: () => reelsApi.submitForApproval(reel.id, note.trim() || null),
    onSuccess: () => {
      toastSuccess('Sent to the brand for approval');
      done();
    },
    onError: (e) => setError(e instanceof ApiError && e.code === 'state.conflict' ? 'This reel is already waiting for the brand.' : messageOf(e)),
  });

  return (
    <Modal opened onClose={onClose} title={mode === 'publish' ? 'Publish to StyleMint' : 'Send to the brand for approval'}>
      <Stack gap="md">
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        {mode === 'publish' ? (
          <>
            {tags === 0 && (
              <Alert color="amber" variant="light">
                No products are tagged. Shoppers will not be able to buy from this reel, and it earns no commission.
              </Alert>
            )}
            <Radio.Group label="Was this reel made or edited with AI?" value={ai} onChange={(v) => setAi(v as AiChoice)}>
              <Stack gap={6} mt={6}>
                {reel.isAiGenerated != null && <Radio value="keep" label={`Keep what I said before (${reel.isAiGenerated ? 'yes' : 'no'})`} />}
                <Radio value="no" label="No" />
                <Radio value="yes" label="Yes — show shoppers an “AI” label" />
              </Stack>
            </Radio.Group>
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button leftSection={<IconSend size={16} />} loading={publish.isPending} onClick={() => publish.mutate()}>
                Publish
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Text size="sm">
              This reel has products from a brand campaign, so the brand reviews it before it goes live. You will be told when they answer.
            </Text>
            <Textarea
              label="Note to the brand (optional)"
              maxLength={APPROVAL_NOTE_MAX}
              autosize
              minRows={2}
              value={note}
              onChange={(e) => setNote(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                Cancel
              </Button>
              <Button leftSection={<IconSend size={16} />} loading={submit.isPending} onClick={() => submit.mutate()}>
                Send for approval
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Modal>
  );
}

function DetailsPanel({ reel }: { reel: Reel }) {
  const qc = useQueryClient();
  const [caption, setCaption] = useState(reel.caption ?? '');
  useEffect(() => setCaption(reel.caption ?? ''), [reel.caption]);
  const save = useMutation({
    mutationFn: () => reelsApi.updateCaption(reel.id, caption.trim() || null),
    onSuccess: () => {
      toastSuccess('Caption saved');
      void qc.invalidateQueries({ queryKey: ['reels', reel.id] });
    },
    onError: (e) => toastError(e, 'Could not save the caption'),
  });
  const dirty = (reel.caption ?? '') !== caption;
  return (
    <Stack gap="md" maw={640}>
      <Textarea
        label="Caption on StyleMint"
        description={`Shown under the reel. Short captions work best — up to ${CAPTION_RECOMMENDED} characters is recommended.`}
        autosize
        minRows={3}
        maxRows={10}
        maxLength={CAPTION_MAX}
        value={caption}
        onChange={(e) => setCaption(e.currentTarget.value)}
        error={caption.length > CAPTION_RECOMMENDED ? `${caption.length} characters — longer than recommended` : undefined}
      />
      <Group>
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
          Save caption
        </Button>
        {dirty && (
          <Button variant="subtle" onClick={() => setCaption(reel.caption ?? '')}>
            Undo
          </Button>
        )}
      </Group>
      <SimpleGrid cols={{ base: 1, xs: 2 }} spacing="xs">
        {[
          ['From', labelOf(platformLabel, reel.sourcePlatform)],
          ['Length', formatDuration(reel.durationSeconds)],
          ['Imported', formatDateTime(reel.createdUtc)],
          ['Published', formatDateTime(reel.publishedAtUtc)],
          ['Made with AI', reel.isAiGenerated == null ? 'Not declared' : reel.isAiGenerated ? 'Yes' : 'No'],
          ['Music', reel.musicTrackTitle ? `${reel.musicTrackTitle} — ${reel.musicArtistName ?? ''}` : '—'],
        ].map(([k, v]) => (
          <div key={k}>
            <Text size="xs" c="dimmed">
              {k}
            </Text>
            <Text size="sm">{v}</Text>
          </div>
        ))}
      </SimpleGrid>
    </Stack>
  );
}

function AnalyticsPanel({ reel }: { reel: Reel }) {
  const a = useQuery({ queryKey: ['reels', reel.id, 'analytics'], queryFn: () => analyticsApi.reel(reel.id) });
  if (a.isPending) return <ListSkeleton rows={2} height={80} />;
  if (a.error) return <ErrorBlock error={a.error} onRetry={() => void a.refetch()} title="Could not load this reel’s analytics" />;
  const d = a.data;
  return (
    <Stack gap="md">
      <Text size="xs" c="dimmed">
        Last 30 days ({formatDate(d.window.fromUtc)} – {formatDate(d.window.toUtc)}).
      </Text>
      <SimpleGrid cols={{ base: 2, md: 4 }}>
        <KpiTile label="Views" value={formatCompact(d.reel.views)} hint={`${formatCompact(d.statistics.uniqueViewersEstimate)} on StyleMint`} />
        <KpiTile label="Watched to the end" value={formatPercent(d.statistics.completionRate)} hint={`${formatCompact(d.watchTimeMinutes)} minutes watched`} />
        <KpiTile label="Conversion" value={formatPercent(d.statistics.conversionRate, 2)} hint="Items sold per view" />
        <KpiTile label="Commission" value={formatMoney(d.totalEarnings)} />
      </SimpleGrid>
      <SectionCard title="Commission per product">
        {d.earningsDistribution.length === 0 ? (
          <EmptyBlock title="No sales from this reel yet" />
        ) : (
          <Stack gap="xs">
            {d.earningsDistribution.map((p) => (
              <Group key={p.productId} justify="space-between" wrap="nowrap">
                <Text size="sm" lineClamp={1}>
                  {p.name} <Text span size="xs" c="dimmed">× {p.quantity}</Text>
                </Text>
                <Text size="sm" fw={600}>
                  {formatMoney(p.amount)} <Text span size="xs" c="dimmed">({formatPercentValue(p.percentOfTotal)})</Text>
                </Text>
              </Group>
            ))}
          </Stack>
        )}
      </SectionCard>
      {d.earningsTrend.some((p) => p.amount.amount > 0) && (
        <SectionCard title="Commission per day">
          <TrendBars points={d.earningsTrend} />
        </SectionCard>
      )}
    </Stack>
  );
}

function ReportPanel({ reel }: { reel: Reel }) {
  const r = useQuery({ queryKey: ['reels', reel.id, 'report'], queryFn: () => reelsApi.postPublishReport(reel.id), retry: false });
  if (reel.state !== 3 && reel.state !== 4)
    return <EmptyBlock title="No report yet" body="StyleMint’s coach writes a report 24 hours after a reel is published." />;
  if (r.isPending) return <LoadingBlock label="Loading the report…" />;
  if (r.error) {
    if (r.error instanceof ApiError && r.error.status === 404)
      return <EmptyBlock title="The report is not ready yet" body="It appears about 24 hours after publishing." />;
    return <ErrorBlock error={r.error} onRetry={() => void r.refetch()} title="Could not load the report" />;
  }
  const rep = r.data;
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 1, xs: 2 }}>
        {/* Server-formatted figures are shown exactly as sent. */}
        <KpiTile label="Commission so far" value={rep.commissionEarnedFormatted || '—'} />
        <KpiTile label="Expected next 7 days" value={rep.commissionProjectedNext7Formatted || '—'} tone="gray" />
      </SimpleGrid>
      {rep.body.nextSteps.length > 0 && (
        <SectionCard title="What to try next">
          <Stack gap="sm">
            {rep.body.nextSteps.map((s) => (
              <div key={s.key}>
                <Text fw={600} size="sm">
                  {s.headline}
                </Text>
                <Text size="sm" c="dimmed">
                  {s.body}
                </Text>
              </div>
            ))}
          </Stack>
        </SectionCard>
      )}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <SectionCard title="Moments people stayed for">
          {rep.body.topMoments.length === 0 ? (
            <Text size="sm" c="dimmed">
              Not measured for this reel.
            </Text>
          ) : (
            <Stack gap="xs">
              {rep.body.topMoments.map((m) => (
                <Text size="sm" key={m.atMs}>
                  <b>{formatDuration(m.atMs / 1000)}</b> · {formatPercent(m.retentionRate, 0)} still watching — {m.note}
                </Text>
              ))}
            </Stack>
          )}
        </SectionCard>
        <SectionCard title="What commenters talked about">
          {rep.body.commentThemes.length === 0 ? (
            <Text size="sm" c="dimmed">
              Not enough comments yet.
            </Text>
          ) : (
            <Stack gap="xs">
              {rep.body.commentThemes.map((t) => (
                <div key={t.label}>
                  <Text size="sm" fw={600}>
                    {t.label} <Text span size="xs" c="dimmed">({t.commentCount})</Text>
                  </Text>
                  {t.representativeQuote && (
                    <Text size="xs" c="dimmed" fs="italic">
                      “{t.representativeQuote}”
                    </Text>
                  )}
                </div>
              ))}
            </Stack>
          )}
        </SectionCard>
      </SimpleGrid>
    </Stack>
  );
}

function ApprovalPanel({ reel }: { reel: Reel }) {
  const rounds = useQuery({ queryKey: ['reels', reel.id, 'approval'], queryFn: () => reelsApi.approvalRounds(reel.id) });
  if (rounds.isPending) return <ListSkeleton rows={2} />;
  if (rounds.error) return <ErrorBlock error={rounds.error} onRetry={() => void rounds.refetch()} title="Could not load the approval history" />;
  if (rounds.data.length === 0)
    return <EmptyBlock title="No approval needed so far" body="Only reels with products from a brand campaign go to the brand for approval." />;
  return (
    <Timeline bulletSize={18} lineWidth={2} color="forest" active={rounds.data.length - 1}>
      {rounds.data.map((r) => (
        <Timeline.Item
          key={r.id}
          title={
            <Group gap="xs">
              <Text size="sm" fw={600}>
                Round {r.round}
              </Text>
              <Badge size="sm" variant="light" color={approvalStateColor[r.state] ?? 'gray'}>
                {labelOf(approvalStateLabel, r.state)}
              </Badge>
            </Group>
          }
        >
          <Text size="xs" c="dimmed">
            Sent {formatDateTime(r.submittedUtc)}
            {r.decidedUtc ? ` · answered ${formatDateTime(r.decidedUtc)}` : ''}
          </Text>
          {r.creatorNote && <Text size="sm">Your note: {r.creatorNote}</Text>}
          {r.rejectionReason && (
            <Alert color="signal" variant="light" mt={4} py={6}>
              {r.rejectionReason}
            </Alert>
          )}
        </Timeline.Item>
      ))}
    </Timeline>
  );
}

export default function ReelDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reel = useQuery({ queryKey: ['reels', id], queryFn: () => reelsApi.get(id) });
  const [tab, setTab] = useTab(['products', 'details', 'analytics', 'report', 'approval', 'ideas'] as const, 'products');
  const [publishing, setPublishing] = useState(false);

  const unpublish = useMutation({
    mutationFn: () => reelsApi.unpublish(id),
    onSuccess: () => {
      toastSuccess('Reel unpublished — shoppers no longer see it');
      void qc.invalidateQueries({ queryKey: ['reels'] });
    },
    onError: (e) => toastError(e, 'Could not unpublish'),
  });
  const remove = useMutation({
    mutationFn: () => reelsApi.remove(id),
    onSuccess: () => {
      toastSuccess('Reel removed from StyleMint');
      void qc.invalidateQueries({ queryKey: ['reels'] });
      navigate('/reels', { replace: true });
    },
    onError: (e) => toastError(e, 'Could not delete'),
  });

  if (reel.isPending) return <LoadingBlock label="Loading the reel…" />;
  if (reel.error)
    return (
      <>
        <PageHeader title="Reel" back={{ to: '/reels', label: 'Reels' }} />
        <ErrorBlock error={reel.error} onRetry={() => void reel.refetch()} title="Could not load this reel" />
      </>
    );
  const r = reel.data;

  return (
    <>
      <PageHeader
        title={r.caption?.trim() ? r.caption.trim().slice(0, 60) + (r.caption.trim().length > 60 ? '…' : '') : 'Untitled reel'}
        back={{ to: '/reels', label: 'Reels' }}
        meta={
          <Group gap="xs">
            <Badge color={reelStateColor[r.state] ?? 'gray'} variant="light">
              {labelOf(reelStateLabel, r.state)}
            </Badge>
            <Text size="xs" c="dimmed">
              {labelOf(platformLabel, r.sourcePlatform)} · {formatDuration(r.durationSeconds)}
            </Text>
          </Group>
        }
        actions={
          <>
            {canPublishFrom(r.state) && (
              <Button leftSection={<IconSend size={16} />} onClick={() => setPublishing(true)}>
                Publish
              </Button>
            )}
            {r.state === 6 && (
              <Button variant="light" color="amber" leftSection={<IconCircleCheck size={16} />} onClick={() => setTab('approval')}>
                Waiting for the brand
              </Button>
            )}
            <Menu position="bottom-end">
              <Menu.Target>
                <Button variant="default" rightSection={<IconChevronDown size={14} />} leftSection={<IconDots size={16} />}>
                  More
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item leftSection={<IconExternalLink size={14} />} component="a" href={r.sourceUrl} target="_blank" rel="noopener noreferrer">
                  Open on {labelOf(platformLabel, r.sourcePlatform)}
                </Menu.Item>
                {canUnpublishFrom(r.state) && (
                  <Menu.Item
                    leftSection={<IconEyeOff size={14} />}
                    onClick={() =>
                      void confirmAction({
                        title: 'Unpublish this reel?',
                        body: 'Shoppers will no longer see it. You can publish it again later.',
                        confirmLabel: 'Unpublish',
                      }).then((ok) => ok && unpublish.mutate())
                    }
                  >
                    Unpublish
                  </Menu.Item>
                )}
                <Menu.Divider />
                <Menu.Item
                  color="signal"
                  leftSection={<IconTrash size={14} />}
                  onClick={() =>
                    void confirmAction({
                      title: 'Delete this reel from StyleMint?',
                      body: 'Its product tags go with it. The post on your social account is not touched.',
                      confirmLabel: 'Delete',
                      danger: true,
                    }).then((ok) => ok && remove.mutate())
                  }
                >
                  Delete from StyleMint
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          </>
        }
      />
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, md: 4, lg: 3 }}>
          <Card padding={0} style={{ overflow: 'hidden' }}>
            <Box style={{ aspectRatio: '9 / 16', background: 'var(--sm-inset)' }}>
              <ReelThumb src={r.thumbnailCdnUrl} alt="Reel cover" lazy={false} fallback={<IconBrandInstagram size={32} opacity={0.4} aria-hidden />} />
            </Box>
            <SimpleGrid cols={3} p="sm" spacing={4}>
              {[
                ['Views', r.viewCount],
                ['Likes', r.likeCount],
                ['Saves', r.saveCount],
              ].map(([k, v]) => (
                <div key={k as string}>
                  <Text size="xs" c="dimmed">
                    {k}
                  </Text>
                  <Text fw={700}>{formatCompact(v as number)}</Text>
                </div>
              ))}
            </SimpleGrid>
            <Anchor href={r.sourceUrl} target="_blank" rel="noopener noreferrer" size="xs" px="sm" pb="sm" display="block">
              View original <IconExternalLink size={12} />
            </Anchor>
          </Card>
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 8, lg: 9 }}>
          <Card>
            <Tabs value={tab} onChange={setTab}>
              <Tabs.List mb="md" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
                <Tabs.Tab value="products">Products ({r.taggedProducts?.length ?? 0})</Tabs.Tab>
                <Tabs.Tab value="details">Caption & details</Tabs.Tab>
                <Tabs.Tab value="analytics">Analytics</Tabs.Tab>
                <Tabs.Tab value="report">24-hour report</Tabs.Tab>
                <Tabs.Tab value="approval">Brand approval</Tabs.Tab>
                <Tabs.Tab value="ideas">Ideas</Tabs.Tab>
              </Tabs.List>
              <Tabs.Panel value="products">{tab === 'products' && <TagsPanel reel={r} />}</Tabs.Panel>
              <Tabs.Panel value="details">{tab === 'details' && <DetailsPanel reel={r} />}</Tabs.Panel>
              <Tabs.Panel value="analytics">{tab === 'analytics' && <AnalyticsPanel reel={r} />}</Tabs.Panel>
              <Tabs.Panel value="report">{tab === 'report' && <ReportPanel reel={r} />}</Tabs.Panel>
              <Tabs.Panel value="approval">{tab === 'approval' && <ApprovalPanel reel={r} />}</Tabs.Panel>
              <Tabs.Panel value="ideas">{tab === 'ideas' && <ReelIdeas reel={r} />}</Tabs.Panel>
            </Tabs>
          </Card>
        </Grid.Col>
      </Grid>
      {publishing && <PublishModal reel={r} onClose={() => setPublishing(false)} />}
    </>
  );
}
