import { useState } from 'react';
import { Alert, Avatar, Badge, Button, Card, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconBrandFacebook, IconBrandInstagram, IconBrandTiktok, IconBrandYoutube, IconPlugConnected, IconRefresh, type IconProps } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ComponentType } from 'react';
import { ApiError, messageOf } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatCompact, formatDateTime, formatPercentValue, fromNow, labelOf } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { profileApi } from './api';
import { connectInPopup, SocialAccountState, slugLabel, socialApi, SOCIAL_SLUGS, socialStateColor, socialStateLabel, type SocialAccount, type SocialSlug } from './socialApi';

const ICONS: Record<SocialSlug, ComponentType<IconProps>> = {
  instagram: IconBrandInstagram,
  tiktok: IconBrandTiktok,
  youtube: IconBrandYoutube,
  facebook: IconBrandFacebook,
};
const providerOf: Record<SocialSlug, number> = { instagram: 1, tiktok: 2, youtube: 3, facebook: 4 };

function connectError(e: unknown, slug: SocialSlug): string {
  if (e instanceof ApiError && e.code === 'PROVIDER_UNAVAILABLE') return `Connecting ${slugLabel[slug]} isn’t switched on yet. Please try again later.`;
  return messageOf(e);
}

function AccountCard({ slug, account }: { slug: SocialSlug; account: SocialAccount | undefined }) {
  const qc = useQueryClient();
  const Icon = ICONS[slug];
  const [status, setStatus] = useState<string | null>(null);
  const connected = account?.state === SocialAccountState.Active;
  const refreshList = () => void qc.invalidateQueries({ queryKey: ['social'] });

  const connect = useMutation({
    mutationFn: () => connectInPopup(slug),
    onSuccess: (r) => {
      refreshList();
      if (r === 'connected') toastSuccess(`${slugLabel[slug]} connected`);
      else if (r === 'blocked') setStatus('Your browser blocked the sign-in window. Allow pop-ups for this site and try again.');
      else if (r === 'closed') setStatus(`The ${slugLabel[slug]} window was closed before the account was connected.`);
      else setStatus('Connecting took too long. Try again.');
    },
    onError: (e) => setStatus(connectError(e, slug)),
  });
  const disconnect = useMutation({
    mutationFn: () => socialApi.disconnect(slug),
    onSuccess: () => {
      toastSuccess(`${slugLabel[slug]} disconnected`);
      refreshList();
    },
    onError: (e) => toastError(e),
  });
  const refresh = useMutation({
    mutationFn: () => socialApi.refresh(slug),
    onSuccess: () => {
      toastSuccess('Connection refreshed');
      refreshList();
    },
    onError: (e) => setStatus(`${messageOf(e)} Reconnect the account if this keeps happening.`),
  });

  return (
    <Card padding="md">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Group gap="sm" wrap="nowrap">
          {account?.avatarUrl ? (
            <Avatar src={account.avatarUrl} radius="xl" />
          ) : (
            <Avatar radius="xl" color="forest">
              <Icon size={20} />
            </Avatar>
          )}
          <div>
            <Text fw={600}>{slugLabel[slug]}</Text>
            <Text size="sm" c="dimmed">
              {account ? `@${account.handle}` : 'Not connected'}
              {account?.followerCount != null ? ` · ${formatCompact(account.followerCount)} followers` : ''}
            </Text>
          </div>
        </Group>
        {account && (
          <Badge variant="light" color={socialStateColor[account.state] ?? 'gray'}>
            {labelOf(socialStateLabel, account.state)}
          </Badge>
        )}
      </Group>
      {account?.lastSyncedUtc && (
        <Text size="xs" c="dimmed" mt="xs">
          Last synced {fromNow(account.lastSyncedUtc)}
        </Text>
      )}
      {account?.state === SocialAccountState.RateLimited && account.rateLimitedUntilUtc && (
        <Text size="xs" c="var(--sm-warn-text)" mt={4}>
          {slugLabel[slug]} asked StyleMint to slow down until {formatDateTime(account.rateLimitedUntilUtc)}.
        </Text>
      )}
      {status && (
        <Alert color="amber" variant="light" mt="sm" py={6} withCloseButton onClose={() => setStatus(null)}>
          {status}
        </Alert>
      )}
      <Group mt="md" gap="xs">
        {!connected && (
          <Button size="xs" leftSection={<IconPlugConnected size={14} />} loading={connect.isPending} onClick={() => connect.mutate()}>
            {account ? 'Reconnect' : 'Connect'}
          </Button>
        )}
        {connect.isPending && (
          <Text size="xs" c="dimmed">
            Finish signing in to {slugLabel[slug]} in the window that opened…
          </Text>
        )}
        {account && connected && (
          <Button size="xs" variant="default" leftSection={<IconRefresh size={14} />} loading={refresh.isPending} onClick={() => refresh.mutate()}>
            Refresh
          </Button>
        )}
        {account && (
          <Button
            size="xs"
            variant="subtle"
            color="signal"
            loading={disconnect.isPending}
            onClick={() =>
              void confirmAction({
                title: `Disconnect ${slugLabel[slug]}?`,
                body: 'Reels you already imported stay on StyleMint. You will not be able to pick new ones from this account until you reconnect.',
                confirmLabel: 'Disconnect',
                danger: true,
              }).then((ok) => ok && disconnect.mutate())
            }
          >
            Disconnect
          </Button>
        )}
      </Group>
    </Card>
  );
}

function Audience() {
  const a = useQuery({ queryKey: ['social', 'audience'], queryFn: profileApi.audience, retry: false });
  if (a.isPending) return <ListSkeleton rows={1} height={48} />;
  if (a.error) return <ErrorBlock error={a.error} onRetry={() => void a.refetch()} title="Could not read your audience numbers" />;
  return (
    <Group gap="xl">
      <div>
        <Text size="xs" c="dimmed">
          Followers across accounts
        </Text>
        <Text fw={700} fz="lg">
          {a.data.totalFollowers == null ? '—' : formatCompact(a.data.totalFollowers)}
        </Text>
      </div>
      <div>
        <Text size="xs" c="dimmed">
          Average engagement
        </Text>
        <Text fw={700} fz="lg">
          {formatPercentValue(a.data.averageEngagementRatePercent)}
        </Text>
      </div>
    </Group>
  );
}

export default function SocialAccountsPage() {
  const accounts = useQuery({ queryKey: ['social', 'accounts'], queryFn: socialApi.list });
  return (
    <>
      <PageHeader
        title="Social accounts"
        description="Connect the accounts you post on. StyleMint only reads your posts and numbers — it never posts for you."
      />
      <Stack gap="md">
        {accounts.isPending ? (
          <ListSkeleton rows={2} height={110} />
        ) : accounts.error ? (
          <ErrorBlock error={accounts.error} onRetry={() => void accounts.refetch()} title="Could not load your social accounts" />
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" data-testid="social-accounts">
            {SOCIAL_SLUGS.map((slug) => (
              <AccountCard key={slug} slug={slug} account={accounts.data.find((a) => a.provider === providerOf[slug])} />
            ))}
          </SimpleGrid>
        )}
        <SectionCard title="Your audience" description="Read live from your connected accounts.">
          <Audience />
        </SectionCard>
      </Stack>
    </>
  );
}
