import { useEffect, useMemo, useState, type KeyboardEvent, type MouseEvent } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Avatar,
  Badge,
  Box,
  Button,
  Card,
  Checkbox,
  Group,
  Image,
  NumberInput,
  RangeSlider,
  Stack,
  Text,
  TextInput,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconEdit, IconPlus, IconSearch, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { messageOf } from '../../api/client';
import { DetailSheet } from '../../components/DetailSheet';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDuration, formatMoney, formatPercent, formatPercentValue } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import {
  displayPriceLabel,
  isNoPartnershipError,
  reelsApi,
  serviceItemTypeLabel,
  tilePriceLabel,
  type ProductTile,
  type Reel,
  type TagCommissionItem,
  type TaggedProduct,
  type TagPlacement,
} from './api';

const MIN_QUERY = 2;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Where the product tag sits on the frame (x/y as fractions) and when it shows (seconds). */
export function PlacementEditor({
  thumbnailUrl,
  durationSeconds,
  value,
  onChange,
}: {
  thumbnailUrl: string | null;
  durationSeconds: number;
  value: TagPlacement;
  onChange: (next: TagPlacement) => void;
}) {
  const duration = Math.max(1, Math.floor(durationSeconds || 1));
  const wholeReel = value.appearAtSeconds == null && value.disappearAtSeconds == null;
  const range: [number, number] = [value.appearAtSeconds ?? 0, value.disappearAtSeconds ?? duration];

  const place = (e: MouseEvent<HTMLDivElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    if (!box.width || !box.height) return;
    const x = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    const y = Math.min(1, Math.max(0, (e.clientY - box.top) / box.height));
    onChange({ ...value, overlayPositionX: round2(x), overlayPositionY: round2(y) });
  };
  const nudge = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? 0.1 : 0.02;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    onChange({
      ...value,
      overlayPositionX: round2(Math.min(1, Math.max(0, value.overlayPositionX + m[0]))),
      overlayPositionY: round2(Math.min(1, Math.max(0, value.overlayPositionY + m[1]))),
    });
  };

  return (
    <Stack gap="md">
      <div>
        <Text size="sm" fw={600}>
          Where the tag appears
        </Text>
        <Text size="xs" c="dimmed" mb={6}>
          Tap the frame where the product is, or use the arrow keys.
        </Text>
        <Box
          role="slider"
          tabIndex={0}
          aria-label="Tag position on the reel"
          aria-valuetext={`${Math.round(value.overlayPositionX * 100)}% across, ${Math.round(value.overlayPositionY * 100)}% down`}
          onClick={place}
          onKeyDown={nudge}
          data-testid="placement-frame"
          style={{
            position: 'relative',
            width: 180,
            aspectRatio: '9 / 16',
            borderRadius: 12,
            overflow: 'hidden',
            cursor: 'crosshair',
            background: 'var(--sm-inset)',
            border: '1px solid var(--sm-border)',
          }}
        >
          {thumbnailUrl ? (
            <Image src={thumbnailUrl} alt="" h="100%" w="100%" fit="cover" style={{ pointerEvents: 'none' }} />
          ) : (
            <Text size="xs" c="dimmed" ta="center" pt="xl">
              No preview
            </Text>
          )}
          <Box
            aria-hidden
            style={{
              position: 'absolute',
              left: `${value.overlayPositionX * 100}%`,
              top: `${value.overlayPositionY * 100}%`,
              width: 22,
              height: 22,
              marginLeft: -11,
              marginTop: -11,
              borderRadius: 11,
              background: 'rgba(255,255,255,0.92)',
              border: '3px solid #00784f',
              boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
            }}
          />
        </Box>
        <Group gap="sm" mt="xs">
          <NumberInput
            label="Across (%)"
            size="xs"
            w={100}
            min={0}
            max={100}
            value={Math.round(value.overlayPositionX * 100)}
            onChange={(v) => onChange({ ...value, overlayPositionX: Math.min(1, Math.max(0, Number(v) / 100 || 0)) })}
          />
          <NumberInput
            label="Down (%)"
            size="xs"
            w={100}
            min={0}
            max={100}
            value={Math.round(value.overlayPositionY * 100)}
            onChange={(v) => onChange({ ...value, overlayPositionY: Math.min(1, Math.max(0, Number(v) / 100 || 0)) })}
          />
        </Group>
      </div>
      <div>
        <Text size="sm" fw={600}>
          When it shows
        </Text>
        <Checkbox
          mt={6}
          label="For the whole reel"
          checked={wholeReel}
          onChange={(e) =>
            onChange(
              e.currentTarget.checked
                ? { ...value, appearAtSeconds: null, disappearAtSeconds: null }
                : { ...value, appearAtSeconds: 0, disappearAtSeconds: duration },
            )
          }
        />
        {!wholeReel && (
          <Box px={6} pt="md" pb="lg">
            <RangeSlider
              min={0}
              max={duration}
              step={duration > 120 ? 1 : 0.5}
              minRange={0.5}
              value={range}
              label={(v) => formatDuration(v)}
              marks={[
                { value: 0, label: '0:00' },
                { value: duration, label: formatDuration(duration) },
              ]}
              onChange={([a, b]) => onChange({ ...value, appearAtSeconds: a, disappearAtSeconds: b })}
              thumbFromLabel="Tag appears at"
              thumbToLabel="Tag disappears at"
            />
            <Text size="xs" c="dimmed" mt="lg">
              Shows from {formatDuration(range[0])} to {formatDuration(range[1])}
            </Text>
          </Box>
        )}
      </div>
    </Stack>
  );
}

