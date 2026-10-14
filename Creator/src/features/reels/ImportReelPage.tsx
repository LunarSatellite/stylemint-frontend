import { useMemo, useState } from 'react';
import { ReelThumb } from './ReelThumb';
import {
  Alert,
  Anchor,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core';
import { IconAlertTriangle, IconDownload, IconLink, IconPlugConnected, IconRefresh } from '@tabler/icons-react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError, messageOf } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatCompact, formatDate, formatDuration } from '../../lib/format';
import { toastSuccess } from '../../lib/notify';
import { useTab } from '../../lib/useTab';
import { isConnected, slugLabel, socialApi, SOCIAL_SLUGS, type SocialSlug } from '../profile/socialApi';
import {
  CAPTION_MAX,
  MAX_DURATION_SECONDS,
  parseReelUrl,
  platformLabel,
  reelsApi,
  slugToPlatform,
  type ImportReelBody,
  type ProviderContentItem,
} from './api';

function importError(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.code === 'state.duplicate') return 'This post is already on StyleMint — it was imported before. Find it in your reels.';
    if (e.code === 'PERMISSION_MISSING' || e.code === 'TOKEN_INVALID' || e.code === 'TOKEN_EXPIRED' || e.code === 'TOKEN_REVOKED')
      return 'StyleMint lost access to this account. Reconnect it in Social accounts and try again.';
  }
  return messageOf(e);
}

const isVideo = (item: ProviderContentItem) => /video|reel|short/i.test(item.mediaType || 'VIDEO') || (item.durationSeconds ?? 0) > 0;

/** Turns a listed post into an import body. Video URLs are sent only for Instagram/Facebook (Meta CDN rule). */
export function bodyFromPost(slug: SocialSlug, item: ProviderContentItem, durationOverride?: number): ImportReelBody {
  const platform = slugToPlatform[slug];
  const meta = slug === 'instagram' || slug === 'facebook';
  return {
    sourcePlatform: platform,
    sourceUrl: item.permalink,
    externalId: item.externalId,
    durationSeconds: Math.min(MAX_DURATION_SECONDS, Math.max(1, Math.round(durationOverride ?? item.durationSeconds ?? 0))),
    ...(item.caption ? { caption: item.caption.slice(0, CAPTION_MAX) } : {}),
    ...(item.thumbnailUrl && item.thumbnailUrl.length <= 2048 ? { thumbnailCdnUrl: item.thumbnailUrl } : {}),
    ...(meta && item.videoUrl && item.videoUrl.length <= 2048 ? { videoCdnUrl: item.videoUrl } : {}),
  };
}

