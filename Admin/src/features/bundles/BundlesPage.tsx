import { useEffect, useState } from 'react';
import { ActionIcon, Alert, Avatar, Badge, Button, Group, Modal, NumberInput, Select, Skeleton, Stack, Table, Text, Textarea, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { IconArchive, IconPlayerPause, IconPlayerPlay, IconPlus, IconSearch, IconSend, IconShieldOff, IconTrash } from '@tabler/icons-react';
import {
  adminBundleActions,
  bundleErrorMessage,
  bundlesAdminApi,
  DESCRIPTION_MAX,
  formatPercent,
  isPurchasable,
  MAX_DISCOUNT,
  MAX_ITEMS,
  MAX_QUANTITY,
  ownerKindLabel,
  OWNER_KIND_OPTIONS,
  pausedReasonLabel,
  previewTotals,
  shopStateColor,
  shopStateLabel,
  STATE_OPTIONS,
  stateColor,
  stateLabel,
  submitBlocker,
  TAKEDOWN_NOTE_MIN,
  termsChangeWarning,
  TITLE_MAX,
  validateBundleText,
  validateQuantity,
  validTakedownNote,
  type Bundle,
  type BundleState,
  type BundleSummary,
} from '@/api/bundles';
import { ApiError } from '@/api/errors';
import { productsApi } from '@/api/products';
import { useAuth } from '@/auth/guards';
import { withStepUp } from '@/auth/stepUp';
import { useActionDialog, type ActionSpec } from '@/components/ActionDialog';
import { FieldGrid, IdText, TwoLine, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { ErrorBlock, NotAvailableBlock, SectionCard } from '@/components/StateBlocks';
import { useCursorPages } from '@/hooks/useCursorPages';
import { useListState } from '@/hooks/useListState';
import { fmtMoney } from '@/lib/format';

const isMissing = (e: unknown) => e instanceof ApiError && e.isMissingEndpoint;

export function BundleStateBadge({ state }: { state: BundleState }) {
  return (
    <Badge variant="light" color={stateColor[state]} size="sm" data-testid="bundle-state">
      {stateLabel[state]}
    </Badge>
  );
}

/**
 * Multi-shop bundles across StyleMint (shop-bundles-contract §B5 admin): search by title / owner / id, filter by state
 * and owner kind, look at shops and items, create StyleMint bundles, take a bundle down with a note (only an admin can
 * put it back), archive.
 */
export function BundlesPage() {
  const { can } = useAuth();
  const list = useListState(['state', 'owner'] as const, { pageSize: 25 });
  const resetKey = `${list.search}|${list.filters.state}|${list.filters.owner}|${list.pageSize}`;
  const cursors = useCursorPages(resetKey, list.page, list.setPage);
  const [creating, setCreating] = useState(false);
  const query = useQuery({
    queryKey: ['bundles', 'list', resetKey, cursors.cursor, list.page],
    queryFn: ({ signal }) =>
      bundlesAdminApi.list({ q: list.search, state: list.filters.state, ownerKind: list.filters.owner, cursor: cursors.cursor, page: list.page, pageSize: list.pageSize }, signal),
    enabled: cursors.ready,
    placeholderData: keepPreviousData,
    retry: false,
  });
  useEffect(() => {
    if (query.data) cursors.remember(list.page, query.data.nextCursor);
  }, [query.data, list.page, cursors]);

  const header = (
    <PageHeader
      title="Bundles"
      description="Products from one or more shops sold together at a discount. Every shop accepts the discount on its own items before a bundle goes live."
      actions={
        can('manageBundles') &&
        !isMissing(query.error) && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)}>
            New StyleMint bundle
          </Button>
        )
      }
    />
  );
  if (isMissing(query.error))
    return (
      <>
        {header}
        <NotAvailableBlock what="Bundles" detail="Multi-shop bundles are being set up on this server. Bundles will appear here once they are." />
      </>
    );

  const columns: Column<BundleSummary>[] = [
    {
      key: 'title',
      header: 'Bundle',
      render: (b) => (
        <Group gap="sm" wrap="nowrap">
          <Avatar src={b.coverImageUrl} radius="sm" size={36} alt="">
            {b.title.slice(0, 1)}
          </Avatar>
          <TwoLine primary={b.title} secondary={b.ownerName ?? ownerKindLabel[b.ownerKind]} />
        </Group>
      ),
    },
    { key: 'owner', header: 'Owner', visibleFrom: 'sm', render: (b) => ownerKindLabel[b.ownerKind] },
    { key: 'items', header: 'Items', align: 'right', visibleFrom: 'md', render: (b) => b.itemCount ?? '—' },
    { key: 'shops', header: 'Shops', align: 'right', visibleFrom: 'md', render: (b) => b.shopCount ?? '—' },
    { key: 'discount', header: 'Discount', align: 'right', render: (b) => formatPercent(b.discountPercent) },
    {
      key: 'state',
      header: 'Status',
      render: (b) => (
        <Group gap={4} wrap="nowrap">
          <BundleStateBadge state={b.state} />
          {b.state === 'Live' && b.isPurchasable === false && (
            <Badge variant="light" color="amber" size="sm">
              Out of stock
            </Badge>
          )}
        </Group>
      ),
    },
    { key: 'updated', header: 'Updated', visibleFrom: 'lg', render: (b) => <When value={b.updatedUtc} relative /> },
  ];

  return (
    <>
      {header}
      <DataTable
        label="Bundles"
        columns={columns}
        page={query.data}
        isLoading={query.isLoading || !cursors.ready}
        isFetching={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        rowKey={(b) => b.id}
        onRowClick={(b) => list.open(b.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        pagerMode="cursor"
        filtered={list.filtered}
        emptyTitle="No bundles yet"
        emptyBody="Bundles appear here as soon as a shop, a creator or StyleMint makes one."
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <TextInput
              label="Search"
              placeholder="Title, owner or bundle ID"
              leftSection={<IconSearch size={14} />}
              w={260}
              value={list.searchInput}
              onChange={(e) => list.setSearchInput(e.currentTarget.value)}
            />
            <Select label="Status" w={180} clearable placeholder="Any" data={STATE_OPTIONS} value={list.filters.state || null} onChange={(v) => list.setFilter('state', v)} />
            <Select label="Owner" w={160} clearable placeholder="Any" data={OWNER_KIND_OPTIONS} value={list.filters.owner || null} onChange={(v) => list.setFilter('owner', v)} />
          </Group>
        }
      />
      <BundleDrawer id={list.selected} onClose={() => list.open(null)} />
      {creating && <CreateBundleModal onClose={() => setCreating(false)} onCreated={(id) => list.open(id)} />}
    </>
  );
}

function BundleDrawer({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const [adding, setAdding] = useState(false);
  const q = useQuery({ queryKey: ['bundles', 'detail', id], queryFn: ({ signal }) => bundlesAdminApi.get(id!, signal), enabled: !!id });
  const b = q.data;
  const acts = b ? adminBundleActions(b, can('manageBundles')) : null;
  const done = (r?: unknown) => {
    if (r && typeof r === 'object' && 'id' in r) queryClient.setQueryData(['bundles', 'detail', id], r);
    else void queryClient.invalidateQueries({ queryKey: ['bundles', 'detail', id] });
    void queryClient.invalidateQueries({ queryKey: ['bundles', 'list'] });
  };
  // Bundle error codes get plain copy; everything else (step-up challenges included) reaches the dialog untouched.
  const plain = (e: unknown) => (e instanceof ApiError && e.code?.toLowerCase().startsWith('bundle') ? new Error(bundleErrorMessage(e)) : e);
  const run = (spec: Omit<ActionSpec, 'onDone'>) => open({ ...spec, run: (v) => spec.run(v).catch((e: unknown) => Promise.reject(plain(e))), onDone: done });
  const shopName = (vendorId: string) => b?.shops.find((s) => s.vendorAccountId === vendorId)?.name ?? 'Shop';

  const actions = b && acts && (
    <>
      {acts.canSubmit && (
        <Button
          size="sm"
          leftSection={<IconSend size={16} />}
          disabled={!!submitBlocker(b)}
          title={submitBlocker(b) ?? undefined}
          onClick={() =>
            run({
              title: 'Send to the shops',
              consequence: `Every shop is asked to accept the ${formatPercent(b.discountPercent)} discount on its items. The bundle goes live when all of them accept.`,
              confirmLabel: 'Send for acceptance',
              run: () => bundlesAdminApi.submit(b.id),
              success: 'Sent to the shops for acceptance.',
            })
          }
        >
          Send for acceptance…
        </Button>
      )}
      {acts.canEdit && (
        <Button size="sm" variant="default" leftSection={<IconPlus size={16} />} disabled={b.items.length >= MAX_ITEMS} onClick={() => setAdding(true)}>
          Add item
        </Button>
      )}
      {acts.canEdit && (
        <Button
          size="sm"
          variant="default"
          onClick={() =>
            run({
              title: 'Edit the bundle',
              consequence: termsChangeWarning(b, null)
                ? `Title, description and cover change at once. A new discount: ${termsChangeWarning(b, null)}`
                : 'Title, description, cover and discount change at once.',
              confirmLabel: 'Save',
              fields: [
                { name: 'title', kind: 'text', label: 'Title', required: true, defaultValue: b.title },
                { name: 'description', kind: 'textarea', label: 'Description', defaultValue: b.description ?? '' },
                { name: 'cover', kind: 'text', label: 'Cover image URL (https)', defaultValue: b.coverImageUrl ?? '' },
                { name: 'discount', kind: 'number', label: 'Discount (%)', min: 0, max: MAX_DISCOUNT, decimalScale: 2, defaultValue: String(b.discountPercent) },
              ],
              run: (v) => {
                const input = { title: v.title ?? '', description: v.description ?? '', coverImageUrl: v.cover ?? '', discountPercent: v.discount ?? '' };
                const problem = validateBundleText(input);
                if (problem) return Promise.reject(new Error(problem));
                const discount = Number(input.discountPercent);
                return bundlesAdminApi.update(b.id, {
                  title: input.title.trim(),
                  description: input.description.trim() || null,
                  coverImageUrl: input.coverImageUrl.trim() || null,
                  ...(discount !== b.discountPercent ? { discountPercent: discount } : {}),
                });
              },
              success: 'Bundle saved.',
            })
          }
        >
          Edit…
        </Button>
      )}
      {acts.canPause && (
        <Button
          size="sm"
          variant="light"
          leftSection={<IconPlayerPause size={16} />}
          onClick={() => run({ title: 'Pause the bundle', consequence: 'Buyers can no longer add it to their cart until it is resumed.', confirmLabel: 'Pause', run: () => bundlesAdminApi.pause(b.id), success: 'Bundle paused.' })}
        >
          Pause…
        </Button>
      )}
      {acts.canResume && (
        <Button
          size="sm"
          variant="light"
          leftSection={<IconPlayerPlay size={16} />}
          onClick={() =>
            run({
              title: 'Resume the bundle',
              consequence: 'It goes back on sale if every shop still accepts the current terms; otherwise it waits for them. The owner and shops are told.',
              confirmLabel: 'Resume',
              run: () => bundlesAdminApi.resume(b.id),
              success: 'Bundle resumed.',
            })
          }
        >
          Resume…
        </Button>
      )}
      {acts.canTakedown && (
        <Button
          size="sm"
          variant="light"
          color="signal"
          leftSection={<IconShieldOff size={16} />}
          onClick={() =>
            run({
              title: `Take down “${b.title}”`,
              consequence: 'Buyers can no longer buy it and carts holding it are told. The owner and every shop see your note. Only an admin can put it back on sale.',
              confirmLabel: 'Take down',
              danger: true,
              fields: [{ name: 'note', kind: 'textarea', label: 'Note (shown to the owner and shops, kept in the audit log)', required: true, minLength: TAKEDOWN_NOTE_MIN }],
              run: (v) => {
                const note = (v.note ?? '').trim();
                if (!validTakedownNote(note)) return Promise.reject(new Error('Give a note of 3 to 500 characters.'));
                return bundlesAdminApi.takedown(b.id, note);
              },
              success: 'Bundle taken down.',
            })
          }
        >
          Take down…
        </Button>
      )}
      {acts.canArchive && (
        <Button
          size="sm"
          variant="light"
          color="signal"
          leftSection={<IconArchive size={16} />}
          onClick={() =>
            run({
              title: `Archive “${b.title}”`,
              consequence: 'It disappears for buyers for good, its share link stops working and the owner and every shop are told. This cannot be undone.',
              confirmLabel: 'Archive',
              danger: true,
              run: () => bundlesAdminApi.archive(b.id),
              success: 'Bundle archived.',
            })
          }
        >
          Archive…
        </Button>
      )}
    </>
  );

  return (
    <DetailDrawer
      opened={!!id}
      onClose={onClose}
      title={b?.title ?? 'Bundle'}
      subtitle={b ? `${ownerKindLabel[b.ownerKind]}${b.ownerName ? ` · ${b.ownerName}` : ''} · ${formatPercent(b.discountPercent)} off` : undefined}
      badges={b && <BundleStateBadge state={b.state} />}
      actions={actions}
    >
      {dialog}
      {q.error ? (
        <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
      ) : !b ? (
        <Stack>
          <Skeleton height={120} radius="lg" />
          <Skeleton height={200} radius="lg" />
        </Stack>
      ) : (
        <Stack gap="lg">
          {b.state === 'Paused' && b.pausedReason && (
            <Alert variant="light" color="signal" title="Paused">
              {pausedReasonLabel[b.pausedReason]}
              {b.pausedNote ? ` Note: ${b.pausedNote}` : ''}
            </Alert>
          )}
          {b.state === 'Live' && !isPurchasable(b) && (
            <Alert variant="light" color="amber" title="Not buyable right now" data-testid="availability">
              Out of stock: {b.items.filter((i) => !i.available).map((i) => i.title).join(', ')}. The bundle stays live.
            </Alert>
          )}
          <SectionCard title="Bundle">
            <FieldGrid
              fields={[
                { label: 'Status', value: stateLabel[b.state] },
                { label: 'Terms version', value: `v${b.termsVersion}` },
                { label: 'Owner', value: <TwoLine primary={b.ownerName ?? ownerKindLabel[b.ownerKind]} secondary={<IdText value={b.ownerAccountId} />} /> },
                { label: 'Discount', value: formatPercent(b.discountPercent) },
                { label: 'Bundle ID', value: <IdText value={b.id} /> },
                { label: 'Published', value: b.publishedUtc ? <When value={b.publishedUtc} /> : null },
                { label: 'Archived', value: b.archivedUtc ? <When value={b.archivedUtc} /> : null },
                { label: 'List total', value: b.totals ? fmtMoney(b.totals.listTotal, b.totals.currency) : null },
                { label: 'Bundle total', value: b.totals ? fmtMoney(b.totals.bundleTotal, b.totals.currency) : null },
                { label: 'Buyer saves', value: b.totals ? fmtMoney(b.totals.saving, b.totals.currency) : null },
                { label: 'Description', value: b.description, wide: true },
              ]}
            />
          </SectionCard>
          <SectionCard title={`Shops (${b.shops.length})`}>
            <Table aria-label="Bundle shops" verticalSpacing="xs">
              <Table.Tbody>
                {b.shops.map((s) => (
                  <Table.Tr key={s.vendorAccountId} data-testid={`shop-${s.vendorAccountId}`}>
                    <Table.Td>
                      <TwoLine primary={s.name} secondary={<IdText value={s.vendorAccountId} />} />
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" size="sm" color={shopStateColor[s.state]}>
                        {shopStateLabel[s.state]}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed">
                        {s.acceptedTermsVersion != null ? `accepted v${s.acceptedTermsVersion}` : ''}
                        {s.closeReason ? ` “${s.closeReason}”` : ''}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </SectionCard>
          <SectionCard title={`Items (${b.items.length})`}>
            <Table aria-label="Bundle items" verticalSpacing="xs">
              <Table.Tbody>
                {b.items.map((i) => (
                  <Table.Tr key={i.id} data-testid={`item-${i.id}`}>
                    <Table.Td>
                      <Group gap="sm" wrap="nowrap">
                        <Avatar src={i.thumbnailUrl} radius="sm" size={32} alt="">
                          {i.title.slice(0, 1)}
                        </Avatar>
                        <TwoLine primary={`${i.title}${i.quantity > 1 ? ` × ${i.quantity}` : ''}`} secondary={shopName(i.vendorAccountId)} />
                      </Group>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="sm">{fmtMoney(i.bundleUnitPrice, b.totals?.currency ?? 'NPR')}</Text>
                      <Text size="xs" c="dimmed" td="line-through">
                        {i.bundleUnitPrice < i.listUnitPrice ? fmtMoney(i.listUnitPrice, b.totals?.currency ?? 'NPR') : ''}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {!i.available && (
                        <Badge size="xs" color="amber" variant="light">
                          Out of stock
                        </Badge>
                      )}
                      {i.commissionRatePercent != null && (
                        <Text size="xs" c="dimmed">
                          Creator {formatPercent(i.commissionRatePercent)}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td style={{ width: 40 }}>
                      {acts?.canEdit && (
                        <ActionIcon
                          variant="subtle"
                          color="signal"
                          aria-label={`Remove ${i.title}`}
                          onClick={() =>
                            run({
                              title: `Remove “${i.title}”`,
                              consequence: termsChangeWarning(b, null) ?? 'It leaves this bundle. The product itself is untouched.',
                              confirmLabel: 'Remove',
                              danger: true,
                              run: () => bundlesAdminApi.removeItem(b.id, i.id),
                              success: 'Item removed.',
                            })
                          }
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </SectionCard>
          {!can('manageBundles') && (
            <Text size="sm" c="dimmed">
              Your role can look at bundles but not change them.
            </Text>
          )}
        </Stack>
      )}
      {b && adding && <AddItemModal b={b} onClose={() => setAdding(false)} onDone={done} />}
    </DetailDrawer>
  );
}

interface Picked {
  productId: string;
  title: string;
  vendorName: string | null;
  price: number;
  quantity: number;
}

/** Any active listed product (contract §B3 "Platform-owned"): admin product search, first 20 matches. */
function ProductSearch({ picked, onPick, exclude }: { picked: Picked[]; onPick: (p: Picked) => void; exclude?: Set<string> }) {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const q = useQuery({
    queryKey: ['bundles', 'product-search', debounced],
    queryFn: ({ signal }) => productsApi.list({ search: debounced, status: 'active', page: 1, pageSize: 20 }, signal),
    enabled: debounced.length >= 2,
  });
  const taken = new Set([...picked.map((p) => p.productId), ...(exclude ?? [])]);
  return (
    <Stack gap="xs">
      <TextInput label="Find a product" placeholder="Product name, at least 2 letters" leftSection={<IconSearch size={14} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} />
      {debounced.length >= 2 &&
        (q.isPending ? (
          <Skeleton height={60} />
        ) : q.error ? (
          <ErrorBlock error={q.error} onRetry={() => void q.refetch()} />
        ) : (q.data?.items ?? []).length === 0 ? (
          <Text size="sm" c="dimmed">
            No active product matches.
          </Text>
        ) : (
          <Stack gap={4} role="list" aria-label="Matching products" mah={240} style={{ overflowY: 'auto' }}>
            {(q.data?.items ?? []).map((p) => (
              <Group key={p.id} justify="space-between" wrap="nowrap" role="listitem">
                <TwoLine primary={p.name} secondary={[p.vendorName, p.price ? fmtMoney(p.price.min, p.price.currency) : null, p.stock?.outOfStock ? 'out of stock' : null].filter(Boolean).join(' · ')} />
                <Button
                  size="xs"
                  variant="light"
                  aria-label={`Add ${p.name}`}
                  disabled={taken.has(p.id)}
                  onClick={() => onPick({ productId: p.id, title: p.name, vendorName: p.vendorName, price: p.price?.min ?? 0, quantity: 1 })}
                >
                  {taken.has(p.id) ? 'Added' : 'Add'}
                </Button>
              </Group>
            ))}
          </Stack>
        ))}
    </Stack>
  );
}

function PickedRows({ items, onChange }: { items: Picked[]; onChange: (next: Picked[]) => void }) {
  if (items.length === 0) return null;
  return (
    <Stack gap={4} role="list" aria-label="Picked items">
      {items.map((p) => (
        <Group key={p.productId} wrap="nowrap" gap="sm" role="listitem">
          <Text size="sm" style={{ flex: 1, minWidth: 0 }} truncate>
            {p.title}
            {p.vendorName ? ` · ${p.vendorName}` : ''}
          </Text>
          <NumberInput
            aria-label={`Quantity of ${p.title}`}
            w={72}
            size="xs"
            min={1}
            max={MAX_QUANTITY}
            allowDecimal={false}
            clampBehavior="strict"
            value={p.quantity}
            onChange={(n) => onChange(items.map((x) => (x.productId === p.productId ? { ...x, quantity: Number(n) || 1 } : x)))}
          />
          <ActionIcon variant="subtle" color="signal" aria-label={`Remove ${p.title}`} onClick={() => onChange(items.filter((x) => x.productId !== p.productId))}>
            <IconTrash size={14} />
          </ActionIcon>
        </Group>
      ))}
    </Stack>
  );
}

function CreateBundleModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [cover, setCover] = useState('');
  const [discount, setDiscount] = useState<number | string>(10);
  const [items, setItems] = useState<Picked[]>([]);
  const problem =
    validateBundleText({ title, description, coverImageUrl: cover, discountPercent: discount }) ??
    (items.length === 0 ? 'Add at least one product.' : (items.map((i) => validateQuantity(i.quantity)).find(Boolean) ?? null));
  const preview = previewTotals(
    items.map((i) => ({ price: i.price, quantity: i.quantity })),
    Number(discount) || 0,
  );
  const create = useMutation({
    mutationFn: () =>
      withStepUp(() =>
        bundlesAdminApi.create({
          title: title.trim(),
          description: description.trim() || null,
          coverImageUrl: cover.trim() || null,
          discountPercent: Number(discount),
          items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        }),
      ),
    onSuccess: (b) => {
      queryClient.setQueryData(['bundles', 'detail', b.id], b);
      void queryClient.invalidateQueries({ queryKey: ['bundles', 'list'] });
      notifications.show({ color: 'forest', title: 'Done', message: 'Draft bundle created. Send it to the shops when it is ready.' });
      onCreated(b.id);
      onClose();
    },
  });
  return (
    <Modal opened onClose={onClose} title="New StyleMint bundle" size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Starts as a draft. Each shop whose product you add is asked to accept the discount on its items once you send it.
        </Text>
        <TextInput label="Title" required maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.currentTarget.value)} />
        <Textarea label="Description" autosize minRows={2} maxLength={DESCRIPTION_MAX} value={description} onChange={(e) => setDescription(e.currentTarget.value)} />
        <TextInput label="Cover image URL (https)" value={cover} onChange={(e) => setCover(e.currentTarget.value)} />
        <NumberInput label="Discount (%)" description={`0–${MAX_DISCOUNT} %, funded by each shop on its own items.`} min={0} max={MAX_DISCOUNT} decimalScale={2} value={discount} onChange={setDiscount} />
        <PickedRows items={items} onChange={setItems} />
        {items.length < MAX_ITEMS && <ProductSearch picked={items} onPick={(p) => setItems([...items, p])} />}
        {items.length > 0 && (
          <Text size="sm" data-testid="create-preview">
            {fmtMoney(preview.listTotal)} separately → {fmtMoney(preview.bundleTotal)} as a bundle
          </Text>
        )}
        {problem && (
          <Text size="sm" c="signal">
            {problem}
          </Text>
        )}
        {create.error && (
          <Alert variant="light" color="signal" role="alert">
            {bundleErrorMessage(create.error)}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!!problem} loading={create.isPending} onClick={() => create.mutate()}>
            Create draft
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function AddItemModal({ b, onClose, onDone }: { b: Bundle; onClose: () => void; onDone: (r?: unknown) => void }) {
  const [items, setItems] = useState<Picked[]>([]);
  const warning = termsChangeWarning(b, null);
  const add = useMutation({
    mutationFn: () =>
      withStepUp(async () => {
        let last: Bundle | undefined;
        for (const i of items) last = (await bundlesAdminApi.addItem(b.id, { productId: i.productId, quantity: i.quantity })) ?? last;
        return last;
      }),
    onSuccess: (r) => {
      notifications.show({ color: 'forest', title: 'Done', message: items.length === 1 ? 'Item added.' : `${items.length} items added.` });
      onDone(r);
      onClose();
    },
  });
  return (
    <Modal opened onClose={onClose} title="Add items" size="lg" zIndex={400}>
      <Stack gap="md">
        {warning && (
          <Alert variant="light" color="amber">
            {warning}
          </Alert>
        )}
        <PickedRows items={items} onChange={setItems} />
        {b.items.length + items.length < MAX_ITEMS && <ProductSearch picked={items} exclude={new Set(b.items.map((i) => i.productId))} onPick={(p) => setItems([...items, p])} />}
        {add.error && (
          <Alert variant="light" color="signal" role="alert">
            {bundleErrorMessage(add.error)}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={items.length === 0} loading={add.isPending} onClick={() => add.mutate()}>
            Add {items.length > 1 ? `${items.length} items` : 'item'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
