import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Modal,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
  VisuallyHidden,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconAlertTriangle, IconArchive, IconGift, IconPencil, IconPlus } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { ApiError, messageOf } from '@/api/errors';
import { toPage } from '@/api/paging';
import {
  ACCESS_SOURCE,
  SUBSCRIPTION_STATE,
  SUBSCRIPTION_TONE,
  tryOnApi,
  type TryOnPlan,
  type TryOnPlanBody,
  type TryOnSettingsBody,
  type TryOnSubscription,
} from '@/api/tryOn';
import { useAuth } from '@/auth/guards';
import { withStepUp } from '@/auth/stepUp';
import { useActionDialog } from '@/components/ActionDialog';
import { IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { MetricTile } from '@/components/MetricTile';
import { PageHeader } from '@/components/PageHeader';
import { EmptyBlock, ErrorBlock, LoadingBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';
import { fmtDate, fmtMoney, fmtNumber } from '@/lib/format';

const TABS = ['settings', 'plans', 'subscribers', 'usage'] as const;
type Tab = (typeof TABS)[number];

function failure(caught: unknown): string {
  if (caught instanceof ApiError && caught.code === 'mfa.step_up_cancelled') return 'Cancelled - the change was not made.';
  const ref = caught instanceof ApiError && caught.correlationId ? ` (reference ${caught.correlationId})` : '';
  return `${messageOf(caught)}${ref}`;
}

/** A failed read: a missing endpoint says so; anything else offers a retry. Never drawn as "none". */
function LoadFailure({ error, onRetry, what }: { error: unknown; onRetry: () => void; what: string }) {
  if (error instanceof ApiError && error.isMissingEndpoint) return <NotAvailableBlock what={what} />;
  return <ErrorBlock error={error} onRetry={onRetry} />;
}

/**
 * Virtual try-on is a premium feature: the admins decide whether it runs, whether it is free, the trial length, the
 * plans (and so the subscription price), and who has access.
 */
export function TryOnPage() {
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = (TABS as readonly string[]).includes(raw ?? '') ? (raw as Tab) : 'settings';
  return (
    <>
      <PageHeader title="Virtual try-on" description="Premium AR try-on for shoppers: whether it runs, what it costs, who has it and how much it is used." />
      <Tabs
        value={tab}
        // A tab starts clean: the subscriber filters and paging belong to that tab only.
        onChange={(v) => setParams(v && v !== 'settings' ? { tab: v } : {}, { replace: true })}
        keepMounted={false}
      >
        <ScrollArea type="never" mb="md">
          <Tabs.List style={{ flexWrap: 'nowrap' }}>
            <Tabs.Tab value="settings">Settings</Tabs.Tab>
            <Tabs.Tab value="plans">Plans</Tabs.Tab>
            <Tabs.Tab value="subscribers">Subscribers</Tabs.Tab>
            <Tabs.Tab value="usage">Usage</Tabs.Tab>
          </Tabs.List>
        </ScrollArea>
        <Tabs.Panel value="settings">
          <SettingsCard />
        </Tabs.Panel>
        <Tabs.Panel value="plans">
          <PlansCard />
        </Tabs.Panel>
        <Tabs.Panel value="subscribers">
          <SubscribersCard />
        </Tabs.Panel>
        <Tabs.Panel value="usage">
          <UsageCard />
        </Tabs.Panel>
      </Tabs>
    </>
  );
}

// ── Settings ─────────────────────────────────────────────────────────────────

function SettingsCard() {
  const { can } = useAuth();
  const editable = can('manageTryOn');
  const queryClient = useQueryClient();
  const [dialog, openDialog] = useActionDialog();
  const query = useQuery({ queryKey: ['try-on', 'settings'], queryFn: ({ signal }) => tryOnApi.settings(signal) });
  const [form, setForm] = useState<TryOnSettingsBody | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.data) {
      const { enabled, freeForEveryone, freeTrialDays, disclaimer } = query.data;
      setForm({ enabled, freeForEveryone, freeTrialDays, disclaimer });
    }
  }, [query.data]);

  let body;
  if (query.isLoading) body = <LoadingBlock label="Loading settings…" />;
  else if (query.error) body = <LoadFailure error={query.error} onRetry={() => void query.refetch()} what="Try-on settings" />;
  else if (form && query.data) {
    const saved = query.data;
    const invalid =
      !Number.isInteger(form.freeTrialDays) || form.freeTrialDays < 0 || form.freeTrialDays > 30
        ? 'Free trial is 0 to 30 days.'
        : form.disclaimer.length > 500
          ? 'Keep the disclaimer under 500 characters.'
          : null;
    const dirty =
      form.enabled !== saved.enabled || form.freeForEveryone !== saved.freeForEveryone || form.freeTrialDays !== saved.freeTrialDays || form.disclaimer !== saved.disclaimer;
    const done = (next: unknown) => {
      queryClient.setQueryData(['try-on', 'settings'], next);
      void queryClient.invalidateQueries({ queryKey: ['try-on'] });
    };
    const write = () => tryOnApi.saveSettings({ ...form, disclaimer: form.disclaimer.trim() });

    const save = async () => {
      setError(null);
      const turningOff = saved.enabled && !form.enabled;
      const makingFree = !saved.freeForEveryone && form.freeForEveryone;
      if (turningOff || makingFree) {
        openDialog({
          title: turningOff ? 'Turn virtual try-on off' : 'Make try-on free for everyone',
          consequence: turningOff
            ? 'Every shopper loses try-on straight away, paying subscribers included. Their subscriptions keep running and count down meanwhile.'
            : 'Every shopper gets try-on without paying. New subscriptions stop making sense until you turn this off again.',
          confirmLabel: turningOff ? 'Turn try-on off' : 'Make it free',
          danger: turningOff,
          run: write,
          success: 'Try-on settings saved.',
          onDone: done,
        });
        return;
      }
      setBusy(true);
      try {
        done(await withStepUp(write));
        notifications.show({ color: 'forest', title: 'Done', message: 'Try-on settings saved.' });
      } catch (caught) {
        setError(failure(caught));
      } finally {
        setBusy(false);
      }
    };

    body = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        noValidate
      >
        <Stack gap="md" maw={640}>
          <Switch
            label="Try-on is available"
            description="Off hides try-on from every shopper, whatever they paid."
            checked={form.enabled}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, enabled: e.currentTarget.checked })}
          />
          <Switch
            label="Free for everyone"
            description="Anyone signed in can use try-on without a plan, trial or grant."
            checked={form.freeForEveryone}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, freeForEveryone: e.currentTarget.checked })}
          />
          <NumberInput
            label="Free trial (days)"
            description="0 turns trials off. Each shopper gets one trial."
            min={0}
            max={30}
            allowDecimal={false}
            w={200}
            value={form.freeTrialDays}
            disabled={!editable}
            onChange={(v) => setForm({ ...form, freeTrialDays: typeof v === 'number' ? v : Number(v) || 0 })}
          />
          <Textarea
            label="Disclaimer"
            description={`Shown on every try-on screen. ${form.disclaimer.length}/500`}
            autosize
            minRows={3}
            maxRows={8}
            value={form.disclaimer}
            disabled={!editable}
            onChange={(e) => setForm({ ...form, disclaimer: e.currentTarget.value })}
          />
          {(invalid || error) && (
            <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
              {invalid ?? error}
            </Alert>
          )}
          <Group justify="space-between" wrap="wrap">
            <Text size="xs" c="dimmed">
              Last changed <When value={saved.updatedUtc} />
            </Text>
            {editable && (
              <Group gap="sm">
                <Button variant="default" disabled={!dirty || busy} onClick={() => setForm({ enabled: saved.enabled, freeForEveryone: saved.freeForEveryone, freeTrialDays: saved.freeTrialDays, disclaimer: saved.disclaimer })}>
                  Discard
                </Button>
                <Button type="submit" loading={busy} disabled={!dirty || !!invalid}>
                  Save settings
                </Button>
              </Group>
            )}
          </Group>
        </Stack>
      </form>
    );
  }

  return (
    <SectionCard title="Settings" description={editable ? undefined : 'Only a Super Admin can change these.'}>
      {body}
      {dialog}
    </SectionCard>
  );
}

