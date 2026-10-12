import { useEffect, useState } from 'react';
import { ActionIcon, Alert, Badge, Button, Group, NumberInput, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { DateTimePicker } from '@mantine/dates';
import { notifications } from '@mantine/notifications';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { z } from 'zod';
import { CAMPAIGN_STATE, CAMPAIGN_TONE, campaignsApi, CTA_KIND, PLACEMENT, type Campaign, type CampaignBody } from '@/api/catalog';
import { messageOf } from '@/api/errors';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const campaignSchema = z
  .object({
    slug: z.string().trim().min(1, 'Required').max(80).regex(SLUG, 'Lowercase letters, numbers and single hyphens'),
    placement: z.number().int().min(1).max(2),
    eyebrow: z.string().trim().max(40).nullable(),
    title: z.string().trim().min(1, 'Required').max(80),
    subtitle: z.string().trim().max(160).nullable(),
    heroImageUrl: z.string().trim().url('A full https:// address').startsWith('https://', 'Must be https'),
    heroReelId: z.string().uuid('A reel ID').nullable(),
    priority: z.number().int().min(0).max(1000),
    startsUtc: z.date({ required_error: 'Required' }),
    endsUtc: z.date({ required_error: 'Required' }),
    collectionId: z.string().uuid('A collection ID').nullable(),
    ctas: z.array(z.object({ label: z.string().trim().min(1, 'Label required').max(24), targetKind: z.number().int().min(1).max(7), targetValue: z.string().trim().max(500).nullable() })).max(3),
  })
  .refine((v) => v.endsUtc > v.startsUtc, { path: ['endsUtc'], message: 'Must end after it starts' });

interface Form {
  slug: string;
  placement: number;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  heroImageUrl: string;
  heroReelId: string | null;
  priority: number;
  startsUtc: Date | null;
  endsUtc: Date | null;
  collectionId: string | null;
  ctas: { label: string; targetKind: number; targetValue: string | null }[];
}

function toForm(c?: Campaign): Form {
  return {
    slug: c?.slug ?? '',
    placement: c?.placement ?? 1,
    eyebrow: c?.eyebrow ?? null,
    title: c?.title ?? '',
    subtitle: c?.subtitle ?? null,
    heroImageUrl: c?.heroImageUrl ?? '',
    heroReelId: c?.heroReelId ?? null,
    priority: c?.priority ?? 0,
    startsUtc: c ? new Date(c.startsUtc) : null,
    endsUtc: c ? new Date(c.endsUtc) : null,
    collectionId: c?.collectionId ?? null,
    ctas: c?.ctas.map((x) => ({ label: x.label, targetKind: x.targetKind, targetValue: x.targetValue || null })) ?? [],
  };
}

/** Home and Discover hero campaigns: draft, publish (scheduled by its dates), archive. */
export function CampaignsPage() {
  const { can } = useAuth();
  const list = useListState(['state', 'placement'] as const, { pageSize: 25 });
  const resetKey = `${list.filters.state}|${list.filters.placement}|${list.pageSize}`;
  const cursors = useCursorPages(resetKey, list.page, list.setPage);
  const [editing, setEditing] = useState<Campaign | 'new' | null>(null);
  const query = useQuery({
    queryKey: ['campaigns', resetKey, cursors.cursor, list.page],
    queryFn: ({ signal }) => campaignsApi.list({ state: list.filters.state, placement: list.filters.placement, cursor: cursors.cursor, page: list.page, pageSize: list.pageSize }, signal),
    enabled: cursors.ready,
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (query.data) cursors.remember(list.page, query.data.nextCursor);
  }, [query.data, list.page, cursors]);

  const now = Date.now();
  const live = (c: Campaign) => c.state === 2 && new Date(c.startsUtc).getTime() <= now && now < new Date(c.endsUtc).getTime();
  const columns: Column<Campaign>[] = [
    { key: 'title', header: 'Campaign', render: (c) => <TwoLine primary={c.title} secondary={<span className="sm-mono">{c.slug}</span>} /> },
    { key: 'placement', header: 'Where', render: (c) => PLACEMENT[c.placement] },
    {
      key: 'state',
      header: 'State',
      render: (c) => (
        <Group gap={4}>
          <Badge variant="light" color={CAMPAIGN_TONE[c.state]}>
            {CAMPAIGN_STATE[c.state]}
          </Badge>
          {live(c) && <Badge color="forest">Live</Badge>}
        </Group>
      ),
    },
    { key: 'runs', header: 'Runs', visibleFrom: 'md', render: (c) => <Text size="sm"><When value={c.startsUtc} /> → <When value={c.endsUtc} /></Text> },
    { key: 'priority', header: 'Priority', align: 'right', visibleFrom: 'lg', render: (c) => c.priority },
  ];

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Hero banners on Home and Discover. A published campaign is live between its start and end."
        actions={
          can('manageCatalogOps') && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
              New campaign
            </Button>
          )
        }
      />
      <DataTable
        label="Campaigns"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading || !cursors.ready}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(c) => c.id}
        onRowClick={(c) => setEditing(c)}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        pagerMode="cursor"
        filtered={list.filtered}
        emptyTitle="No campaigns yet"
        toolbar={
          <Group gap="md" align="flex-end">
            <Select label="State" w={160} clearable placeholder="Any" data={Object.entries(CAMPAIGN_STATE).map(([value, label]) => ({ value, label }))} value={list.filters.state || null} onChange={(v) => list.setFilter('state', v)} />
            <Select label="Placement" w={160} clearable placeholder="Any" data={Object.entries(PLACEMENT).map(([value, label]) => ({ value, label }))} value={list.filters.placement || null} onChange={(v) => list.setFilter('placement', v)} />
          </Group>
        }
      />
      <CampaignEditor campaign={editing} onClose={() => setEditing(null)} />
    </>
  );
}

