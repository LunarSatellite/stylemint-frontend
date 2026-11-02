import { useState } from 'react';
import { ActionIcon, Alert, Avatar, Badge, Button, Card, Group, Modal, NumberInput, Stack, Text, TextInput, Tooltip } from '@mantine/core';
import { IconArchive, IconPencil, IconPlayerPause, IconPlayerPlay, IconPlus, IconSend, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useSession } from '../../auth/useSession';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDateTime, formatMoney, initialsOf } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import {
  activeShops,
  BUNDLES_KEY,
  bundleErrorMessage,
  bundlePermissions,
  bundlesApi,
  creatorEarning,
  detailKey,
  formatPercent,
  isBundleError,
  isMissingEndpoint,
  MAX_ITEMS,
  MAX_QUANTITY,
  NOTE_MAX,
  resumeBlocker,
  submitBlocker,
  termsChangeWarning,
  validateQuantity,
  type Bundle,
  type BundleItem,
  type BundleShop,
} from './api';
import { EditBundleModal } from './BundleForm';
import { AvailabilityBadge, BundlesSettingUp, BundleStateBadge, CoverThumb, PriceLine, ShareLinkButton, ShopStateBadge, stateExplanation, TotalsLine, unavailableItems } from './components';
import { ProductPicker, type PickedItem } from './ProductPicker';

type WriteResult = Bundle | undefined | 'cancelled';

/** Run a bundle write: keep the returned bundle, refresh lists, toast; map errors; re-read on a conflict. */
function useBundleWrite(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (w: { run: () => Promise<WriteResult>; success: string; after?: () => void }) => ({ result: await w.run(), w }),
    onSuccess: ({ result, w }) => {
      if (result === 'cancelled') return;
      if (result) queryClient.setQueryData(detailKey(id), result);
      else void queryClient.invalidateQueries({ queryKey: detailKey(id) });
      void queryClient.invalidateQueries({ queryKey: [...BUNDLES_KEY, 'list'] });
      toastSuccess(w.success);
      w.after?.();
    },
    onError: (error) => {
      toastError(new Error(bundleErrorMessage(error)));
      if (isBundleError(error, 'state.concurrency_conflict') || isBundleError(error, 'bundle_not_editable') || isBundleError(error, 'bundle_item_not_partner'))
        void queryClient.invalidateQueries({ queryKey: detailKey(id) });
    },
  });
}

export default function BundleDetailPage() {
  const { id = '' } = useParams();
  const q = useQuery({ queryKey: detailKey(id), queryFn: () => bundlesApi.get(id), enabled: !!id });
  const back = { to: '/bundles', label: 'Bundles' };
  if (q.isPending)
    return (
      <>
        <PageHeader title="Bundle" back={back} />
        <ListSkeleton rows={3} height={90} />
      </>
    );
  if (q.error || !q.data) {
    const notFound = q.error instanceof ApiError && q.error.status === 404 && !!q.error.code;
    return (
      <>
        <PageHeader title="Bundle" back={back} />
        {isMissingEndpoint(q.error) ? (
          <BundlesSettingUp />
        ) : notFound ? (
          <Card>
            <EmptyBlock title="Bundle not found" body="It may have been archived." />
          </Card>
        ) : (
          <ErrorBlock error={q.error} title="Could not load this bundle" onRetry={() => void q.refetch()} />
        )}
      </>
    );
  }
  return <BundleBody b={q.data} />;
}