// ── Plans ────────────────────────────────────────────────────────────────────

function PlansCard() {
  const { can } = useAuth();
  const editable = can('manageTryOn');
  const queryClient = useQueryClient();
  const [view, setView] = useState<'active' | 'archived'>('active');
  const [editing, setEditing] = useState<TryOnPlan | 'new' | null>(null);
  const [dialog, openDialog] = useActionDialog();
  const query = useQuery({ queryKey: ['try-on', 'plans'], queryFn: ({ signal }) => tryOnApi.plans(signal) });
  const rows = useMemo(
    () => (query.data ?? []).filter((p) => (view === 'archived' ? p.isArchived : !p.isArchived)).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [query.data, view],
  );
  const done = () => void queryClient.invalidateQueries({ queryKey: ['try-on', 'plans'] });

  const columns: Column<TryOnPlan>[] = [
    { key: 'name', header: 'Plan', render: (p) => <TwoLine primary={p.name} secondary={p.description ?? undefined} /> },
    { key: 'price', header: 'Price', align: 'right', render: (p) => <Text size="sm" fw={600}>{fmtMoney(p.priceAmount, p.currency)}</Text> },
    { key: 'duration', header: 'Lasts', render: (p) => `${p.durationDays} day${p.durationDays === 1 ? '' : 's'}` },
    {
      key: 'state',
      header: 'State',
      render: (p) => (p.isArchived ? <Badge variant="light" color="gray">Archived</Badge> : p.isActive ? <Badge variant="light" color="forest">On sale</Badge> : <Badge variant="light" color="amber">Hidden</Badge>),
    },
    { key: 'order', header: 'Order', align: 'right', visibleFrom: 'md', render: (p) => p.sortOrder },
    {
      key: 'actions',
      header: <VisuallyHidden>Actions</VisuallyHidden>,
      align: 'right',
      render: (p) =>
        editable && !p.isArchived ? (
          <Group gap={4} justify="flex-end" wrap="nowrap" onClick={(e) => e.stopPropagation()}>
            <Button size="xs" variant="subtle" leftSection={<IconPencil size={14} />} onClick={() => setEditing(p)} aria-label={`Edit ${p.name}`}>
              Edit
            </Button>
            <Button
              size="xs"
              variant="subtle"
              color="signal"
              leftSection={<IconArchive size={14} />}
              aria-label={`Archive ${p.name}`}
              onClick={() =>
                openDialog({
                  title: `Archive “${p.name}”`,
                  consequence: 'Shoppers can no longer buy it. Anyone already subscribed keeps access until their period ends. Archiving cannot be undone.',
                  confirmLabel: 'Archive plan',
                  danger: true,
                  run: () => tryOnApi.archivePlan(p.id),
                  success: 'Plan archived.',
                  onDone: done,
                })
              }
            >
              Archive
            </Button>
          </Group>
        ) : null,
    },
  ];

  return (
    <>
      <SectionCard
        title="Plans"
        description="What a shopper pays for try-on, and for how long. The price is set here."
        padding={0}
        action={
          editable && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
              New plan
            </Button>
          )
        }
      >
        <DataTable
          label="Try-on plans"
          columns={columns}
          page={query.data ? toPage<TryOnPlan>(rows, 1, Math.max(1, rows.length)) : undefined}
          isLoading={query.isLoading}
          isFetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          rowKey={(p) => p.id}
          emptyTitle={view === 'archived' ? 'No archived plans' : 'No plans yet'}
          emptyBody={view === 'archived' ? undefined : 'Without a plan on sale shoppers can only use a trial, a grant or free access.'}
          toolbar={
            <SegmentedControl
              aria-label="Which plans"
              value={view}
              onChange={(v) => setView(v as 'active' | 'archived')}
              data={[
                { value: 'active', label: 'Current' },
                { value: 'archived', label: 'Archived' },
              ]}
            />
          }
        />
      </SectionCard>
      <PlanModal plan={editing} onClose={() => setEditing(null)} onSaved={done} />
      {dialog}
    </>
  );
}

