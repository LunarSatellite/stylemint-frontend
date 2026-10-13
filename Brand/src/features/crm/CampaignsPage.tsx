import { useEffect, useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Modal,
  Progress,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconBolt, IconPlus, IconSend, IconSpeakerphone } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { useLocation, useNavigate } from 'react-router-dom';
import { messageOf } from '../../api/client';
import { KpiTile } from '../../components/KpiTile';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDateTime, formatNumber, fromNow, humanize } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import {
  CampaignChannel,
  CampaignStatus,
  campaignStatusColor,
  campaignStatusLabel,
  crmApi,
  type CampaignSummary,
  type TargetFilter,
} from './api';
import { AudienceSummary, BUILT_IN_SEGMENTS, consentCount, describeFilter, loadSegments, type RuleSegment } from './audience';
import { DetailSheet, IfCan, RequireCap, Stat } from './components';
import { CRM_KEY, useCan, useClientPage, useCrmSession, usePagedQuery } from './hooks';

/** Seller campaigns never use the CRM's own email/SMS: the backend delivers through StyleMint. */
export const CHANNEL_NOTE = 'Sent through StyleMint: app notification and in-app inbox; email only to buyers who opted in to shop emails.';

function pct(n: number | null | undefined) {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${Math.round(n > 1 ? n : n * 100)}%`;
}

// ---------------------------------------------------------------- create

function NewCampaignModal({ opened, onClose, initialSegment }: { opened: boolean; onClose: () => void; initialSegment: RuleSegment | null }) {
  const qc = useQueryClient();
  const { tenantId } = useCrmSession();
  const segments = [...BUILT_IN_SEGMENTS, ...loadSegments(tenantId)];
  if (initialSegment && !segments.some((s) => s.key === initialSegment.key)) segments.push(initialSegment);
  const [name, setName] = useState('');
  const [segmentKey, setSegmentKey] = useState<string>(initialSegment?.key ?? 'all');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [when, setWhen] = useState('');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (opened && initialSegment) setSegmentKey(initialSegment.key);
  }, [opened, initialSegment]);
  const segment = segments.find((s) => s.key === segmentKey) ?? segments[0];
  const filter: TargetFilter = segment.filter;
  const preview = useQuery({
    queryKey: [CRM_KEY, 'audience', JSON.stringify(filter)],
    queryFn: () => crmApi.previewAudience(filter),
    enabled: opened,
    staleTime: 60_000,
  });
  const close = () => {
    setName('');
    setTitle('');
    setMessage('');
    setWhen('');
    setError(null);
    setSegmentKey('all');
    onClose();
  };
  const save = useMutation({
    mutationFn: async (mode: 'draft' | 'send' | 'schedule') => {
      const created = await crmApi.createCampaign({
        name: name.trim(),
        description: `Audience: ${segment.name} (${describeFilter(filter)})`,
        channelType: CampaignChannel.Email,
        subject: title.trim(),
        bodyTemplate: message.trim(),
        targetFilterJson: JSON.stringify(filter),
        scheduledAt: mode === 'schedule' && when ? dayjs(when).toISOString() : null,
      });
      if (mode === 'send') await crmApi.launchCampaign(created.id);
      if (mode === 'schedule' && when) await crmApi.scheduleCampaign(created.id, dayjs(when).toISOString());
      return mode;
    },
    onSuccess: (mode) => {
      toastSuccess(mode === 'send' ? 'Campaign is sending' : mode === 'schedule' ? 'Campaign scheduled' : 'Draft saved');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'campaigns'] });
      close();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const valid = !!name.trim() && !!title.trim() && !!message.trim();
  const consented = preview.data ? consentCount(preview.data) : null;
  const total = preview.data?.estimatedRecipients ?? null;
  const confirmSend = async () => {
    const ok = await confirmAction({
      title: 'Send this campaign now?',
      body:
        consented !== null
          ? `${formatNumber(consented)} customers who agreed to marketing will get “${title.trim()}”.${total !== null && total > consented ? ` ${formatNumber(total - consented)} without consent are skipped.` : ''}`
          : `Customers in “${segment.name}” who agreed to marketing will get “${title.trim()}”. Everyone else is skipped.`,
      confirmLabel: 'Send now',
    });
    if (ok) save.mutate('send');
  };
  return (
    <Modal opened={opened} onClose={close} title="New campaign" size="lg">
      <Stack gap="md">
        {error && (
          <Alert color="signal" variant="light">
            {error}
          </Alert>
        )}
        <TextInput label="Campaign name (only you see this)" required maxLength={200} value={name} onChange={(e) => setName(e.currentTarget.value)} placeholder="e.g. Dashain offer for regulars" />
        <Select
          label="Send to"
          data={segments.map((s) => ({ value: s.key, label: s.name }))}
          value={segmentKey}
          onChange={(v) => setSegmentKey(v ?? 'all')}
          allowDeselect={false}
          comboboxProps={{ zIndex: 400 }}
        />
        <Card withBorder padding="sm">
          <Text size="xs" c="dimmed" mb={6}>
            {describeFilter(filter)}
          </Text>
          <AudienceSummary filter={filter} />
        </Card>
        <TextInput label="Title" description="The notification headline." required maxLength={120} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <Textarea
          label="Message"
          required
          autosize
          minRows={3}
          maxLength={1000}
          value={message}
          onChange={(e) => setMessage(e.currentTarget.value)}
          description="Do not include phone numbers or links outside StyleMint."
        />
        <TextInput label="Schedule (optional)" type="datetime-local" value={when} onChange={(e) => setWhen(e.currentTarget.value)} />
        <Alert variant="light" color="gray" p="xs" icon={<IconSpeakerphone size={16} />}>
          <Text size="xs">{CHANNEL_NOTE}</Text>
        </Alert>
        <Group justify="flex-end" gap="xs">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button variant="light" disabled={!valid} loading={save.isPending && save.variables === 'draft'} onClick={() => save.mutate('draft')}>
            Save draft
          </Button>
          {when ? (
            <Button disabled={!valid} loading={save.isPending && save.variables === 'schedule'} onClick={() => save.mutate('schedule')}>
              Schedule
            </Button>
          ) : (
            <Button leftSection={<IconSend size={15} />} disabled={!valid || consented === 0} loading={save.isPending && save.variables === 'send'} onClick={() => void confirmSend()}>
              Send now
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  );
}

// ---------------------------------------------------------------- detail

function CampaignDetail({ c, onClose }: { c: CampaignSummary; onClose: () => void }) {
  const qc = useQueryClient();
  const canDelete = useCan('records.delete');
  const canManage = useCan('campaigns.manage');
  const stats = useQuery({ queryKey: [CRM_KEY, 'campaigns', c.id, 'stats'], queryFn: () => crmApi.campaignStats(c.id), enabled: c.status !== CampaignStatus.Draft });
  const act = useMutation({
    mutationFn: (a: { run: () => Promise<unknown>; done: string; close?: boolean }) => a.run().then(() => a),
    onSuccess: (a) => {
      toastSuccess(a.done);
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'campaigns'] });
      if (a.close) onClose();
    },
    onError: (e) => toastError(e),
  });
  const s = stats.data;
  const consented = s?.consentedRecipients ?? c.consentedRecipients ?? null;
  const skipped = s?.skippedNoConsent ?? c.skippedNoConsent ?? null;
  return (
    <Stack gap="md">
      <Group gap="xs">
        <Badge color={campaignStatusColor[c.status] ?? 'gray'} variant="light">
          {campaignStatusLabel[c.status] ?? '—'}
        </Badge>
        <Text size="xs" c="dimmed">
          {c.launchedAt ? `Sent ${fromNow(c.launchedAt)}` : c.scheduledAt ? `Scheduled for ${formatDateTime(c.scheduledAt)}` : `Created ${fromNow(c.createdAt)}`}
        </Text>
      </Group>
      {c.description && (
        <Text size="sm" c="dimmed">
          {c.description}
        </Text>
      )}
      {(consented !== null || skipped !== null) && (
        <Alert variant="light" color="forest" p="xs" data-testid="campaign-consent">
          <Text size="sm">
            {consented !== null ? `${formatNumber(consented)} customers with marketing consent` : ''}
            {skipped ? ` · ${formatNumber(skipped)} skipped (no consent)` : ''}
          </Text>
        </Alert>
      )}
      {c.status === CampaignStatus.Draft ? (
        <Text size="sm" c="dimmed">
          Not sent yet.
        </Text>
      ) : stats.isPending ? (
        <ListSkeleton rows={2} height={48} />
      ) : stats.error ? (
        <ErrorBlock error={stats.error} title="Could not load results" onRetry={() => void stats.refetch()} />
      ) : s ? (
        <>
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
            <Stat label="Recipients" value={formatNumber(s.totalRecipients)} />
            <Stat label="Delivered" value={formatNumber(s.sentCount)} />
            <Stat label="Opened" value={`${formatNumber(s.openedCount)} · ${pct(s.openRate)}`} />
            <Stat label="Clicked" value={`${formatNumber(s.clickCount)} · ${pct(s.clickRate)}`} />
            <Stat label="Bought" value={`${formatNumber(s.convertedCount)} · ${pct(s.conversionRate)}`} />
            <Stat label="Failed" value={formatNumber(s.failedCount)} />
          </SimpleGrid>
          {s.totalRecipients > 0 && <Progress value={(s.sentCount / Math.max(1, s.totalRecipients)) * 100} color="forest" aria-label="Delivered" />}
        </>
      ) : null}
      <Group gap="xs">
        {canManage && c.status === CampaignStatus.Draft && (
          <Button
            leftSection={<IconSend size={15} />}
            onClick={() =>
              void confirmAction({
                title: 'Send this campaign now?',
                body: 'Only customers who agreed to marketing get it. Everyone else is skipped.',
                confirmLabel: 'Send now',
              }).then((ok) => ok && act.mutate({ run: () => crmApi.launchCampaign(c.id), done: 'Campaign is sending' }))
            }
          >
            Send now
          </Button>
        )}
        {canManage && (c.status === CampaignStatus.Scheduled || c.status === CampaignStatus.Running) && (
          <Button
            variant="light"
            color="signal"
            onClick={() =>
              void confirmAction({ title: 'Stop this campaign?', body: 'Messages not sent yet will not go out.', confirmLabel: 'Stop campaign', danger: true }).then(
                (ok) => ok && act.mutate({ run: () => crmApi.cancelCampaign(c.id), done: 'Campaign stopped' }),
              )
            }
          >
            Stop
          </Button>
        )}
        {canDelete && (c.status === CampaignStatus.Draft || c.status === CampaignStatus.Cancelled) && (
          <Button
            variant="subtle"
            color="signal"
            onClick={() =>
              void confirmAction({ title: 'Delete this campaign?', body: c.name, confirmLabel: 'Delete', danger: true }).then(
                (ok) => ok && act.mutate({ run: () => crmApi.deleteCampaign(c.id), done: 'Campaign deleted', close: true }),
              )
            }
          >
            Delete
          </Button>
        )}
      </Group>
    </Stack>
  );
}

// ---------------------------------------------------------------- lists

function CampaignsTab({ initialSegment }: { initialSegment: RuleSegment | null }) {
  const [creating, setCreating] = useState(!!initialSegment);
  const [open, setOpen] = useState<CampaignSummary | null>(null);
  const [status, setStatus] = useState<string>('all');
  const list = useQuery({ queryKey: [CRM_KEY, 'campaigns', 'list'], queryFn: crmApi.campaigns });
  const aggregate = useQuery({ queryKey: [CRM_KEY, 'campaigns', 'aggregate'], queryFn: crmApi.campaignAggregate, retry: false });
  const filtered = (list.data ?? [])
    .filter((c) => status === 'all' || String(c.status) === status)
    .sort((a, b) => (b.launchedAt ?? b.createdAt).localeCompare(a.launchedAt ?? a.createdAt));
  const paging = useClientPage(filtered, 10, status);
  const ag = aggregate.data;
  return (
    <Stack gap="md">
      <SimpleGrid cols={{ base: 2, md: 4 }} spacing="sm">
        <KpiTile label="Campaigns" value={formatNumber(ag?.totalCampaigns)} loading={aggregate.isPending} />
        <KpiTile label="Messages delivered" value={formatNumber(ag?.totalSent)} loading={aggregate.isPending} />
        <KpiTile label="Open rate" value={pct(ag?.overallOpenRate)} loading={aggregate.isPending} tone="gray" />
        <KpiTile label="Bought after" value={formatNumber(ag?.totalConverted)} hint={ag ? pct(ag.overallConversionRate) : undefined} loading={aggregate.isPending} tone="amber" />
      </SimpleGrid>
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Select
          w={200}
          aria-label="Filter campaigns"
          data={[
            { value: 'all', label: 'All campaigns' },
            { value: '1', label: 'Drafts' },
            { value: '2', label: 'Scheduled' },
            { value: '3', label: 'Sending' },
            { value: '4', label: 'Sent' },
            { value: '5', label: 'Cancelled' },
          ]}
          value={status}
          onChange={(v) => setStatus(v ?? 'all')}
          allowDeselect={false}
        />
        <IfCan cap="campaigns.manage">
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
            New campaign
          </Button>
        </IfCan>
      </Group>
      {list.isPending ? (
        <ListSkeleton rows={3} height={76} />
      ) : list.error ? (
        <ErrorBlock error={list.error} title="Could not load campaigns" onRetry={() => void list.refetch()} />
      ) : paging.total === 0 ? (
        <EmptyBlock title={status === 'all' ? 'No campaigns yet' : 'No campaigns here'} body="Send an offer or a thank-you to a segment of your customers." />
      ) : (
        <Stack gap="xs">
          {paging.items.map((c) => (
            <Card key={c.id} withBorder padding="sm" data-interactive="true" style={{ cursor: 'pointer' }} onClick={() => setOpen(c)} aria-label={`Campaign ${c.name}`}>
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text fw={600} size="sm" truncate>
                    {c.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {c.status === CampaignStatus.Draft
                      ? `Draft · ${fromNow(c.createdAt)}`
                      : `${formatNumber(c.sentCount)} delivered · ${formatNumber(c.openedCount)} opened · ${formatNumber(c.convertedCount)} bought`}
                  </Text>
                </Stack>
                <Badge color={campaignStatusColor[c.status] ?? 'gray'} variant="light">
                  {campaignStatusLabel[c.status] ?? '—'}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      <Pager page={paging.page} pageSize={paging.pageSize} total={paging.total} shown={paging.items.length} hasPrev={paging.hasPrev} hasNext={paging.hasNext} onPrev={paging.prev} onNext={paging.next} />
      <NewCampaignModal opened={creating} onClose={() => setCreating(false)} initialSegment={initialSegment} />
      <DetailSheet opened={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && <CampaignDetail c={open} onClose={() => setOpen(null)} />}
      </DetailSheet>
    </Stack>
  );
}

function AutomationsTab() {
  const qc = useQueryClient();
  const canManage = useCan('automations.manage');
  const list = usePagedQuery({ key: ['automations'], fetchPage: (page, pageSize) => crmApi.automations(page, pageSize) });
  const toggle = useMutation({
    mutationFn: (a: { id: string; on: boolean }) => crmApi.setAutomationActive(a.id, a.on),
    onSuccess: (_, a) => {
      toastSuccess(a.on ? 'Automation turned on' : 'Automation paused');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'automations'] });
    },
    onError: (e) => toastError(e),
  });
  return (
    <Stack gap="md">
      <Alert variant="light" color="gray" p="xs" icon={<IconBolt size={16} />}>
        <Text size="xs">Automations follow up on their own — for example a thank-you after a first order. {CHANNEL_NOTE}</Text>
      </Alert>
      {list.query.isPending ? (
        <ListSkeleton rows={3} height={64} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} title="Could not load automations" onRetry={() => void list.query.refetch()} />
      ) : list.items.length === 0 ? (
        <EmptyBlock title="No automations yet" body="Automations set up for your shop appear here." />
      ) : (
        <Stack gap="xs">
          {list.items.map((w) => (
            <Card key={w.id} withBorder padding="sm">
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text fw={600} size="sm">
                    {w.name}
                  </Text>
                  <Text size="xs" c="dimmed">
                    When: {humanize(w.triggerType)} · {w.steps?.length ?? 0} steps · ran {formatNumber(w.executionCount)} times
                    {w.lastTriggeredAt ? ` · last ${fromNow(w.lastTriggeredAt)}` : ''}
                  </Text>
                </Stack>
                <Switch
                  checked={w.isActive}
                  disabled={!canManage || (toggle.isPending && toggle.variables?.id === w.id)}
                  onChange={(e) => toggle.mutate({ id: w.id, on: e.currentTarget.checked })}
                  aria-label={`${w.isActive ? 'Pause' : 'Turn on'} ${w.name}`}
                />
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={list.items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
    </Stack>
  );
}

export default function CampaignsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [initialSegment] = useState<RuleSegment | null>(() => (location.state as { segment?: RuleSegment } | null)?.segment ?? null);
  useEffect(() => {
    // Consume the hand-over from Segments so a reload does not reopen the form.
    if (location.state) navigate(location.pathname, { replace: true, state: null });
  }, [location.state, location.pathname, navigate]);
  return (
    <RequireCap cap="campaigns.view">
      <PageHeader title="Campaigns & automations" description="Reach customers who agreed to hear from your shop — through StyleMint, never by phone or email lists." />
      <Tabs defaultValue="campaigns" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="campaigns">Campaigns</Tabs.Tab>
          <Tabs.Tab value="automations">Automations</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="campaigns">
          <CampaignsTab initialSegment={initialSegment} />
        </Tabs.Panel>
        <Tabs.Panel value="automations">
          <AutomationsTab />
        </Tabs.Panel>
      </Tabs>
    </RequireCap>
  );
}
