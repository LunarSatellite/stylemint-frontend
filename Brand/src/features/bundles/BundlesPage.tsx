import { useState } from 'react';
import { Alert, Badge, Button, Card, Group, SegmentedControl, Select, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconMailForward, IconPlus } from '@tabler/icons-react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatMoney, fromNow } from '../../lib/format';
import { BUNDLES_KEY, bundlesApi, formatPercent, isMissingEndpoint, ownerKindLabel, shopStateLabel, stateLabel, toBundleState, type BundleState, type BundleSummary } from './api';
import { bundlePath, CreateBundleModal } from './BundleForm';
import { BundlesSettingUp, BundleStateBadge, CoverThumb } from './components';

const ROLES = [
  { value: 'owner', label: 'My bundles' },
  { value: 'shop', label: 'Invited & joined' },
];

const STATE_FILTER: { value: BundleState; label: string }[] = (['Draft', 'PendingAcceptance', 'Live', 'Paused', 'Archived'] as BundleState[]).map((s) => ({
  value: s,
  label: stateLabel[s],
}));

/** Bundles this shop owns, or other owners' bundles it is invited to / part of (`GET /v1/bundles/mine?as=`). */
export default function BundlesPage() {
  const [params, setParams] = useSearchParams();
  const as = params.get('as') === 'shop' ? 'shop' : 'owner';
  const stateParam = params.get('state');
  const state = stateParam ? toBundleState(stateParam) : null;
  const filter = state && state !== 'Unknown' ? state : null;
  const [creating, setCreating] = useState(false);
  const list = useCursorList({
    key: [...BUNDLES_KEY, 'list', as],
    resetKey: `${as}|${filter ?? ''}`,
    fetchPage: (cursor) => bundlesApi.mine({ as, state: filter, cursor }),
  });
  const q = list.query;
  const missing = isMissingEndpoint(q.error);
  const items = q.data?.items ?? [];
  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v);
    else next.delete(k);
    setParams(next, { replace: true });
  };
  const waitingForMe = as === 'shop' ? items.filter((b) => b.myShopState === 'Pending' || b.myShopState === 'Invited').length : 0;

  return (
    <>
      <PageHeader
        title="Bundles"
        description="Sell products together at a bundle discount — your own, or with other shops. Every shop accepts the discount on its own items before a bundle goes live."
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
          <Group gap="sm" wrap="wrap" align="flex-end">
            <SegmentedControl aria-label="Show bundles" data={ROLES} value={as} onChange={(v) => setParam('as', v === 'owner' ? null : v)} />
            <Select
              aria-label="Status"
              placeholder="Any status"
              clearable
              w={200}
              data={STATE_FILTER}
              value={filter}
              onChange={(v) => setParam('state', v)}
            />
          </Group>
          {waitingForMe > 0 && (
            <Alert variant="light" color="amber" icon={<IconMailForward size={18} />} title={`${waitingForMe} ${waitingForMe === 1 ? 'bundle is' : 'bundles are'} waiting for you`}>
              <Text size="sm">Open it to add your products or to accept or decline the discount on them.</Text>
            </Alert>
          )}
          {q.isPending ? (
            <ListSkeleton rows={3} height={96} />
          ) : q.error ? (
            <ErrorBlock error={q.error} title="Could not load your bundles" onRetry={() => void q.refetch()} />
          ) : items.length === 0 ? (
            <Card>
              <EmptyBlock
                title={filter ? 'No bundles match' : as === 'shop' ? 'No invitations yet' : 'No bundles yet'}
                body={
                  filter
                    ? 'Try another status.'
                    : as === 'shop'
                      ? 'When a creator, StyleMint or another shop puts your products in a bundle, it shows here for you to accept.'
                      : 'Put two or more products together at a discount. You can invite other shops to add theirs.'
                }
                action={
                  as === 'owner' &&
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
  const waiting = b.myRole !== 'Owner' && (b.myShopState === 'Pending' || b.myShopState === 'Invited');
  const meta = [
    b.ownerName ? `by ${b.ownerName}` : b.myRole === 'Owner' ? null : ownerKindLabel[b.ownerKind],
    b.itemCount != null ? `${b.itemCount} ${b.itemCount === 1 ? 'item' : 'items'}` : null,
    b.shopCount != null ? `${b.shopCount} ${b.shopCount === 1 ? 'shop' : 'shops'}` : null,
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
          {b.myRole !== 'Owner' && b.myShopState && (
            <Badge variant={waiting ? 'filled' : 'outline'} color={waiting ? 'amber' : 'gray'} size="sm">
              {shopStateLabel[b.myShopState]}
            </Badge>
          )}
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