interface PlanForm {
  name: string;
  description: string;
  priceAmount: number | '';
  durationDays: number | '';
  isActive: boolean;
  sortOrder: number | '';
}

function planForm(p: TryOnPlan | null): PlanForm {
  return {
    name: p?.name ?? '',
    description: p?.description ?? '',
    priceAmount: p?.priceAmount ?? '',
    durationDays: p?.durationDays ?? 30,
    isActive: p?.isActive ?? true,
    sortOrder: p?.sortOrder ?? 0,
  };
}

function planErrors(f: PlanForm): Partial<Record<keyof PlanForm, string>> {
  const e: Partial<Record<keyof PlanForm, string>> = {};
  const name = f.name.trim();
  if (!name) e.name = 'Name is required';
  else if (name.length > 60) e.name = 'At most 60 characters';
  if (f.description.trim().length > 300) e.description = 'At most 300 characters';
  if (f.priceAmount === '' || !(f.priceAmount > 0)) e.priceAmount = 'Price must be more than 0';
  if (f.durationDays === '' || !Number.isInteger(f.durationDays) || f.durationDays < 1 || f.durationDays > 366) e.durationDays = '1 to 366 days';
  if (f.sortOrder === '' || !Number.isInteger(f.sortOrder) || f.sortOrder < 0 || f.sortOrder > 1000) e.sortOrder = '0 to 1000';
  return e;
}

