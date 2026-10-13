import { useState } from 'react';
import { Anchor, Badge, Button, Card, Group, Progress, Select, SimpleGrid, Stack, Tabs, Text, Textarea } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatNumber, fromNow, humanize } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { crmApi, feedbackTypeColor, feedbackTypeLabel, npsClassColor, npsClassLabel, type FeedbackTheme } from './api';
import { DetailSheet, IfCan, RequireCap } from './components';
import { CRM_KEY, useClientPage, usePagedQuery } from './hooks';

function signed(n: number) {
  const r = Math.round(n);
  return r > 0 ? `+${r}` : String(r);
}

function Scores() {
  const nps = useQuery({ queryKey: [CRM_KEY, 'nps', 'summary'], queryFn: crmApi.npsSummary });
  const csat = useQuery({ queryKey: [CRM_KEY, 'csat', 'summary'], queryFn: crmApi.csatSummary });
  if (nps.error && csat.error)
    return (
      <ErrorBlock
        error={nps.error}
        title="Could not load your scores"
        onRetry={() => {
          void nps.refetch();
          void csat.refetch();
        }}
      />
    );
  const n = nps.data;
  return (
    <Stack gap="sm">
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <KpiTile
          label="NPS"
          loading={nps.isPending}
          value={n && n.totalResponded > 0 ? signed(n.npsScore) : '—'}
          hint={n ? `${formatNumber(n.totalResponded)} answers · ${humanize(n.trend)}` : nps.error ? 'Could not load' : undefined}
          tone={n && n.npsScore >= 30 ? 'forest' : n && n.npsScore < 0 ? 'signal' : 'amber'}
        />
        <KpiTile label="Promoters" loading={nps.isPending} value={n ? `${Math.round(n.promoterPct)}%` : '—'} tone="forest" />
        <KpiTile label="Detractors" loading={nps.isPending} value={n ? `${Math.round(n.detractorPct)}%` : '—'} tone="signal" />
        <KpiTile
          label="Satisfaction (CSAT)"
          loading={csat.isPending}
          value={csat.data && csat.data.totalRecords > 0 ? `${csat.data.avgCsatScore.toFixed(1)}` : '—'}
          hint={csat.data ? `${formatNumber(csat.data.totalRecords)} signals · ${humanize(csat.data.trend)}` : csat.error ? 'Could not load' : undefined}
          tone="gray"
        />
      </SimpleGrid>
      {n && n.totalResponded > 0 && (
        <Progress.Root size="lg" aria-label="Promoters, passives and detractors">
          <Progress.Section value={n.promoterPct} color="forest">
            <Progress.Label>Promoters</Progress.Label>
          </Progress.Section>
          <Progress.Section value={n.passivePct} color="gray" />
          <Progress.Section value={n.detractorPct} color="signal">
            <Progress.Label>Detractors</Progress.Label>
          </Progress.Section>
        </Progress.Root>
      )}
    </Stack>
  );
}

