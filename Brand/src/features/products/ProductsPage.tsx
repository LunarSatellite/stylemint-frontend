import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Anchor,
  Avatar,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  ScrollArea,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
} from '@mantine/core';
import { IconDots, IconEdit, IconPackages, IconPhoto, IconPlus, IconRocket, IconSearch, IconX } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCursorList } from '../../api/useCursorList';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatMoney, fromNow } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { useIsPhone } from '../../lib/useIsPhone';
import { ProductState, productsApi, productStateColor, productStateLabel, type Product } from './api';
import { StockModal } from './StockModal';

const FILTERS = [
  { value: 'all', label: 'All', state: null },
  { value: 'live', label: 'Live', state: ProductState.Active },
  { value: 'draft', label: 'Drafts', state: ProductState.Draft },
  { value: 'oos', label: 'Out of stock', state: ProductState.OutOfStock },
  { value: 'archived', label: 'Archived', state: ProductState.Archived },
];

const LOW_STOCK = 5;

function stockOf(p: Product) {
  const v = p.variants.find((x) => x.isDefault) ?? p.variants[0];
  return v;
}

function StockBadge({ p }: { p: Product }) {
  const v = stockOf(p);
  if (!v) return <Text size="sm">—</Text>;
  if (!v.trackInventory) return <Text size="sm" c="dimmed">Not tracked</Text>;
  const color = v.quantityOnHand === 0 ? 'signal' : v.quantityOnHand <= LOW_STOCK ? 'amber' : 'gray';
  return (
    <Badge color={color} variant="light">
      {v.quantityOnHand} in stock
    </Badge>
  );
}

