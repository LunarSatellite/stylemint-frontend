import type { ReactNode } from 'react';
import { useState } from 'react';
import { Alert, Anchor, Badge, Button, Card, Group, Image, Progress, SimpleGrid, Stack, Tabs, TagsInput, Text, Textarea, Tooltip } from '@mantine/core';
import { IconExternalLink, IconPlus, IconSparkles, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageOf } from '../../api/client';
import { DetailSheet } from '../../components/DetailSheet';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatCompact, formatDate, formatDuration, formatPercent, labelOf } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { useTab } from '../../lib/useTab';
import { analyzeSoftMessage, storyArcStateColor, storyArcStateLabel, studioApi, type Briefing, type StudioDraft } from './api';

/** A post-time suggestion shown in the recommendation's own time zone, never the device's. */
function postTime(iso: string, timeZone: string) {
  try {
    return new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return new Date(iso).toUTCString();
  }
}

function Explained({ k, map, children }: { k: string; map: Record<string, string>; children: ReactNode }) {
  const why = map[k];
  return why ? (
    <Tooltip label={why} multiline w={280}>
      <span style={{ textDecoration: 'underline dotted', cursor: 'help' }}>{children}</span>
    </Tooltip>
  ) : (
    <>{children}</>
  );
}

function BriefingView({ b }: { b: Briefing }) {
  const body = b.body;
  return (
    <Stack gap="md">
      <Group gap="xs">
        <Text fw={650}>Hook strength</Text>
        <Badge size="lg" variant="light" color={b.hookScore >= 0.7 ? 'forest' : b.hookScore >= 0.4 ? 'amber' : 'signal'}>
          {Math.round(b.hookScore * 100)}/100
        </Badge>
      </Group>
      {body.captionVariants.length > 0 && (
        <div>
          <Text fw={600} size="sm" mb={4}>Caption ideas</Text>
          <Stack gap={6}>
            {body.captionVariants.map((c, i) => (
              <Card key={i} padding="xs" withBorder>
                <Text size="sm">{c.text}</Text>
                <Text size="xs" c="dimmed">{c.tone}{c.engagementScoreEstimate != null ? ` · expected engagement ${formatPercent(c.engagementScoreEstimate, 0)}` : ''}</Text>
              </Card>
            ))}
          </Stack>
        </div>
      )}
      {(body.hashtagsReach.length > 0 || body.hashtagsNiche.length > 0) && (
        <div>
          <Text fw={600} size="sm" mb={4}>Hashtags</Text>
          <Group gap={4}>
            {body.hashtagsReach.map((h) => <Badge key={h} variant="light">#{h.replace(/^#/, '')}</Badge>)}
            {body.hashtagsNiche.map((h) => <Badge key={h} variant="light" color="gray">#{h.replace(/^#/, '')}</Badge>)}
          </Group>
        </div>
      )}
      {body.postTimeRecommendations.length > 0 && (
        <div>
          <Text fw={600} size="sm" mb={4}>Best times to post</Text>
          {body.postTimeRecommendations.map((p, i) => (
            <Text size="sm" key={i}>
              {postTime(p.suggestedAtUtc, p.timeZone)} <Text span size="xs" c="dimmed">({p.timeZone}) — {p.rationale}</Text>
            </Text>
          ))}
        </div>
      )}
      {body.audioSuggestions.length > 0 && (
        <div>
          <Text fw={600} size="sm" mb={4}>Sounds</Text>
          {body.audioSuggestions.map((a) => (
            <Text size="sm" key={a.musicTrackRefId}>
              {a.trackTitle} — {a.artist}{' '}
              {a.externalListenUrl && /^https?:\/\//.test(a.externalListenUrl) && (
                <Anchor href={a.externalListenUrl} target="_blank" rel="noopener noreferrer" size="xs">listen <IconExternalLink size={10} /></Anchor>
              )}
            </Text>
          ))}
        </div>
      )}
      <Text size="sm">
        <Explained k="predictedAudience" map={b.explanationByKey}>
          Expected reach {formatCompact(body.predictedAudience.estimatedReachLow)}–{formatCompact(body.predictedAudience.estimatedReachHigh)}
        </Explained>
        {body.predictedAudience.primaryAgeBucket ? `, mostly ${body.predictedAudience.primaryAgeBucket}` : ''}
        {body.predictedAudience.primaryRegions.length ? ` in ${body.predictedAudience.primaryRegions.join(', ')}` : ''}. Peaks in {body.shelfLifePeakHours} h.
      </Text>
    </Stack>
  );
}

function DraftSheet({ draft, onClose }: { draft: StudioDraft | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [caption, setCaption] = useState(draft?.caption ?? '');
  const [hashtags, setHashtags] = useState<string[]>(draft?.hashtags ?? []);
  const [id, setId] = useState<string | null>(draft?.id ?? null);
  const [briefing, setBriefing] = useState<Briefing | null>(null);
  const [soft, setSoft] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => {
      const body = { caption: caption.trim(), hashtags };
      const d = id ? await studioApi.updateDraft(id, body) : await studioApi.createDraft(body);
      setId(d.id);
      return d;
    },
    onSuccess: () => {
      toastSuccess('Draft saved');
      void qc.invalidateQueries({ queryKey: ['studio', 'drafts'] });
    },
    onError: (e) => toastError(e),
  });
  const analyze = useMutation({
    mutationFn: async () => {
      const d = await save.mutateAsync();
      return studioApi.analyze(d.id);
    },
    onSuccess: (b) => {
      setSoft(null);
      setBriefing(b);
    },
    onError: (e) => {
      const msg = analyzeSoftMessage(e);
      if (msg) setSoft(msg);
      else toastError(e, 'Could not get a briefing');
    },
  });
  return (
    <DetailSheet opened onClose={onClose} title={id ? 'Edit draft' : 'New draft'} size="xl">
      <Stack gap="md">
        <Textarea label="Caption" autosize minRows={3} maxLength={2200} value={caption} onChange={(e) => setCaption(e.currentTarget.value)} />
        <TagsInput label="Hashtags" value={hashtags} onChange={setHashtags} />
        <Group>
          <Button variant="default" loading={save.isPending && !analyze.isPending} onClick={() => save.mutate()}>Save draft</Button>
          <Button leftSection={<IconSparkles size={16} />} loading={analyze.isPending} onClick={() => analyze.mutate()}>Get AI briefing</Button>
        </Group>
        {soft && <Alert color="blue" variant="light">{soft}</Alert>}
        {briefing && <BriefingView b={briefing} />}
      </Stack>
    </DetailSheet>
  );
}

function Drafts() {
  const qc = useQueryClient();
  const drafts = useQuery({ queryKey: ['studio', 'drafts'], queryFn: studioApi.drafts });
  const [open, setOpen] = useState<StudioDraft | 'new' | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => studioApi.deleteDraft(id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio', 'drafts'] }),
    onError: (e) => toastError(e),
  });
  return (
    <SectionCard title="Caption drafts" description="Plan a reel's caption and hashtags, then get an AI briefing on hook, timing and sound." action={<Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setOpen('new')}>New draft</Button>}>
      {drafts.isPending ? (
        <ListSkeleton rows={2} />
      ) : drafts.error ? (
        <ErrorBlock error={drafts.error} onRetry={() => void drafts.refetch()} title="Could not load drafts" />
      ) : drafts.data.length === 0 ? (
        <EmptyBlock title="No drafts" />
      ) : (
        <Stack gap="xs">
          {drafts.data.map((d) => (
            <Card key={d.id} padding="sm" withBorder>
              <Group justify="space-between" wrap="nowrap">
                <div style={{ minWidth: 0, cursor: 'pointer' }} onClick={() => setOpen(d)}>
                  <Text size="sm" fw={600} lineClamp={1}>{d.caption || 'Untitled draft'}</Text>
                  <Text size="xs" c="dimmed">{formatDate(d.createdAt)}{d.hashtags.length ? ` · ${d.hashtags.length} hashtags` : ''}</Text>
                </div>
                <Group gap={4} wrap="nowrap">
                  <Button size="xs" variant="light" onClick={() => setOpen(d)}>Open</Button>
                  <Button size="xs" variant="subtle" color="signal" aria-label="Delete draft" onClick={() => void confirmAction({ title: 'Delete this draft?', body: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }).then((ok) => ok && remove.mutate(d.id))}>
                    <IconTrash size={14} />
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      {open && <DraftSheet draft={open === 'new' ? null : open} onClose={() => setOpen(null)} />}
    </SectionCard>
  );
}

function Recipes() {
  const r = useQuery({ queryKey: ['studio', 'recipes'], queryFn: studioApi.recipes });
  if (r.isPending) return <ListSkeleton rows={2} height={80} />;
  if (r.error) return <ErrorBlock error={r.error} onRetry={() => void r.refetch()} title="Could not load recipes" />;
  const all = [...r.data.fromTheBrand, ...r.data.generic];
  if (all.length === 0) return <EmptyBlock title="No reel recipes yet" body="Recipes are step-by-step reel formats with a sound and beats. Brands and StyleMint publish them." />;
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
      {all.map((x) => (
        <Card key={x.recipeId} padding="sm" withBorder>
          {x.thumbnailUrl && <Image src={x.thumbnailUrl} alt="" h={100} radius="sm" fit="cover" mb="xs" />}
          <Group justify="space-between" wrap="nowrap">
            <Text fw={600} size="sm" lineClamp={1}>{x.title}</Text>
            {x.fromBrand && <Badge size="xs">Brand</Badge>}
          </Group>
          <Text size="xs" c="dimmed">{x.songTitle} — {x.songArtist} · {formatDuration(x.intendedDurationSeconds)}</Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

function StoryArcs() {
  const qc = useQueryClient();
  const arcs = useQuery({ queryKey: ['studio', 'arcs'], queryFn: studioApi.storyArcs });
  const act = useMutation({
    mutationFn: ({ id, accept }: { id: string; accept: boolean }) => (accept ? studioApi.acceptStoryArc(id) : studioApi.dropStoryArc(id, null)),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['studio', 'arcs'] }),
    onError: (e) => toastError(e, messageOf(e)),
  });
  if (arcs.isPending) return <ListSkeleton rows={2} />;
  if (arcs.error) return <ErrorBlock error={arcs.error} onRetry={() => void arcs.refetch()} title="Could not load story arcs" />;
  if (arcs.data.length === 0) return <EmptyBlock title="No story arcs yet" body="StyleMint suggests a series of reels around a theme when your audience is ready for one." />;
  return (
    <Stack gap="xs">
      {arcs.data.map((a) => (
        <Card key={a.id} padding="sm" withBorder>
          <Group justify="space-between" wrap="wrap">
            <div>
              <Group gap="xs">
                <Text fw={600} size="sm">{a.title}</Text>
                <Badge size="sm" variant="light" color={storyArcStateColor[a.state] ?? 'gray'}>{labelOf(storyArcStateLabel, a.state)}</Badge>
                {a.commissionBoostPercent > 0 && <Badge size="sm" variant="light" color="forest">+{a.commissionBoostPercent}% commission</Badge>}
              </Group>
              <Text size="xs" c="dimmed">{a.reelsPublishedCount} of {a.targetReelCount} reels</Text>
              <Progress value={(a.reelsPublishedCount / Math.max(1, a.targetReelCount)) * 100} size="sm" mt={4} w={200} color="forest" />
            </div>
            {a.state === 1 && (
              <Group gap="xs">
                <Button size="xs" onClick={() => act.mutate({ id: a.id, accept: true })}>Start</Button>
                <Button size="xs" variant="subtle" color="gray" onClick={() => act.mutate({ id: a.id, accept: false })}>No thanks</Button>
              </Group>
            )}
            {a.state === 2 && <Button size="xs" variant="subtle" color="gray" onClick={() => act.mutate({ id: a.id, accept: false })}>Drop</Button>}
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

function Ideas() {
  const insight = useQuery({ queryKey: ['studio', 'insight'], queryFn: studioApi.insight, retry: false });
  const collab = useQuery({ queryKey: ['studio', 'collab'], queryFn: studioApi.collabSuggestions });
  return (
    <Stack gap="md">
      <SectionCard title="This week’s coaching">
        {insight.isPending ? <ListSkeleton rows={1} /> : insight.error ? <ErrorBlock error={insight.error} onRetry={() => void insight.refetch()} /> : insight.data ? (
          <Stack gap={4}>
            <Text fw={600}>{insight.data.headline}</Text>
            <Text size="sm">{insight.data.detail}</Text>
            <Text size="sm" fw={600}>Try: {insight.data.actionItem}</Text>
          </Stack>
        ) : (
          <EmptyBlock title="No insight this week yet" body="Coaching appears once your reels have had some views this week." />
        )}
      </SectionCard>
      <SectionCard title="Creators to collaborate with" description="They tag the same products you do.">
        {collab.isPending ? <ListSkeleton rows={2} /> : collab.error ? <ErrorBlock error={collab.error} onRetry={() => void collab.refetch()} /> : collab.data.length === 0 ? (
          <EmptyBlock title="No suggestions yet" />
        ) : (
          <Stack gap={6}>
            {collab.data.map((c) => (
              <Text size="sm" key={`${c.otherCreatorId}-${c.sharedProductId}`}>
                <b>@{c.otherCreatorHandle}</b> — both of you feature {c.sharedProductName}. {c.matchReason}
              </Text>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  );
}

export default function StudioPage() {
  const [tab, setTab] = useTab(['drafts', 'recipes', 'arcs', 'ideas'] as const, 'drafts');
  return (
    <>
      <PageHeader title="Studio" description="Plan reels with AI help, follow proven reel recipes and story arcs." />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="drafts">Drafts</Tabs.Tab>
          <Tabs.Tab value="recipes">Reel recipes</Tabs.Tab>
          <Tabs.Tab value="arcs">Story arcs</Tabs.Tab>
          <Tabs.Tab value="ideas">Coaching & collabs</Tabs.Tab>
        </Tabs.List>
        {tab === 'drafts' ? <Drafts /> : tab === 'recipes' ? <Card><Recipes /></Card> : tab === 'arcs' ? <Card><StoryArcs /></Card> : <Ideas />}
      </Tabs>
    </>
  );
}
