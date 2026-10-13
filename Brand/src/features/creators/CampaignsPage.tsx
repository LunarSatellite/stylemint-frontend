import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useSearchParams } from 'react-router-dom';
import { isMissingEndpoint, messageOf } from '../../api/client';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { SectionCard } from '../../components/SectionCard';
import { StatusBadge } from '../../components/StatusBadge';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatMoney, fromNow } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { useIsPhone } from '../../lib/useIsPhone';
import { ApplicationState, BriefState, creatorsApi, type Brief, type CampaignApplication } from './api';
import { confirmAction, CreatorLine, CREATORS_KEY, DetailSheet, ReasonModal } from './components';
import { applicationStateLook, briefStateLook, campaignGoalLabel, commissionRange, lookOf, toFraction, workspaceStateLook } from './labels';

const goalOptions = Object.entries(campaignGoalLabel).map(([value, label]) => ({ value, label }));

function NewBriefModal({ onClose, onCreated }: { onClose: () => void; onCreated: (b: Brief) => void }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState<string | null>('1');
  const [error, setError] = useState<string | null>(null);
  const create = useMutation({
    mutationFn: () => creatorsApi.draftBrief({ title: title.trim(), primaryGoal: Number(goal), productVariantIds: [] }),
    onSuccess: (b) => {
      toastSuccess('Brief drafted');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'briefs'] });
      onCreated(b);
    },
    onError: (e) => setError(messageOf(e)),
  });
  return (
    <Modal opened onClose={onClose} title="New campaign brief">
      <Stack>
        {error && (
          <Alert color="signal" variant="light" role="alert">
            {error}
          </Alert>
        )}
        <TextInput label="Title" placeholder="e.g. Dashain festive collection" maxLength={200} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <Select label="Goal" data={goalOptions} value={goal} onChange={setGoal} allowDeselect={false} />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={create.isPending} onClick={() => (title.trim() ? create.mutate() : setError('Give the brief a title.'))}>
            Create draft
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function lines(s: string) {
  return s
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

function EditBrief({ b }: { b: Brief }) {
  const qc = useQueryClient();
  const [min, setMin] = useState(Math.round((b.commissionRange?.minPercent ?? 0.1) * 1000) / 10);
  const [max, setMax] = useState(Math.round((b.commissionRange?.maxPercent ?? 0.15) * 1000) / 10);
  const [doSay, setDoSay] = useState((b.body?.doSayPoints ?? []).join('\n'));
  const [dontSay, setDontSay] = useState((b.body?.dontSayPoints ?? []).join('\n'));
  const save = useMutation({
    mutationFn: () =>
      creatorsApi.updateBrief(b.id, {
        commissionRange: { minPercent: toFraction(min), maxPercent: toFraction(max) },
        body: { ...b.body, doSayPoints: lines(doSay), dontSayPoints: lines(dontSay) },
      }),
    onSuccess: () => {
      toastSuccess('Brief saved');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'briefs'] });
    },
    onError: (e) => toastError(e),
  });
  return (
    <Stack gap="sm">
      <SimpleGrid cols={2}>
        <NumberInput label="Lowest commission (%)" min={0} max={100} decimalScale={1} value={min} onChange={(v) => setMin(Number(v) || 0)} />
        <NumberInput label="Highest commission (%)" min={0} max={100} decimalScale={1} value={max} onChange={(v) => setMax(Number(v) || 0)} />
      </SimpleGrid>
      <Textarea label="Creators should say (one per line)" autosize minRows={2} value={doSay} onChange={(e) => setDoSay(e.currentTarget.value)} />
      <Textarea label="Creators must not say (one per line)" autosize minRows={2} value={dontSay} onChange={(e) => setDontSay(e.currentTarget.value)} />
      <Button variant="light" loading={save.isPending} onClick={() => save.mutate()} style={{ alignSelf: 'flex-start' }} disabled={max < min}>
        Save draft
      </Button>
    </Stack>
  );
}

