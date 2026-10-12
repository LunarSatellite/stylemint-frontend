import { Anchor, Badge, Button, Group, Menu, Tabs, Text } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconChevronDown, IconLinkOff, IconMessageReport, IconSparkles } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { contentApi, POST_REPORT_REASON, POST_REPORT_STATE, REEL_PLATFORM, REEL_STATE, type FailingReelLink, type PostReport, type RecipeDraft } from '@/api/catalog';
import { toPage } from '@/api/paging';
import { useActionDialog } from '@/components/ActionDialog';
import { IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';
import { useListState } from '@/hooks/useListState';

/** Content queues that are not the general moderation queue: social-feed post reports, broken reel links, AI recipe drafts. */
export function ContentPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'reports';
  return (
    <>
      <PageHeader title="Reels & content" description="Post reports, reels whose source link has broken, and recipes a model drafted that need a person’s sign-off." />
      <Tabs value={tab} onChange={(v) => v && setParams(new URLSearchParams({ tab: v }), { replace: true })} keepMounted={false} variant="outline">
        <Tabs.List mb="md">
          <Tabs.Tab value="reports" leftSection={<IconMessageReport size={16} />}>
            Post reports
          </Tabs.Tab>
          <Tabs.Tab value="links" leftSection={<IconLinkOff size={16} />}>
            Broken reel links
          </Tabs.Tab>
          <Tabs.Tab value="recipes" leftSection={<IconSparkles size={16} />}>
            Recipe drafts
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="reports">
          <PostReports />
        </Tabs.Panel>
        <Tabs.Panel value="links">
          <BrokenLinks />
        </Tabs.Panel>
        <Tabs.Panel value="recipes">
          <RecipeDrafts />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

function PostReports() {
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const q = useQuery({ queryKey: ['content', 'reports'], queryFn: ({ signal }) => contentApi.postReports(200, signal) });
  const done = () => void queryClient.invalidateQueries({ queryKey: ['content', 'reports'] });
  const reasonField = { name: 'reason', kind: 'textarea' as const, label: 'Reason (kept with the decision)', required: true, minLength: 5 };
  const columns: Column<PostReport>[] = [
    { key: 'reason', header: 'Reported for', render: (r) => <TwoLine primary={POST_REPORT_REASON[r.reason] ?? r.reason} secondary={r.context} /> },
    { key: 'post', header: 'Post', render: (r) => <IdText value={r.postId} /> },
    { key: 'state', header: 'State', render: (r) => <Badge variant="light" color="amber">{POST_REPORT_STATE[r.state]}</Badge> },
    { key: 'when', header: 'Reported', visibleFrom: 'sm', render: (r) => <When value={r.createdUtc} relative /> },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (r) => (
        <Menu position="bottom-end">
          <Menu.Target>
            <Button size="compact-sm" variant="default" rightSection={<IconChevronDown size={12} />} onClick={(e) => e.stopPropagation()}>
              Act
            </Button>
          </Menu.Target>
          <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
            <Menu.Label>The post</Menu.Label>
            <Menu.Item onClick={() => open({ title: 'Hide the post', consequence: 'Hidden from feeds; the author still sees it.', confirmLabel: 'Hide post', fields: [reasonField], run: (v) => contentApi.hidePost(r.postId, v.reason!.trim()), success: 'Post hidden.', onDone: done })}>
              Hide post…
            </Menu.Item>
            <Menu.Item color="signal" onClick={() => open({ title: 'Remove the post', consequence: 'Removed for everyone. It can be restored later.', confirmLabel: 'Remove post', danger: true, fields: [reasonField], run: (v) => contentApi.removePost(r.postId, v.reason!.trim()), success: 'Post removed.', onDone: done })}>
              Remove post…
            </Menu.Item>
            <Menu.Item onClick={() => open({ title: 'Restore the post', consequence: 'A removed post is published again. A hidden post stays hidden.', confirmLabel: 'Restore', run: () => contentApi.restorePost(r.postId), success: 'Post restored.', onDone: done })}>
              Restore post
            </Menu.Item>
            <Menu.Divider />
            <Menu.Label>The report</Menu.Label>
            {[
              [3, 'Close as actioned'],
              [4, 'Dismiss'],
              [5, 'Close as duplicate'],
            ].map(([terminal, label]) => (
              <Menu.Item
                key={terminal}
                onClick={() =>
                  open({
                    title: String(label),
                    consequence: 'Closes this report. Act on the post first if it needs it - closing the report does not touch the post.',
                    confirmLabel: String(label),
                    fields: [reasonField],
                    run: (v) => contentApi.resolveReport(r.id, Number(terminal), v.reason!.trim()),
                    success: 'Report closed.',
                    onDone: done,
                  })
                }
              >
                {label}…
              </Menu.Item>
            ))}
          </Menu.Dropdown>
        </Menu>
      ),
    },
  ];
  return (
    <>
      {dialog}
      <DataTable label="Post reports" columns={columns} page={q.data ? toPage(q.data, 1, 1000) : undefined} isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()} rowKey={(r) => r.id} emptyTitle="No open reports" />
    </>
  );
}

