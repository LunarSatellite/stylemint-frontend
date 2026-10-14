import { useState } from 'react';
import { Anchor, Badge, Button, Card, Divider, Group, Progress, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconSparkles, IconUserPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isMissingEndpoint } from '../../api/client';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatMoney, formatNumber } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { creatorsApi, type CreatorPick, type MatchSnapshot } from './api';
import { CreatorLine, CREATORS_KEY, DetailSheet, InviteModal } from './components';
import { compactCount, pct } from './labels';

interface InviteTarget {
  accountId: string;
  name: string | null;
  minPercent?: number;
  maxPercent?: number;
  brandBriefId?: string | null;
}

/** Public profile + reach + rate card + what this creator already sold for you. No private data. */
export function CreatorProfileCard({ accountId, onInvite }: { accountId: string; onInvite?: () => void }) {
  const profile = useQuery({ queryKey: [CREATORS_KEY, 'profile', accountId], queryFn: () => creatorsApi.profile(accountId), retry: false });
  const stats = useQuery({ queryKey: [CREATORS_KEY, 'reel-stats', accountId], queryFn: () => creatorsApi.reelStats(accountId), retry: false });
  const rate = useQuery({ queryKey: [CREATORS_KEY, 'rate-card', accountId], queryFn: () => creatorsApi.rateCard(accountId), retry: false });
  const perf = useQuery({ queryKey: [CREATORS_KEY, 'performance'], queryFn: () => creatorsApi.performance(), retry: false });
  const mine = perf.data?.find((p) => p.creatorAccountId === accountId);

  if (profile.isPending) return <ListSkeleton rows={3} />;
  if (profile.error && !isMissingEndpoint(profile.error))
    return <ErrorBlock error={profile.error} title="Could not load this creator" onRetry={() => void profile.refetch()} />;
  const p = profile.data;
  return (
    <Stack gap="md" data-testid="creator-profile">
      <CreatorLine accountId={accountId} name={p?.displayName} handle={p?.handle} avatarUrl={p?.avatarUrl} size={48} extra={p?.location} />
      {!p && <Text size="sm" c="dimmed">This creator has no public profile yet.</Text>}
      {p?.bio && <Text size="sm">{p.bio}</Text>}
      {p?.specializationSummary && (
        <Text size="sm" c="dimmed">
          {p.specializationSummary}
        </Text>
      )}
      {!!p?.styleTags.length && (
        <Group gap={4}>
          {p.styleTags.map((t) => (
            <Badge key={t} variant="outline" color="slate" size="sm">
              {t}
            </Badge>
          ))}
        </Group>
      )}
      <SimpleGrid cols={3} spacing="xs">
        <Card withBorder padding="xs">
          <Text size="xs" c="dimmed">
            Reels
          </Text>
          <Text fw={650}>{stats.data ? formatNumber(stats.data.publishedReelCount) : '—'}</Text>
        </Card>
        <Card withBorder padding="xs">
          <Text size="xs" c="dimmed">
            Views
          </Text>
          <Text fw={650}>{stats.data ? compactCount(stats.data.totalViewsSnapshot) : '—'}</Text>
        </Card>
        <Card withBorder padding="xs">
          <Text size="xs" c="dimmed">
            Likes
          </Text>
          <Text fw={650}>{stats.data ? compactCount(stats.data.totalStyleMintLikes) : '—'}</Text>
        </Card>
      </SimpleGrid>
      <Divider label="Rate card" labelPosition="left" />
      {rate.data ? (
        <Stack gap={6}>
          <Text size="sm">
            From {formatMoney(rate.data.baseRate)} · prefers {pct(rate.data.commissionPreference)} commission
          </Text>
          {rate.data.rates.map((r) => (
            <Group key={r.tierName} justify="space-between" wrap="nowrap">
              <Text size="sm">
                {r.tierName} · {r.includedReels} {r.includedReels === 1 ? 'reel' : 'reels'}
              </Text>
              <Text size="sm" fw={600}>
                {formatMoney(r.price)}
              </Text>
            </Group>
          ))}
        </Stack>
      ) : (
        <Text size="sm" c="dimmed">
          {rate.isPending ? 'Loading…' : 'No public rate card.'}
        </Text>
      )}
      <Divider label="With your shop" labelPosition="left" />
      {mine ? (
        <SimpleGrid cols={3} spacing="xs" data-testid="creator-performance">
          <Text size="sm">
            <b>{formatNumber(mine.unitsSold)}</b> sold
          </Text>
          <Text size="sm">
            <b>{formatMoney({ amount: mine.attributedRevenue, currency: mine.currency })}</b> sales
          </Text>
          <Text size="sm">
            <b>{formatMoney({ amount: mine.commissionPaid, currency: mine.currency })}</b> commission
          </Text>
        </SimpleGrid>
      ) : (
        <Text size="sm" c="dimmed">
          No sales through this creator yet.
        </Text>
      )}
      {onInvite && (
        <Button leftSection={<IconUserPlus size={16} />} onClick={onInvite}>
          Invite to partner
        </Button>
      )}
    </Stack>
  );
}

