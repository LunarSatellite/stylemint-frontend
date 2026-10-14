import { useState } from 'react';
import { Anchor, Badge, Button, Card, Group, NumberInput, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconExternalLink } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { fromNow, labelOf } from '../../lib/format';
import { audioProviderLabel, communityApi, type AudioCard } from './api';

const safe = (url: string | null | undefined) => (url && /^https?:\/\//i.test(url) ? url : null);

/** Opens the track on its own service (no in-app playback) and records the listen. */
function ListenLink({ card }: { card: AudioCard }) {
  const url = safe(card.primaryListenUrl);
  if (!url) return null;
  return (
    <Anchor
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      size="sm"
      onClick={() => void communityApi.audioInteraction(card.musicTrackRefId, 1).catch(() => undefined)}
    >
      {card.primaryListenDisplayLabel || `Listen on ${labelOf(audioProviderLabel, card.primaryListenProvider)}`} <IconExternalLink size={12} />
    </Anchor>
  );
}

function Recommendations() {
  const [duration, setDuration] = useState<number | ''>(30);
  const recs = useQuery({ queryKey: ['audio', 'recs', duration], queryFn: () => communityApi.audioRecommendations(duration === '' ? null : duration) });
  return (
    <SectionCard title="Sounds for your next reel" action={<NumberInput aria-label="Reel length in seconds" size="xs" w={140} min={1} max={300} suffix=" s" value={duration} onChange={(v) => setDuration(v === '' ? '' : Number(v))} />}>
      {recs.isPending ? (
        <ListSkeleton rows={3} height={80} />
      ) : recs.error ? (
        <ErrorBlock error={recs.error} onRetry={() => void recs.refetch()} title="Could not load suggestions" />
      ) : recs.data.length === 0 ? (
        <EmptyBlock title="No suggestions yet" />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          {recs.data.map((c) => (
            <Card key={c.musicTrackRefId} padding="sm" withBorder>
              <Text fw={600} size="sm" lineClamp={1}>{c.title}</Text>
              <Text size="xs" c="dimmed">{c.artist} · {c.durationDisplay}{c.tempoBpm ? ` · ${c.tempoBpm} BPM` : ''}</Text>
              <Group gap={4} my={6}>
                {c.genre && <Badge size="xs" variant="light">{c.genre}</Badge>}
                {c.mood && <Badge size="xs" variant="light" color="gray">{c.mood}</Badge>}
              </Group>
              <Text size="xs">{c.reasonSummaryLine}</Text>
              {c.primaryListenTimestampHint && <Text size="xs" c="dimmed">Use from {c.primaryListenTimestampHint}</Text>}
              <Stack gap={2} mt={6}>
                <ListenLink card={c} />
              </Stack>
            </Card>
          ))}
        </SimpleGrid>
      )}
    </SectionCard>
  );
}

function Trends() {
  const [provider, setProvider] = useState<string | null>(null);
  const list = useCursorList({ key: ['audio', 'trends'], resetKey: provider ?? '', fetchPage: (c) => communityApi.audioTrends(c, provider ? Number(provider) : undefined) });
  const items = list.query.data?.items ?? [];
  return (
    <SectionCard
      title="Trending now"
      action={<Select aria-label="Service" size="xs" w={160} placeholder="All services" clearable data={Object.entries(audioProviderLabel).map(([value, label]) => ({ value, label }))} value={provider} onChange={setProvider} />}
    >
      {list.query.isPending ? (
        <ListSkeleton rows={3} height={36} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load trends" />
      ) : items.length === 0 ? (
        <EmptyBlock title="No trends right now" />
      ) : (
        <Stack gap={0}>
          {items.map((t) => (
            <Group key={t.id} justify="space-between" py="xs" style={{ borderBottom: '1px solid var(--sm-row-line)' }} wrap="nowrap">
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={600} truncate>{t.externalTrackIdentifier}</Text>
                <Text size="xs" c="dimmed">{labelOf(audioProviderLabel, t.provider)}{t.regionCode ? ` · ${t.regionCode}` : ''} · seen {fromNow(t.capturedUtc)}</Text>
              </div>
              {safe(t.listenUrl) && (
                <Button component="a" href={safe(t.listenUrl)!} target="_blank" rel="noopener noreferrer" size="xs" variant="light" rightSection={<IconExternalLink size={12} />}>
                  Listen
                </Button>
              )}
            </Group>
          ))}
        </Stack>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
    </SectionCard>
  );
}

export default function AudioPage() {
  return (
    <>
      <PageHeader title="Audio library" description="Sounds picked for your style and what is trending. Tracks open on their own service." />
      <Stack gap="md">
        <Recommendations />
        <Trends />
      </Stack>
    </>
  );
}