function CommissionLine({ item }: { item: TagCommissionItem | undefined }) {
  if (!item) return <Text size="xs" c="dimmed">Checking commission…</Text>;
  if (item.status === 'Applies')
    return (
      <Text size="xs" c="var(--sm-good-text)" fw={600}>
        {formatPercent(item.commissionRateFraction, 0)} commission
        {item.commissionPerSale ? ` · ${formatMoney(item.commissionPerSale)} per sale` : ''}
      </Text>
    );
  if (item.status === 'NoPartnership')
    return (
      <Text size="xs" c="dimmed">
        No partnership with this brand yet —{' '}
        <Anchor component={Link} to="/brands" size="xs">
          request one
        </Anchor>
      </Text>
    );
  return (
    <Text size="xs" c="dimmed">
      Not available to tag right now
    </Text>
  );
}

/** Search the catalogue; each result says whether the creator can tag it and what it would earn. */
/** "Hotel stay" / "Travel package" / "Bank product" for a service item; nothing for a product. */
export function ServiceBadge({ isService, serviceType }: { isService?: boolean | null; serviceType?: number | null }) {
  if (!isService) return null;
  return (
    <Badge size="xs" color="indigo" variant="light" data-testid="service-badge">
      {serviceItemTypeLabel[serviceType ?? 0] ?? 'Service'}
    </Badge>
  );
}