function BundleBody({ b }: { b: Bundle }) {
  const { accountId: me } = useSession();
  const perms = bundlePermissions(b, me);
  const write = useBundleWrite(b.id);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editItem, setEditItem] = useState<BundleItem | null>(null);
  const shopName = (vendorId: string) => b.shops.find((s) => s.vendorAccountId === vendorId)?.name ?? 'Shop';
  const blocker = submitBlocker(b);
  const resumeWhy = resumeBlocker(b);
  const outOfStock = unavailableItems(b);
  const earning = creatorEarning(b.items);
  const closedWithReason = b.shops.filter((s) => (s.state === 'Declined' || s.state === 'Withdrawn') && s.closeReason);

  const submit = async () => {
    const shops = activeShops(b);
    const ok = await confirmAction({
      title: 'Send the bundle to the shops?',
      body: `${shops.length === 1 ? 'The shop is' : `All ${shops.length} shops are`} asked to accept the ${formatPercent(b.discountPercent)} discount on their items. It goes live when every shop accepts; you can copy the share link then.`,
      confirmLabel: 'Send for acceptance',
    });
    if (ok) write.mutate({ run: () => bundlesApi.submit(b.id), success: 'Sent to the shops for acceptance.' });
  };
  const pause = async () => {
    if (await confirmAction({ title: 'Pause this bundle?', body: 'Buyers can no longer add it to their cart and your share link shows it as unavailable. You can resume it while every shop still accepts.', confirmLabel: 'Pause bundle' }))
      write.mutate({ run: () => bundlesApi.pause(b.id), success: 'Bundle paused.' });
  };
  const archive = async () => {
    if (
      await confirmAction({
        title: 'Archive this bundle?',
        body: 'It disappears for buyers for good, your share link stops working and every shop is told. This cannot be undone.',
        confirmLabel: 'Archive bundle',
        danger: true,
      })
    )
      write.mutate({ run: () => bundlesApi.archive(b.id), success: 'Bundle archived.' });
  };
  const removeItem = async (i: BundleItem) => {
    const warning = termsChangeWarning(b, me);
    const ok = await confirmAction({ title: `Remove ${i.title}?`, body: warning ?? 'It leaves this bundle. The product itself is untouched.', confirmLabel: 'Remove item', danger: true });
    if (ok) write.mutate({ run: () => bundlesApi.removeItem(b.id, i.id), success: 'Item removed.' });
  };
  const removeShop = async (s: BundleShop) => {
    const count = b.items.filter((i) => i.vendorAccountId === s.vendorAccountId).length;
    const ok = await confirmAction({
      title: `Remove ${s.name} from the bundle?`,
      body: `${count ? `Their ${count} ${count === 1 ? 'item leaves' : 'items leave'} the bundle too. ` : ''}${termsChangeWarning(b, me) ?? ''} They are told.`.trim(),
      confirmLabel: 'Remove shop',
      danger: true,
    });
    if (ok) write.mutate({ run: () => bundlesApi.removeShop(b.id, s.vendorAccountId), success: `${s.name} removed.` });
  };

  return (
    <>
      <PageHeader
        title={b.title}
        back={{ to: '/bundles', label: 'Bundles' }}
        description={stateExplanation(b)}
        meta={
          <Group gap={6} wrap="wrap">
            <BundleStateBadge state={b.state} />
            <Badge variant="outline" color="gray" size="sm">
              {formatPercent(b.discountPercent)} off
            </Badge>
            <Badge variant="outline" color="gray" size="sm">
              Terms v{b.termsVersion}
            </Badge>
          </Group>
        }
        actions={
          <>
            {perms.canShare && <ShareLinkButton id={b.id} />}
            {perms.canEdit && (
              <Button variant="default" leftSection={<IconPencil size={16} />} onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {perms.canSubmit && (
              <Tooltip label={blocker} disabled={!blocker}>
                <Button leftSection={<IconSend size={16} />} disabled={!!blocker || write.isPending} onClick={() => void submit()}>
                  Send for acceptance
                </Button>
              </Tooltip>
            )}
            {perms.canPause && (
              <Button variant="light" leftSection={<IconPlayerPause size={16} />} onClick={() => void pause()}>
                Pause
              </Button>
            )}
            {perms.canResume && (
              <Tooltip label={resumeWhy} disabled={!resumeWhy}>
                <Button
                  leftSection={<IconPlayerPlay size={16} />}
                  disabled={!!resumeWhy || write.isPending}
                  onClick={() => write.mutate({ run: () => bundlesApi.resume(b.id), success: 'Bundle is live again.' })}
                >
                  Resume
                </Button>
              </Tooltip>
            )}
            {perms.canArchive && (
              <Button variant="light" color="signal" leftSection={<IconArchive size={16} />} onClick={() => void archive()}>
                Archive
              </Button>
            )}
          </>
        }
      />
      <Stack gap="lg">
        {perms.canSubmit && blocker && (
          <Alert variant="light" color="amber" data-testid="submit-blocker">
            {blocker}
          </Alert>
        )}
        {b.state === 'Paused' && (b.pausedNote || resumeWhy) && (
          <Alert variant="light" color="signal" title="Why it is paused">
            <Text size="sm">{[b.pausedNote, resumeWhy].filter(Boolean).join(' ')}</Text>
          </Alert>
        )}
        {b.state === 'Live' && outOfStock.length > 0 && (
          <Alert variant="light" color="amber" title="Buyers cannot buy it right now" data-testid="availability">
            <Text size="sm">Out of stock: {outOfStock.join(', ')}. The bundle stays live and can be bought again as soon as it is back in stock.</Text>
          </Alert>
        )}
        {closedWithReason.length > 0 && (
          <Alert variant="light" color="gray" title="Shop responses">
            <Stack gap={2}>
              {closedWithReason.map((s) => (
                <Text size="sm" key={s.vendorAccountId}>
                  {s.name} {s.state === 'Declined' ? 'declined' : 'withdrew'}: “{s.closeReason}”
                </Text>
              ))}
            </Stack>
          </Alert>
        )}
        <SectionCard
          title={`Items (${b.items.length} of ${MAX_ITEMS})`}
          description="Products from your partner brands. Each shop funds the discount on its own items."
          action={
            perms.canAddItems && (
              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setAdding(true)}>
                Add items
              </Button>
            )
          }
        >
          <ItemList b={b} shopName={shopName} busy={write.isPending} canEdit={perms.canEditItem} onEdit={setEditItem} onRemove={(i) => void removeItem(i)} />
          {(b.totals || earning != null) && (
            <Card withBorder mt="sm" padding="sm">
              <Stack gap="xs">
                <TotalsLine totals={b.totals} />
                {earning != null && (
                  <Text size="sm" data-testid="creator-earning">
                    You earn about {formatMoney(earning)} per bundle sold (commission on the discounted prices).
                  </Text>
                )}
              </Stack>
            </Card>
          )}
        </SectionCard>
        <SectionCard title={`Shops (${activeShops(b).length})`} description="Every shop accepts the terms version shown. Changing items or the discount asks every shop again.">
          <ShopList b={b} busy={write.isPending} canRemove={perms.canRemoveShop} onRemove={(s) => void removeShop(s)} />
        </SectionCard>
      </Stack>
      {perms.canEdit && editing && <EditBundleModal b={b} me={me} opened onClose={() => setEditing(false)} />}
      {perms.canAddItems && adding && <AddItemsModal b={b} me={me} onClose={() => setAdding(false)} />}
      {editItem && <EditItemModal b={b} me={me} item={editItem} onClose={() => setEditItem(null)} />}
    </>
  );
}