function FromAccounts() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const accounts = useQuery({ queryKey: ['social', 'accounts'], queryFn: socialApi.list });
  const connected = useMemo(
    () => SOCIAL_SLUGS.filter((s) => isConnected((accounts.data ?? []).find((a) => a.provider === slugToPlatform[s]))),
    [accounts.data],
  );
  const [chosen, setChosen] = useState<SocialSlug | null>(null);
  const slug = chosen && connected.includes(chosen) ? chosen : (connected[0] ?? null);
  const [selected, setSelected] = useState<Record<string, ProviderContentItem>>({});
  const [durations, setDurations] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [bulkReport, setBulkReport] = useState<string | null>(null);

  const posts = useInfiniteQuery({
    queryKey: ['social', 'content', slug],
    queryFn: ({ pageParam }) => reelsApi.providerContent(slug!, pageParam),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    enabled: !!slug,
  });

  const importMany = useMutation({
    mutationFn: async () => {
      const items = Object.values(selected).map((i) => bodyFromPost(slug!, i, durations[i.externalId]));
      if (items.length === 1) return { single: await reelsApi.import(items[0]) };
      return { bulk: await reelsApi.importBulk(items) };
    },
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ['reels', 'list'] });
      if ('single' in res && res.single) {
        toastSuccess('Reel imported. Now tag the products in it.');
        navigate(`/reels/${res.single.id}?tab=products`);
        return;
      }
      if ('bulk' in res && res.bulk) {
        const b = res.bulk;
        const failures = b.items.filter((i) => !i.success);
        setSelected({});
        setBulkReport(
          failures.length === 0
            ? `${b.successCount} reels imported. Open each one to tag products.`
            : `${b.successCount} imported, ${b.failureCount} not imported: ${failures
                .map((f) => (f.errorCode === 'state.duplicate' ? 'already on StyleMint' : (f.errorMessage ?? 'failed')))
                .join('; ')}.`,
        );
      }
    },
    onError: (e) => setError(importError(e)),
  });

  if (accounts.isPending) return <ListSkeleton rows={2} />;
  if (accounts.error) return <ErrorBlock error={accounts.error} onRetry={() => void accounts.refetch()} title="Could not load your social accounts" />;
  if (!slug)
    return (
      <EmptyBlock
        title="No social account connected"
        body="Connect Instagram, TikTok, YouTube or Facebook to pick reels from your posts — or paste a link instead."
        action={
          <Button component={Link} to="/social" mt="sm" leftSection={<IconPlugConnected size={16} />}>
            Connect an account
          </Button>
        }
      />
    );

  const pages = posts.data?.pages ?? [];
  const items = pages.flatMap((p) => p.items).filter(isVideo);
  const first = pages[0];
  const picked = Object.values(selected);
  const needsDuration = picked.filter((i) => !i.durationSeconds && !durations[i.externalId]);

  const toggle = (item: ProviderContentItem) => {
    setError(null);
    setBulkReport(null);
    setSelected((s) => {
      const copy = { ...s };
      if (copy[item.externalId]) delete copy[item.externalId];
      else if (Object.keys(copy).length < 50) copy[item.externalId] = item;
      return copy;
    });
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap">
        <SegmentedControl
          data={connected.map((s) => ({ value: s, label: slugLabel[s] }))}
          value={slug}
          onChange={(v) => {
            setChosen(v as SocialSlug);
            setSelected({});
          }}
          aria-label="Account"
        />
        <Button variant="subtle" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => void posts.refetch()} loading={posts.isRefetching}>
          Refresh
        </Button>
      </Group>
      {first?.providerStatus && (
        <Alert color="amber" variant="light" icon={<IconAlertTriangle size={16} />}>
          {first.servedFromCache ? 'Showing your saved posts — ' : ''}
          {first.providerStatus.message || `${slugLabel[slug]} is not answering right now.`}
          {first.providerStatus.retryAfterUtc ? ' Try again in a few minutes.' : ' You may need to reconnect the account.'}
        </Alert>
      )}
      {error && (
        <Alert color="signal" variant="light" role="alert">
          {error}
        </Alert>
      )}
      {bulkReport && (
        <Alert color="forest" variant="light">
          {bulkReport}{' '}
          <Anchor component={Link} to="/reels">
            Go to your reels
          </Anchor>
        </Alert>
      )}
      {posts.isPending ? (
        <ListSkeleton rows={3} height={110} />
      ) : posts.error ? (
        <ErrorBlock error={posts.error} onRetry={() => void posts.refetch()} title={`Could not load your ${slugLabel[slug]} posts`} />
      ) : items.length === 0 && !posts.hasNextPage ? (
        <EmptyBlock title="No videos found" body={`We could not find any video posts on this ${slugLabel[slug]} account.`} />
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4 }} spacing="sm" data-testid="importable-posts">
          {items.map((item) => {
            const on = !!selected[item.externalId];
            return (
              <Card
                key={item.externalId}
                padding={0}
                withBorder
                style={{ overflow: 'hidden', outline: on ? '3px solid var(--sm-accent)' : undefined, cursor: 'pointer' }}
                onClick={() => toggle(item)}
              >
                <Box style={{ position: 'relative', aspectRatio: '9 / 12', background: 'var(--sm-inset)' }}>
                  <ReelThumb src={item.thumbnailUrl} />
                  <Checkbox
                    checked={on}
                    onChange={() => toggle(item)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select post from ${formatDate(item.publishedUtc)}`}
                    pos="absolute"
                    top={8}
                    left={8}
                  />
                  {item.durationSeconds ? (
                    <Badge pos="absolute" bottom={8} right={8} variant="filled" color="dark" size="sm">
                      {formatDuration(item.durationSeconds)}
                    </Badge>
                  ) : null}
                </Box>
                <Stack gap={2} p="xs">
                  <Text size="xs" lineClamp={2}>
                    {item.caption || 'No caption'}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {formatDate(item.publishedUtc)}
                    {item.viewCount != null ? ` · ${formatCompact(item.viewCount)} views` : ''}
                  </Text>
                </Stack>
              </Card>
            );
          })}
        </SimpleGrid>
      )}
      {posts.hasNextPage && (
        <Group justify="center">
          <Button variant="default" onClick={() => void posts.fetchNextPage()} loading={posts.isFetchingNextPage}>
            Load more posts
          </Button>
        </Group>
      )}
      {picked.length > 0 && (
        <Card withBorder style={{ position: 'sticky', bottom: 72, zIndex: 5, boxShadow: 'var(--sm-shadow-high)' }}>
          <Stack gap="sm">
            {needsDuration.map((i) => (
              <NumberInput
                key={i.externalId}
                label={`How long is “${(i.caption || 'this video').slice(0, 40)}”? (seconds)`}
                min={1}
                max={MAX_DURATION_SECONDS}
                value={durations[i.externalId] ?? ''}
                onChange={(v) => setDurations((d) => ({ ...d, [i.externalId]: Number(v) || 0 }))}
              />
            ))}
            <Group justify="space-between">
              <Text size="sm" fw={600}>
                {picked.length} selected
              </Text>
              <Button
                leftSection={<IconDownload size={16} />}
                loading={importMany.isPending}
                disabled={needsDuration.length > 0}
                onClick={() => {
                  setError(null);
                  importMany.mutate();
                }}
              >
                {picked.length === 1 ? 'Import and tag products' : `Import ${picked.length} reels`}
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  );
}

function FromLink() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [url, setUrl] = useState('');
  const [duration, setDuration] = useState<number | ''>('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const parsed = url.trim() ? parseReelUrl(url) : null;

  const save = useMutation({
    mutationFn: () =>
      reelsApi.import({
        sourcePlatform: parsed!.platform,
        sourceUrl: parsed!.url,
        externalId: parsed!.externalId,
        durationSeconds: Number(duration),
        ...(caption.trim() ? { caption: caption.trim() } : {}),
      }),
    onSuccess: (reel) => {
      void qc.invalidateQueries({ queryKey: ['reels', 'list'] });
      toastSuccess('Reel imported. Now tag the products in it.');
      navigate(`/reels/${reel.id}?tab=products`);
    },
    onError: (e) => setError(importError(e)),
  });

  const submit = () => {
    setError(null);
    if (!parsed) return setError('Paste the link to a single reel or video on Instagram, TikTok, YouTube Shorts or Facebook.');
    const d = Number(duration);
    if (!d || d < 1 || d > MAX_DURATION_SECONDS) return setError('Enter how long the video is, in seconds (1 to 3600).');
    save.mutate();
  };

  return (
    <Stack gap="md" maw={560}>
      <Text size="sm" c="dimmed">
        Without a connected account StyleMint cannot read the video’s length or cover image, so enter the length yourself. Connecting
        the account is better: the cover and numbers come along.
      </Text>
      {error && (
        <Alert color="signal" variant="light" role="alert">
          {error}
        </Alert>
      )}
      <TextInput
        label="Link to the reel"
        placeholder="https://www.instagram.com/reel/…"
        leftSection={<IconLink size={16} />}
        value={url}
        onChange={(e) => setUrl(e.currentTarget.value)}
        description={parsed ? `${platformLabel[parsed.platform]} · id ${parsed.externalId}` : 'Instagram, TikTok, YouTube Shorts or Facebook'}
        error={url.trim() && !parsed ? 'This does not look like a link to a single reel or video.' : undefined}
      />
      <NumberInput label="Length (seconds)" min={1} max={MAX_DURATION_SECONDS} value={duration} onChange={(v) => setDuration(v === '' ? '' : Number(v))} w={200} />
      <Textarea label="Caption" autosize minRows={2} maxRows={6} maxLength={CAPTION_MAX} value={caption} onChange={(e) => setCaption(e.currentTarget.value)} />
      <Group>
        <Button onClick={submit} loading={save.isPending} leftSection={<IconDownload size={16} />}>
          Import and tag products
        </Button>
      </Group>
    </Stack>
  );
}

export default function ImportReelPage() {
  const [tab, setTab] = useTab(['accounts', 'link'] as const, 'accounts');
  return (
    <>
      <PageHeader
        title="Import a reel"
        description="Bring in a reel you already posted. StyleMint links to the original — the video stays on your account."
        back={{ to: '/reels', label: 'Reels' }}
      />
      <SectionCard title="Choose a reel">
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="accounts" leftSection={<IconPlugConnected size={14} />}>
              From my accounts
            </Tabs.Tab>
            <Tabs.Tab value="link" leftSection={<IconLink size={14} />}>
              Paste a link
            </Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="accounts">{tab === 'accounts' && <FromAccounts />}</Tabs.Panel>
          <Tabs.Panel value="link">{tab === 'link' && <FromLink />}</Tabs.Panel>
        </Tabs>
      </SectionCard>
    </>
  );
}