function PlanModal({ plan, onClose, onSaved }: { plan: TryOnPlan | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const existing = plan && plan !== 'new' ? plan : null;
  const [form, setForm] = useState<PlanForm>(planForm(existing));
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(planForm(plan && plan !== 'new' ? plan : null));
    setTouched(false);
    setError(null);
  }, [plan]);

  const errors = touched ? planErrors(form) : {};
  const close = () => !busy && onClose();

  const submit = async () => {
    setTouched(true);
    if (Object.keys(planErrors(form)).length > 0) return;
    const body: TryOnPlanBody = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      priceAmount: Number(form.priceAmount),
      currency: 'NPR',
      durationDays: Number(form.durationDays),
      isActive: form.isActive,
      sortOrder: Number(form.sortOrder),
    };
    setBusy(true);
    setError(null);
    try {
      await withStepUp(() => (existing ? tryOnApi.updatePlan(existing.id, body) : tryOnApi.createPlan(body)));
      notifications.show({ color: 'forest', title: 'Done', message: existing ? 'Plan saved.' : 'Plan created.' });
      onSaved();
      onClose();
    } catch (caught) {
      setError(failure(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal opened={plan !== null} onClose={close} title={<Text fw={650}>{existing ? `Edit “${existing.name}”` : 'New plan'}</Text>} size="md" closeOnClickOutside={!busy}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        noValidate
      >
        <Stack gap="md">
          {existing && <Text size="sm">A new price applies to purchases from now on; people already subscribed keep what they paid for.</Text>}
          <TextInput label="Name" required value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} error={errors.name} data-autofocus />
          <Textarea label="Description" autosize minRows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.currentTarget.value })} error={errors.description} />
          <SimpleGrid cols={{ base: 1, xs: 2 }}>
            <NumberInput
              label="Price (NPR)"
              required
              min={0}
              decimalScale={2}
              thousandSeparator=","
              value={form.priceAmount}
              onChange={(v) => setForm({ ...form, priceAmount: v === '' ? '' : Number(v) })}
              error={errors.priceAmount}
            />
            <NumberInput
              label="Duration (days)"
              required
              min={1}
              max={366}
              allowDecimal={false}
              value={form.durationDays}
              onChange={(v) => setForm({ ...form, durationDays: v === '' ? '' : Number(v) })}
              error={errors.durationDays}
            />
            <NumberInput
              label="Sort order"
              description="Lower shows first"
              min={0}
              max={1000}
              allowDecimal={false}
              value={form.sortOrder}
              onChange={(v) => setForm({ ...form, sortOrder: v === '' ? '' : Number(v) })}
              error={errors.sortOrder}
            />
          </SimpleGrid>
          <Switch label="On sale" description="Off keeps the plan but hides it from shoppers." checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.currentTarget.checked })} />
          {error && (
            <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
              {error}
            </Alert>
          )}
          <Group justify="flex-end" gap="sm">
            <Button variant="default" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              {existing ? 'Save plan' : 'Create plan'}
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