export default function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filterId = params.get('filter') ?? 'all';
  const lowStockOnly = params.get('stock') === 'low';
  const filter = FILTERS.find((f) => f.value === filterId) ?? FILTERS[0];
  const [search, setSearch] = useState('');
  const [stockFor, setStockFor] = useState<string | null>(null);
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const wide = search.trim().length > 0 || lowStockOnly;
  const list = useCursorList({
    key: ['products', 'list', filter.value],
    resetKey: `${filter.value}|${wide}`,
    fetchPage: (cursor) => productsApi.list(filter.state, cursor, wide ? 100 : 25),
  });
  const raw = list.query.data?.items;
  const items = useMemo(() => {
    const t = search.trim().toLowerCase();
    return (raw ?? []).filter((p) => {
      if (t && !p.name.toLowerCase().includes(t) && !p.variants.some((v) => v.sku.toLowerCase().includes(t))) return false;
      if (lowStockOnly) {
        const v = stockOf(p);
        if (!v || !v.trackInventory || v.quantityOnHand > LOW_STOCK) return false;
      }
      return true;
    });
  }, [raw, search, lowStockOnly]);

  const publish = useMutation({
    mutationFn: (id: string) => productsApi.publish(id),
    onSuccess: () => {
      toastSuccess('Product published');
      void qc.invalidateQueries({ queryKey: ['products'] });
    },
    onError: (e) => toastError(e, 'Could not publish'),
  });

  const setFilter = (value: string) => {
    const next = new URLSearchParams(params);
    if (value === 'all') next.delete('filter');
    else next.set('filter', value);
    setParams(next, { replace: true });
  };

  const rowMenu = (p: Product) => (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" aria-label={`More actions for ${p.name}`} onClick={(e) => e.stopPropagation()}>
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown onClick={(e) => e.stopPropagation()}>
        <Menu.Item leftSection={<IconEdit size={14} />} component={Link} to={`/products/${p.id}`}>
          {p.state === ProductState.Draft ? 'Continue editing' : 'Edit'}
        </Menu.Item>
        {p.state !== ProductState.Archived && (
          <Menu.Item leftSection={<IconPackages size={14} />} onClick={() => setStockFor(p.id)}>
            Update stock
          </Menu.Item>
        )}
        {p.state === ProductState.Draft && p.wizardStepReached >= 4 && (
          <Menu.Item leftSection={<IconRocket size={14} />} onClick={() => publish.mutate(p.id)}>
            Publish
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );

  const thumb = (p: Product) => (
    <Avatar src={p.images[0]?.cdnUrl} radius="md" size={44} color="forest" alt="">
      <IconPhoto size={18} />
    </Avatar>
  );

  return (
    <>
      <PageHeader
        title="Products"
        description="Everything you sell on StyleMint."
        actions={
          <Button component={Link} to="/products/new" leftSection={<IconPlus size={16} />}>
            Add product
          </Button>
        }
      />
      <ScrollArea type="never" mb="sm">
        <SegmentedControl value={filter.value} onChange={setFilter} data={FILTERS.map((f) => ({ value: f.value, label: f.label }))} aria-label="Filter products" />
      </ScrollArea>
      <Group mb="md" gap="sm" wrap="wrap">
        <TextInput
          placeholder="Search name or SKU"
          leftSection={<IconSearch size={16} />}
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          style={{ flex: '1 1 240px', maxWidth: 380 }}
          aria-label="Search products"
          rightSection={
            search ? (
              <ActionIcon variant="subtle" color="gray" onClick={() => setSearch('')} aria-label="Clear search">
                <IconX size={14} />
              </ActionIcon>
            ) : null
          }
        />
        {lowStockOnly && (
          <Badge
            size="lg"
            color="amber"
            variant="light"
            rightSection={
              <ActionIcon
                size="xs"
                variant="transparent"
                color="amber"
                aria-label="Show all stock levels"
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.delete('stock');
                  setParams(next, { replace: true });
                }}
              >
                <IconX size={12} />
              </ActionIcon>
            }
          >
            Low stock only
          </Badge>
        )}
      </Group>

      {list.query.isPending ? (
        <ListSkeleton rows={6} height={isPhone ? 80 : 56} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} onRetry={() => void list.query.refetch()} title="Could not load your products" />
      ) : items.length === 0 ? (
        <Card>
          <EmptyBlock
            title={wide ? 'No products match' : filter.value === 'all' ? 'You have no products yet' : `No ${filter.label.toLowerCase()} products`}
            body={filter.value === 'all' && !wide ? 'Add your first product — it takes a few minutes.' : undefined}
            action={
              filter.value === 'all' && !wide ? (
                <Button component={Link} to="/products/new" leftSection={<IconPlus size={16} />} mt="sm">
                  Add product
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : isPhone ? (
        <Stack gap="sm">
          {items.map((p) => {
            const v = stockOf(p);
            return (
              <Card key={p.id} padding="sm" data-interactive="true" onClick={() => navigate(`/products/${p.id}`)} style={{ cursor: 'pointer' }}>
                <Group wrap="nowrap" align="flex-start" gap="sm">
                  {thumb(p)}
                  <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={600} size="sm" lineClamp={2}>
                      {p.name}
                    </Text>
                    <Group gap={6}>
                      <Text size="sm">{v ? formatMoney({ amount: v.priceAmount, currency: v.priceCurrency }) : '—'}</Text>
                      <Badge color={productStateColor[p.state]} variant="light" size="sm">
                        {productStateLabel[p.state]}
                      </Badge>
                    </Group>
                    <StockBadge p={p} />
                  </Stack>
                  {rowMenu(p)}
                </Group>
              </Card>
            );
          })}
        </Stack>
      ) : (
        <Card padding={0}>
          <Table.ScrollContainer minWidth={720}>
            <Table>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Product</Table.Th>
                  <Table.Th ta="right">Price</Table.Th>
                  <Table.Th>Stock</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Updated</Table.Th>
                  <Table.Th />
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((p) => {
                  const v = stockOf(p);
                  return (
                    <Table.Tr key={p.id} className="sm-row-link" onClick={() => navigate(`/products/${p.id}`)}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          {thumb(p)}
                          <div style={{ minWidth: 0 }}>
                            <Anchor component={Link} to={`/products/${p.id}`} fw={600} size="sm" c="inherit" lineClamp={1} onClick={(e) => e.stopPropagation()}>
                              {p.name}
                            </Anchor>
                            <Text size="xs" c="dimmed">
                              {v?.sku.startsWith('DRAFT-') ? 'No SKU yet' : v?.sku}
                            </Text>
                          </div>
                        </Group>
                      </Table.Td>
                      <Table.Td ta="right">
                        <Text size="sm">{v ? formatMoney({ amount: v.priceAmount, currency: v.priceCurrency }) : '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <StockBadge p={p} />
                      </Table.Td>
                      <Table.Td>
                        <Badge color={productStateColor[p.state]} variant="light">
                          {productStateLabel[p.state]}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {fromNow(p.updatedUtc)}
                        </Text>
                      </Table.Td>
                      <Table.Td onClick={(e) => e.stopPropagation()}>{rowMenu(p)}</Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        </Card>
      )}
      {!wide && (
        <Pager
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          shown={items.length}
          hasPrev={list.hasPrev}
          hasNext={list.hasNext}
          onPrev={list.prev}
          onNext={list.next}
          busy={list.query.isFetching}
        />
      )}
      {wide && list.hasNext && (
        <Text size="xs" c="dimmed" mt="sm">
          Showing matches among your latest 100 products.
        </Text>
      )}
      <StockModal productId={stockFor} onClose={() => setStockFor(null)} />
    </>
  );
}