function MatchCard({ m, onInvite, onView }: { m: MatchSnapshot; onInvite: (m: MatchSnapshot) => void; onView: (id: string) => void }) {
  const qc = useQueryClient();
  const dismiss = useMutation({
    mutationFn: () => creatorsApi.dismissMatch(m.id),
    onSuccess: () => {
      toastSuccess('Suggestion hidden');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'matches'] });
    },
    onError: (e) => toastError(e),
  });
  const score = Math.round(Math.max(0, Math.min(1, m.score > 1 ? m.score / 100 : m.score)) * 100);
  return (
    <Card withBorder padding="sm" data-testid="match-card">
      <Stack gap={8}>
        <Anchor component="button" type="button" onClick={() => onView(m.creatorAccountId)} underline="never" c="inherit" ta="left">
          <CreatorLine accountId={m.creatorAccountId} handle={m.creatorHandle} />
        </Anchor>
        <Group gap={8} wrap="nowrap">
          <Progress value={score} color="forest" style={{ flex: 1 }} aria-label={`Match ${score}%`} />
          <Text size="xs" fw={600}>
            {score}% match
          </Text>
        </Group>
        {m.reasonSummary && (
          <Text size="xs" c="dimmed" lineClamp={3}>
            {m.reasonSummary}
          </Text>
        )}
        <Group gap="xs" grow>
          <Button size="xs" leftSection={<IconUserPlus size={14} />} onClick={() => onInvite(m)}>
            Invite
          </Button>
          <Button size="xs" variant="default" leftSection={<IconX size={14} />} loading={dismiss.isPending} onClick={() => dismiss.mutate()}>
            Not now
          </Button>
        </Group>
      </Stack>
    </Card>
  );
}

function ResultCard({ c, onView }: { c: CreatorPick; onView: (id: string) => void }) {
  return (
    <Card withBorder padding="sm" data-interactive="true" onClick={() => onView(c.creatorAccountId)} style={{ cursor: 'pointer' }}>
      <Stack gap={8}>
        <CreatorLine accountId={c.creatorAccountId} name={c.displayName} handle={c.handle} avatarUrl={c.avatarUrl} />
        {c.bio && (
          <Text size="xs" c="dimmed" lineClamp={2}>
            {c.bio}
          </Text>
        )}
        <Group gap={4}>
          {c.followerCount !== null && (
            <Badge variant="light" color="slate" size="sm">
              {compactCount(c.followerCount)} followers
            </Badge>
          )}
          {c.hasExistingPartnership && (
            <Badge variant="light" color="forest" size="sm">
              Partner
            </Badge>
          )}
          {c.niches.slice(0, 3).map((n) => (
            <Badge key={n} variant="outline" color="slate" size="sm">
              {n}
            </Badge>
          ))}
        </Group>
      </Stack>
    </Card>
  );
}