function ItemList({
  b,
  shopName,
  busy,
  canEdit,
  onEdit,
  onRemove,
}: {
  b: Bundle;
  shopName: (id: string) => string;
  busy: boolean;
  canEdit: (i: BundleItem) => boolean;
  onEdit: (i: BundleItem) => void;
  onRemove: (i: BundleItem) => void;
}) {
  if (b.items.length === 0) return <Text size="sm" c="dimmed">No items yet.</Text>;
  return (
    <Stack gap="xs" role="list" aria-label="Bundle items">
      {b.items.map((i) => (
        <Card key={i.id} withBorder padding="xs" role="listitem" data-testid={`item-${i.id}`}>
          <Group wrap="nowrap" gap="sm" align="flex-start">
            <CoverThumb url={i.thumbnailUrl} size={44} label={i.title} />
            <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
              <Group gap={6} wrap="wrap">
                <Text fw={600} size="sm">
                  {i.title}
                </Text>
                <AvailabilityBadge item={i} />
              </Group>
              <Text size="xs" c="dimmed">
                {shopName(i.vendorAccountId)}
                {i.note ? ` · “${i.note}”` : ''}
              </Text>
              <Group gap="md" wrap="wrap">
                <PriceLine list={i.listUnitPrice} bundle={i.bundleUnitPrice} quantity={i.quantity} />
                <Text size="xs" c="dimmed">
                  {i.commissionRatePercent != null ? `Your commission ${formatPercent(i.commissionRatePercent)}` : 'Commission set when the shop accepts'}
                </Text>
              </Group>
            </Stack>
            {canEdit(i) && (
              <Group gap={2} wrap="nowrap">
                <Tooltip label="Change quantity or note">
                  <ActionIcon variant="subtle" color="gray" aria-label={`Edit ${i.title}`} disabled={busy} onClick={() => onEdit(i)}>
                    <IconPencil size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="Remove from bundle">
                  <ActionIcon variant="subtle" color="signal" aria-label={`Remove ${i.title}`} disabled={busy} onClick={() => onRemove(i)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </Group>
        </Card>
      ))}
    </Stack>
  );
}

function ShopList({ b, busy, canRemove, onRemove }: { b: Bundle; busy: boolean; canRemove: (s: BundleShop) => boolean; onRemove: (s: BundleShop) => void }) {
  if (b.shops.length === 0) return <Text size="sm" c="dimmed">Shops appear here as you add their products.</Text>;
  return (
    <Stack gap="xs" role="list" aria-label="Bundle shops">
      {b.shops.map((s) => {
        const count = b.items.filter((i) => i.vendorAccountId === s.vendorAccountId).length;
        const stale = s.state === 'Accepted' && s.acceptedTermsVersion != null && s.acceptedTermsVersion !== b.termsVersion;
        return (
          <Card key={s.vendorAccountId} withBorder padding="xs" role="listitem" data-testid={`shop-${s.vendorAccountId}`}>
            <Group wrap="nowrap" gap="sm">
              <Avatar src={s.logoUrl} size={28} radius="xl">
                {initialsOf(s.name)}
              </Avatar>
              <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                <Text size="sm" fw={600} truncate>
                  {s.name}
                </Text>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {[
                    `${count} ${count === 1 ? 'item' : 'items'}`,
                    s.state === 'Accepted' && s.acceptedTermsVersion != null ? `accepted v${s.acceptedTermsVersion}` : null,
                    s.acceptedUtc && s.state === 'Accepted' ? formatDateTime(s.acceptedUtc) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
              </Stack>
              <ShopStateBadge state={stale ? 'Pending' : s.state} />
              {canRemove(s) && (
                <Tooltip label="Remove shop and its items">
                  <ActionIcon variant="subtle" color="signal" aria-label={`Remove ${s.name}`} disabled={busy} onClick={() => onRemove(s)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
          </Card>
        );
      })}
    </Stack>
  );
}

function AddItemsModal({ b, me, onClose }: { b: Bundle; me: string | null; onClose: () => void }) {
  const write = useBundleWrite(b.id);
  const [items, setItems] = useState<PickedItem[]>([]);
  const exclude = new Set(b.items.map((i) => i.productId));
  const warning = termsChangeWarning(b, me);
  const problem = items.map((i) => validateQuantity(i.quantity)).find(Boolean) ?? null;
  const add = () =>
    write.mutate({
      run: async () => {
        let last: Bundle | undefined;
        for (const i of items) last = (await bundlesApi.addItem(b.id, { productId: i.productId, quantity: i.quantity })) ?? last;
        return last;
      },
      success: items.length === 1 ? 'Item added.' : `${items.length} items added.`,
      after: onClose,
    });
  return (
    <Modal opened onClose={onClose} title="Add products" size="lg">
      <Stack gap="md">
        {warning && (
          <Alert variant="light" color="amber">
            {warning}
          </Alert>
        )}
        <ProductPicker value={items} onChange={setItems} max={MAX_ITEMS - b.items.length} exclude={exclude} />
        {problem && (
          <Text size="sm" c="signal">
            {problem}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={items.length === 0 || !!problem} loading={write.isPending} onClick={add}>
            Add {items.length > 1 ? `${items.length} items` : 'item'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function EditItemModal({ b, me, item, onClose }: { b: Bundle; me: string | null; item: BundleItem; onClose: () => void }) {
  const write = useBundleWrite(b.id);
  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [note, setNote] = useState(item.note ?? '');
  const qtyChanged = quantity !== item.quantity;
  const warning = qtyChanged ? termsChangeWarning(b, me) : null;
  const problem = validateQuantity(quantity);
  return (
    <Modal opened onClose={onClose} title={`Edit ${item.title}`}>
      <Stack gap="md">
        <NumberInput label="Quantity in the bundle" min={1} max={MAX_QUANTITY} allowDecimal={false} value={quantity} onChange={(n) => setQuantity(Number(n) || 0)} />
        <TextInput label="Note (optional)" description="Shown to buyers with the item." maxLength={NOTE_MAX} value={note} onChange={(e) => setNote(e.currentTarget.value)} />
        {warning && (
          <Alert variant="light" color="amber">
            {warning}
          </Alert>
        )}
        {problem && (
          <Text size="sm" c="signal">
            {problem}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!!problem}
            loading={write.isPending}
            onClick={() =>
              write.mutate({
                run: () => bundlesApi.updateItem(b.id, item.id, { ...(qtyChanged ? { quantity } : {}), note: note.trim() || null }),
                success: 'Item saved.',
                after: onClose,
              })
            }
          >
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
