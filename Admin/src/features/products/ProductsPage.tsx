import { Alert, Avatar, Badge, Button, Chip, Group, Image, Select, SimpleGrid, Skeleton, Stack, Table, Text, TextInput, Timeline } from '@mantine/core';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconAlertTriangle, IconEye, IconEyeOff, IconSearch, IconStarFilled } from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import { isMissing } from '@/api/people';
import {
  PRODUCT_SORT,
  PRODUCT_STATUS_FILTER,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
  productsApi,
  TAKEDOWN_REASONS,
  type AdminProduct,
  type AdminProductDetail,
} from '@/api/products';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { useListState } from '@/hooks/useListState';
import { fmtMoney, fmtNumber, humanize } from '@/lib/format';

function Status({ p }: { p: Pick<AdminProduct, 'status' | 'unpublished'> }) {
  return (
    <Group gap={4} wrap="nowrap">
      <Badge variant="light" color={PRODUCT_STATUS_TONE[p.status] ?? 'gray'}>
        {PRODUCT_STATUS_LABEL[p.status] ?? humanize(p.status)}
      </Badge>
      {p.status === 'Suspended' && (
        <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
          {p.unpublished ? 'by an admin' : 'vendor suspended'}
        </Text>
      )}
    </Group>
  );
}

function priceText(p: AdminProduct) {
  if (!p.price) return '—';
  return p.price.min === p.price.max ? fmtMoney(p.price.min, p.price.currency) : `${fmtMoney(p.price.min, p.price.currency)} – ${fmtMoney(p.price.max, p.price.currency)}`;
}

/**
 * Every vendor's products with moderation: find a listing, see stock, sales and reports, take it down with a reason
 * the vendor is shown, and restore it when fixed.
 */
export function ProductsPage() {
  const list = useListState(['status', 'vendor', 'sort', 'flagged', 'unpublished', 'oos'] as const);
  const f = list.filters;
  const query = useQuery({
    queryKey: ['products', 'list', list.search, f, list.page, list.pageSize],
    queryFn: ({ signal }) =>
      productsApi.list(
        {
          search: list.search,
          status: f.status,
          vendorAccountId: f.vendor,
          sort: f.sort,
          flagged: f.flagged === '1',
          unpublished: f.unpublished === '1',
          outOfStock: f.oos === '1',
          page: list.page,
          pageSize: list.pageSize,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
    retry: false,
  });

  const columns: Column<AdminProduct>[] = [
    {
      key: 'product',
      header: 'Product',
      render: (p) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar src={p.thumbnailUrl} radius="sm" size={40} alt="">
            {p.name.slice(0, 1)}
          </Avatar>
          <TwoLine primary={p.name} secondary={p.categoryName} />
          {p.flagged && (
            <Badge size="xs" color="amber" variant="filled" title={`${p.openModerationItems} open report(s)`}>
              Reported
            </Badge>
          )}
        </Group>
      ),
    },
    { key: 'vendor', header: 'Vendor', visibleFrom: 'sm', render: (p) => p.vendorName ?? <IdText value={p.vendorAccountId} /> },
    { key: 'price', header: 'Price', align: 'right', visibleFrom: 'md', render: (p) => <Text size="sm" style={{ whiteSpace: 'nowrap' }}>{priceText(p)}</Text> },
    {
      key: 'stock',
      header: 'Stock',
      align: 'right',
      visibleFrom: 'lg',
      render: (p) => (p.stock ? <Text size="sm" c={p.stock.outOfStock ? 'signal' : undefined}>{fmtNumber(p.stock.totalOnHand)}</Text> : '—'),
    },
    { key: 'sold', header: 'Sold 30d', align: 'right', visibleFrom: 'lg', render: (p) => fmtNumber(p.unitsSold30d) },
    { key: 'status', header: 'Status', render: (p) => <Status p={p} /> },
  ];

  const toggle = (key: 'flagged' | 'unpublished' | 'oos') => list.setFilter(key, f[key] === '1' ? null : '1');

  return (
    <>
      <PageHeader title="Products" description="The catalogue across every vendor. Take a listing down with a reason the vendor sees; restore it when it is fixed." />
      {isMissing(query.error) ? (
        <NotAvailableBlock what="The cross-vendor product list" detail="GET /v1/admin/products ships with the backend branch feat/admin-api-gaps. This page is built for it and fills in once that is deployed." />
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
            <Stack gap="sm">
              <Group gap="md" align="flex-end" wrap="wrap">
                <TextInput label="Search" placeholder="Name, SKU or product ID" leftSection={<IconSearch size={14} />} w={280} value={list.searchInput} onChange={(e) => list.setSearchInput(e.currentTarget.value)} />
                <Select label="Status" w={160} clearable placeholder="Any" data={PRODUCT_STATUS_FILTER} value={f.status || null} onChange={(v) => list.setFilter('status', v)} />
                <Select label="Sort" w={180} data={PRODUCT_SORT} value={f.sort || 'updated_desc'} onChange={(v) => list.setFilter('sort', v === 'updated_desc' ? null : v)} allowDeselect={false} />
              </Group>
              <Group gap="xs">
                <Chip size="sm" checked={f.flagged === '1'} onChange={() => toggle('flagged')}>
                  Reported
                </Chip>
                <Chip size="sm" checked={f.unpublished === '1'} onChange={() => toggle('unpublished')}>
                  Taken down
                </Chip>
                <Chip size="sm" checked={f.oos === '1'} onChange={() => toggle('oos')}>
                  Out of stock
                </Chip>
                {f.vendor && (
                  <Group gap={6}>
                    <Text size="sm" c="dimmed">
                      Vendor
                    </Text>
                    <IdText value={f.vendor} />
                    <Button size="compact-xs" variant="subtle" onClick={() => list.setFilter('vendor', null)}>
                      Clear
                    </Button>
                  </Group>
                )}
              </Group>
            </Stack>
          }
        />
      )}
      <ProductDrawer id={list.selected} onClose={() => list.open(null)} />
    </>
  );
}

function ProductDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const q = useQuery({ queryKey: ['products', 'detail', id], queryFn: ({ signal }) => productsApi.detail(id!, signal), enabled: !!id });
  const p = q.data;
  const done = (r: unknown) => {
    queryClient.setQueryData(['products', 'detail', id], r as AdminProductDetail);
    void queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
  };
  const canTakeDown = p && !p.unpublished && p.status !== 'Draft' && p.status !== 'Archived';

  return (
    <DetailDrawer
      opened={!!id}
      onClose={onClose}
      title={p?.name ?? 'Product'}
      subtitle={p ? [p.vendorName, p.categoryName].filter(Boolean).join(' · ') : undefined}
      badges={p && <Status p={p} />}
      actions={
        p &&
        can('moderateProducts') && (
          <>
            {canTakeDown && (
              <Button
                size="sm"
                variant="light"
                color="signal"
                leftSection={<IconEyeOff size={16} />}
                onClick={() =>
                  open({
                    title: `Take down “${p.name}”`,
                    consequence: 'The listing disappears from search, reels, collections and the shop, and the vendor gets an email with your reason. You can restore it later.',
                    confirmLabel: 'Take down listing',
                    danger: true,
                    fields: [
                      { name: 'code', kind: 'select', label: 'Reason category', options: TAKEDOWN_REASONS },
                      { name: 'reason', kind: 'textarea', label: 'Reason (shown to the vendor)', required: true, minLength: 3 },
                    ],
                    run: (v) => productsApi.unpublish(p.id, v.reason!.trim(), v.code || null),
                    success: 'Listing taken down.',
                    onDone: done,
                  })
                }
              >
                Take down…
              </Button>
            )}
            {p.unpublished && (
              <Button
                size="sm"
                leftSection={<IconEye size={16} />}
                onClick={() =>
                  open({
                    title: `Restore “${p.name}”`,
                    consequence: 'The listing goes live again (unless the vendor’s whole account is suspended - then it returns when they are reinstated).',
                    confirmLabel: 'Restore listing',
                    fields: [{ name: 'note', kind: 'textarea', label: 'Note (audit log)' }],
                    run: (v) => productsApi.restore(p.id, v.note?.trim() || null),
                    success: 'Listing restored.',
                    onDone: done,
                  })
                }
              >
                Restore
              </Button>
            )}
          </>
        )
      }
    >
      {dialog}
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : !p ? (
        <Stack>
          <Skeleton height={160} radius="lg" />
          <Skeleton height={200} radius="lg" />
        </Stack>
      ) : (
        <Stack gap="lg">
          {p.unpublished && (
            <Alert color="signal" variant="light" icon={<IconEyeOff size={16} />} title="Taken down by an admin">
              {p.unpublished.reasonCode ? `${humanize(p.unpublished.reasonCode)} - ` : ''}
              {p.unpublished.reason} · <When value={p.unpublished.atUtc} />
            </Alert>
          )}
          {p.moderation && p.moderation.openItems.length > 0 && (
            <Alert color="amber" variant="light" icon={<IconAlertTriangle size={16} />} title={`${p.moderation.openItems.length} open report(s)`}>
              <Stack gap={4}>
                {p.moderation.openItems.map((m) => (
                  <Group key={m.moderationItemId} gap={6}>
                    <Text size="sm">{m.reportReasonCode ? humanize(m.reportReasonCode) : humanize(m.source)}</Text>
                    <Text size="xs" c="dimmed">
                      <When value={m.submittedUtc} relative />
                    </Text>
                    {can('viewModeration') && (
                      <Button size="compact-xs" variant="subtle" component={Link} to={`/moderation?state=all&open=${encodeURIComponent(m.moderationItemId)}`}>
                        Open report
                      </Button>
                    )}
                  </Group>
                ))}
              </Stack>
            </Alert>
          )}
          {p.images.length > 0 && (
            <SimpleGrid cols={{ base: 3, sm: 5 }} spacing="xs">
              {[...p.images]
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((img) => (
                  <a key={img.id} href={img.url} target="_blank" rel="noopener noreferrer" aria-label="Open image full size">
                    <Image src={img.url} alt="" radius="md" h={96} fit="cover" />
                  </a>
                ))}
            </SimpleGrid>
          )}
          <SectionCard title="Listing">
            <FieldGrid
              cols={3}
              fields={[
                { label: 'Price', value: priceText(p) },
                { label: 'On hand', value: p.stock ? `${fmtNumber(p.stock.totalOnHand)} across ${p.stock.variantCount} variant(s)` : null },
                { label: 'Sold', value: p.unitsSold != null ? `${fmtNumber(p.unitsSold)} (${fmtNumber(p.unitsSold30d)} in 30 days)` : null },
                {
                  label: 'Rating',
                  value: p.averageRating != null ? (
                    <Group gap={4}>
                      <IconStarFilled size={12} color="var(--mantine-color-amber-6)" />
                      {p.averageRating.toFixed(1)} ({p.reviewCount ?? 0})
                    </Group>
                  ) : null,
                },
                { label: 'In a reel', value: p.hasReel == null ? null : p.hasReel ? 'Yes' : 'No' },
                { label: 'Processing time', value: p.processingTimeDays != null ? `${p.processingTimeDays} day(s)` : null },
                { label: 'Restriction', value: p.restrictionLevel },
                { label: 'Created', value: <When value={p.createdUtc} /> },
                { label: 'Updated', value: <When value={p.updatedUtc} /> },
                { label: 'Short description', value: p.shortDescription, wide: true },
                { label: 'Vendor', value: <IdText value={p.vendorAccountId} /> },
                { label: 'Product ID', value: <IdText value={p.id} /> },
              ]}
            />
            {p.longDescriptionMarkdown && (
              <Text size="sm" mt="md" style={{ whiteSpace: 'pre-wrap' }} lineClamp={12}>
                {p.longDescriptionMarkdown}
              </Text>
            )}
          </SectionCard>
          {p.variants.length > 0 && (
            <SectionCard title={`Variants (${p.variants.length})`}>
              <Table.ScrollContainer minWidth={420}>
                <Table aria-label="Variants">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>SKU</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Price</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>On hand</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {p.variants.map((v) => (
                      <Table.Tr key={v.id}>
                        <Table.Td>
                          <span className="sm-mono">{v.sku}</span> {v.isDefault && <Badge size="xs" variant="outline">Default</Badge>}
                        </Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{fmtMoney(v.price.amount, v.price.currency)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{v.trackInventory ? fmtNumber(v.quantityOnHand) : 'Not tracked'}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </SectionCard>
          )}
          {p.moderation && p.moderation.history.length > 0 && (
            <SectionCard title="Moderation history">
              <Timeline bulletSize={14} lineWidth={2}>
                {p.moderation.history.map((h, i) => (
                  <Timeline.Item key={i} title={humanize(h.action)}>
                    <Text size="sm">{[h.reasonCode ? humanize(h.reasonCode) : null, h.reason].filter(Boolean).join(' - ') || '—'}</Text>
                    <Text size="xs" c="dimmed">
                      <When value={h.atUtc} /> · <IdText value={h.byAdminId} />
                    </Text>
                  </Timeline.Item>
                ))}
              </Timeline>
            </SectionCard>
          )}
        </Stack>
      )}
    </DetailDrawer>
  );
}