export default function FindCreatorsPage() {
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q, 300);
  const [viewing, setViewing] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteTarget | null>(null);

  const matches = useQuery({ queryKey: [CREATORS_KEY, 'matches'], queryFn: () => creatorsApi.matches(null), retry: false });
  const list = useCursorList({
    key: [CREATORS_KEY, 'search-page'],
    resetKey: debounced,
    fetchPage: (cursor) => creatorsApi.searchCreators(debounced, null, cursor, false),
  });

  const prefill = useMutation({
    mutationFn: (m: MatchSnapshot) => creatorsApi.matchPrefill(m.id),
    onSuccess: (p) =>
      setInvite({
        accountId: p.creatorAccountId,
        name: null,
        minPercent: p.brandCommissionMinBps / 100,
        maxPercent: Math.max(p.brandCommissionMaxBps, p.proposedCommissionBps) / 100,
        brandBriefId: p.brandBriefId,
      }),
    onError: (e) => toastError(e, 'Could not prepare the invitation'),
  });

  const startInvite = (accountId: string, name: string | null) => {
    setViewing(null);
    setInvite({ accountId, name });
  };

  const matchItems = matches.data?.items.filter((m) => m.state === 1) ?? [];

  return (
    <>
      <PageHeader title="Find creators" description="Creators matched to your shop, and everyone you can invite. Profiles show public reach and what they already sold for you." />
      <Stack gap="lg">
        <SectionCard
          title={
            <Group gap={6}>
              <IconSparkles size={18} aria-hidden /> Suggested for you
            </Group>
          }
          description="Fresh matches every day, based on your products and each creator's audience."
        >
          {matches.isPending ? (
            <ListSkeleton rows={2} height={120} />
          ) : matches.error ? (
            isMissingEndpoint(matches.error) ? (
              <EmptyBlock title="Suggestions are not available yet" />
            ) : (
              <ErrorBlock error={matches.error} title="Could not load suggestions" onRetry={() => void matches.refetch()} />
            )
          ) : matchItems.length === 0 ? (
            <EmptyBlock title="No suggestions today" body="New matches appear as creators join and your sales grow. Search below meanwhile." />
          ) : (
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
              {matchItems.map((m) => (
                <MatchCard key={m.id} m={m} onInvite={(x) => prefill.mutate(x)} onView={setViewing} />
              ))}
            </SimpleGrid>
          )}
        </SectionCard>

        <SectionCard title="All creators">
          <Stack gap="sm">
            <TextInput
              leftSection={<IconSearch size={16} />}
              placeholder="Search by name, handle or style"
              aria-label="Search creators"
              value={q}
              onChange={(e) => setQ(e.currentTarget.value)}
            />
            {list.query.isPending ? (
              <ListSkeleton rows={3} height={90} />
            ) : list.query.error ? (
              <ErrorBlock error={list.query.error} title="Could not load creators" onRetry={() => void list.query.refetch()} />
            ) : !list.query.data?.items.length ? (
              <EmptyBlock title={debounced ? 'No creators match your search' : 'No creators yet'} />
            ) : (
              <>
                <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                  {list.query.data.items.map((c) => (
                    <ResultCard key={c.creatorAccountId} c={c} onView={setViewing} />
                  ))}
                </SimpleGrid>
                <Pager
                  page={list.page}
                  pageSize={list.pageSize}
                  total={list.total}
                  shown={list.query.data.items.length}
                  hasPrev={list.hasPrev}
                  hasNext={list.hasNext}
                  onPrev={list.prev}
                  onNext={list.next}
                  busy={list.query.isFetching}
                />
              </>
            )}
          </Stack>
        </SectionCard>
      </Stack>

      <DetailSheet opened={!!viewing} onClose={() => setViewing(null)} title="Creator">
        {viewing && (
          <CreatorProfileCard
            accountId={viewing}
            onInvite={() => startInvite(viewing, null)}
          />
        )}
      </DetailSheet>
      {invite && (
        <InviteModal
          opened
          onClose={() => setInvite(null)}
          creator={{ accountId: invite.accountId, name: invite.name }}
          defaults={{ minPercent: invite.minPercent, maxPercent: invite.maxPercent, brandBriefId: invite.brandBriefId }}
        />
      )}
    </>
  );
}