function ApplicationRow({ briefId, a }: { briefId: string; a: CampaignApplication }) {
  const qc = useQueryClient();
  const [declining, setDeclining] = useState(false);
  const accept = useMutation({
    mutationFn: () => creatorsApi.acceptApplication(briefId, a.id),
    onSuccess: () => {
      toastSuccess('Application accepted — a partnership was created');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'applications', briefId] });
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'partnerships'] });
    },
    onError: (e) => toastError(e),
  });
  return (
    <Card withBorder padding="sm" data-testid="application-row">
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap">
          <CreatorLine accountId={a.creatorProfileId} extra={`applied ${fromNow(a.submittedUtc)}`} />
          <StatusBadge {...lookOf(applicationStateLook, a.state)} />
        </Group>
        {a.message && <Text size="sm">{a.message}</Text>}
        {a.declineReason && (
          <Text size="xs" c="dimmed">
            Declined: {a.declineReason}
          </Text>
        )}
        {a.state === ApplicationState.Pending && (
          <Group gap="xs">
            <Button
              size="xs"
              loading={accept.isPending}
              onClick={async () => {
                const ok = await confirmAction({
                  title: 'Accept this creator?',
                  body: 'A partnership starts on this brief’s terms and the creator is notified.',
                  confirmLabel: 'Accept',
                });
                if (ok) accept.mutate();
              }}
            >
              Accept
            </Button>
            <Button size="xs" variant="default" onClick={() => setDeclining(true)}>
              Decline
            </Button>
          </Group>
        )}
      </Stack>
      <ReasonModal
        opened={declining}
        onClose={() => setDeclining(false)}
        title="Decline application"
        intro="The creator is told their application was not accepted."
        required={false}
        label="Reason (optional, the creator sees it)"
        confirmLabel="Decline"
        danger
        onConfirm={async (reason) => {
          await creatorsApi.declineApplication(briefId, a.id, reason || null);
          toastSuccess('Application declined');
          void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'applications', briefId] });
        }}
      />
    </Card>
  );
}

function Applications({ briefId }: { briefId: string }) {
  const q = useQuery({ queryKey: [CREATORS_KEY, 'applications', briefId], queryFn: () => creatorsApi.applications(briefId, undefined, null) });
  if (q.isPending) return <ListSkeleton rows={2} />;
  if (q.error) return <ErrorBlock error={q.error} title="Could not load applications" onRetry={() => void q.refetch()} />;
  const items = [...q.data.items].sort((x, y) => (x.state === 1 ? -1 : 0) - (y.state === 1 ? -1 : 0));
  if (!items.length) return <EmptyBlock title="No applications yet" body="Publish the brief so creators can apply." />;
  return (
    <Stack gap="xs">
      {items.map((a) => (
        <ApplicationRow key={a.id} briefId={briefId} a={a} />
      ))}
    </Stack>
  );
}

