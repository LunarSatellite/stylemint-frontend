import { Badge, Box, Button, Card, Group, SegmentedControl, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconDownload, IconEye, IconHeart, IconTag } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatCompact, formatDate, labelOf } from '../../lib/format';
import { ReelThumb } from './ReelThumb';
import { platformLabel, reelsApi, reelStateColor, reelStateLabel, type Reel } from './api';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Drafts' },
  { value: 'live', label: 'Published' },
  { value: 'review', label: 'In review' },
  { value: 'off', label: 'Unpublished' },
] as const;

const matches: Record<string, (r: Reel) => boolean> = {
  all: () => true,
  draft: (r) => r.state === 1 || r.state === 2,
  live: (r) => r.state === 3,
  review: (r) => r.state === 6,
  off: (r) => r.state === 4 || r.state === 5,
};

export function ReelCard({ reel }: { reel: Reel }) {
  const tags = reel.taggedProducts?.length ?? 0;
  return (
    <Card padding={0} data-interactive="true" component={Link} to={`/reels/${reel.id}`} style={{ textDecoration: 'none', color: 'inherit', overflow: 'hidden' }}>
      <Box style={{ position: 'relative', aspectRatio: '9 / 12', background: 'var(--sm-inset)' }}>
        <ReelThumb src={reel.thumbnailCdnUrl} />
        <Badge pos="absolute" top={8} left={8} color={reelStateColor[reel.state] ?? 'gray'} variant="filled" size="sm">
          {labelOf(reelStateLabel, reel.state)}
        </Badge>
      </Box>
      <Stack gap={4} p="sm">
        <Text size="sm" fw={600} lineClamp={2} mih={40}>
          {reel.caption?.trim() || 'No caption'}
        </Text>
        <Group gap="sm" c="dimmed">
          <Group gap={3}>
            <IconEye size={14} aria-hidden />
            <Text size="xs">{formatCompact(reel.viewCount)}</Text>
          </Group>
          <Group gap={3}>
            <IconHeart size={14} aria-hidden />
            <Text size="xs">{formatCompact(reel.likeCount)}</Text>
          </Group>
          <Group gap={3}>
            <IconTag size={14} aria-hidden />
            <Text size="xs" c={tags === 0 ? 'var(--sm-warn-text)' : undefined}>
              {tags}
            </Text>
          </Group>
        </Group>
        <Text size="xs" c="dimmed">
          {labelOf(platformLabel, reel.sourcePlatform)} · {formatDate(reel.publishedAtUtc ?? reel.createdUtc)}
        </Text>
      </Stack>
    </Card>
  );
}

export default function ReelsPage() {
  const [filter, setFilter] = useState<string>('all');
  const list = useCursorList({ key: ['reels', 'list'], fetchPage: (c) => reelsApi.list(c, 48) });
  const items = list.query.data?.items ?? [];
  const shown = items.filter(matches[filter] ?? matches.all);

  return (
    <>
      <PageHeader
        title="Reels"
        description="Import reels from your social accounts, tag the products you wear, and publish them to StyleMint shoppers."
        actions={
          <Button component={Link} to="/reels/import" leftSection={<IconDownload size={16} />}>
            Import a reel
          </Button>
        }
      />
      <SegmentedControl
        mb="md"
        data={FILTERS.map((f) => ({ value: f.value, label: f.label }))}
        value={filter}
        onChange={setFilter}
        aria-label="Show reels"
        style={{ maxWidth: '100%', overflowX: 'auto' }}
      />
      {list.query.isPending ? (
        <ListSkeleton rows={3} height={120} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load your reels" />
      ) : items.length === 0 ? (
        <Card>
          <EmptyBlock
            title="No reels yet"
            body="Import a reel you posted on Instagram, TikTok, YouTube Shorts or Facebook, then tag the products in it."
            action={
              <Button component={Link} to="/reels/import" mt="sm" leftSection={<IconDownload size={16} />}>
                Import your first reel
              </Button>
            }
          />
        </Card>
      ) : shown.length === 0 ? (
        <Card>
          <EmptyBlock title="Nothing here on this page" body="No reel on this page matches the filter. Try another filter or page." />
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 4, lg: 5 }} spacing="md" data-testid="reels-grid">
          {shown.map((r) => (
            <ReelCard key={r.id} reel={r} />
          ))}
        </SimpleGrid>
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
