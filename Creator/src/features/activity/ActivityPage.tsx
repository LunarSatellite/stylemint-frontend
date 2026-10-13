import { useState } from 'react';
import { Badge, Button, Card, Chip, Group, Indicator, Stack, Tabs, Text, UnstyledButton } from '@mantine/core';
import { IconChecks } from '@tabler/icons-react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDateTime, fromNow, labelOf } from '../../lib/format';
import { toastError } from '../../lib/notify';
import { useTab } from '../../lib/useTab';
import { ACTIVITY_FILTERS, activityApi, activityKindLabel, describeNotification, type InboxItem } from './api';

const PAGE = 30;

function Inbox() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const inbox = useInfiniteQuery({
    queryKey: ['inbox', 'list'],
    queryFn: ({ pageParam }) => activityApi.inbox(pageParam, PAGE),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => (last.length === PAGE ? last[last.length - 1].queuedUtc : null),
  });
  const refresh = () => void qc.invalidateQueries({ queryKey: ['inbox'] });
  const read = useMutation({ mutationFn: (id: string) => activityApi.markRead(id), onSuccess: refresh });
  const readAll = useMutation({ mutationFn: activityApi.markAllRead, onSuccess: refresh, onError: (e) => toastError(e) });

  if (inbox.isPending) return <ListSkeleton rows={4} height={52} />;
  if (inbox.error) return <ErrorBlock error={inbox.error} onRetry={() => void inbox.refetch()} title="Could not load your notifications" />;
  const items = inbox.data.pages.flat();
  if (items.length === 0) return <EmptyBlock title="No notifications yet" body="Invites, payouts, tips and reports show up here." />;
  const open = (item: InboxItem) => {
    if (!item.readUtc) read.mutate(item.id);
    const to = describeNotification(item).to;
    if (to) navigate(to);
  };
  return (
    <Stack gap="xs">
      <Group justify="flex-end">
        <Button size="xs" variant="subtle" leftSection={<IconChecks size={14} />} loading={readAll.isPending} onClick={() => readAll.mutate()} disabled={!items.some((i) => !i.readUtc)}>
          Mark all as read
        </Button>
      </Group>
      {items.map((item) => {
        const d = describeNotification(item);
        return (
          <UnstyledButton key={item.id} onClick={() => open(item)} style={{ display: 'block', width: '100%' }}>
            <Card padding="sm" withBorder data-interactive="true" style={{ background: item.readUtc ? undefined : 'var(--sm-active-bg)' }}>
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Indicator disabled={!!item.readUtc} color="forest" size={8} position="middle-start" offset={-10}>
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={item.readUtc ? 500 : 700}>
                      {d.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {d.body}
                    </Text>
                  </div>
                </Indicator>
                <Text size="xs" c="dimmed" style={{ flexShrink: 0 }} title={formatDateTime(item.queuedUtc)}>
                  {fromNow(item.queuedUtc)}
                </Text>
              </Group>
            </Card>
          </UnstyledButton>
        );
      })}
      {inbox.hasNextPage && (
        <Group justify="center">
          <Button variant="default" size="xs" loading={inbox.isFetchingNextPage} onClick={() => void inbox.fetchNextPage()}>
            Older notifications
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function Feed() {
  const [filter, setFilter] = useState('all');
  const kinds = ACTIVITY_FILTERS.find((f) => f.value === filter)?.kinds ?? null;
  const list = useCursorList({ key: ['activity', 'feed'], resetKey: filter, fetchPage: (c) => activityApi.activity(c, kinds) });
  const items = list.query.data?.items ?? [];
  return (
    <Stack gap="sm">
      <Chip.Group value={filter} onChange={(v) => setFilter(String(v))}>
        <Group gap="xs">
          {ACTIVITY_FILTERS.map((f) => (
            <Chip key={f.value} value={f.value} size="sm">
              {f.label}
            </Chip>
          ))}
        </Group>
      </Chip.Group>
      {list.query.isPending ? (
        <ListSkeleton rows={4} height={44} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load your activity" />
      ) : items.length === 0 ? (
        <EmptyBlock title="Nothing here yet" />
      ) : (
        <Stack gap={0}>
          {items.map((a) => (
            <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--sm-row-line)' }}>
              <Group gap={6}>
                <Badge size="xs" variant="light">
                  {labelOf(activityKindLabel, a.kind)}
                </Badge>
                <Text size="xs" c="dimmed">
                  {formatDateTime(a.occurredUtc)}
                </Text>
              </Group>
              <Text size="sm" fw={600} mt={2}>
                {a.headline}
              </Text>
              {a.body && (
                <Text size="sm" c="dimmed">
                  {a.body}
                </Text>
              )}
            </div>
          ))}
        </Stack>
      )}
      {/* totalCount ignores the filter on the server, so it is not shown. */}
      <Pager page={list.page} pageSize={list.pageSize} total={null} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
    </Stack>
  );
}

export default function ActivityPage() {
  const [tab, setTab] = useTab(['notifications', 'activity'] as const, 'notifications');
  return (
    <>
      <PageHeader title="Activity" description="Notifications and a history of what happened on your account." />
      <Card>
        <Tabs value={tab} onChange={setTab}>
          <Tabs.List mb="md">
            <Tabs.Tab value="notifications">Notifications</Tabs.Tab>
            <Tabs.Tab value="activity">History</Tabs.Tab>
          </Tabs.List>
          {tab === 'notifications' ? <Inbox /> : <Feed />}
        </Tabs>
      </Card>
    </>
  );
}
