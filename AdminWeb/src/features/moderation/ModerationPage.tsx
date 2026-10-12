import { useState } from 'react';
import { Alert, Badge, Button, Group, List, Paper, Select, Stack, Text, Textarea } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconAlertTriangle, IconRobot } from '@tabler/icons-react';
import { messageOf } from '@/api/errors';
import {
  actionsFor,
  decideModeration,
  MOD_ACTION,
  MOD_ACTION_TONE,
  MOD_SOURCE,
  MOD_STATE,
  MOD_STATE_TONE,
  moderationApi,
  REPORT_REASON,
  TARGET_KIND,
  type FraudSummary,
  type ModerationItem,
} from '@/api/moderation';
import { useAuth } from '@/auth/guards';
import { FieldGrid, IdText, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';

const options = (m: Record<number, string>) => Object.entries(m).map(([value, label]) => ({ value, label }));

/** Reports about reels, reviews, comments and profiles, oldest first. Decide with an action and a note. */
export function ModerationPage() {
  const list = useListState(['state', 'kind', 'source'] as const, { state: '1' });
  const state = list.filters.state === 'all' ? '' : list.filters.state || '1';
  const query = useQuery({
    queryKey: ['moderation', state, list.filters.kind, list.filters.source, list.page, list.pageSize],
    queryFn: ({ signal }) => moderationApi.queue({ state, targetKind: list.filters.kind, source: list.filters.source, page: list.page, pageSize: list.pageSize }, signal),
    placeholderData: keepPreviousData,
    staleTime: 10_000,
  });
  const columns: Column<ModerationItem>[] = [
    { key: 'kind', header: 'What', render: (m) => <Text size="sm" fw={600}>{TARGET_KIND[m.targetKind] ?? m.targetKind}</Text> },
    { key: 'reason', header: 'Reported for', render: (m) => (m.reportReasonCode ? REPORT_REASON[m.reportReasonCode] ?? m.reportReasonCode : <Text size="sm" c="dimmed">—</Text>) },
    { key: 'source', header: 'Source', visibleFrom: 'md', render: (m) => MOD_SOURCE[m.source] ?? '—' },
    {
      key: 'state',
      header: 'State',
      render: (m) => (
        <Badge variant="light" color={MOD_STATE_TONE[m.state]}>
          {MOD_STATE[m.state]}
        </Badge>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      visibleFrom: 'sm',
      render: (m) =>
        m.action ? (
          <Badge variant="light" color={MOD_ACTION_TONE[m.action]}>
            {MOD_ACTION[m.action]}
          </Badge>
        ) : (
          <Text size="sm" c="dimmed">
            —
          </Text>
        ),
    },
    { key: 'submitted', header: 'Reported', render: (m) => <When value={m.submittedUtc} relative /> },
  ];
  return (
    <>
      <PageHeader title="Moderation" description="Reported and auto-flagged content, oldest first. Hide or remove content; warn, suspend or ban only on profile reports." />
      <DataTable
        label="Moderation queue"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(m) => m.id}
        onRowClick={(m) => list.open(m.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        filtered={list.filtered}
        emptyTitle="Nothing to moderate"
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <Select label="State" w={160} data={[...options(MOD_STATE), { value: 'all', label: 'All states' }]} value={list.filters.state || '1'} onChange={(v) => list.setFilter('state', v === '1' ? null : v)} allowDeselect={false} />
            <Select label="Content" w={180} clearable placeholder="Any" data={options(TARGET_KIND).filter((o) => o.value !== '5')} value={list.filters.kind || null} onChange={(v) => list.setFilter('kind', v)} />
            <Select label="Source" w={180} clearable placeholder="Any" data={options(MOD_SOURCE)} value={list.filters.source || null} onChange={(v) => list.setFilter('source', v)} />
          </Group>
        }
      />
      <ModerationDrawer item={query.data?.items.find((m) => m.id === list.selected) ?? null} id={list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function ModerationDrawer({ item, id, onClose }: { item: ModerationItem | null; id: string | null; onClose: () => void }) {
  const { can, claims } = useAuth();
  const queryClient = useQueryClient();
  const fresh = useQuery({ queryKey: ['moderation', 'item', id], queryFn: ({ signal }) => moderationApi.get(id!, signal), enabled: !!id, initialData: item ?? undefined });
  const m = fresh.data;
  const [action, setAction] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [fraud, setFraud] = useState<FraudSummary | null>(null);

  const decide = useMutation({
    mutationFn: () => decideModeration(m!, claims!.adminAccountId, Number(action), note.trim() || null),
    onSuccess: () => {
      notifications.show({ color: 'forest', title: 'Decision recorded', message: MOD_ACTION[Number(action)] });
      setAction(null);
      setNote('');
      void queryClient.invalidateQueries({ queryKey: ['moderation'] });
    },
  });
  const summarise = useMutation({ mutationFn: () => moderationApi.fraudSummary(m!.targetId), onSuccess: setFraud });

  return (
    <DetailDrawer
      opened={!!id}
      onClose={onClose}
      title={m ? `${TARGET_KIND[m.targetKind]} report` : 'Report'}
      badges={
        m && (
          <Badge variant="light" color={MOD_STATE_TONE[m.state]}>
            {MOD_STATE[m.state]}
          </Badge>
        )
      }
    >
      {m && (
        <Stack gap="lg">
          <SectionCard title="Report">
            <FieldGrid
              fields={[
                { label: 'Content', value: TARGET_KIND[m.targetKind] },
                { label: 'Content ID', value: <IdText value={m.targetId} /> },
                { label: 'Reported for', value: m.reportReasonCode ? REPORT_REASON[m.reportReasonCode] ?? m.reportReasonCode : null },
                { label: 'Source', value: MOD_SOURCE[m.source] },
                { label: 'Reporter', value: <IdText value={m.reporterAccountId} /> },
                { label: 'Reported', value: <When value={m.submittedUtc} /> },
                { label: 'Reviewer', value: m.assignedReviewerId ? (m.assignedReviewerId === claims?.adminAccountId ? 'You' : <IdText value={m.assignedReviewerId} />) : 'Unassigned' },
              ]}
            />
          </SectionCard>
          {m.state === 3 ? (
            <SectionCard title="Decision">
              <FieldGrid
                fields={[
                  { label: 'Action', value: m.action ? MOD_ACTION[m.action] : null },
                  { label: 'Decided', value: <When value={m.decidedUtc} /> },
                  { label: 'Note', value: m.decisionNote, wide: true },
                ]}
              />
              <Text size="xs" c="dimmed" mt="sm">
                The decision is recorded; the content or account change is applied by the owning service and may fail separately.
              </Text>
            </SectionCard>
          ) : can('decideModeration') ? (
            <Paper withBorder p="md" radius="lg">
              <Stack gap="sm">
                <Text fw={650}>Decide</Text>
                <Select
                  label="Action"
                  required
                  data={actionsFor(m.targetKind).map((a) => ({ value: String(a), label: MOD_ACTION[a]! }))}
                  value={action}
                  onChange={setAction}
                  description={m.targetKind !== 4 ? 'Account actions (warn, suspend, ban) are available on profile reports only.' : undefined}
                  comboboxProps={{ withinPortal: true }}
                />
                <Textarea label="Note (kept in the audit log)" autosize minRows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
                {decide.error && (
                  <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
                    {messageOf(decide.error)}
                  </Alert>
                )}
                <Group justify="flex-end">
                  <Button
                    color={action && Number(action) >= 3 ? 'signal' : undefined}
                    disabled={!action}
                    loading={decide.isPending}
                    onClick={() => decide.mutate()}
                  >
                    {action ? `Confirm: ${MOD_ACTION[Number(action)]}` : 'Choose an action'}
                  </Button>
                </Group>
              </Stack>
            </Paper>
          ) : null}
          {can('decideModeration') && m.targetKind === 4 && (
            <SectionCard
              title="Fraud signals"
              description="An AI summary of this account’s refunds and orders. A prompt for judgement, not evidence."
              action={
                <Button size="xs" variant="light" leftSection={<IconRobot size={14} />} loading={summarise.isPending} onClick={() => summarise.mutate()}>
                  Summarise
                </Button>
              }
            >
              {summarise.error ? (
                <Text size="sm" c="signal">
                  {messageOf(summarise.error)}
                </Text>
              ) : fraud ? (
                <Stack gap="xs">
                  <Group gap="sm">
                    <Badge color={fraud.totalRiskScore >= 60 ? 'signal' : fraud.totalRiskScore >= 30 ? 'amber' : 'forest'}>Risk {Math.round(fraud.totalRiskScore)}</Badge>
                    <Badge variant="outline">{fraud.recommendedAction.replace(/_/g, ' ')}</Badge>
                  </Group>
                  <Text size="sm">{fraud.summary}</Text>
                  {fraud.redFlags.length > 0 && (
                    <List size="sm">
                      {fraud.redFlags.map((f) => (
                        <List.Item key={f}>{f.replace(/_/g, ' ')}</List.Item>
                      ))}
                    </List>
                  )}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed">
                  Not run yet.
                </Text>
              )}
            </SectionCard>
          )}
        </Stack>
      )}
    </DetailDrawer>
  );
}
