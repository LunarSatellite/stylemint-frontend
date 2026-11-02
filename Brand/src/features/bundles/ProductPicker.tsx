import { useMemo, useState } from 'react';
import { ActionIcon, Card, Checkbox, Group, NumberInput, Stack, Text, TextInput } from '@mantine/core';
import { IconSearch, IconTrash } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatMoney } from '../../lib/format';
import { isServiceItem, ProductState, productsApi } from '../products/api';
import { BUNDLES_KEY, MAX_QUANTITY } from './api';
import { CoverThumb } from './components';

/** A product the seller may put in a bundle. */
export interface ProductOption {
  productId: string;
  title: string;
  thumbnailUrl: string | null;
  price: number;
  inStock: boolean;
  /** Set when the product cannot be picked (shown greyed with this reason). */
  disabledReason?: string | null;
}

export interface PickedItem extends ProductOption {
  quantity: number;
}

/**
 * The seller's own listed products (contract §B3: a vendor adds only its own products). No server search on
 * products: one 100-item page of active products, filtered locally (Seller Center rule).
 */
export function useOwnProductOptions(enabled: boolean) {
  return useQuery({
    queryKey: [...BUNDLES_KEY, 'own-products'],
    enabled,
    queryFn: async (): Promise<ProductOption[]> => {
      const page = await productsApi.list(ProductState.Active, null, 100);
      return (page.items ?? [])
        .filter((p) => !isServiceItem(p))
        .map((p) => {
          const v = p.variants.find((x) => x.id === p.defaultVariantId) ?? p.variants.find((x) => x.isDefault) ?? p.variants[0];
          const img = p.images.find((i) => i.isPrimary) ?? p.images[0];
          return { productId: p.id, title: p.name, thumbnailUrl: img?.cdnUrl ?? null, price: v?.priceAmount ?? 0, inStock: p.isInStock };
        });
    },
  });
}

/** Pick products (checkbox) and a quantity each. `exclude` = products already in the bundle. */
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
  const q = useOwnProductOptions(enabled);
  const [search, setSearch] = useState('');
  const options = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((o) => !exclude?.has(o.productId) && (!s || o.title.toLowerCase().includes(s)));
  }, [q.data, search, exclude]);
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
        aria-label="Search your products"
        placeholder="Search your products"
        leftSection={<IconSearch size={14} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
      />
      {q.isPending ? (
        <ListSkeleton rows={3} height={48} />
      ) : q.error ? (
        <ErrorBlock error={q.error} title="Could not load your products" onRetry={() => void q.refetch()} />
      ) : options.length === 0 ? (
        <Text size="sm" c="dimmed">
          {(q.data ?? []).length === 0 ? 'You have no published products yet.' : 'No product matches.'}
        </Text>
      ) : (
        <Stack gap={4} role="list" aria-label="Your products" mah={280} style={{ overflowY: 'auto' }}>
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
                      {[formatMoney(o.price), o.inStock ? null : 'out of stock', o.disabledReason].filter(Boolean).join(' · ')}
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
