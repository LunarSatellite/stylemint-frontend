import { Avatar, Badge, Button, Group, Select, Skeleton, Stack, Text, TextInput } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconEyeOff, IconEye, IconSearch } from '@tabler/icons-react';
import { PRODUCT_STATE, PRODUCT_TONE, productsApi, type ProductRow } from '@/api/catalog';
import { isMissing } from '@/api/people';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, StatusBadge, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';
import { fmtMoney } from '@/lib/format';

const nameOf = (p: ProductRow) => p.title || p.name || 'Untitled product';
const stateOf = (p: ProductRow) => p.state ?? p.status ?? null;

function StateBadge({ value }: { value: number | string | null }) {
  if (typeof value === 'number')
    return (
      <Badge variant="light" color={PRODUCT_TONE[value] ?? 'gray'}>
        {PRODUCT_STATE[value] ?? value}
      </Badge>
    );
  return <StatusBadge value={value} />;
}

/**
 * Every vendor's products, with moderation. Built against `GET /v1/admin/products` (and suspend/reinstate), which the
 * backend is adding; until it answers, the page says the list isn't available rather than showing an empty catalogue.
 */
export function ProductsPage() {
  const { can } = useAuth();
  const list = useListState(['state', 'vendor'] as const);
  const query = useQuery({
    queryKey: ['products', 'list', list.search, list.filters.state, list.filters.vendor, list.page, list.pageSize],
    queryFn: ({ signal }) => productsApi.list({ search: list.search, state: list.filters.state, vendorAccountId: list.filters.vendor, page: list.page, pageSize: list.pageSize }, signal),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const columns: Column<ProductRow>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (p) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar src={p.primaryImageUrl ?? p.thumbnailUrl} radius="sm" size={38} alt="">
            {nameOf(p).slice(0, 1)}
          </Avatar>
          <TwoLine primary={nameOf(p)} secondary={p.categoryName} />
        </Group>
      ),
    },
    { key: 'vendor', header: 'Vendor', render: (p) => p.vendorName ?? <IdText value={p.vendorAccountId ?? null} /> },
    { key: 'price', header: 'Price', align: 'right', visibleFrom: 'sm', render: (p) => fmtMoney(p.priceAmount ?? p.price ?? null, p.currency) },
    { key: 'state', header: 'State', render: (p) => <StateBadge value={stateOf(p)} /> },
    { key: 'updated', header: 'Updated', visibleFrom: 'md', render: (p) => <When value={p.updatedUtc ?? p.createdUtc ?? null} relative /> },
  ];

  return (
    <>
      <PageHeader title="Products" description="The catalogue across every vendor. Suspend a listing that breaks the rules; reinstate it when fixed." />
      {isMissing(query.error) ? (
        <NotAvailableBlock what="The cross-vendor product list" detail="The backend is adding GET /v1/admin/products and its moderation actions. This page is built for it and fills in as soon as it ships - nothing is hidden." />
      ) : (
        <DataTable
          label="Products"
          columns={columns}
          page={query.data}
          isLoading={query.isLoading}
          isFetching={query.isFetching}
          error={query.error}
          onRetry={() => void query.refetch()}
          rowKey={(p) => p.id}
          onRowClick={(p) => list.open(p.id)}
          selectedKey={list.selected}
          onPageChange={list.setPage}
          onPageSizeChange={list.setPageSize}
          filtered={list.filtered}
          emptyTitle="No products yet"
          toolbar={
            <Group gap="md" align="flex-end" wrap="wrap">
              <TextInput label="Search" placeholder="Product name" leftSection={<IconSearch size={14} />} w={280} value={list.searchInput} onChange={(e) => list.setSearchInput(e.currentTarget.value)} />
              <Select
                label="State"
                w={170}
                clearable
                placeholder="Any state"
                data={Object.entries(PRODUCT_STATE).map(([value, label]) => ({ value, label }))}
                value={list.filters.state || null}
                onChange={(v) => list.setFilter('state', v)}
              />
            </Group>
          }
        />
      )}
      <ProductDrawer id={list.selected} row={query.data?.items.find((p) => p.id === list.selected)} onClose={() => list.open(null)} canModerate={can('moderateProducts')} />
    </>
  );
}

