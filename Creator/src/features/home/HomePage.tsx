import { useEffect, useMemo, useState } from 'react';
import { Alert, Anchor, Badge, Button, Group, SimpleGrid, Stack, Text, ThemeIcon } from '@mantine/core';
import {
  IconArrowRight,
  IconBolt,
  IconBulb,
  IconDownload,
  IconHeartHandshake,
  IconPlugConnected,
  IconTag,
  IconUserCircle,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { isMissingEndpoint } from '../../api/client';
import { useAccount, useSession } from '../../auth/useSession';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatCompact, formatDateTime, formatMoney, formatNumber, fromNow, labelOf } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { activityApi, activityKindLabel } from '../activity/api';
import { analyticsApi, windowFor } from '../analytics/api';
import { DeltaBadge } from '../analytics/components';
import { moneyApi, type BoostOffer } from '../money/api';
import { BriefCard } from '../partnerships/BriefsPage';
import { partnershipsApi, pendingActor } from '../partnerships/api';
import { BrandCell, InviteActions } from '../partnerships/PartnershipsPage';
import { profileApi } from '../profile/api';
import { isConnected, socialApi } from '../profile/socialApi';
import { reelsApi } from '../reels/api';
import { studioApi } from '../studio/api';

/** Countdown anchored to the server clock in the response, not the device clock. */
function useServerCountdown(serverNowUtc: string, expiresUtc: string): number {
  const offset = useMemo(() => Date.parse(serverNowUtc) - Date.now(), [serverNowUtc]);
  const [left, setLeft] = useState(() => Date.parse(expiresUtc) - (Date.now() + offset));
  useEffect(() => {
    const tick = () => setLeft(Date.parse(expiresUtc) - (Date.now() + offset));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [expiresUtc, offset]);
  return Math.max(0, left);
}

function BoostOfferCard({ offer }: { offer: BoostOffer }) {
  const qc = useQueryClient();
  const left = useServerCountdown(offer.serverNowUtc, offer.expiresUtc);
  const accept = useMutation({
    mutationFn: () => moneyApi.acceptBoostOffer(offer.id),
    onSuccess: () => {
      toastSuccess('Boost on — your reel is promoted for the next 6 hours, free.');
      void qc.invalidateQueries({ queryKey: ['home', 'boost-offers'] });
    },
    onError: (e) => toastError(e, 'Could not accept the boost'),
  });
  if (left <= 0) return null;
  const mins = Math.floor(left / 60_000);
  const secs = Math.floor((left % 60_000) / 1000);
  return (
    <Alert color="forest" variant="light" icon={<IconBolt size={18} />} title="Free boost for your reel">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Text size="sm">
          This reel is taking off. StyleMint will boost it for 6 hours at no cost. Offer ends in{' '}
          <b>
            {mins}:{String(secs).padStart(2, '0')}
          </b>
          . <Anchor component={Link} to={`/reels/${offer.reelId}`}>See the reel</Anchor>
        </Text>
        <Button size="xs" loading={accept.isPending} onClick={() => accept.mutate()}>
          Boost it — free
        </Button>
      </Group>
    </Alert>
  );
}

function BoostOffers() {
  const offers = useQuery({ queryKey: ['home', 'boost-offers'], queryFn: moneyApi.boostOffers, retry: false, refetchInterval: 60_000 });
  // An older server without the list endpoint: nothing to show (offers still arrive as notifications).
  if (offers.error && isMissingEndpoint(offers.error)) return null;
  if (!offers.data?.length) return null;
  return (
    <Stack gap="sm">
      {offers.data.filter((o) => o.state === 1).map((o) => (
        <BoostOfferCard key={o.id} offer={o} />
      ))}
    </Stack>
  );
}

function ThisWeek() {
  const window = useMemo(() => windowFor(7), []);
  const o = useQuery({ queryKey: ['home', 'week', window], queryFn: () => analyticsApi.overview(window) });
  const balance = useQuery({ queryKey: ['home', 'balance'], queryFn: moneyApi.balance });
  const d = o.data;
  const b = balance.data;
  return (
    <>
      {o.error && <ErrorBlock error={o.error} onRetry={() => void o.refetch()} title="Could not load this week’s numbers" />}
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="md">
        <KpiTile label="Views this week" value={d ? formatCompact(d.totalViews.current) : ''} loading={o.isPending} right={d && <DeltaBadge value={d.totalViews.deltaPercent} />} to="/analytics" />
        <KpiTile label="Sales this week" value={d ? formatNumber(d.totalSales.current) : ''} loading={o.isPending} right={d && <DeltaBadge value={d.totalSales.deltaPercent} />} to="/analytics" />
        <KpiTile
          label="Earned this week"
          value={d ? formatMoney(d.totalEarnings.current) : ''}
          loading={o.isPending}
          right={d && <DeltaBadge value={d.totalEarnings.deltaPercent} />}
          to="/earnings"
        />
        {balance.error ? (
          <KpiTile label="Ready to pay out" value="—" hint="Could not load" tone="signal" to="/payouts" />
        ) : (
          <KpiTile
            label="Ready to pay out"
            value={b ? formatMoney({ amount: b.availableValue, currency: b.currency }) : ''}
            hint={b ? `${formatMoney({ amount: b.pendingValue, currency: b.currency })} pending` : undefined}
            loading={balance.isPending}
            tone="amber"
            to="/payouts"
          />
        )}
      </SimpleGrid>
    </>
  );
}

function Invites() {
  const q = useQuery({ queryKey: ['partnerships', 'home-invites'], queryFn: () => partnershipsApi.list([1], null, 20) });
  const mine = (q.data?.items ?? []).filter((p) => pendingActor(p) === 'creator');
  return (
    <SectionCard
      title="Brand invites"
      action={
        <Button component={Link} to="/partnerships?tab=invites" variant="subtle" size="xs" rightSection={<IconArrowRight size={14} />}>
          All
        </Button>
      }
    >
      {q.isPending ? (
        <ListSkeleton rows={2} height={44} />
      ) : q.error ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} title="Could not load invites" />
      ) : mine.length === 0 ? (
        <EmptyBlock title="No invites waiting" body={<Anchor component={Link} to="/brands">Find brands to partner with</Anchor>} />
      ) : (
        <Stack gap="sm">
          {mine.slice(0, 4).map((p) => (
            <Group key={p.id} justify="space-between" wrap="wrap" gap="xs">
              <Anchor component={Link} to={`/partnerships/${p.id}`} c="inherit" underline="never">
                <BrandCell p={p} />
              </Anchor>
              <InviteActions p={p} compact />
            </Group>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

function OpenCampaigns() {
  const q = useQuery({ queryKey: ['partnerships', 'briefs', 'home'], queryFn: () => partnershipsApi.briefs(null) });
  return (
    <SectionCard
      title="Open campaigns"
      action={
        <Button component={Link} to="/briefs" variant="subtle" size="xs" rightSection={<IconArrowRight size={14} />}>
          All
        </Button>
      }
    >
      {q.isPending ? (
        <ListSkeleton rows={2} height={80} />
      ) : q.error ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} title="Could not load campaigns" />
      ) : q.data.items.length === 0 ? (
        <EmptyBlock title="No campaigns open right now" />
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          {q.data.items.slice(0, 2).map((b) => (
            <BriefCard key={b.id} brief={b} />
          ))}
        </SimpleGrid>
      )}
    </SectionCard>
  );
}

interface Task {
  key: string;
  icon: typeof IconTag;
  text: string;
  to: string;
  cta: string;
}

/** Things worth doing next, derived from real data. A source that fails just adds no task. */
function Tasks() {
  const { accountId } = useSession();
  const reels = useQuery({ queryKey: ['reels', 'list', 'home'], queryFn: () => reelsApi.list(null, 50) });
  const social = useQuery({ queryKey: ['social', 'accounts'], queryFn: socialApi.list });
  const profile = useQuery({ queryKey: ['profile', 'creator', accountId], queryFn: () => profileApi.creatorProfile(accountId!), enabled: !!accountId });
  const nudges = useQuery({ queryKey: ['studio', 'tag-nudges'], queryFn: () => studioApi.tagNudges(10) });
  const insight = useQuery({ queryKey: ['studio', 'insight'], queryFn: studioApi.insight, retry: false });

  const tasks: Task[] = [];
  const list = reels.data?.items ?? [];
  const untagged = list.filter((r) => (r.state === 3 || r.state === 1) && (r.taggedProducts?.length ?? 0) === 0);
  const drafts = list.filter((r) => r.state === 1 && (r.taggedProducts?.length ?? 0) > 0);
  if (social.data && !social.data.some(isConnected))
    tasks.push({ key: 'social', icon: IconPlugConnected, text: 'Connect Instagram, TikTok, YouTube or Facebook to import reels in a tap.', to: '/social', cta: 'Connect' });
  if (reels.data && list.length === 0) tasks.push({ key: 'first', icon: IconDownload, text: 'Import your first reel and tag what you’re wearing.', to: '/reels/import', cta: 'Import' });
  if (untagged.length > 0)
    tasks.push({ key: 'untagged', icon: IconTag, text: `${untagged.length} reel${untagged.length > 1 ? 's have' : ' has'} no products tagged — they can’t earn yet.`, to: `/reels/${untagged[0].id}?tab=products`, cta: 'Tag products' });
  if (drafts.length > 0) tasks.push({ key: 'drafts', icon: IconHeartHandshake, text: `${drafts.length} tagged reel${drafts.length > 1 ? 's are' : ' is'} ready to publish.`, to: `/reels/${drafts[0].id}`, cta: 'Publish' });
  if (profile.data && (!profile.data.bio || !profile.data.specializationSummary))
    tasks.push({ key: 'profile', icon: IconUserCircle, text: 'Finish your profile so brands know what you create.', to: '/profile', cta: 'Edit profile' });
  for (const n of (nudges.data ?? []).slice(0, 2))
    tasks.push({ key: `nudge-${n.reelId}-${n.suggestedProductId}`, icon: IconTag, text: `Tag “${n.productName}” — ${n.reason}`, to: `/reels/${n.reelId}?tab=products`, cta: 'Open reel' });

  const loading = reels.isPending || social.isPending;
  return (
    <SectionCard title="To do">
      <Stack gap="sm">
        {insight.data && (
          <Alert color="blue" variant="light" icon={<IconBulb size={18} />} title={insight.data.headline}>
            {insight.data.detail} <b>{insight.data.actionItem}</b>
          </Alert>
        )}
        {loading ? (
          <ListSkeleton rows={2} height={40} />
        ) : tasks.length === 0 ? (
          <Text size="sm" c="dimmed">
            You’re all caught up.
          </Text>
        ) : (
          tasks.map((t) => (
            <Group key={t.key} justify="space-between" wrap="nowrap" gap="sm">
              <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                <ThemeIcon variant="light" color="forest" radius="xl">
                  <t.icon size={16} />
                </ThemeIcon>
                <Text size="sm">{t.text}</Text>
              </Group>
              <Button component={Link} to={t.to} size="xs" variant="light" style={{ flexShrink: 0 }}>
                {t.cta}
              </Button>
            </Group>
          ))
        )}
        {reels.error && (
          <Text size="xs" c="dimmed">
            Could not check your reels for tasks.
          </Text>
        )}
      </Stack>
    </SectionCard>
  );
}

function RecentActivity() {
  const q = useQuery({ queryKey: ['activity', 'home'], queryFn: () => activityApi.activity(null, null) });
  return (
    <SectionCard
      title="Recent activity"
      action={
        <Button component={Link} to="/activity" variant="subtle" size="xs" rightSection={<IconArrowRight size={14} />}>
          All
        </Button>
      }
    >
      {q.isPending ? (
        <ListSkeleton rows={3} height={36} />
      ) : q.error ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} title="Could not load activity" />
      ) : q.data.items.length === 0 ? (
        <EmptyBlock title="No activity yet" />
      ) : (
        <Stack gap="xs">
          {q.data.items.slice(0, 5).map((a) => (
            <div key={a.id}>
              <Group gap={6}>
                <Badge size="xs" variant="light">
                  {labelOf(activityKindLabel, a.kind)}
                </Badge>
                <Text size="xs" c="dimmed" title={formatDateTime(a.occurredUtc)}>
                  {fromNow(a.occurredUtc)}
                </Text>
              </Group>
              <Text size="sm">{a.headline}</Text>
            </div>
          ))}
        </Stack>
      )}
    </SectionCard>
  );
}

export default function HomePage() {
  const account = useAccount();
  const first = account.data?.displayName?.split(/\s+/)[0];
  return (
    <>
      <PageHeader title={first ? `Hi, ${first}` : 'Home'} description="Your week on StyleMint at a glance." actions={
        <Button component={Link} to="/reels/import" leftSection={<IconDownload size={16} />}>
          Import a reel
        </Button>
      } />
      <Stack gap="md">
        <BoostOffers />
        <ThisWeek />
        <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
          <Tasks />
          <Invites />
        </SimpleGrid>
        <OpenCampaigns />
        <RecentActivity />
      </Stack>
    </>
  );
}