function CampaignEditor({ campaign, onClose }: { campaign: Campaign | 'new' | null; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const existing = campaign && campaign !== 'new' ? campaign : undefined;
  const [form, setForm] = useState<Form>(toForm(existing));
  const [errors, setErrors] = useState<Record<string, string>>({});
  useEffect(() => {
    setForm(toForm(existing));
    setErrors({});
  }, [campaign]); // eslint-disable-line react-hooks/exhaustive-deps
  const readOnly = !can('manageCatalogOps') || existing?.state === 3;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = useMutation({
    mutationFn: async () => {
      const parsed = campaignSchema.safeParse(form);
      if (!parsed.success) {
        const e: Record<string, string> = {};
        for (const issue of parsed.error.issues) e[issue.path.join('.')] ??= issue.message;
        setErrors(e);
        throw new Error('Fix the highlighted fields.');
      }
      setErrors({});
      const v = parsed.data;
      const body: CampaignBody = { ...v, startsUtc: v.startsUtc.toISOString(), endsUtc: v.endsUtc.toISOString(), ctas: v.ctas.map((c) => ({ ...c, targetValue: c.targetValue || null })) };
      return existing ? campaignsApi.update(existing.id, body) : campaignsApi.create(body);
    },
    onSuccess: () => {
      notifications.show({ color: 'forest', title: 'Saved', message: existing ? 'Campaign updated.' : 'Draft campaign created.' });
      void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      onClose();
    },
  });

  const lifecycle = (publish: boolean) =>
    open({
      title: publish ? 'Publish the campaign' : 'Archive the campaign',
      consequence: publish ? 'It goes live at its start time (now, if that has passed) on its placement.' : 'It comes down everywhere and cannot be published again. Archive is final.',
      confirmLabel: publish ? 'Publish' : 'Archive',
      danger: !publish,
      run: () => (publish ? campaignsApi.publish(existing!.id) : campaignsApi.archive(existing!.id)),
      success: publish ? 'Campaign published.' : 'Campaign archived.',
      onDone: () => {
        void queryClient.invalidateQueries({ queryKey: ['campaigns'] });
        onClose();
      },
    });

  return (
    <DetailDrawer
      opened={campaign !== null}
      onClose={onClose}
      title={existing ? existing.title : 'New campaign'}
      badges={existing && <Badge variant="light" color={CAMPAIGN_TONE[existing.state]}>{CAMPAIGN_STATE[existing.state]}</Badge>}
      actions={
        existing &&
        can('manageCatalogOps') && (
          <>
            {existing.state === 1 && (
              <Button size="sm" onClick={() => lifecycle(true)}>
                Publish…
              </Button>
            )}
            {existing.state !== 3 && (
              <Button size="sm" variant="light" color="signal" onClick={() => lifecycle(false)}>
                Archive…
              </Button>
            )}
          </>
        )
      }
      size="lg"
    >
      {dialog}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <fieldset disabled={readOnly} style={{ border: 0, padding: 0, margin: 0 }}>
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <TextInput label="Title" required value={form.title} onChange={(e) => set('title', e.currentTarget.value)} error={errors.title} maxLength={80} />
              <TextInput label="Slug" required value={form.slug} onChange={(e) => set('slug', e.currentTarget.value.toLowerCase())} error={errors.slug} description="Used in links; unique for ever." />
              <TextInput label="Eyebrow" value={form.eyebrow ?? ''} onChange={(e) => set('eyebrow', e.currentTarget.value || null)} error={errors.eyebrow} maxLength={40} />
              <Select label="Placement" required data={Object.entries(PLACEMENT).map(([value, label]) => ({ value, label }))} value={String(form.placement)} onChange={(v) => set('placement', Number(v))} allowDeselect={false} />
            </SimpleGrid>
            <TextInput label="Subtitle" value={form.subtitle ?? ''} onChange={(e) => set('subtitle', e.currentTarget.value || null)} error={errors.subtitle} maxLength={160} />
            <TextInput label="Hero image URL" required value={form.heroImageUrl} onChange={(e) => set('heroImageUrl', e.currentTarget.value)} error={errors.heroImageUrl} placeholder="https://…" />
            {form.heroImageUrl && /^https:\/\//.test(form.heroImageUrl) && (
              <div className="sm-doc-frame" style={{ minHeight: 120 }}>
                <img src={form.heroImageUrl} alt="Hero preview" style={{ maxHeight: 180 }} />
              </div>
            )}
            <SimpleGrid cols={{ base: 1, sm: 2 }}>
              <DateTimePicker label="Starts" required value={form.startsUtc} onChange={(d) => set('startsUtc', d)} error={errors.startsUtc} />
              <DateTimePicker label="Ends" required value={form.endsUtc} onChange={(d) => set('endsUtc', d)} error={errors.endsUtc} />
              <NumberInput label="Priority" description="0–1000; higher shows first" min={0} max={1000} value={form.priority} onChange={(v) => set('priority', Number(v) || 0)} error={errors.priority} />
              <TextInput label="Hero reel ID" value={form.heroReelId ?? ''} onChange={(e) => set('heroReelId', e.currentTarget.value.trim() || null)} error={errors.heroReelId} />
              <TextInput label="Collection ID" value={form.collectionId ?? ''} onChange={(e) => set('collectionId', e.currentTarget.value.trim() || null)} error={errors.collectionId} />
            </SimpleGrid>
            <Text fw={600} size="sm" mt="xs">
              Buttons (up to 3)
            </Text>
            {form.ctas.map((c, i) => (
              <Group key={i} gap="xs" align="flex-start" wrap="nowrap">
                <TextInput aria-label={`Button ${i + 1} label`} placeholder="Label" w={140} value={c.label} maxLength={24} error={errors[`ctas.${i}.label`]} onChange={(e) => set('ctas', form.ctas.map((x, j) => (j === i ? { ...x, label: e.currentTarget.value } : x)))} />
                <Select aria-label={`Button ${i + 1} target type`} w={140} data={Object.entries(CTA_KIND).map(([value, label]) => ({ value, label }))} value={String(c.targetKind)} onChange={(v) => set('ctas', form.ctas.map((x, j) => (j === i ? { ...x, targetKind: Number(v) } : x)))} allowDeselect={false} />
                <TextInput aria-label={`Button ${i + 1} target`} placeholder="Slug, ID or https:// link" style={{ flex: 1 }} value={c.targetValue ?? ''} onChange={(e) => set('ctas', form.ctas.map((x, j) => (j === i ? { ...x, targetValue: e.currentTarget.value || null } : x)))} />
                <ActionIcon variant="subtle" color="signal" aria-label={`Remove button ${i + 1}`} onClick={() => set('ctas', form.ctas.filter((_, j) => j !== i))} mt={6}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
            ))}
            {form.ctas.length < 3 && !readOnly && (
              <Button variant="subtle" size="xs" leftSection={<IconPlus size={14} />} onClick={() => set('ctas', [...form.ctas, { label: '', targetKind: 1, targetValue: null }])} w="fit-content">
                Add a button
              </Button>
            )}
            {save.error && (
              <Alert color="signal" variant="light" role="alert">
                {messageOf(save.error)}
              </Alert>
            )}
            {!readOnly && (
              <Group justify="flex-end">
                <Button variant="default" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" loading={save.isPending}>
                  {existing ? 'Save changes' : 'Create draft'}
                </Button>
              </Group>
            )}
          </Stack>
        </fieldset>
      </form>
    </DetailDrawer>
  );
}