function ProductDrawer({ id, row, onClose, canModerate }: { id: string | null; row?: ProductRow; onClose: () => void; canModerate: boolean }) {
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const detail = useQuery({ queryKey: ['products', 'detail', id], queryFn: ({ signal }) => productsApi.detail(id!, signal), enabled: !!id, retry: false });
  const p = detail.data ?? row;
  const state = p ? stateOf(p) : null;
  const suspended = state === 5 || state === 'Suspended';

  const act = (suspend: boolean) =>
    open({
      title: suspend ? `Suspend “${p ? nameOf(p) : 'product'}”` : `Reinstate “${p ? nameOf(p) : 'product'}”`,
      consequence: suspend
        ? 'Shoppers stop seeing the listing everywhere - search, reels, collections - until it is reinstated. The vendor is told why.'
        : 'The listing returns to the catalogue in its previous state.',
      confirmLabel: suspend ? 'Suspend listing' : 'Reinstate listing',
      danger: suspend,
      fields: [{ name: 'reason', kind: 'textarea', label: suspend ? 'Reason (shown to the vendor)' : 'Reason', required: true, minLength: 5 }],
      run: (v) => (suspend ? productsApi.suspend(id!, v.reason!.trim()) : productsApi.reinstate(id!, v.reason!.trim())),
      success: suspend ? 'Listing suspended.' : 'Listing reinstated.',
      onDone: () => void queryClient.invalidateQueries({ queryKey: ['products'] }),
    });

  return (
    <DetailDrawer
      opened={!!id}
      onClose={onClose}
      title={p ? nameOf(p) : 'Product'}
      subtitle={p?.vendorName ?? undefined}
      badges={p && <StateBadge value={state} />}
      actions={
        canModerate &&
        p && (
          <Button size="sm" variant={suspended ? 'default' : 'light'} color={suspended ? undefined : 'signal'} leftSection={suspended ? <IconEye size={16} /> : <IconEyeOff size={16} />} onClick={() => act(!suspended)}>
            {suspended ? 'Reinstate' : 'Suspend listing'}
          </Button>
        )
      }
    >
      {dialog}
      {!p ? (
        <Skeleton height={200} radius="lg" />
      ) : (
        <Stack gap="lg">
          {(p.primaryImageUrl || p.thumbnailUrl) && (
            <div className="sm-doc-frame">
              <img src={p.primaryImageUrl ?? p.thumbnailUrl ?? ''} alt={nameOf(p)} loading="lazy" />
            </div>
          )}
          <SectionCard title="Listing">
            <FieldGrid
              fields={[
                { label: 'Name', value: nameOf(p) },
                { label: 'Category', value: p.categoryName },
                { label: 'Price', value: fmtMoney(p.priceAmount ?? p.price ?? null, p.currency) },
                { label: 'Publicly listed', value: p.isPubliclyListed == null ? null : p.isPubliclyListed ? 'Yes' : 'No' },
                { label: 'Vendor', value: p.vendorName ?? <IdText value={p.vendorAccountId ?? null} /> },
                { label: 'Product ID', value: <IdText value={p.id} /> },
                { label: 'Created', value: <When value={p.createdUtc ?? null} /> },
                { label: 'Updated', value: <When value={p.updatedUtc ?? null} /> },
              ]}
            />
          </SectionCard>
          {detail.error && !isMissing(detail.error) && (
            <Text size="sm" c="dimmed">
              Showing the list row; the full detail couldn’t be loaded.
            </Text>
          )}
        </Stack>
      )}
    </DetailDrawer>
  );
}