export function ProductPicker({
  onPick,
  includeServices = true,
}: {
  onPick: (product: ProductTile, commission: TagCommissionItem) => void;
  /** Hotel stays, travel packages and bank products can be tagged in reels; collections stay products-only. */
  includeServices?: boolean;
}) {
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q.trim(), 350);
  const enabled = debounced.length >= MIN_QUERY;
  const results = useQuery({
    queryKey: ['reels', 'product-search', debounced, includeServices],
    queryFn: () => reelsApi.searchProducts(debounced, { includeServices }),
    enabled,
  });
  const ids = useMemo(() => (results.data ?? []).map((p) => p.productId), [results.data]);
  const commission = useQuery({ queryKey: ['reels', 'tag-commission', ids], queryFn: () => reelsApi.tagCommission(ids), enabled: ids.length > 0 });
  const byId = new Map((commission.data ?? []).map((c) => [c.productId, c]));
  const sorted = [...(results.data ?? [])].sort((a, b) => Number(byId.get(b.productId)?.status === 'Applies') - Number(byId.get(a.productId)?.status === 'Applies'));

  return (
    <Stack gap="sm">
      <TextInput
        label={includeServices ? 'Find a product or service' : 'Find a product'}
        placeholder={includeServices ? 'Search products, hotels, trips or bank products' : 'Search by product or brand'}
        leftSection={<IconSearch size={16} />}
        value={q}
        onChange={(e) => setQ(e.currentTarget.value)}
        data-autofocus
      />
      {!enabled ? (
        <Text size="sm" c="dimmed">
          Type at least {MIN_QUERY} letters. You can tag products{includeServices ? ', hotel stays, trips and bank products' : ''} from brands you have an active
          partnership with.
        </Text>
      ) : results.isPending ? (
        <ListSkeleton rows={4} height={56} />
      ) : results.error ? (
        <ErrorBlock error={results.error} onRetry={() => void results.refetch()} title="Search did not work" />
      ) : sorted.length === 0 ? (
        <EmptyBlock title="No products found" body="Try another word, or check the brand’s name." />
      ) : (
        <Stack gap="xs" data-testid="product-results">
          {commission.error && (
            <Alert color="amber" variant="light">
              Could not check commission for these products. You can still try to tag one.
            </Alert>
          )}
          {sorted.map((p) => {
            const c = byId.get(p.productId);
            const canTag = c ? c.status === 'Applies' : !!commission.error;
            return (
              <Card key={p.productId} padding="xs" withBorder data-testid={`pick-${p.productId}`}>
                <Group justify="space-between" wrap="nowrap" gap="sm">
                  <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Avatar src={p.heroImageUrl || undefined} radius="sm" size={44} />
                    <div style={{ minWidth: 0 }}>
                      <Text size="sm" fw={600} lineClamp={1}>
                        {p.name}
                      </Text>
                      <Text size="xs" c="dimmed" lineClamp={1}>
                        {p.brandName || 'Brand'} · <span data-testid="price-label">{tilePriceLabel(p)}</span>
                        {p.isOutOfStock ? ' · out of stock' : ''}
                      </Text>
                      <ServiceBadge isService={p.isService} serviceType={p.serviceType} />
                      <CommissionLine item={commission.error ? undefined : c} />
                    </div>
                  </Group>
                  <Button
                    size="xs"
                    disabled={!canTag}
                    onClick={() =>
                      onPick(
                        p,
                        c ?? {
                          productId: p.productId,
                          status: 'Applies',
                          partnershipId: null,
                          commissionRateFraction: null,
                          commissionRateMinFraction: null,
                          commissionRateMaxFraction: null,
                          unitPrice: null,
                          commissionPerSale: null,
                        },
                      )
                    }
                    aria-label={`Tag ${p.name}`}
                  >
                    Tag
                  </Button>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}
    </Stack>
  );
}

function tagError(e: unknown): string {
  if (isNoPartnershipError(e)) return 'You need an active partnership with this brand before you can tag its products.';
  return messageOf(e);
}

type SheetState =
  | { mode: 'closed' }
  | { mode: 'pick' }
  | { mode: 'place'; product: { id: string; name: string; image: string | null; commission: TagCommissionItem | null }; tagId?: string; placement: TagPlacement };

const DEFAULT_PLACEMENT: TagPlacement = { overlayPositionX: 0.5, overlayPositionY: 0.7, appearAtSeconds: null, disappearAtSeconds: null };

function placementOf(t: TaggedProduct): TagPlacement {
  return { overlayPositionX: t.overlayPositionX, overlayPositionY: t.overlayPositionY, appearAtSeconds: t.appearAtSeconds, disappearAtSeconds: t.disappearAtSeconds };
}

/** The reel's tagged products: add (search → place → save), move/retime, remove. */
export function TagsPanel({ reel }: { reel: Reel }) {
  const qc = useQueryClient();
  const tags = useQuery({ queryKey: ['reels', reel.id, 'tags'], queryFn: () => reelsApi.tags(reel.id), initialData: reel.taggedProducts, initialDataUpdatedAt: 0 });
  const [sheet, setSheet] = useState<SheetState>({ mode: 'closed' });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setError(null), [sheet.mode]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['reels', reel.id] });
    void qc.invalidateQueries({ queryKey: ['reels', 'list'] });
  };

  const save = useMutation({
    mutationFn: async (s: Extract<SheetState, { mode: 'place' }>) => {
      const placement: TagPlacement = {
        overlayPositionX: s.placement.overlayPositionX,
        overlayPositionY: s.placement.overlayPositionY,
        ...(s.placement.appearAtSeconds != null ? { appearAtSeconds: s.placement.appearAtSeconds } : {}),
        ...(s.placement.disappearAtSeconds != null ? { disappearAtSeconds: s.placement.disappearAtSeconds } : {}),
      };
      return s.tagId ? reelsApi.updateTag(reel.id, s.tagId, placement) : reelsApi.tag(reel.id, s.product.id, placement);
    },
    onSuccess: (_r, s) => {
      toastSuccess(s.tagId ? 'Tag updated' : `${s.product.name} tagged`);
      setSheet({ mode: 'closed' });
      invalidate();
    },
    onError: (e) => setError(tagError(e)),
  });

  const remove = useMutation({
    mutationFn: (t: TaggedProduct) => reelsApi.untag(reel.id, t.id),
    onSuccess: () => {
      toastSuccess('Tag removed');
      invalidate();
    },
    onError: (e) => toastError(e, 'Could not remove the tag'),
  });

  const list = tags.data ?? [];

  return (
    <Stack gap="md" data-testid="tags-panel">
      <Group justify="space-between">
        <Text size="sm" c="dimmed" maw={560}>
          Tag the products you show. Shoppers tap them while watching, and you earn commission on every sale.
        </Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setSheet({ mode: 'pick' })}>
          Tag a product
        </Button>
      </Group>
      {tags.error ? (
        <ErrorBlock error={tags.error} onRetry={() => void tags.refetch()} title="Could not load the tagged products" />
      ) : list.length === 0 ? (
        <EmptyBlock title="No products tagged yet" body="Reels with tagged products earn commission. Tag at least one before you publish." />
      ) : (
        <Stack gap="xs">
          {list.map((t) => (
            <Card key={t.id} padding="sm" withBorder>
              <Group justify="space-between" wrap="nowrap" gap="sm">
                <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                  <Avatar src={t.productPrimaryImageUrl ?? undefined} radius="sm" size={48} />
                  <div style={{ minWidth: 0 }}>
                    <Text size="sm" fw={600} lineClamp={1}>
                      {t.productName ?? 'Product'}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={1}>
                      {t.vendorDisplayName ?? 'Brand'} ·{' '}
                      <span data-testid="tag-price">
                        {t.isService || t.displayPrice
                          ? displayPriceLabel(t.displayPrice, t.serviceType, { amount: t.productPriceSnapshotAmount, currency: t.productPriceSnapshotCurrency })
                          : formatMoney({ amount: t.productPriceSnapshotAmount, currency: t.productPriceSnapshotCurrency })}
                      </span>
                    </Text>
                    <Group gap={6} mt={2}>
                      <ServiceBadge isService={t.isService} serviceType={t.serviceType} />
                      {t.isService && t.serviceType === 3 ? (
                        <Badge size="xs" color="gray" variant="light">
                          Enquiries only · no sale commission
                        </Badge>
                      ) : (
                        <Badge size="xs" color="forest" variant="light">
                          {formatPercentValue(t.commissionRateSnapshotPercent)} · {formatMoney({ amount: t.commissionPerSaleSnapshotAmount, currency: t.commissionPerSaleSnapshotCurrency })}{' '}
                          {t.isService ? 'per booking' : 'per sale'}
                        </Badge>
                      )}
                      <Badge size="xs" color="gray" variant="light">
                        {t.appearAtSeconds == null && t.disappearAtSeconds == null
                          ? 'Whole reel'
                          : `${formatDuration(t.appearAtSeconds ?? 0)}–${formatDuration(t.disappearAtSeconds ?? reel.durationSeconds)}`}
                      </Badge>
                    </Group>
                  </div>
                </Group>
                <Group gap={4} wrap="nowrap">
                  <Tooltip label="Move or retime">
                    <ActionIcon
                      variant="subtle"
                      color="gray"
                      aria-label={`Edit tag for ${t.productName ?? 'product'}`}
                      onClick={() =>
                        setSheet({
                          mode: 'place',
                          tagId: t.id,
                          product: { id: t.productId, name: t.productName ?? 'Product', image: t.productPrimaryImageUrl, commission: null },
                          placement: placementOf(t),
                        })
                      }
                    >
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Remove tag">
                    <ActionIcon
                      variant="subtle"
                      color="signal"
                      aria-label={`Remove tag for ${t.productName ?? 'product'}`}
                      loading={remove.isPending && remove.variables?.id === t.id}
                      onClick={() =>
                        void confirmAction({
                          title: 'Remove this tag?',
                          body: 'Shoppers will no longer see this product on the reel. Sales already made keep their commission.',
                          confirmLabel: 'Remove',
                          danger: true,
                        }).then((ok) => ok && remove.mutate(t))
                      }
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}

      <DetailSheet
        opened={sheet.mode !== 'closed'}
        onClose={() => setSheet({ mode: 'closed' })}
        title={sheet.mode === 'place' ? (sheet.tagId ? 'Move or retime the tag' : `Place ${sheet.product.name}`) : 'Tag a product'}
      >
        {sheet.mode === 'pick' && (
          <ProductPicker
            onPick={(p, c) =>
              setSheet({ mode: 'place', product: { id: p.productId, name: p.name, image: p.heroImageUrl || null, commission: c }, placement: DEFAULT_PLACEMENT })
            }
          />
        )}
        {sheet.mode === 'place' && (
          <Stack gap="md">
            {error && (
              <Alert color="signal" variant="light" role="alert" data-testid="tag-error">
                {error}
                {/partnership/i.test(error) && (
                  <>
                    {' '}
                    <Anchor component={Link} to="/brands" size="sm">
                      Find the brand
                    </Anchor>
                  </>
                )}
              </Alert>
            )}
            {sheet.product.commission?.status === 'Applies' && sheet.product.commission.commissionRateFraction != null && (
              <Text size="sm">
                You earn <b>{formatPercent(sheet.product.commission.commissionRateFraction, 0)}</b>
                {sheet.product.commission.commissionPerSale ? ` (${formatMoney(sheet.product.commission.commissionPerSale)})` : ''} on each sale.
              </Text>
            )}
            <PlacementEditor
              thumbnailUrl={reel.thumbnailCdnUrl}
              durationSeconds={reel.durationSeconds}
              value={sheet.placement}
              onChange={(placement) => setSheet({ ...sheet, placement })}
            />
            <Group justify="flex-end">
              {!sheet.tagId && (
                <Button variant="default" onClick={() => setSheet({ mode: 'pick' })}>
                  Back
                </Button>
              )}
              <Button onClick={() => save.mutate(sheet)} loading={save.isPending}>
                {sheet.tagId ? 'Save' : 'Tag product'}
              </Button>
            </Group>
          </Stack>
        )}
      </DetailSheet>
    </Stack>
  );
}