function Surveys() {
  const [klass, setKlass] = useState('all');
  const list = usePagedQuery({
    key: ['nps', 'list'],
    resetKey: klass,
    fetchPage: (page, pageSize) => crmApi.npsSurveys({ classification: klass === 'all' ? null : Number(klass), page, pageSize }),
  });
  return (
    <Stack gap="md">
      <Select
        w={220}
        aria-label="Filter answers"
        data={[
          { value: 'all', label: 'All answers' },
          { value: '1', label: 'Promoters (9–10)' },
          { value: '2', label: 'Passives (7–8)' },
          { value: '3', label: 'Detractors (0–6)' },
        ]}
        value={klass}
        onChange={(v) => setKlass(v ?? 'all')}
        allowDeselect={false}
      />
      {list.query.isPending ? (
        <ListSkeleton rows={4} height={60} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} title="Could not load survey answers" onRetry={() => void list.query.refetch()} />
      ) : list.items.length === 0 ? (
        <EmptyBlock title="No survey answers yet" body="Send an NPS survey from a customer’s profile (to buyers who agreed to hear from shops)." />
      ) : (
        <Stack gap="xs">
          {list.items.map((s) => (
            <Card key={s.id} withBorder padding="sm">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Anchor component={Link} to={`/crm/customers/${s.contactId}`} size="sm" fw={600}>
                    {s.contactName ?? 'Customer'}
                  </Anchor>
                  <Text size="sm">{s.comment ? `“${s.comment}”` : s.respondedAt ? 'No comment' : 'Waiting for an answer'}</Text>
                  <Text size="xs" c="dimmed">
                    {s.respondedAt ? `Answered ${fromNow(s.respondedAt)}` : s.sentAt ? `Sent ${fromNow(s.sentAt)}` : fromNow(s.createdAt)}
                  </Text>
                </Stack>
                {s.score !== null && (
                  <Badge size="lg" variant="light" color={npsClassColor[s.classification ?? 0] ?? 'gray'}>
                    {s.score}
                    {s.classification ? ` · ${npsClassLabel[s.classification]}` : ''}
                  </Badge>
                )}
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={list.items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
    </Stack>
  );
}

function ThemeDetail({ theme }: { theme: FeedbackTheme }) {
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [acting, setActing] = useState<string | null>(null);
  const items = useQuery({ queryKey: [CRM_KEY, 'feedback', 'theme', theme.topicTag], queryFn: () => crmApi.feedbackByTheme(theme.topicTag) });
  const paging = useClientPage(items.data, 10);
  const mark = useMutation({
    mutationFn: (id: string) => crmApi.markFeedbackActed(id, note.trim() || 'Handled'),
    onSuccess: () => {
      toastSuccess('Marked as handled');
      setActing(null);
      setNote('');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'feedback'] });
    },
    onError: (e) => toastError(e),
  });
  if (items.isPending) return <ListSkeleton rows={3} height={60} />;
  if (items.error) return <ErrorBlock error={items.error} title="Could not load this theme" onRetry={() => void items.refetch()} />;
  if (paging.total === 0) return <EmptyBlock title="No comments in this theme" />;
  return (
    <Stack gap="xs">
      {paging.items.map((f) => (
        <Card key={f.id} withBorder padding="sm">
          <Stack gap={4}>
            <Group gap="xs">
              <Badge size="xs" variant="light" color={feedbackTypeColor[f.feedbackType] ?? 'gray'}>
                {feedbackTypeLabel[f.feedbackType] ?? 'Feedback'}
              </Badge>
              {f.isActedOn && (
                <Badge size="xs" variant="light" color="forest">
                  Handled
                </Badge>
              )}
              <Text size="xs" c="dimmed">
                {fromNow(f.createdAt)}
              </Text>
            </Group>
            <Text size="sm">“{f.quoteText}”</Text>
            <Anchor component={Link} to={`/crm/customers/${f.contactId}`} size="xs">
              Open customer
            </Anchor>
            {!f.isActedOn && (
              <IfCan cap="customers.edit">
                {acting === f.id ? (
                  <Stack gap={6}>
                    <Textarea size="xs" autosize minRows={1} placeholder="What did you do? (optional)" value={note} onChange={(e) => setNote(e.currentTarget.value)} />
                    <Group gap="xs">
                      <Button size="xs" loading={mark.isPending} onClick={() => mark.mutate(f.id)}>
                        Save
                      </Button>
                      <Button size="xs" variant="default" onClick={() => setActing(null)}>
                        Cancel
                      </Button>
                    </Group>
                  </Stack>
                ) : (
                  <Group>
                    <Button size="xs" variant="light" onClick={() => setActing(f.id)}>
                      Mark handled
                    </Button>
                  </Group>
                )}
              </IfCan>
            )}
          </Stack>
        </Card>
      ))}
      <Pager page={paging.page} pageSize={paging.pageSize} total={paging.total} shown={paging.items.length} hasPrev={paging.hasPrev} hasNext={paging.hasNext} onPrev={paging.prev} onNext={paging.next} />
    </Stack>
  );
}

function Themes() {
  const themes = useQuery({ queryKey: [CRM_KEY, 'feedback', 'themes'], queryFn: crmApi.feedbackThemes });
  const sorted = [...(themes.data ?? [])].sort((a, b) => b.count - a.count);
  const paging = useClientPage(sorted, 12);
  const [open, setOpen] = useState<FeedbackTheme | null>(null);
  const max = Math.max(1, ...sorted.map((t) => t.count));
  return (
    <>
      {themes.isPending ? (
        <ListSkeleton rows={4} height={48} />
      ) : themes.error ? (
        <ErrorBlock error={themes.error} title="Could not load feedback themes" onRetry={() => void themes.refetch()} />
      ) : paging.total === 0 ? (
        <EmptyBlock title="No themes yet" body="Themes are picked up from reviews, questions and survey comments." />
      ) : (
        <Stack gap="xs">
          {paging.items.map((t) => (
            <Card key={t.topicTag} withBorder padding="sm" data-interactive="true" style={{ cursor: 'pointer' }} onClick={() => setOpen(t)} aria-label={`Theme ${t.topicTag}`}>
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                  <Group gap="xs">
                    <Text fw={600} size="sm">
                      {humanize(t.topicTag)}
                    </Text>
                    <Badge size="xs" variant="light" color={feedbackTypeColor[t.mostCommonType] ?? 'gray'}>
                      mostly {feedbackTypeLabel[t.mostCommonType]?.toLowerCase() ?? 'feedback'}
                    </Badge>
                  </Group>
                  <Progress value={(t.count / max) * 100} color={t.avgSentiment < 0 ? 'signal' : 'forest'} size="sm" aria-hidden />
                </Stack>
                <Text size="sm" fw={600}>
                  {formatNumber(t.count)}
                </Text>
              </Group>
            </Card>
          ))}
          <Pager page={paging.page} pageSize={paging.pageSize} total={paging.total} shown={paging.items.length} hasPrev={paging.hasPrev} hasNext={paging.hasNext} onPrev={paging.prev} onNext={paging.next} />
        </Stack>
      )}
      <DetailSheet opened={!!open} onClose={() => setOpen(null)} title={open ? humanize(open.topicTag) : ''}>
        {open && <ThemeDetail theme={open} />}
      </DetailSheet>
    </>
  );
}

export default function FeedbackPage() {
  return (
    <RequireCap cap="feedback.view">
      <PageHeader title="Feedback" description="How your customers rate you (NPS and satisfaction) and what they keep telling you." />
      <Stack gap="lg">
        <Scores />
        <SectionCard title="Answers and themes">
          <Tabs defaultValue="themes" keepMounted={false}>
            <Tabs.List mb="md">
              <Tabs.Tab value="themes">Themes</Tabs.Tab>
              <Tabs.Tab value="answers">Survey answers</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="themes">
              <Themes />
            </Tabs.Panel>
            <Tabs.Panel value="answers">
              <Surveys />
            </Tabs.Panel>
          </Tabs>
        </SectionCard>
      </Stack>
    </RequireCap>
  );
}
