import { useEffect } from 'react';
import { ActionIcon, Avatar, Badge, Button, Group, Select, Skeleton, Stack, Table, Text } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { COLLECTION_KIND, COLLECTION_STATE, collectionsApi, CAMPAIGN_TONE, PRODUCT_STATE, type CollectionSummary } from '@/api/catalog';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock, SectionCard } from '@/components/StateBlocks';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Platform collections (editorial and looks): curate products, publish, archive. */
export function CollectionsPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const list = useListState(['state'] as const, { pageSize: 25 });
  const cursors = useCursorPages(`${list.filters.state}|${list.pageSize}`, list.page, list.setPage);
  const query = useQuery({
    queryKey: ['collections', list.filters.state, cursors.cursor, list.page, list.pageSize],
    queryFn: ({ signal }) => collectionsApi.list({ state: list.filters.state, cursor: cursors.cursor, page: list.page, pageSize: list.pageSize }, signal),
    enabled: cursors.ready,
    placeholderData: keepPreviousData,
  });
  useEffect(() => {
    if (query.data) cursors.remember(list.page, query.data.nextCursor);
  }, [query.data, list.page, cursors]);

  const create = () =>
    open({
      title: 'New collection',
      consequence: 'Starts as a draft with no products. Add at least one product before publishing.',
      confirmLabel: 'Create draft',
      fields: [
        { name: 'kind', kind: 'select', label: 'Kind', required: true, options: [{ value: '1', label: 'Editorial' }, { value: '4', label: 'Look' }], defaultValue: '1' },
        { name: 'title', kind: 'text', label: 'Title', required: true },
        { name: 'slug', kind: 'text', label: 'Slug', required: true, placeholder: 'summer-linen-edit' },
        { name: 'subtitle', kind: 'text', label: 'Subtitle' },
        { name: 'cover', kind: 'text', label: 'Cover image URL (https)' },
      ],
      run: (v) => {
        if (!SLUG.test(v.slug!.trim())) return Promise.reject(new Error('The slug may use lowercase letters, numbers and single hyphens.'));
        return collectionsApi.create({
          kind: Number(v.kind),
          slug: v.slug!.trim(),
          title: v.title!.trim(),
          subtitle: v.subtitle?.trim() || null,
          description: null,
          coverImageUrl: v.cover?.trim() || null,
          sortOrder: 0,
          startsUtc: null,
          endsUtc: null,
        });
      },
      success: 'Draft collection created.',
      onDone: (r) => {
        void queryClient.invalidateQueries({ queryKey: ['collections'] });
        list.open((r as { id: string }).id);
      },
    });

  const columns: Column<CollectionSummary>[] = [
    {
      key: 'title',
      header: 'Collection',
      render: (c) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar src={c.coverImageUrl} radius="sm" size={36} alt="">
            {c.title.slice(0, 1)}
          </Avatar>
          <TwoLine primary={c.title} secondary={<span className="sm-mono">{c.slug}</span>} />
        </Group>
      ),
    },
    { key: 'kind', header: 'Kind', visibleFrom: 'sm', render: (c) => COLLECTION_KIND[c.kind] },
    { key: 'items', header: 'Products', align: 'right', render: (c) => c.itemCount },
    { key: 'state', header: 'State', render: (c) => <Badge variant="light" color={CAMPAIGN_TONE[c.state]}>{COLLECTION_STATE[c.state]}</Badge> },
    { key: 'updated', header: 'Updated', visibleFrom: 'md', render: (c) => <When value={c.updatedUtc} relative /> },
  ];

  return (
    <>
      {dialog}
      <PageHeader
        title="Collections"
        description="Editorial collections and shoppable looks curated by StyleMint. Vendor and creator collections are managed by their owners."
        actions={
          can('manageCatalogOps') && (
            <Button leftSection={<IconPlus size={16} />} onClick={create}>
              New collection
            </Button>
          )
        }
      />
      <DataTable
        label="Collections"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading || !cursors.ready}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(c) => c.id}
        onRowClick={(c) => list.open(c.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        pagerMode="cursor"
        filtered={!!list.filters.state}
        emptyTitle="No collections yet"
        toolbar={<Select label="State" w={160} clearable placeholder="Any" data={Object.entries(COLLECTION_STATE).map(([value, label]) => ({ value, label }))} value={list.filters.state || null} onChange={(v) => list.setFilter('state', v)} />}
      />
      <CollectionDrawer id={list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function CollectionDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const q = useQuery({ queryKey: ['collections', 'detail', id], queryFn: ({ signal }) => collectionsApi.get(id!, signal), enabled: !!id });
  const c = q.data;
  const manage = can('manageCatalogOps') && c?.state !== 3;
  const done = (r?: unknown) => {
    if (r && typeof r === 'object' && 'id' in r) queryClient.setQueryData(['collections', 'detail', id], r);
    void queryClient.invalidateQueries({ queryKey: ['collections'] });
  };
  return (
    <DetailDrawer
      opened={!!id}
      onClose={onClose}
      title={c?.title ?? 'Collection'}
      subtitle={c?.subtitle ?? undefined}
      badges={c && <Badge variant="light" color={CAMPAIGN_TONE[c.state]}>{COLLECTION_STATE[c.state]}</Badge>}
      actions={
        c &&
        manage && (
          <>
            <Button
              size="sm"
              leftSection={<IconPlus size={16} />}
              onClick={() =>
                open({
                  title: 'Add a product',
                  consequence: 'Appended at the end. Only active or out-of-stock products can be added (60 at most).',
                  confirmLabel: 'Add product',
                  fields: [
                    { name: 'productId', kind: 'text', label: 'Product ID', required: true },
                    { name: 'note', kind: 'text', label: 'Note shown with it (optional)' },
                  ],
                  run: (v) => (GUID.test(v.productId!.trim()) ? collectionsApi.addItem(c.id, v.productId!.trim(), v.note?.trim() || null) : Promise.reject(new Error('Paste a product ID.'))),
                  success: 'Product added.',
                  onDone: done,
                })
              }
            >
              Add product
            </Button>
            {c.state === 1 && (
              <Button size="sm" variant="light" onClick={() => open({ title: 'Publish the collection', consequence: 'Shoppers can see it (within its dates, if set).', confirmLabel: 'Publish', run: () => collectionsApi.publish(c.id), success: 'Collection published.', onDone: done })}>
                Publish…
              </Button>
            )}
            <Button size="sm" variant="light" color="signal" onClick={() => open({ title: 'Archive the collection', consequence: 'It disappears for shoppers and cannot be published again.', confirmLabel: 'Archive', danger: true, run: () => collectionsApi.archive(c.id), success: 'Collection archived.', onDone: done })}>
              Archive…
            </Button>
          </>
        )
      }
    >
      {dialog}
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : !c ? (
        <Skeleton height={200} radius="lg" />
      ) : (
        <Stack gap="lg">
          <SectionCard title="About">
            <FieldGrid
              fields={[
                { label: 'Kind', value: COLLECTION_KIND[c.kind] },
                { label: 'Slug', value: <span className="sm-mono">{c.slug}</span> },
                { label: 'Runs from', value: <When value={c.startsUtc} /> },
                { label: 'Runs until', value: <When value={c.endsUtc} /> },
                { label: 'Published', value: <When value={c.publishedUtc} /> },
                { label: 'ID', value: <IdText value={c.id} /> },
                { label: 'Description', value: c.description, wide: true },
              ]}
            />
          </SectionCard>
          <SectionCard title={`Products (${c.items.length})`}>
            {c.items.length === 0 ? (
              <Text size="sm" c="dimmed">
                No products yet. Add at least one before publishing.
              </Text>
            ) : (
              <Table aria-label="Products in the collection">
                <Table.Tbody>
                  {c.items.map((i) => (
                    <Table.Tr key={i.productId}>
                      <Table.Td>
                        <Group gap="sm" wrap="nowrap">
                          <Avatar src={i.primaryImageUrl} radius="sm" size={36} alt="">
                            {i.productName.slice(0, 1)}
                          </Avatar>
                          <TwoLine primary={i.productName} secondary={i.note} />
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        {!i.isPubliclyListed && (
                          <Badge size="xs" color="amber" variant="light">
                            Not listed
                          </Badge>
                        )}
                        {i.productState && i.productState !== 2 && (
                          <Badge size="xs" color="gray" variant="light" ml={4}>
                            {PRODUCT_STATE[i.productState]}
                          </Badge>
                        )}
                      </Table.Td>
                      <Table.Td style={{ width: 40 }}>
                        {manage && (
                          <ActionIcon
                            variant="subtle"
                            color="signal"
                            aria-label={`Remove ${i.productName}`}
                            onClick={() => open({ title: `Remove “${i.productName}”`, consequence: 'It leaves this collection. The product itself is untouched.', confirmLabel: 'Remove', danger: true, run: () => collectionsApi.removeItem(c.id, i.productId), success: 'Removed from the collection.', onDone: done })}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        )}
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </SectionCard>
        </Stack>
      )}
    </DetailDrawer>
  );
}