function BrokenLinks() {
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const q = useQuery({ queryKey: ['content', 'links'], queryFn: ({ signal }) => contentApi.failingReelLinks(200, signal) });
  const columns: Column<FailingReelLink>[] = [
    {
      key: 'source',
      header: 'Source',
      render: (l) => (
        <TwoLine
          primary={REEL_PLATFORM[l.sourcePlatform] ?? 'Source'}
          secondary={
            /^https:\/\//i.test(l.sourceUrl) ? (
              <Anchor href={l.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" size="xs">
                {l.sourceUrl}
              </Anchor>
            ) : (
              l.sourceUrl
            )
          }
        />
      ),
    },
    { key: 'state', header: 'Reel', render: (l) => REEL_STATE[l.reelState] ?? l.reelState },
    { key: 'fails', header: 'Failures', align: 'right', render: (l) => <Badge color={l.consecutiveFailures > 5 ? 'signal' : 'amber'}>{l.consecutiveFailures}</Badge> },
    { key: 'detail', header: 'Last error', visibleFrom: 'md', render: (l) => <Text size="xs" lineClamp={2}>{l.lastDetail ?? '—'}</Text> },
    { key: 'checked', header: 'Checked', visibleFrom: 'sm', render: (l) => <When value={l.lastCheckedUtc} relative /> },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (l) =>
        l.reelState !== 5 && (
          <Button
            size="compact-sm"
            variant="default"
            onClick={(e) => {
              e.stopPropagation();
              open({
                title: 'Mark the reel as deleted on its source',
                consequence: 'The reel stops showing on StyleMint because its original was deleted on the platform.',
                confirmLabel: 'Mark deleted',
                danger: true,
                run: () => contentApi.markReelExternalDeleted(l.reelId),
                success: 'Reel marked as deleted at source.',
                onDone: () => void queryClient.invalidateQueries({ queryKey: ['content', 'links'] }),
              });
            }}
          >
            Mark deleted
          </Button>
        ),
    },
  ];
  return (
    <>
      {dialog}
      <DataTable label="Broken reel links" columns={columns} page={q.data ? toPage(q.data, 1, 1000) : undefined} isLoading={q.isLoading} error={q.error} onRetry={() => void q.refetch()} rowKey={(l) => l.reelId} emptyTitle="Every reel link works" />
    </>
  );
}

function RecipeDrafts() {
  const list = useListState([] as const, { pageSize: 25 });
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const take = Math.min(100, list.pageSize);
  const q = useQuery({ queryKey: ['content', 'recipes', list.page, take], queryFn: ({ signal }) => contentApi.recipeDrafts((list.page - 1) * take, take, signal) });
  const done = () => void queryClient.invalidateQueries({ queryKey: ['content', 'recipes'] });
  const columns: Column<RecipeDraft>[] = [
    { key: 'title', header: 'Recipe', render: (r) => <TwoLine primary={r.title} secondary={`${r.segment.songTitle} - ${r.segment.artist}`} /> },
    { key: 'mood', header: 'Mood', visibleFrom: 'sm', render: (r) => r.context.moodLabel },
    { key: 'why', header: 'Why the model chose it', visibleFrom: 'md', render: (r) => <Text size="xs" lineClamp={2}>{r.reasoning.headlineRationale}</Text> },
    { key: 'when', header: 'Drafted', visibleFrom: 'lg', render: (r) => <When value={r.createdUtc} relative /> },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (r) => (
        <Group gap={6} justify="flex-end" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
          <Button size="compact-sm" onClick={() => open({ title: `Promote “${r.title}”`, consequence: 'It becomes a curated recipe creators can use.', confirmLabel: 'Promote', run: () => contentApi.promoteRecipe(r.id), success: 'Recipe promoted.', onDone: done })}>
            Promote
          </Button>
          <Button
            size="compact-sm"
            variant="light"
            color="signal"
            onClick={() =>
              open({
                title: `Hide “${r.title}”`,
                consequence: 'Nobody will be offered this recipe.',
                confirmLabel: 'Hide recipe',
                danger: true,
                fields: [{ name: 'reason', kind: 'textarea', label: 'Reason', required: true, minLength: 5 }],
                run: (v) => contentApi.hideRecipe(r.id, v.reason!.trim()),
                success: 'Recipe hidden.',
                onDone: done,
              })
            }
          >
            Hide
          </Button>
        </Group>
      ),
    },
  ];
  return (
    <>
      {dialog}
      <DataTable
        label="Recipe drafts"
        columns={columns}
        page={q.data ? toPage(q.data, list.page, take) : undefined}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(r) => r.id}
        onPageChange={list.setPage}
        pagerMode="cursor"
        emptyTitle="No drafts waiting"
      />
    </>
  );
}
