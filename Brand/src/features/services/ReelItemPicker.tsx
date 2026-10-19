import { useMemo, useState } from 'react';
import { Avatar, Badge, Button, Card, CloseButton, Group, Stack, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { isMissingEndpoint } from '../../api/client';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { priceLabel, REEL_ITEMS_KEY, serviceItemTypeLabel, tagPickerApi, type TaggableItem } from './reelItems';

/** "Hotel stay" / "Travel package" / "Bank product" badge for a service item; nothing for a product. */
export function ServiceItemBadge({ item }: { item: Pick<TaggableItem, 'isService' | 'serviceType'> }) {
  if (!item.isService) return null;
  return (
    <Badge size="xs" variant="light" color="indigo">
      {serviceItemTypeLabel[item.serviceType ?? 0] ?? 'Service'}
    </Badge>
  );
}

/**
 * The seller's own taggable items — products AND service items (hotel stays, travel packages, bank products) — with
 * the price label buyers see on a reel tag. Used where the seller picks what creators should tag (campaign briefs).
 * Values are the items' default variant ids (`productVariantIds` on the brief).
 */
export function FeaturedItemsField({
  value,
  onChange,
  label = 'Products and services to feature',
}: {
  value: string[];
  onChange: (variantIds: string[]) => void;
  label?: string;
}) {
  const [q, setQ] = useState('');
  const [debounced] = useDebouncedValue(q.trim(), 300);
  const [seen, setSeen] = useState<Record<string, TaggableItem>>({});
  const results = useQuery({
    queryKey: [...REEL_ITEMS_KEY, 'mine', debounced],
    queryFn: async () => {
      const page = await tagPickerApi.items({ scope: 'mine', q: debounced, pageSize: 20 });
      const items = page.items ?? [];
      setSeen((s) => {
        const next = { ...s };
        for (const it of items) if (it.defaultVariantId) next[it.defaultVariantId] = it;
        return next;
      });
      return items;
    },
    retry: (n, e) => !isMissingEndpoint(e) && n < 1,
  });
  const selected = useMemo(() => new Set(value), [value]);
  const toggle = (variantId: string) => onChange(selected.has(variantId) ? value.filter((v) => v !== variantId) : [...value, variantId]);

  return (
    <Stack gap="xs" data-testid="featured-items">
      <div>
        <Text size="sm" fw={500}>
          {label}
        </Text>
        <Text size="xs" c="dimmed">
          Creators on this brief tag these in their reels. Hotel stays, travel packages and bank products count as items too.
        </Text>
      </div>
      {value.length > 0 && (
        <Group gap={6}>
          {value.map((id) => {
            const it = seen[id];
            return (
              <Badge
                key={id}
                variant="outline"
                color="forest"
                size="lg"
                rightSection={<CloseButton size="xs" aria-label={`Remove ${it?.name ?? 'item'}`} onClick={() => toggle(id)} />}
              >
                {it ? `${it.name} · ${priceLabel(it)}` : 'Selected item'}
              </Badge>
            );
          })}
        </Group>
      )}
      {isMissingEndpoint(results.error) ? (
        <Text size="sm" c="dimmed">
          Choosing items for a brief is being set up. Creators can still tag any of your products.
        </Text>
      ) : (
        <>
          <TextInput
            placeholder="Search your products and services"
            aria-label="Search your products and services"
            leftSection={<IconSearch size={16} />}
            value={q}
            onChange={(e) => setQ(e.currentTarget.value)}
          />
          {results.isPending ? (
            <ListSkeleton rows={3} height={48} />
          ) : results.error ? (
            <ErrorBlock error={results.error} onRetry={() => void results.refetch()} title="Could not load your items" />
          ) : results.data.length === 0 ? (
            <Text size="sm" c="dimmed">
              {debounced ? 'Nothing matches.' : 'You have no published products or services yet.'}
            </Text>
          ) : (
            <Stack gap={6}>
              {results.data.map((it) => {
                const variantId = it.defaultVariantId;
                const on = !!variantId && selected.has(variantId);
                return (
                  <Card key={it.productId} withBorder padding="xs" data-testid={`pick-${it.productId}`}>
                    <Group justify="space-between" wrap="nowrap" gap="sm">
                      <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
                        <Avatar src={it.primaryImageUrl ?? undefined} radius="sm" size={40} />
                        <div style={{ minWidth: 0 }}>
                          <Text size="sm" fw={600} lineClamp={1}>
                            {it.name}
                          </Text>
                          <Group gap={6} wrap="nowrap">
                            <Text size="xs" c="dimmed" data-testid="price-label">
                              {priceLabel(it)}
                            </Text>
                            <ServiceItemBadge item={it} />
                          </Group>
                        </div>
                      </Group>
                      <Button
                        size="xs"
                        variant={on ? 'light' : 'default'}
                        disabled={!variantId}
                        onClick={() => variantId && toggle(variantId)}
                        aria-label={`${on ? 'Remove' : 'Add'} ${it.name}`}
                      >
                        {on ? 'Added' : 'Add'}
                      </Button>
                    </Group>
                  </Card>
                );
              })}
            </Stack>
          )}
        </>
      )}
    </Stack>
  );
}
