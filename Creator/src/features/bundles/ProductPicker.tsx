import { useState } from 'react';
import { ActionIcon, Card, Checkbox, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import type { PagedResult } from '../../api/paging';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatMoney } from '../../lib/format';
import { reelsApi, type TaggableItem } from '../reels/api';
import { BUNDLES_KEY, formatPercent, MAX_QUANTITY } from './api';
import { CoverThumb } from './components';

/** A product the creator may put in a bundle. */
export interface ProductOption {
  productId: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  shopName: string | null;
  /** Percent (8 = 8 %) from the active partnership; null when unknown. */
  commissionPercent: number | null;
  /** Set when the product cannot be picked (shown greyed with this reason). */
  disabledReason?: string | null;
}

export interface PickedItem extends ProductOption {
  quantity: number;
}

/**
 * Products of shops the creator has an ACTIVE partnership with (contract §B3 "Creator-owned"): the tag picker
 * (`GET v1/tag-picker/items`, products only) plus `GET v1/creator/tag-products/commission` — rows whose status is not
 * `Applies` are shown greyed ("No active partnership"). The server checks again on add and on every acceptance.
 */
export function usePartnerProductOptions(q: string, enabled: boolean) {
  return useQuery({
    queryKey: [...BUNDLES_KEY, 'partner-products', q],
    enabled,
    queryFn: async (): Promise<ProductOption[]> => {
      const page = await api.get<PagedResult<TaggableItem>>('/v1/tag-picker/items', { q: q.slice(0, 100) || undefined, scope: 'all', kind: 'product', pageSize: 30 });
      const rows = (page.items ?? []).filter((i) => !i.isService);
      const commission = await reelsApi.tagCommission(rows.map((r) => r.productId));
      const byId = new Map(commission.map((c) => [c.productId, c]));
      return rows.map((r) => {
        const c = byId.get(r.productId);
        const applies = c?.status === 'Applies';
        return {
          productId: r.productId,
          title: r.name,
          thumbnailUrl: r.primaryImageUrl,
          price: r.displayPrice?.amount ?? 0,
          shopName: r.vendorDisplayName,
          commissionPercent: applies && c?.commissionRateFraction != null ? Math.round(c.commissionRateFraction * 10000) / 100 : null,
          disabledReason: applies ? null : c?.status === 'ProductUnavailable' ? 'Not available' : 'No active partnership',
        };
      });
    },
  });
}

/** Search partner products, pick them (checkbox) and a quantity each. `exclude` = products already in the bundle. */
export function ProductPicker({
  value,
  onChange,
  max,
  exclude,
  enabled = true,
}: {
  value: PickedItem[];
  onChange: (next: PickedItem[]) => void;
  max: number;
  exclude?: Set<string>;
  enabled?: boolean;
}) {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const q = usePartnerProductOptions(debounced, enabled);
  const options = (q.data ?? []).filter((o) => !exclude?.has(o.productId));
  const picked = new Map(value.map((v) => [v.productId, v]));
  const toggle = (o: ProductOption) => {
    if (picked.has(o.productId)) onChange(value.filter((v) => v.productId !== o.productId));
    else if (value.length < max) onChange([...value, { ...o, quantity: 1 }]);
  };
  const setQty = (id: string, quantity: number) => onChange(value.map((v) => (v.productId === id ? { ...v, quantity } : v)));

  return (
    <Stack gap="xs">
      {value.length > 0 && <PickedList value={value} onQuantity={setQty} onRemove={(id) => onChange(value.filter((v) => v.productId !== id))} />}
      <TextInput
        aria-label="Search partner products"
        placeholder="Search products from your partner brands"
        leftSection={<IconSearch size={14} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
      {q.isPending ? (
        <ListSkeleton rows={3} height={48} />
      ) : q.error ? (
        <ErrorBlock error={q.error} title="Could not load products" onRetry={() => void q.refetch()} />
      ) : options.length === 0 ? (
        <Text size="sm" c="dimmed">
          {debounced ? 'No product matches.' : 'No products yet. Partner with a brand first, then add its products here.'}
        </Text>
      ) : (
        <Stack gap={4} role="list" aria-label="Partner products" mah={280} style={{ overflowY: 'auto' }}>
          {options.map((o) => {
            const checked = picked.has(o.productId);
            const disabled = !!o.disabledReason || (!checked && value.length >= max);
            return (
              <Card key={o.productId} withBorder padding={6} role="listitem" style={{ opacity: o.disabledReason ? 0.55 : 1 }}>
                <Group wrap="nowrap" gap="sm">
                  <Checkbox
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(o)}
                    aria-label={`${o.title}${o.disabledReason ? ` (${o.disabledReason})` : ''}`}
                  />
                  <CoverThumb url={o.thumbnailUrl} size={36} />
                  <Stack gap={0} style={{ minWidth: 0, flex: 1 }}>
                    <Text size="sm" fw={600} truncate>
                      {o.title}
                    </Text>
                    <Text size="xs" c="dimmed" truncate>
                      {[o.shopName, formatMoney(o.price), o.commissionPercent != null ? `you earn ${formatPercent(o.commissionPercent)}` : null, o.disabledReason]
                        .filter(Boolean)
                        .join(' · ')}
                    </Text>
                  </Stack>
                </Group>
              </Card>
            );
          })}
        </Stack>
      )}
      {value.length >= max && (
        <Text size="xs" c="dimmed">
          That is the most items this bundle can hold.
        </Text>
      )}
    </Stack>
  );
}

function PickedList({ value, onQuantity, onRemove }: { value: PickedItem[]; onQuantity: (id: string, q: number) => void; onRemove: (id: string) => void }) {
  return (
    <Stack gap={4} aria-label="Picked items" role="list">
      {value.map((v) => (
        <Group key={v.productId} wrap="nowrap" gap="sm" role="listitem" data-testid={`picked-${v.productId}`}>
          <CoverThumb url={v.thumbnailUrl} size={32} />
          <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
            {v.title}
          </Text>
          <NumberInput
            aria-label={`Quantity of ${v.title}`}
            w={72}
            size="xs"
            min={1}
            max={MAX_QUANTITY}
            clampBehavior="strict"
            allowDecimal={false}
            value={v.quantity}
            onChange={(n) => onQuantity(v.productId, typeof n === 'number' ? n : Number(n) || 1)}
          />
          <ActionIcon variant="subtle" color="signal" aria-label={`Remove ${v.title}`} onClick={() => onRemove(v.productId)}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      ))}
    </Stack>
  );
}