function PublishModal({ b, onClose }: { b: Brief; onClose: () => void }) {
  const qc = useQueryClient();
  const [range, setRange] = useState<[Date | null, Date | null]>([new Date(), dayjs().add(14, 'day').toDate()]);
  const publish = useMutation({
    mutationFn: () => creatorsApi.publishBrief(b.id, dayjs(range[0]).startOf('day').toISOString(), dayjs(range[1]).endOf('day').toISOString()),
    onSuccess: () => {
      toastSuccess('Brief published. Creators can apply now.');
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'briefs'] });
      onClose();
    },
    onError: (e) => toastError(e),
  });
  return (
    <Modal opened onClose={onClose} title="Publish to creators" zIndex={400}>
      <Stack>
        <DatePickerInput type="range" label="Applications open" value={range} onChange={setRange} minDate={new Date()} popoverProps={{ zIndex: 500 }} />
        <Text size="xs" c="dimmed">
          Creators on StyleMint can read the brief and apply between these dates.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={publish.isPending} disabled={!range[0] || !range[1]} onClick={() => publish.mutate()}>
            Publish
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function BriefDetail({ b }: { b: Brief }) {
  const qc = useQueryClient();
  const [publishing, setPublishing] = useState(false);
  const act = useMutation({
    mutationFn: (action: 'lock' | 'unpublish' | 'fork' | 'retire') => creatorsApi.briefAction(b.id, action),
    onSuccess: (_d, action) => {
      toastSuccess({ lock: 'Brief locked', unpublish: 'Brief unpublished', fork: 'New draft version created', retire: 'Brief retired' }[action]);
      void qc.invalidateQueries({ queryKey: [CREATORS_KEY, 'briefs'] });
    },
    onError: (e) => toastError(e),
  });
  const ask = async (action: 'lock' | 'unpublish' | 'fork' | 'retire') => {
    const copy = {
      lock: ['Lock this brief?', 'A locked brief cannot be edited. Make a new version to change it later.', 'Lock'],
      unpublish: ['Stop taking applications?', 'Creators can no longer apply. Existing partnerships are not affected.', 'Unpublish'],
      fork: ['Make a new version?', 'A new draft is created from this brief for you to edit.', 'Make new version'],
      retire: ['Retire this brief?', 'It is closed for good. Existing partnerships continue.', 'Retire'],
    }[action];
    if (await confirmAction({ title: copy[0], body: copy[1], confirmLabel: copy[2], danger: action === 'retire' })) act.mutate(action);
  };
  const published = !!b.publishedUtc && b.state === BriefState.Locked;
  return (
    <Stack gap="md" data-testid="brief-detail">
      <Group justify="space-between">
        <Text fw={650}>
          {b.title} <Text span c="dimmed" size="sm">v{b.version}</Text>
        </Text>
        <StatusBadge {...lookOf(briefStateLook, b.state)} />
      </Group>
      <SimpleGrid cols={2} spacing="xs">
        <div>
          <Text size="xs" c="dimmed">
            Goal
          </Text>
          <Text size="sm">{campaignGoalLabel[b.primaryGoal] ?? '—'}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">
            Commission
          </Text>
          <Text size="sm">{commissionRange(b.commissionRange?.minPercent, b.commissionRange?.maxPercent)}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">
            Applications
          </Text>
          <Text size="sm">{published ? `${formatDate(b.applicationsOpenUtc)} – ${formatDate(b.applicationsCloseUtc)}` : 'Not published'}</Text>
        </div>
        <div>
          <Text size="xs" c="dimmed">
            Boost budget
          </Text>
          <Text size="sm">{formatMoney({ amount: b.boostBudgetAmount, currency: b.boostBudgetCurrency })}</Text>
        </div>
      </SimpleGrid>
      {b.state === BriefState.Draft && <EditBrief b={b} />}
      <Group gap="xs">
        {b.state === BriefState.Draft && <Button onClick={() => void ask('lock')}>Lock brief</Button>}
        {b.state === BriefState.Locked && !published && <Button onClick={() => setPublishing(true)}>Publish to creators</Button>}
        {published && (
          <Button variant="default" onClick={() => void ask('unpublish')}>
            Unpublish
          </Button>
        )}
        {b.state !== BriefState.Draft && (
          <Button variant="default" onClick={() => void ask('fork')}>
            New version
          </Button>
        )}
        {b.state !== BriefState.Retired && (
          <Button variant="light" color="signal" onClick={() => void ask('retire')}>
            Retire
          </Button>
        )}
      </Group>
      {b.state !== BriefState.Draft && (
        <>
          <Divider label="Creator applications" labelPosition="left" />
          <Applications briefId={b.id} />
        </>
      )}
      {publishing && <PublishModal b={b} onClose={() => setPublishing(false)} />}
    </Stack>
  );
}

function Workspaces() {
  const q = useQuery({ queryKey: [CREATORS_KEY, 'workspaces'], queryFn: creatorsApi.workspaces, retry: false });
  if (q.isPending) return <ListSkeleton rows={2} />;
  if (q.error)
    return isMissingEndpoint(q.error) ? (
      <EmptyBlock title="Campaign workspaces are not available yet" />
    ) : (
      <ErrorBlock error={q.error} title="Could not load campaigns" onRetry={() => void q.refetch()} />
    );
  if (!q.data.length) return <EmptyBlock title="No campaigns yet" body="Campaigns run a locked brief with a budget across channels." />;
  return (
    <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
      {q.data.map((w) => (
        <Card key={w.id} withBorder padding="sm">
          <Group justify="space-between" wrap="nowrap">
            <Text fw={600} truncate>
              {w.name}
            </Text>
            <StatusBadge {...lookOf(workspaceStateLook, w.state)} />
          </Group>
          <Text size="sm" c="dimmed">
            {formatMoney({ amount: w.spentAmount, currency: w.budgetCurrency })} of {formatMoney({ amount: w.budgetAmount, currency: w.budgetCurrency })} spent
          </Text>
        </Card>
      ))}
    </SimpleGrid>
  );
}

const STATE_FILTERS = [
  { value: 'open', label: 'Open', states: [BriefState.Draft, BriefState.Locked] },
  { value: 'retired', label: 'Retired', states: [BriefState.Retired] },
  { value: 'all', label: 'All', states: undefined },
];

export default function CampaignsPage() {
  const phone = useIsPhone();
  const [params, setParams] = useSearchParams();
  const [filter, setFilter] = useState('open');
  const [creating, setCreating] = useState(false);
  const openId = params.get('brief');
  const def = STATE_FILTERS.find((f) => f.value === filter)!;
  const list = useCursorList({
    key: [CREATORS_KEY, 'briefs', 'page'],
    resetKey: filter,
    fetchPage: (cursor) => creatorsApi.briefs(def.states, cursor),
  });
  const openBrief = useQuery({
    queryKey: [CREATORS_KEY, 'briefs', 'one', openId],
    queryFn: () => creatorsApi.brief(openId!),
    enabled: !!openId,
  });
  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('brief', id);
    else next.delete('brief');
    setParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="Briefs & campaigns"
        description="A brief tells creators what to make and what you pay. Publish it to collect applications, then pick the creators you want."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
            New brief
          </Button>
        }
      />
      <Stack gap="lg">
        <SectionCard title="Briefs">
          <Stack gap="md">
            <SegmentedControl value={filter} onChange={setFilter} data={STATE_FILTERS.map(({ value, label }) => ({ value, label }))} fullWidth={phone} />
            {list.query.isPending ? (
              <ListSkeleton />
            ) : list.query.error ? (
              <ErrorBlock error={list.query.error} title="Could not load briefs" onRetry={() => void list.query.refetch()} />
            ) : !list.query.data.items.length ? (
              <EmptyBlock title="No briefs here" body="Create a brief to invite creators to a campaign." />
            ) : (
              <Stack gap="xs">
                {list.query.data.items.map((b) => (
                  <Card key={b.id} withBorder padding="sm" onClick={() => setOpen(b.id)} style={{ cursor: 'pointer' }} data-testid="brief-row">
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ minWidth: 0 }}>
                        <Text fw={600} truncate>
                          {b.title}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {campaignGoalLabel[b.primaryGoal] ?? ''} · {commissionRange(b.commissionRange?.minPercent, b.commissionRange?.maxPercent)} · v{b.version}
                          {b.publishedUtc && b.state === BriefState.Locked ? ' · taking applications' : ''}
                        </Text>
                      </div>
                      <StatusBadge {...lookOf(briefStateLook, b.state)} />
                    </Group>
                  </Card>
                ))}
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
              </Stack>
            )}
          </Stack>
        </SectionCard>
        <SectionCard title="Campaigns" description="Budgets and results of briefs running as campaigns.">
          <Workspaces />
        </SectionCard>
      </Stack>
      <DetailSheet opened={!!openId} onClose={() => setOpen(null)} title="Brief">
        {openBrief.isPending ? (
          <ListSkeleton rows={3} />
        ) : openBrief.error ? (
          <ErrorBlock error={openBrief.error} title="Could not load this brief" onRetry={() => void openBrief.refetch()} />
        ) : openBrief.data ? (
          <BriefDetail b={openBrief.data} />
        ) : null}
      </DetailSheet>
      {creating && (
        <NewBriefModal
          onClose={() => setCreating(false)}
          onCreated={(b) => {
            setCreating(false);
            setOpen(b.id);
          }}
        />
      )}
    </>
  );
}
