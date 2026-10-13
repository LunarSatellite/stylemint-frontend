import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Group,
  List,
  SimpleGrid,
  Stack,
  Tabs,
  TagsInput,
  Text,
  Textarea,
  Timeline,
  Tooltip,
} from '@mantine/core';
import { IconBulb, IconPlus, IconSend, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { messageOf } from '../../api/client';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatDateTime, formatMoney, formatNumber, fromNow } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import {
  activityEntry,
  CommentableKind,
  crmApi,
  dealStatusColor,
  dealStatusLabel,
  feedbackTypeColor,
  feedbackTypeLabel,
  npsClassColor,
  npsClassLabel,
  parseTags,
  signalEntry,
  type Customer,
  type TimelineEntry,
  type TaskDto,
} from './api';
import { ConsentBadge, IfCan, PrivacyNote, RequireCap } from './components';
import { CRM_KEY, useCan, useClientPage } from './hooks';
import { TaskModal, TaskRow } from './TaskModal';

// ---------------------------------------------------------------- timeline

function TimelineTab({ id }: { id: string }) {
  const events = useQuery({ queryKey: [CRM_KEY, 'customer', id, 'activity'], queryFn: () => crmApi.activity('Contact', id, 1, 100) });
  const timeline = useQuery({ queryKey: [CRM_KEY, 'customer', id, 'timeline'], queryFn: () => crmApi.customerTimeline(id) });
  const merged = useMemo(() => {
    const out: TimelineEntry[] = [...(events.data?.items ?? []).map(activityEntry), ...(timeline.data?.signals ?? []).map(signalEntry)];
    return out.sort((x, y) => y.at.localeCompare(x.at));
  }, [events.data, timeline.data]);
  const paging = useClientPage(merged, 20);
  if (events.isPending || timeline.isPending) return <ListSkeleton rows={4} height={44} />;
  if (events.error && timeline.error)
    return (
      <ErrorBlock
        error={timeline.error}
        title="Could not load the timeline"
        onRetry={() => {
          void events.refetch();
          void timeline.refetch();
        }}
      />
    );
  const partial = !!(events.error || timeline.error);
  return (
    <Stack gap="sm">
      {partial && (
        <Alert color="amber" variant="light" p="xs">
          <Text size="xs">Part of this customer’s history could not be loaded. What is shown may be incomplete.</Text>
        </Alert>
      )}
      {merged.length === 0 ? (
        <EmptyBlock title="Nothing on the timeline yet" body="Orders, returns, reviews and questions appear here as they happen." />
      ) : (
        <>
          <Timeline bulletSize={14} lineWidth={2} active={-1}>
            {paging.items.map((e) => (
              <Timeline.Item
                key={e.id}
                color={e.color}
                title={
                  <Group gap="xs" wrap="wrap">
                    <Badge size="xs" variant="light" color={e.color}>
                      {e.label}
                    </Badge>
                    <Text size="xs" c="dimmed">
                      {formatDateTime(e.at)}
                    </Text>
                  </Group>
                }
              >
                {e.summary && (
                  <Text size="sm" mt={4}>
                    {e.summary}
                  </Text>
                )}
              </Timeline.Item>
            ))}
          </Timeline>
          <Pager page={paging.page} pageSize={paging.pageSize} total={paging.total} shown={paging.items.length} hasPrev={paging.hasPrev} hasNext={paging.hasNext} onPrev={paging.prev} onNext={paging.next} />
        </>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------- notes

function NotesTab({ id }: { id: string }) {
  const qc = useQueryClient();
  const canEdit = useCan('customers.edit');
  const canDelete = useCan('records.delete');
  const [text, setText] = useState('');
  const key = [CRM_KEY, 'customer', id, 'notes'];
  const notes = useQuery({ queryKey: key, queryFn: () => crmApi.notes(CommentableKind.Contact, id) });
  const add = useMutation({
    mutationFn: () => crmApi.addNote(CommentableKind.Contact, id, text.trim()),
    onSuccess: () => {
      setText('');
      toastSuccess('Note saved');
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toastError(e, 'Could not save the note'),
  });
  const remove = useMutation({
    mutationFn: (noteId: string) => crmApi.deleteNote(noteId),
    onSuccess: () => {
      toastSuccess('Note deleted');
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (e) => toastError(e),
  });
  const items = [...(notes.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <Stack gap="md">
      {canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) add.mutate();
          }}
        >
          <Stack gap="xs">
            <Textarea
              label="Add a private note"
              description="Only your team sees notes. Do not paste phone numbers or emails."
              autosize
              minRows={2}
              maxLength={4000}
              value={text}
              onChange={(e) => setText(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button type="submit" size="xs" loading={add.isPending} disabled={!text.trim()}>
                Save note
              </Button>
            </Group>
          </Stack>
        </form>
      )}
      {notes.isPending ? (
        <ListSkeleton rows={3} height={60} />
      ) : notes.error ? (
        <ErrorBlock error={notes.error} title="Could not load notes" onRetry={() => void notes.refetch()} />
      ) : items.length === 0 ? (
        <EmptyBlock title="No notes yet" body="Keep sizes, preferences or promises here for your team." />
      ) : (
        <Stack gap="xs">
          {items.map((n) => (
            <Card key={n.id} withBorder padding="sm">
              <Group justify="space-between" align="flex-start" wrap="nowrap">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text size="sm" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {n.content}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {n.authorName ? `${n.authorName} · ` : ''}
                    {fromNow(n.createdAt)}
                    {n.editedAt ? ' · edited' : ''}
                  </Text>
                </Stack>
                {canDelete && (
                  <Tooltip label="Delete note">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label="Delete note"
                      onClick={() =>
                        void confirmAction({ title: 'Delete this note?', body: 'Your team will no longer see it.', confirmLabel: 'Delete', danger: true }).then(
                          (ok) => ok && remove.mutate(n.id),
                        )
                      }
                    >
                      <IconTrash size={15} />
                    </ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------- tasks

function TasksTab({ customer }: { customer: Customer }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const tasks = useQuery({ queryKey: [CRM_KEY, 'tasks', 'customer', customer.id], queryFn: () => crmApi.tasksFor('Contact', customer.id) });
  const complete = useMutation({
    mutationFn: (t: TaskDto) => crmApi.completeTask(t.id),
    onSuccess: () => {
      toastSuccess('Task done');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'tasks'] });
    },
    onError: (e) => toastError(e),
  });
  const items = (tasks.data ?? []).filter((t) => t.status !== 4);
  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setOpen(true)}>
          Add follow-up
        </Button>
      </Group>
      {tasks.isPending ? (
        <ListSkeleton rows={3} height={56} />
      ) : tasks.error ? (
        <ErrorBlock error={tasks.error} title="Could not load tasks" onRetry={() => void tasks.refetch()} />
      ) : items.length === 0 ? (
        <EmptyBlock title="No follow-ups" body="Add a task to remember to check in, send a size chart or thank them for a review." />
      ) : (
        <Stack gap="xs">
          {items.map((t) => (
            <TaskRow key={t.id} t={t} onComplete={(x) => complete.mutate(x)} busy={complete.isPending && complete.variables?.id === t.id} />
          ))}
        </Stack>
      )}
      <TaskModal opened={open} onClose={() => setOpen(false)} customer={{ id: customer.id, name: customer.name }} />
    </Stack>
  );
}

// ---------------------------------------------------------------- feedback

function FeedbackTab({ customer }: { customer: Customer }) {
  const qc = useQueryClient();
  const nps = useQuery({ queryKey: [CRM_KEY, 'customer', customer.id, 'nps'], queryFn: () => crmApi.npsForCustomer(customer.id) });
  const feedback = useQuery({ queryKey: [CRM_KEY, 'customer', customer.id, 'feedback'], queryFn: () => crmApi.feedbackForCustomer(customer.id) });
  const send = useMutation({
    mutationFn: () => crmApi.sendNps(customer.id),
    onSuccess: () => {
      toastSuccess('Survey sent through StyleMint');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'customer', customer.id, 'nps'] });
    },
    onError: (e) => toastError(e, 'Could not send the survey'),
  });
  return (
    <Stack gap="md">
      <IfCan cap="feedback.send">
        <Group justify="space-between" wrap="wrap" gap="xs">
          <Text size="sm" c="dimmed">
            {customer.marketingConsent === true
              ? 'Ask how likely they are to recommend your shop (0–10).'
              : 'Surveys go only to buyers who agreed to hear from shops.'}
          </Text>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconSend size={14} />}
            disabled={customer.marketingConsent !== true}
            loading={send.isPending}
            onClick={() =>
              void confirmAction({
                title: 'Send a rating survey?',
                body: `${customer.name} gets a short StyleMint survey asking how likely they are to recommend your shop.`,
                confirmLabel: 'Send survey',
              }).then((ok) => ok && send.mutate())
            }
          >
            Send NPS survey
          </Button>
        </Group>
      </IfCan>
      <SectionCard title="Ratings (NPS)">
        {nps.isPending ? (
          <ListSkeleton rows={2} height={40} />
        ) : nps.error ? (
          <ErrorBlock error={nps.error} title="Could not load ratings" onRetry={() => void nps.refetch()} />
        ) : (nps.data ?? []).length === 0 ? (
          <EmptyBlock title="No surveys yet" />
        ) : (
          <Stack gap="xs">
            {(nps.data ?? []).map((s) => (
              <Group key={s.id} justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text size="sm">{s.comment ? `“${s.comment}”` : s.respondedAt ? 'No comment' : 'Waiting for an answer'}</Text>
                  <Text size="xs" c="dimmed">
                    {s.respondedAt ? `Answered ${fromNow(s.respondedAt)}` : s.sentAt ? `Sent ${fromNow(s.sentAt)}` : formatDate(s.createdAt)}
                  </Text>
                </Stack>
                {s.score !== null && (
                  <Badge color={npsClassColor[s.classification ?? 0] ?? 'gray'} variant="light" size="lg">
                    {s.score}/10 {s.classification ? `· ${npsClassLabel[s.classification]}` : ''}
                  </Badge>
                )}
              </Group>
            ))}
          </Stack>
        )}
      </SectionCard>
      <SectionCard title="What they said">
        {feedback.isPending ? (
          <ListSkeleton rows={2} height={40} />
        ) : feedback.error ? (
          <ErrorBlock error={feedback.error} title="Could not load feedback" onRetry={() => void feedback.refetch()} />
        ) : (feedback.data ?? []).length === 0 ? (
          <EmptyBlock title="No feedback picked up yet" body="Themes from reviews, questions and survey comments show up here." />
        ) : (
          <Stack gap="xs">
            {(feedback.data ?? []).map((f) => (
              <Stack key={f.id} gap={2}>
                <Group gap="xs">
                  <Badge size="xs" variant="light" color={feedbackTypeColor[f.feedbackType] ?? 'gray'}>
                    {feedbackTypeLabel[f.feedbackType] ?? 'Feedback'}
                  </Badge>
                  {f.topicTag && (
                    <Text size="xs" c="dimmed">
                      {f.topicTag}
                    </Text>
                  )}
                </Group>
                <Text size="sm">“{f.quoteText}”</Text>
              </Stack>
            ))}
          </Stack>
        )}
      </SectionCard>
    </Stack>
  );
}

// ---------------------------------------------------------------- deals

function DealsTab({ id }: { id: string }) {
  const timeline = useQuery({ queryKey: [CRM_KEY, 'customer', id, 'timeline'], queryFn: () => crmApi.customerTimeline(id) });
  if (timeline.isPending) return <ListSkeleton rows={2} height={52} />;
  if (timeline.error) return <ErrorBlock error={timeline.error} title="Could not load deals" onRetry={() => void timeline.refetch()} />;
  const deals = timeline.data?.deals ?? [];
  if (deals.length === 0) return <EmptyBlock title="No wholesale deals" body="Bulk or wholesale orders you track under Deals & quotes show here." />;
  return (
    <Stack gap="xs">
      {deals.map((d) => (
        <Card key={d.dealId} withBorder padding="sm">
          <Group justify="space-between" wrap="nowrap">
            <Stack gap={2}>
              <Text size="sm" fw={600}>
                {d.dealName}
              </Text>
              <Text size="xs" c="dimmed">
                {d.stageName ?? '—'}
                {d.closeDate ? ` · closes ${formatDate(d.closeDate)}` : ''}
              </Text>
            </Stack>
            <Stack gap={2} align="flex-end">
              <Text size="sm" fw={600}>
                {d.amount !== null ? formatMoney({ amount: d.amount, currency: d.currency ?? 'NPR' }) : '—'}
              </Text>
              <Badge size="xs" variant="light" color={dealStatusColor[d.status] ?? 'gray'}>
                {dealStatusLabel[d.status] ?? '—'}
              </Badge>
            </Stack>
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------- tags

function TagsEditor({ id, tags }: { id: string; tags: string[] }) {
  const qc = useQueryClient();
  const canEdit = useCan('customers.edit');
  const [value, setValue] = useState<string[]>(tags);
  const [error, setError] = useState<string | null>(null);
  const dirty = value.join('|') !== tags.join('|');
  const save = useMutation({
    mutationFn: () => crmApi.updateCustomerTags(id, value),
    onSuccess: () => {
      toastSuccess('Tags saved');
      setError(null);
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'customer', id] });
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'customers'] });
    },
    onError: (e) => setError(messageOf(e)),
  });
  if (!canEdit)
    return tags.length ? (
      <Group gap={6}>
        {tags.map((t) => (
          <Badge key={t} variant="outline" color="slate">
            {t}
          </Badge>
        ))}
      </Group>
    ) : (
      <Text size="sm" c="dimmed">
        No tags
      </Text>
    );
  return (
    <Stack gap="xs">
      <TagsInput
        aria-label="Customer tags"
        placeholder="Add a tag, e.g. VIP, wholesale, size M"
        value={value}
        onChange={setValue}
        maxTags={20}
        clearable
      />
      {error && (
        <Text size="xs" c="signal">
          {error}
        </Text>
      )}
      {dirty && (
        <Group justify="flex-end" gap="xs">
          <Button size="xs" variant="default" onClick={() => setValue(tags)}>
            Undo
          </Button>
          <Button size="xs" loading={save.isPending} onClick={() => save.mutate()}>
            Save tags
          </Button>
        </Group>
      )}
    </Stack>
  );
}

// ---------------------------------------------------------------- page

function churnOf(predictions: { kind: number; probability: number; probabilityLabel: string }[]) {
  const p = predictions.find((x) => x.kind === 2) ?? predictions.find((x) => x.kind === 3);
  return p ?? null;
}

function Profile() {
  const { id = '' } = useParams();
  const customer = useQuery({ queryKey: [CRM_KEY, 'customer', id, 'seller'], queryFn: () => crmApi.sellerCustomer(id), enabled: !!id });
  // Tags live on the CRM contact; predictions / AI summary / open tasks on its profile. Both are extras.
  const contact = useQuery({ queryKey: [CRM_KEY, 'customer', id, 'contact'], queryFn: () => crmApi.contact(id), enabled: !!id });
  const profile = useQuery({ queryKey: [CRM_KEY, 'customer', id, 'profile'], queryFn: () => crmApi.customerProfile(id), enabled: !!id, retry: false });
  const [tab, setTab] = useState<string | null>('timeline');

  if (customer.isPending)
    return (
      <>
        <PageHeader title="Customer" back={{ to: '/crm/customers', label: 'Customers' }} />
        <ListSkeleton rows={4} height={80} />
      </>
    );
  if (customer.error || !customer.data)
    return (
      <>
        <PageHeader title="Customer" back={{ to: '/crm/customers', label: 'Customers' }} />
        <ErrorBlock error={customer.error ?? new Error('No data')} title="Could not load this customer" onRetry={() => void customer.refetch()} />
      </>
    );

  const c = customer.data;
  const churn = churnOf(profile.data?.predictions ?? []);
  const ai = profile.data?.aiSummary ?? null;
  const tags = parseTags(contact.data?.tagsJson);
  const openTasks = profile.data?.openTasks?.length ?? 0;

  return (
    <>
      <PageHeader
        title={c.name}
        back={{ to: '/crm/customers', label: 'Customers' }}
        meta={
          <Group gap="xs" wrap="wrap">
            {c.city && (
              <Text size="sm" c="dimmed">
                {c.city}
              </Text>
            )}
            <ConsentBadge consent={c.marketingConsent} />
            {c.consentChannels && c.marketingConsent && (
              <Text size="xs" c="dimmed">
                via {[c.consentChannels.push ? 'app' : null, c.consentChannels.email ? 'email' : null].filter(Boolean).join(' & ')}
              </Text>
            )}
            {c.erased && (
              <Badge variant="light" color="gray">
                Account deleted
              </Badge>
            )}
            {churn && (
              <Badge variant="light" color={churn.probability >= 0.6 ? 'signal' : churn.probability >= 0.3 ? 'amber' : 'forest'}>
                Churn risk: {churn.probabilityLabel || `${Math.round(churn.probability * 100)}%`}
              </Badge>
            )}
            {c.firstOrderAt && (
              <Text size="sm" c="dimmed">
                Customer since {formatDate(c.firstOrderAt)}
              </Text>
            )}
          </Group>
        }
      />
      <Stack gap="lg">
        <PrivacyNote />
        <SimpleGrid cols={{ base: 2, sm: 3, lg: 6 }} spacing="sm">
          <KpiTile label="Orders" value={formatNumber(c.orderCount)} />
          <KpiTile label="Lifetime value" value={c.lifetimeValue !== null ? formatMoney({ amount: c.lifetimeValue, currency: c.currency }) : '—'} />
          <KpiTile label="Returns" value={formatNumber(c.returnsCount)} tone={c.returnsCount ? 'amber' : 'forest'} />
          <KpiTile
            label="Reviews"
            value={c.reviewAverage !== null ? `${c.reviewAverage.toFixed(1)} ★` : '—'}
            hint={c.reviewCount ? `${formatNumber(c.reviewCount)} reviews` : undefined}
            tone="gray"
          />
          <KpiTile label="Questions" value={formatNumber(c.questionsCount)} tone="gray" />
          <KpiTile
            label="Last order"
            value={<span style={{ fontSize: 18 }}>{c.lastOrderAt ? formatDate(c.lastOrderAt) : '—'}</span>}
            hint={c.lastOrderAt ? fromNow(c.lastOrderAt) : undefined}
            tone="gray"
          />
        </SimpleGrid>

        {ai && (ai.headline || ai.recommendedActions?.length) ? (
          <Alert variant="light" color="forest" icon={<IconBulb size={18} />} title={ai.headline || 'Suggestions'}>
            {ai.recommendedActions?.length ? (
              <List size="sm" spacing={2}>
                {ai.recommendedActions.slice(0, 3).map((a) => (
                  <List.Item key={a}>{a}</List.Item>
                ))}
              </List>
            ) : null}
          </Alert>
        ) : null}

        <SectionCard title="Tags" description="Group customers your way — tags can be used in segments and campaigns.">
          {contact.isPending ? (
            <ListSkeleton rows={1} height={36} />
          ) : contact.error ? (
            <ErrorBlock error={contact.error} title="Could not load tags" onRetry={() => void contact.refetch()} />
          ) : (
            <TagsEditor key={tags.join('|')} id={c.id} tags={tags} />
          )}
        </SectionCard>

        <Card>
          <Tabs value={tab} onChange={setTab} keepMounted={false}>
            <Tabs.List mb="md" style={{ flexWrap: 'nowrap', overflowX: 'auto' }}>
              <Tabs.Tab value="timeline">Timeline</Tabs.Tab>
              <Tabs.Tab value="notes">Notes</Tabs.Tab>
              <Tabs.Tab value="tasks">Follow-ups{openTasks ? ` (${openTasks})` : ''}</Tabs.Tab>
              <Tabs.Tab value="feedback">Feedback</Tabs.Tab>
              <Tabs.Tab value="deals">Deals</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="timeline">
              <TimelineTab id={c.id} />
            </Tabs.Panel>
            <Tabs.Panel value="notes">
              <NotesTab id={c.id} />
            </Tabs.Panel>
            <Tabs.Panel value="tasks">
              <TasksTab customer={c} />
            </Tabs.Panel>
            <Tabs.Panel value="feedback">
              <FeedbackTab customer={c} />
            </Tabs.Panel>
            <Tabs.Panel value="deals">
              <DealsTab id={c.id} />
            </Tabs.Panel>
          </Tabs>
        </Card>
      </Stack>
    </>
  );
}

export default function CustomerProfilePage() {
  return (
    <RequireCap cap="customers.view">
      <Profile />
    </RequireCap>
  );
}
