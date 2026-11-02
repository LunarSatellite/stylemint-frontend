import { useState } from 'react';
import { Badge, Button, Card, Group, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatMoney, fromNow } from '../../lib/format';
import { BUNDLES_KEY, bundlesApi, formatPercent, isMissingEndpoint, stateLabel, toBundleState, type BundleState, type BundleSummary } from './api';
import { bundlePath, CreateBundleModal } from './BundleForm';
import { BundlesSettingUp, BundleStateBadge, CoverThumb } from './components';

const STATE_FILTER: { value: BundleState; label: string }[] = (['Draft', 'PendingAcceptance', 'Live', 'Paused', 'Archived'] as BundleState[]).map((s) => ({
  value: s,
  label: stateLabel[s],
}));

/** The creator's own bundles (`GET /v1/bundles/mine?as=owner`). */
export default function BundlesPage() {
  const [params, setParams] = useSearchParams();
  const stateParam = params.get('state');
  const parsed = stateParam ? toBundleState(stateParam) : null;
  const filter = parsed && parsed !== 'Unknown' ? parsed : null;
  const [creating, setCreating] = useState(false);
  const list = useCursorList({
    key: [...BUNDLES_KEY, 'list', 'owner'],
    resetKey: filter ?? '',
    fetchPage: (cursor) => bundlesApi.mine({ as: 'owner', state: filter, cursor }),
  });
  const q = list.query;
  const missing = isMissingEndpoint(q.error);
  const items = q.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="Bundles"
        description="Put products from your partner brands together at a bundle discount and share one link. You earn your commission on every item."
        actions={
          !missing && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
              New bundle
            </Button>
          )
        }
      />
      {missing ? (
        <BundlesSettingUp />
      ) : (
        <Stack gap="md">
          <Select
            aria-label="Status"
            placeholder="Any status"
            clearable
            w={200}
            data={STATE_FILTER}
            value={filter}
            onChange={(v) => setParams(v ? new URLSearchParams({ state: v }) : new URLSearchParams(), { replace: true })}
          />
          {q.isPending ? (
            <ListSkeleton rows={3} height={96} />
          ) : q.error ? (
            <ErrorBlock error={q.error} title="Could not load your bundles" onRetry={() => void q.refetch()} />
          ) : items.length === 0 ? (
            <Card>
              <EmptyBlock
                title={filter ? 'No bundles match' : 'No bundles yet'}
                body={filter ? 'Try another status.' : 'Pick 2–12 products from your partner brands — a trekking kit, a wedding look — and sell them together.'}
                action={
                  !filter && (
                    <Button size="sm" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setCreating(true)}>
                      New bundle
                    </Button>
                  )
                }
              />
            </Card>
          ) : (
            <>
              <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                {items.map((b) => (
                  <BundleCard key={b.id} b={b} />
                ))}
              </SimpleGrid>
              <Pager
                page={list.page}
                pageSize={list.pageSize}
                total={list.total}
                shown={items.length}
                hasPrev={list.hasPrev}
                hasNext={list.hasNext}
                onPrev={list.prev}
                onNext={list.next}
                busy={q.isFetching}
              />
            </>
          )}
        </Stack>
      )}
      <CreateBundleModal opened={creating} onClose={() => setCreating(false)} />
    </>
  );
}

function BundleCard({ b }: { b: BundleSummary }) {
  const meta = [
    b.itemCount != null ? `${b.itemCount} ${b.itemCount === 1 ? 'item' : 'items'}` : null,
    b.shopCount != null ? `${b.shopCount} ${b.shopCount === 1 ? 'shop' : 'shops'}` : null,
    b.state === 'PendingAcceptance' && b.acceptedShopCount != null && b.shopCount != null ? `${b.acceptedShopCount} of ${b.shopCount} accepted` : null,
    b.updatedUtc ? `updated ${fromNow(b.updatedUtc)}` : null,
  ].filter(Boolean);
  return (
    <Card withBorder component={Link} to={bundlePath(b.id)} padding="sm" data-testid={`bundle-${b.id}`}>
      <Group justify="space-between" wrap="nowrap" gap="xs" align="flex-start">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
          <CoverThumb url={b.coverImageUrl} size={48} />
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text fw={650} truncate>
              {b.title}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {meta.join(' · ')}
            </Text>
            {b.totals && (
              <Text size="xs">
                {formatMoney(b.totals.bundleTotal)} · {formatPercent(b.discountPercent)} off
              </Text>
            )}
          </Stack>
        </Group>
        <Stack gap={4} align="flex-end">
          <BundleStateBadge state={b.state} />
          {b.state === 'Live' && b.isPurchasable === false && (
            <Badge variant="light" color="amber" size="sm">
              Item out of stock
            </Badge>
          )}
        </Stack>
      </Group>
    </Card>
  );
}
