import { useMemo, useState } from 'react';
import {
  Alert,
  Anchor,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  NumberInput,
  SegmentedControl,
  Stack,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconCalendarPlus, IconPlus, IconVideo } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { Link, useSearchParams } from 'react-router-dom';
import { messageOf } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDateTime } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { crmApi, MeetingStatus, meetingStatusColor, meetingStatusLabel, TaskStatus, type MeetingListItem, type TaskDto } from './api';
import { CustomerPicker, RequireCap } from './components';
import { CRM_KEY, usePagedQuery } from './hooks';
import { TaskModal, TaskRow } from './TaskModal';

// ---------------------------------------------------------------- tasks

function TasksTab() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<string>(String(TaskStatus.Open));
  const [open, setOpen] = useState(false);
  const list = usePagedQuery({
    key: ['tasks', 'list'],
    resetKey: status,
    fetchPage: (page, pageSize) => crmApi.tasks({ status: status === 'all' ? null : Number(status), page, pageSize }),
  });
  const complete = useMutation({
    mutationFn: (t: TaskDto) => crmApi.completeTask(t.id),
    onSuccess: () => {
      toastSuccess('Task done');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'tasks'] });
    },
    onError: (e) => toastError(e),
  });
  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <SegmentedControl
          value={status}
          onChange={setStatus}
          aria-label="Filter tasks"
          data={[
            { value: String(TaskStatus.Open), label: 'Open' },
            { value: String(TaskStatus.InProgress), label: 'In progress' },
            { value: String(TaskStatus.Done), label: 'Done' },
            { value: 'all', label: 'All' },
          ]}
        />
        <Button leftSection={<IconPlus size={16} />} onClick={() => setOpen(true)}>
          New task
        </Button>
      </Group>
      {list.query.isPending ? (
        <ListSkeleton rows={4} height={64} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} title="Could not load tasks" onRetry={() => void list.query.refetch()} />
      ) : list.items.length === 0 ? (
        <EmptyBlock title={status === String(TaskStatus.Open) ? 'Nothing to follow up' : 'No tasks here'} body="Tasks you add from a customer or here appear in this list." />
      ) : (
        <Stack gap="xs">
          {list.items.map((t) => (
            <div key={t.id}>
              <TaskRow t={t} onComplete={(x) => complete.mutate(x)} busy={complete.isPending && complete.variables?.id === t.id} />
              {t.subjectKind === 2 && t.subjectId && (
                <Anchor component={Link} to={`/crm/customers/${t.subjectId}`} size="xs" ml="sm">
                  Open customer
                </Anchor>
              )}
            </div>
          ))}
        </Stack>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={list.items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
      <TaskModal opened={open} onClose={() => setOpen(false)} />
    </Stack>
  );
}

// ---------------------------------------------------------------- meetings

function MeetingModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [contactId, setContactId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState('');
  const [when, setWhen] = useState('');
  const [duration, setDuration] = useState<number | string>(30);
  const [joinUrl, setJoinUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const close = () => {
    setContactId(null);
    setTitle('');
    setAgenda('');
    setWhen('');
    setDuration(30);
    setJoinUrl('');
    setError(null);
    onClose();
  };
  const create = useMutation({
    mutationFn: () =>
      crmApi.createMeeting({
        contactId: contactId!,
        title: title.trim(),
        agendaText: agenda.trim() || null,
        joinUrl: joinUrl.trim() || null,
        durationMinutes: Number(duration) || 30,
        scheduledAt: when ? dayjs(when).toISOString() : null,
      }),
    onSuccess: () => {
      toastSuccess('Meeting added');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'meetings'] });
      close();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const valid = !!contactId && !!title.trim() && !!when;
  return (
    <Modal opened={opened} onClose={close} title="New meeting">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) create.mutate();
        }}
      >
        <Stack gap="md">
          {error && (
            <Alert color="signal" variant="light">
              {error}
            </Alert>
          )}
          <Text size="xs" c="dimmed">
            For wholesale buyers or fittings. The meeting is on your calendar; StyleMint does not share your contact details or theirs.
          </Text>
          <CustomerPicker value={contactId} onChange={setContactId} required />
          <TextInput label="Title" required maxLength={300} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
          <Group grow align="flex-start">
            <TextInput label="When" type="datetime-local" required value={when} onChange={(e) => setWhen(e.currentTarget.value)} />
            <NumberInput label="Minutes" min={15} max={480} step={15} value={duration} onChange={setDuration} />
          </Group>
          <TextInput label="Video link (optional)" placeholder="https://meet…" value={joinUrl} onChange={(e) => setJoinUrl(e.currentTarget.value)} />
          <Textarea label="Agenda" autosize minRows={2} maxLength={2000} value={agenda} onChange={(e) => setAgenda(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!valid}>
              Add meeting
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function MeetingCard({ m, onCancel, onDone }: { m: MeetingListItem; onCancel: () => void; onDone: () => void }) {
  const live = m.status !== MeetingStatus.Cancelled && m.status !== MeetingStatus.Completed && m.status !== MeetingStatus.CustomerDeclined;
  return (
    <Card withBorder padding="sm">
      <Stack gap={6}>
        <Group justify="space-between" wrap="nowrap" align="flex-start">
          <Stack gap={2} style={{ minWidth: 0 }}>
            <Text size="sm" fw={600}>
              {m.title}
            </Text>
            <Text size="xs" c="dimmed">
              {m.acceptedSlot ? formatDateTime(m.acceptedSlot) : 'Time not set'} · {m.durationMinutes} min
              {m.contactName ? ' · ' : ''}
              {m.contactName && (
                <Anchor component={Link} to={`/crm/customers/${m.contactId}`} size="xs">
                  {m.contactName}
                </Anchor>
              )}
            </Text>
          </Stack>
          <Badge size="sm" variant="light" color={meetingStatusColor[m.status] ?? 'gray'}>
            {meetingStatusLabel[m.status] ?? '—'}
          </Badge>
        </Group>
        {live && (
          <Group gap="xs">
            {m.joinUrl && /^https:\/\//i.test(m.joinUrl) && (
              <Button size="xs" variant="light" component="a" href={m.joinUrl} target="_blank" rel="noopener noreferrer" leftSection={<IconVideo size={14} />}>
                Join
              </Button>
            )}
            <Button size="xs" variant="default" onClick={onDone}>
              Mark done
            </Button>
            <Button size="xs" variant="subtle" color="signal" onClick={onCancel}>
              Cancel
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

function MeetingsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const list = usePagedQuery({ key: ['meetings', 'list'], fetchPage: (page, pageSize) => crmApi.meetings({ page, pageSize }) });
  const act = useMutation({
    mutationFn: (a: { run: () => Promise<unknown>; done: string }) => a.run().then(() => a.done),
    onSuccess: (done) => {
      toastSuccess(done);
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'meetings'] });
    },
    onError: (e) => toastError(e),
  });
  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button leftSection={<IconCalendarPlus size={16} />} onClick={() => setOpen(true)}>
          New meeting
        </Button>
      </Group>
      {list.query.isPending ? (
        <ListSkeleton rows={3} height={72} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} title="Could not load meetings" onRetry={() => void list.query.refetch()} />
      ) : list.items.length === 0 ? (
        <EmptyBlock title="No meetings" body="Plan calls with wholesale buyers or fittings with regular customers." />
      ) : (
        <Stack gap="xs">
          {list.items.map((m) => (
            <MeetingCard
              key={m.id}
              m={m}
              onDone={() => act.mutate({ run: () => crmApi.completeMeeting(m.id), done: 'Meeting marked done' })}
              onCancel={() =>
                void confirmAction({ title: 'Cancel this meeting?', body: m.title, confirmLabel: 'Cancel meeting', cancelLabel: 'Keep', danger: true }).then(
                  (ok) => ok && act.mutate({ run: () => crmApi.cancelMeeting(m.id, 'Cancelled by the shop'), done: 'Meeting cancelled' }),
                )
              }
            />
          ))}
        </Stack>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={list.items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
      <MeetingModal opened={open} onClose={() => setOpen(false)} />
    </Stack>
  );
}

// ---------------------------------------------------------------- agenda (calendar)

interface AgendaEntry {
  id: string;
  at: string;
  kind: 'task' | 'meeting';
  title: string;
  detail: string;
}

function AgendaTab() {
  const tasks = useQuery({ queryKey: [CRM_KEY, 'tasks', 'agenda'], queryFn: () => crmApi.tasks({ status: TaskStatus.Open, page: 1, pageSize: 100 }) });
  const meetings = useQuery({ queryKey: [CRM_KEY, 'meetings', 'agenda'], queryFn: () => crmApi.meetings({ page: 1, pageSize: 100 }) });
  const days = useMemo(() => {
    const entries: AgendaEntry[] = [];
    for (const t of tasks.data?.items ?? []) if (t.dueDate) entries.push({ id: `t-${t.id}`, at: t.dueDate, kind: 'task', title: t.title, detail: 'Follow-up due' });
    for (const m of meetings.data?.items ?? [])
      if (m.acceptedSlot && m.status !== MeetingStatus.Cancelled)
        entries.push({ id: `m-${m.id}`, at: m.acceptedSlot, kind: 'meeting', title: m.title, detail: `${dayjs(m.acceptedSlot).format('HH:mm')} · ${m.durationMinutes} min` });
    const from = dayjs().startOf('day').subtract(7, 'day');
    const groups = new Map<string, AgendaEntry[]>();
    entries
      .filter((e) => dayjs(e.at).isAfter(from))
      .sort((a, b) => a.at.localeCompare(b.at))
      .forEach((e) => {
        const k = dayjs(e.at).format('YYYY-MM-DD');
        groups.set(k, [...(groups.get(k) ?? []), e]);
      });
    return [...groups.entries()];
  }, [tasks.data, meetings.data]);

  if (tasks.isPending || meetings.isPending) return <ListSkeleton rows={4} height={56} />;
  if (tasks.error || meetings.error)
    return (
      <ErrorBlock
        error={tasks.error ?? meetings.error}
        title="Could not load your calendar"
        onRetry={() => {
          void tasks.refetch();
          void meetings.refetch();
        }}
      />
    );
  if (days.length === 0) return <EmptyBlock title="Your calendar is clear" body="Tasks with a due date and booked meetings show here by day." />;
  const today = dayjs().format('YYYY-MM-DD');
  return (
    <Stack gap="md">
      {days.map(([day, entries]) => (
        <div key={day}>
          <Text size="xs" tt="uppercase" fw={700} c={day === today ? 'forest' : 'dimmed'} mb={6} style={{ letterSpacing: '0.05em' }}>
            {day === today ? 'Today' : dayjs(day).format('ddd D MMM')}
            {day < today ? ' · past' : ''}
          </Text>
          <Stack gap={6}>
            {entries.map((e) => (
              <Card key={e.id} withBorder padding="xs" pl="sm">
                <Group justify="space-between" wrap="nowrap">
                  <Text size="sm" fw={600} truncate>
                    {e.title}
                  </Text>
                  <Badge size="xs" variant="light" color={e.kind === 'meeting' ? 'blue' : 'amber'}>
                    {e.kind === 'meeting' ? 'Meeting' : 'Task'}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed">
                  {e.detail}
                </Text>
              </Card>
            ))}
          </Stack>
        </div>
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------- page

export default function TasksPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') ?? 'tasks';
  return (
    <RequireCap cap="tasks.manage">
      <PageHeader title="Tasks & calendar" description="Follow-ups for your customers and meetings with wholesale buyers." />
      <Tabs value={tab} onChange={(v) => setParams(v && v !== 'tasks' ? { tab: v } : {}, { replace: true })} keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="tasks">Tasks</Tabs.Tab>
          <Tabs.Tab value="meetings">Meetings</Tabs.Tab>
          <Tabs.Tab value="agenda">Calendar</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="tasks">
          <TasksTab />
        </Tabs.Panel>
        <Tabs.Panel value="meetings">
          <MeetingsTab />
        </Tabs.Panel>
        <Tabs.Panel value="agenda">
          <AgendaTab />
        </Tabs.Panel>
      </Tabs>
    </RequireCap>
  );
}