// ── Subscribers ──────────────────────────────────────────────────────────────

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function SubscribersCard() {
  const { can } = useAuth();
  const editable = can('manageTryOn');
  const queryClient = useQueryClient();
  const [dialog, openDialog] = useActionDialog();
  const list = useListState(['state'] as const, { pageSize: 25 });
  const resetKey = `${list.filters.state}|${list.pageSize}`;
  const cursors = useCursorPages(resetKey, list.page, list.setPage);
  const query = useQuery({
    queryKey: ['try-on', 'subscriptions', resetKey, cursors.cursor, list.page],
    queryFn: ({ signal }) => tryOnApi.subscriptions({ state: list.filters.state, cursor: cursors.cursor, page: list.page, pageSize: list.pageSize }, signal),
    enabled: cursors.ready,
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (query.data) cursors.remember(list.page, query.data.nextCursor);
  }, [query.data, list.page, cursors]);
  const done = () => void queryClient.invalidateQueries({ queryKey: ['try-on', 'subscriptions'] });

  const grant = () =>
    openDialog({
      title: 'Grant try-on access',
      consequence: 'The account gets try-on free for the days you choose, starting now. It is recorded as an admin grant.',
      confirmLabel: 'Grant access',
      fields: [
        { name: 'accountId', kind: 'text', label: 'Account id', required: true, placeholder: '00000000-0000-0000-0000-000000000000' },
        { name: 'days', kind: 'number', label: 'Days', required: true, min: 1, max: 366, defaultValue: '30' },
        { name: 'note', kind: 'textarea', label: 'Note (optional, ≤ 300 characters)' },
      ],
      run: (v) => {
        const accountId = (v.accountId ?? '').trim();
        const days = Number(v.days);
        const note = (v.note ?? '').trim();
        if (!GUID.test(accountId)) return Promise.reject(new Error('The account id is a GUID, like 3f2b…-…'));
        if (!Number.isInteger(days) || days < 1 || days > 366) return Promise.reject(new Error('Days must be a whole number from 1 to 366.'));
        if (note.length > 300) return Promise.reject(new Error('Keep the note under 300 characters.'));
        return tryOnApi.grant({ accountId, days, note: note || null });
      },
      success: 'Access granted.',
      onDone: done,
    });

  const revoke = (s: TryOnSubscription) =>
    openDialog({
      title: 'Revoke try-on access',
      consequence: `${s.accountDisplayName ?? 'This account'} loses try-on now. Nothing is refunded automatically.`,
      confirmLabel: 'Revoke access',
      danger: true,
      fields: [{ name: 'reason', kind: 'textarea', label: 'Reason (kept in the audit log, ≤ 300 characters)', required: true }],
      run: (v) => {
        const reason = (v.reason ?? '').trim();
        if (reason.length > 300) return Promise.reject(new Error('Keep the reason under 300 characters.'));
        return tryOnApi.revoke(s.id, reason);
      },
      success: 'Access revoked.',
      onDone: done,
    });

  const columns: Column<TryOnSubscription>[] = [
    { key: 'who', header: 'Account', render: (s) => <TwoLine primary={s.accountDisplayName ?? 'Unnamed account'} secondary={<IdText value={s.accountId} />} /> },
    { key: 'plan', header: 'How', render: (s) => <TwoLine primary={ACCESS_SOURCE[s.source] ?? '—'} secondary={s.planName ?? undefined} /> },
    {
      key: 'state',
      header: 'State',
      render: (s) => (
        <Badge variant="light" color={SUBSCRIPTION_TONE[s.state] ?? 'gray'}>
          {SUBSCRIPTION_STATE[s.state] ?? `State ${s.state}`}
        </Badge>
      ),
    },
    { key: 'expires', header: 'Until', visibleFrom: 'sm', render: (s) => <When value={s.expiresUtc} /> },
    { key: 'paid', header: 'Paid', align: 'right', visibleFrom: 'md', render: (s) => fmtMoney(s.priceAmount, s.currency) },
    { key: 'note', header: 'Note', visibleFrom: 'lg', render: (s) => <Text size="sm" lineClamp={2}>{s.note ?? '—'}</Text> },
    {
      key: 'actions',
      header: <VisuallyHidden>Actions</VisuallyHidden>,
      align: 'right',
      render: (s) =>
        editable && (s.state === 1 || s.state === 2) ? (
          <Button
            size="xs"
            variant="subtle"
            color="signal"
            aria-label={`Revoke ${s.accountDisplayName ?? s.accountId}`}
            onClick={(e) => {
              e.stopPropagation();
              revoke(s);
            }}
          >
            Revoke
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <SectionCard
        title="Subscribers"
        description="Everyone with try-on access or a past subscription, newest first."
        padding={0}
        action={
          editable && (
            <Button leftSection={<IconGift size={16} />} onClick={grant}>
              Grant access
            </Button>
          )
        }
      >
        <DataTable
          label="Try-on subscribers"
          columns={columns}
          page={query.data}
          isLoading={query.isLoading || !cursors.ready}
          isFetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          rowKey={(s) => s.id}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          pagerMode="cursor"
          filtered={list.filtered}
          emptyTitle="No subscribers yet"
          emptyBody="Purchases, trials and grants appear here."
          toolbar={
            <Select
              label="State"
              w={180}
              clearable
              placeholder="Any state"
              data={Object.entries(SUBSCRIPTION_STATE).map(([value, label]) => ({ value, label }))}
              value={list.filters.state || null}
              onChange={(v) => list.setFilter('state', v)}
              comboboxProps={{ withinPortal: true }}
            />
          }
        />
      </SectionCard>
      {dialog}
    </>
  );
}

// ── Usage ────────────────────────────────────────────────────────────────────

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function UsageCard() {
  const [range, setRange] = useState(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 29 * 86_400_000);
    return { from: isoDay(from), to: isoDay(to) };
  });
  const spanDays = (Date.parse(range.to) - Date.parse(range.from)) / 86_400_000 + 1;
  const rangeError = !range.from || !range.to ? 'Pick both dates.' : spanDays < 1 ? 'The start is after the end.' : spanDays > 366 ? 'At most 366 days at a time.' : null;
  const query = useQuery({
    queryKey: ['try-on', 'usage', range.from, range.to],
    queryFn: ({ signal }) => tryOnApi.usage({ fromUtc: `${range.from}T00:00:00Z`, toUtc: `${range.to}T23:59:59Z` }, signal),
    enabled: !rangeError,
    placeholderData: keepPreviousData,
  });
  const u = query.data;
  const peak = Math.max(1, ...(u?.byDay ?? []).map((d) => d.sessions));

  return (
    <Stack gap="md">
      <SectionCard title="Usage" description="Try-on sessions and new subscriptions in the period.">
        <Group gap="md" align="flex-start" wrap="wrap">
          <TextInput type="date" label="From" value={range.from} max={range.to} onChange={(e) => setRange({ ...range, from: e.currentTarget.value })} w={170} />
          <TextInput type="date" label="To" value={range.to} min={range.from} onChange={(e) => setRange({ ...range, to: e.currentTarget.value })} w={170} />
        </Group>
        {rangeError && (
          <Text size="sm" c="signal" mt="xs" role="alert">
            {rangeError}
          </Text>
        )}
      </SectionCard>
      {rangeError ? null : query.isLoading ? (
        <LoadingBlock label="Loading usage…" />
      ) : query.error && !u ? (
        <LoadFailure error={query.error} onRetry={() => void query.refetch()} what="Try-on usage" />
      ) : u ? (
        <>
          <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
            <MetricTile label="Sessions" value={fmtNumber(u.sessions)} />
            <MetricTile label="Unique users" value={fmtNumber(u.uniqueUsers)} />
            <MetricTile label="Active subscribers" value={fmtNumber(u.activeSubscribers)} hint="Right now" />
            <MetricTile label="Revenue" value={fmtMoney(u.revenueAmount, u.currency)} />
          </SimpleGrid>
          <SimpleGrid cols={{ base: 1, lg: 2 }}>
            <SectionCard title="By day" padding={0}>
              {u.byDay.length === 0 ? (
                <EmptyBlock title="No activity in this period" />
              ) : (
                <Table.ScrollContainer minWidth={320}>
                  <Table aria-label="Try-on activity by day" striped>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Day</Table.Th>
                        <Table.Th>Sessions</Table.Th>
                        <Table.Th ta="right">New subscriptions</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {u.byDay.map((d) => (
                        <Table.Tr key={d.date}>
                          <Table.Td>{fmtDate(d.date)}</Table.Td>
                          <Table.Td>
                            <Group gap="xs" wrap="nowrap">
                              <Box
                                aria-hidden
                                h={8}
                                w={`${Math.round((d.sessions / peak) * 100)}%`}
                                maw={160}
                                miw={d.sessions > 0 ? 2 : 0}
                                style={{ borderRadius: 4, background: 'var(--mantine-color-forest-6)' }}
                              />
                              <Text size="sm">{fmtNumber(d.sessions)}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td ta="right">{fmtNumber(d.newSubscriptions)}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </SectionCard>
            <SectionCard title="Top products" padding={0}>
              {u.topProducts.length === 0 ? (
                <EmptyBlock title="No products tried on in this period" />
              ) : (
                <Table aria-label="Most tried-on products">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Product</Table.Th>
                      <Table.Th ta="right">Sessions</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {u.topProducts.map((p) => (
                      <Table.Tr key={p.productId}>
                        <Table.Td>
                          <TwoLine primary={p.name} secondary={<IdText value={p.productId} />} />
                        </Table.Td>
                        <Table.Td ta="right">{fmtNumber(p.sessions)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}
            </SectionCard>
          </SimpleGrid>
        </>
      ) : null}
    </Stack>
  );
}
