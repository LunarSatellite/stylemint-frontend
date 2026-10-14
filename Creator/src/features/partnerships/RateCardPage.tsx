import { useEffect, useState } from 'react';
import { ActionIcon, Alert, Badge, Button, Card, Group, NumberInput, SimpleGrid, Stack, TagsInput, Text, Textarea, TextInput } from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, messageOf } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatMoney, formatPercent } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { partnershipsApi, RATE_CARD_MAX_COMMISSION, type RateCard, type RateTier } from './api';

const EMPTY_TIER: RateTier = { tierName: '', price: 0, includedReels: 1, description: null };

function Editor({ current, onSaved }: { current: RateCard | null; onSaved: () => void }) {
  const [baseRate, setBaseRate] = useState<number>(current?.baseRate ?? 0);
  const [tiers, setTiers] = useState<RateTier[]>(current?.rates.length ? current.rates : [{ ...EMPTY_TIER, tierName: 'One reel' }]);
  const [commission, setCommission] = useState<number>(Math.round((current?.commissionPreference ?? 0.1) * 100));
  const [platforms, setPlatforms] = useState<string[]>(current?.platformPreferences ?? []);
  const [notes, setNotes] = useState(current?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  useEffect(() => setError(null), [baseRate, tiers, commission]);

  const save = useMutation({
    mutationFn: () =>
      partnershipsApi.publishRateCard({
        baseRate,
        rates: tiers.map((t) => ({ ...t, tierName: t.tierName.trim(), description: t.description?.trim() || null })),
        commissionPreference: commission / 100,
        platformPreferences: platforms,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toastSuccess('Rate card published. Brands see the new version.');
      onSaved();
    },
    onError: (e) => setError(messageOf(e)),
  });

  const submit = () => {
    if (tiers.length === 0) return setError('Add at least one package.');
    if (tiers.some((t) => !t.tierName.trim())) return setError('Give every package a name.');
    if (commission / 100 > RATE_CARD_MAX_COMMISSION) return setError('Commission preference can be at most 50%.');
    save.mutate();
  };

  const setTier = (i: number, patch: Partial<RateTier>) => setTiers((ts) => ts.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <Stack gap="md">
      {error && (
        <Alert color="signal" variant="light" role="alert">
          {error}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }}>
        <NumberInput label="Starting rate (Rs)" description="Your lowest fee for any paid post" min={0} thousandSeparator="," value={baseRate} onChange={(v) => setBaseRate(Number(v) || 0)} />
        <NumberInput label="Commission you prefer (%)" description="On sales from your reels, up to 50%" min={0} max={50} value={commission} onChange={(v) => setCommission(Number(v) || 0)} />
      </SimpleGrid>
      <div>
        <Text size="sm" fw={600} mb="xs">
          Packages
        </Text>
        <Stack gap="sm">
          {tiers.map((t, i) => (
            <Card key={i} padding="sm" withBorder>
              <Group align="flex-end" wrap="wrap" gap="sm">
                <TextInput label="Name" maxLength={200} value={t.tierName} onChange={(e) => setTier(i, { tierName: e.currentTarget.value })} style={{ flex: 2, minWidth: 160 }} />
                <NumberInput label="Price (Rs)" min={0} thousandSeparator="," value={t.price} onChange={(v) => setTier(i, { price: Number(v) || 0 })} w={140} />
                <NumberInput label="Reels" min={0} value={t.includedReels} onChange={(v) => setTier(i, { includedReels: Math.max(0, Math.floor(Number(v) || 0)) })} w={90} />
                <ActionIcon variant="subtle" color="signal" size="lg" aria-label={`Remove package ${t.tierName || i + 1}`} onClick={() => setTiers((ts) => ts.filter((_, j) => j !== i))}>
                  <IconTrash size={16} />
                </ActionIcon>
              </Group>
              <TextInput mt="xs" label="What’s included" maxLength={500} value={t.description ?? ''} onChange={(e) => setTier(i, { description: e.currentTarget.value })} />
            </Card>
          ))}
          <Group>
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setTiers((ts) => [...ts, { ...EMPTY_TIER }])}>
              Add package
            </Button>
          </Group>
        </Stack>
      </div>
      <TagsInput label="Platforms" description="Where you post, e.g. Instagram, TikTok" value={platforms} onChange={setPlatforms} />
      <Textarea label="Notes for brands" maxLength={2000} autosize minRows={2} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
      <Group justify="flex-end">
        <Button onClick={submit} loading={save.isPending}>
          {current ? 'Publish new version' : 'Publish rate card'}
        </Button>
      </Group>
    </Stack>
  );
}

export default function RateCardPage() {
  const qc = useQueryClient();
  const card = useQuery({ queryKey: ['partnerships', 'rate-card'], queryFn: partnershipsApi.rateCard, retry: false });
  const missing = card.error instanceof ApiError && card.error.status === 404;
  const [editing, setEditing] = useState(false);
  const deactivate = useMutation({
    mutationFn: partnershipsApi.deactivateRateCard,
    onSuccess: () => {
      toastSuccess('Rate card hidden from brands');
      void qc.invalidateQueries({ queryKey: ['partnerships', 'rate-card'] });
    },
    onError: (e) => toastError(e),
  });
  const saved = () => {
    setEditing(false);
    void qc.invalidateQueries({ queryKey: ['partnerships', 'rate-card'] });
  };

  return (
    <>
      <PageHeader title="Rate card" description="Your prices for paid posts, shown to brands on your public profile." />
      {card.isPending ? (
        <ListSkeleton rows={3} />
      ) : card.error && !missing ? (
        <ErrorBlock error={card.error} onRetry={() => void card.refetch()} title="Could not load your rate card" />
      ) : missing || editing ? (
        <SectionCard title={missing ? 'Create your rate card' : 'Edit your rate card'} description={missing ? 'You have no rate card yet. Brands see it when they consider you.' : undefined}>
          <Editor current={missing ? null : (card.data ?? null)} onSaved={saved} />
        </SectionCard>
      ) : card.data ? (
        <SectionCard
          title={`Version ${card.data.version}`}
          description={`Live since ${formatDate(card.data.effectiveFromUtc)}`}
          action={
            <Group gap="xs">
              <Button size="xs" onClick={() => setEditing(true)}>
                Edit
              </Button>
              <Button
                size="xs"
                variant="subtle"
                color="signal"
                loading={deactivate.isPending}
                onClick={() =>
                  void confirmAction({ title: 'Hide your rate card?', body: 'Brands will no longer see your prices.', confirmLabel: 'Hide', danger: true }).then(
                    (ok) => ok && deactivate.mutate(),
                  )
                }
              >
                Hide
              </Button>
            </Group>
          }
        >
          <Stack gap="sm">
            <Group gap="xl">
              <div>
                <Text size="xs" c="dimmed">
                  Starting at
                </Text>
                <Text fw={700}>{formatMoney(card.data.baseRate)}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">
                  Commission preference
                </Text>
                <Text fw={700}>{formatPercent(card.data.commissionPreference, 0)}</Text>
              </div>
            </Group>
            <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="sm">
              {card.data.rates.map((t) => (
                <Card key={t.tierName} padding="sm" withBorder>
                  <Group justify="space-between">
                    <Text fw={600}>{t.tierName}</Text>
                    <Badge variant="light">{t.includedReels} reels</Badge>
                  </Group>
                  <Text fw={700} mt={4}>
                    {formatMoney(t.price)}
                  </Text>
                  {t.description && (
                    <Text size="xs" c="dimmed">
                      {t.description}
                    </Text>
                  )}
                </Card>
              ))}
            </SimpleGrid>
            {card.data.notes && <Text size="sm">{card.data.notes}</Text>}
          </Stack>
        </SectionCard>
      ) : null}
    </>
  );
}
