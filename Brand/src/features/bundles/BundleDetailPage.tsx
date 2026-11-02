import { useState } from 'react';
import { ActionIcon, Alert, Avatar, Badge, Button, Card, Group, Loader, Modal, NumberInput, Stack, Table, Text, Textarea, TextInput, Tooltip, UnstyledButton } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconArchive, IconCheck, IconDoorExit, IconPencil, IconPlayerPause, IconPlayerPlay, IconPlus, IconSend, IconTrash, IconUserPlus, IconX } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { useSession } from '../../auth/useSession';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { useIsPhone } from '../../lib/useIsPhone';
import { formatDateTime, formatMoney, initialsOf } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import {
  activeShops,
  BUNDLES_KEY,
  bundleErrorMessage,
  bundlePermissions,
  bundlesApi,
  detailKey,
  formatPercent,
  INVITE_NOTE_MAX,
  isBundleError,
  isMissingEndpoint,
  MAX_ITEMS,
  MAX_QUANTITY,
  NOTE_MAX,
  ownerKindLabel,
  REASON_MAX,
  resumeBlocker,
  shopFunding,
  submitBlocker,
  termsChangeWarning,
  validateQuantity,
  type Bundle,
  type BundleItem,
  type BundleShop,
  type BundleVendor,
} from './api';
import { EditBundleModal } from './BundleForm';
import { AvailabilityBadge, BundlesSettingUp, BundleStateBadge, CoverThumb, PriceLine, ShareLinkButton, ShopStateBadge, stateExplanation, TotalsLine, unavailableItems } from './components';
import { ProductPicker, type PickedItem } from './ProductPicker';

type WriteResult = Bundle | undefined | 'cancelled';

/** Run a bundle write: keep the returned bundle, refresh lists, toast; map errors; re-read on stale terms. */
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
      if (isBundleError(error, 'bundle_terms_changed') || isBundleError(error, 'state.concurrency_conflict') || isBundleError(error, 'bundle_not_editable'))
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
            <EmptyBlock title="Bundle not found" body="It may have been archived, or your shop is no longer part of it." />
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
  const { accountId } = useSession();
  // The server may name the caller's shop (mobile changelog item 5); a vendor's shop id is its account id otherwise.
  const me = b.myVendorAccountId ?? accountId;
  const perms = bundlePermissions(b, me);
  const write = useBundleWrite(b.id);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [editItem, setEditItem] = useState<BundleItem | null>(null);
  const shopName = (vendorId: string) => b.shops.find((s) => s.vendorAccountId === vendorId)?.name ?? 'Shop';
  const blocker = submitBlocker(b);
  const resumeWhy = resumeBlocker(b);
  const outOfStock = unavailableItems(b);
  const closedWithReason = b.shops.filter((s) => (s.state === 'Declined' || s.state === 'Withdrawn') && s.closeReason);

  const submit = async () => {
    const others = activeShops(b).filter((s) => s.vendorAccountId !== me);
    const invitedEmpty = b.shops.filter((s) => s.state === 'Invited' && !b.items.some((i) => i.vendorAccountId === s.vendorAccountId));
    const ok = await confirmAction({
      title: 'Send the bundle to the shops?',
      body:
        others.length === 0
          ? 'Every item is yours, so the bundle goes live straight away.'
          : `${others.length === 1 ? 'The other shop is' : `All ${others.length} other shops are`} asked to accept the ${formatPercent(b.discountPercent)} discount on their items. It goes live when every shop accepts.${
              invitedEmpty.length ? ` ${invitedEmpty.map((s) => s.name).join(', ')} added no products yet and will be dropped.` : ''
            }`,
      confirmLabel: 'Send for acceptance',
    });
    if (ok) write.mutate({ run: () => bundlesApi.submit(b.id), success: others.length === 0 ? 'Bundle is live.' : 'Sent to the shops for acceptance.' });
  };
  const pause = async () => {
    if (await confirmAction({ title: 'Pause this bundle?', body: 'Buyers can no longer add it to their cart. You can resume it while every shop still accepts.', confirmLabel: 'Pause bundle' }))
      write.mutate({ run: () => bundlesApi.pause(b.id), success: 'Bundle paused.' });
  };
  const archive = async () => {
    if (
      await confirmAction({
        title: 'Archive this bundle?',
        body: 'It disappears for buyers for good and every shop in it is told. Bundles already in carts stop working. This cannot be undone.',
        confirmLabel: 'Archive bundle',
        danger: true,
      })
    )
      write.mutate({ run: () => bundlesApi.archive(b.id), success: 'Bundle archived.' });
  };
  const removeItem = async (i: BundleItem) => {
    const warning = termsChangeWarning(b, me);
    const ok = await confirmAction({
      title: `Remove ${i.title}?`,
      body: warning ? `${warning}` : 'It leaves this bundle. The product itself is untouched.',
      confirmLabel: 'Remove item',
      danger: true,
    });
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
            <Text size="xs" c="dimmed">
              {perms.owner ? 'Your bundle' : `By ${b.ownerName ?? ownerKindLabel[b.ownerKind]}`}
            </Text>
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
        {b.state === 'Paused' && (b.pausedNote || resumeWhy) && perms.owner && (
          <Alert variant="light" color="signal" title="Why it is paused">
            <Text size="sm">{[b.pausedNote, perms.canResume ? resumeWhy : null].filter(Boolean).join(' ')}</Text>
          </Alert>
        )}
        {b.state === 'Live' && outOfStock.length > 0 && (
          <Alert variant="light" color="amber" title="Buyers cannot buy it right now" data-testid="availability">
            <Text size="sm">
              Out of stock: {outOfStock.join(', ')}. The bundle stays live and can be bought again as soon as it is back in stock.
            </Text>
          </Alert>
        )}
        {perms.owner && closedWithReason.length > 0 && (
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
        {(perms.canAccept || perms.canWithdraw || perms.mustAddItems) && <ShopPanel b={b} me={me} onAddItems={() => setAdding(true)} />}
        <SectionCard
          title={`Items (${b.items.length} of ${MAX_ITEMS})`}
          description={b.ownerKind === 'Vendor' ? 'Each shop adds its own products. The discount on an item is funded by the shop that sells it.' : undefined}
          action={
            perms.canAddItems && (
              <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setAdding(true)}>
                Add {perms.owner ? 'items' : 'my products'}
              </Button>
            )
          }
        >
          <ItemList b={b} me={me} shopName={shopName} busy={write.isPending} canEdit={perms.canEditItem} onEdit={setEditItem} onRemove={(i) => void removeItem(i)} />
          {b.totals && (
            <Card withBorder mt="sm" padding="sm">
              <TotalsLine totals={b.totals} />
            </Card>
          )}
        </SectionCard>
        <SectionCard
          title={`Shops (${activeShops(b).length})`}
          description="A shop accepts the terms version shown; any change to items or the discount asks every shop again."
          action={
            perms.canInvite && (
              <Button size="xs" variant="light" leftSection={<IconUserPlus size={14} />} onClick={() => setInviting(true)}>
                Invite a shop
              </Button>
            )
          }
        >
          <ShopList b={b} me={me} busy={write.isPending} canRemove={perms.canRemoveShop} onRemove={(s) => void removeShop(s)} />
        </SectionCard>
      </Stack>
      {perms.canEdit && editing && <EditBundleModal b={b} me={me} opened onClose={() => setEditing(false)} />}
      {perms.canAddItems && adding && <AddItemsModal b={b} me={me} onClose={() => setAdding(false)} />}
      {perms.canInvite && <InviteModal b={b} opened={inviting} onClose={() => setInviting(false)} />}
      {editItem && <EditItemModal b={b} me={me} item={editItem} onClose={() => setEditItem(null)} />}
    </>
  );
}

function ItemList({
  b,
  me,
  shopName,
  busy,
  canEdit,
  onEdit,
  onRemove,
}: {
  b: Bundle;
  me: string | null;
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
                {i.vendorAccountId === me ? ' (you)' : ''}
                {i.note ? ` · “${i.note}”` : ''}
              </Text>
              <Group gap="md" wrap="wrap">
                <PriceLine list={i.listUnitPrice} bundle={i.bundleUnitPrice} quantity={i.quantity} />
                {i.commissionRatePercent != null && (
                  <Text size="xs" c="dimmed">
                    Creator commission {formatPercent(i.commissionRatePercent)}
                  </Text>
                )}
                {i.vendorAccountId === me && i.shopFunds != null && i.shopFunds > 0 && (
                  <Text size="xs" c="dimmed">
                    You fund {formatMoney(i.shopFunds)}
                  </Text>
                )}
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

function ShopList({ b, me, busy, canRemove, onRemove }: { b: Bundle; me: string | null; busy: boolean; canRemove: (s: BundleShop) => boolean; onRemove: (s: BundleShop) => void }) {
  if (b.shops.length === 0) return <Text size="sm" c="dimmed">No shops yet.</Text>;
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
                  {s.vendorAccountId === me ? ' (you)' : ''}
                </Text>
                <Text size="xs" c="dimmed" lineClamp={1}>
                  {[
                    `${count} ${count === 1 ? 'item' : 'items'}`,
                    s.state === 'Accepted' && s.acceptedTermsVersion != null ? `accepted v${s.acceptedTermsVersion}` : null,
                    s.state === 'Invited' && s.inviteNote ? `“${s.inviteNote}”` : null,
                    s.closeReason && (s.state === 'Declined' || s.state === 'Withdrawn') ? `“${s.closeReason}”` : null,
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

/**
 * The shop's side: the discount it gives up on its own items, accept / decline (Pending), withdraw (Accepted), or —
 * invited to a shop's bundle — add own products first.
 */
function ShopPanel({ b, me, onAddItems }: { b: Bundle; me: string | null; onAddItems: () => void }) {
  const perms = bundlePermissions(b, me);
  const write = useBundleWrite(b.id);
  const phone = useIsPhone();
  const [reasonFor, setReasonFor] = useState<'decline' | 'withdraw' | null>(null);
  const mine = b.items.filter((i) => i.vendorAccountId === me);
  const funds = b.myShopFunds ?? shopFunding(b.items, me);
  const creator = b.ownerKind === 'Creator';
  const fundingSentence = `You fund ${formatMoney(funds)} of the discount on your items for every bundle sold; ${
    creator ? 'creator commission and platform commission are' : 'platform commission is'
  } charged on the discounted price.`;

  const accept = async () => {
    const ok = await confirmAction({
      title: `Accept terms version ${b.termsVersion}?`,
      body: `${fundingSentence} You can withdraw later; the bundle then pauses for everyone.`,
      confirmLabel: 'Accept terms',
    });
    if (ok) write.mutate({ run: () => bundlesApi.accept(b.id, b.termsVersion), success: 'You accepted the bundle terms.' });
  };

  if (perms.mustAddItems)
    return (
      <SectionCard title={`${b.ownerName ?? 'A shop'} invited you to this bundle`} description="Add one or more of your own products. You then accept the discount on them.">
        <Stack gap="sm">
          {b.shops.find((s) => s.vendorAccountId === me)?.inviteNote && (
            <Text size="sm" fs="italic">
              “{b.shops.find((s) => s.vendorAccountId === me)?.inviteNote}”
            </Text>
          )}
          <Group justify="flex-end">
            <Button leftSection={<IconPlus size={16} />} onClick={onAddItems}>
              Add my products
            </Button>
          </Group>
        </Stack>
      </SectionCard>
    );

  return (
    <SectionCard
      title={perms.canAccept ? 'Your decision' : 'You accepted this bundle'}
      description={perms.canAccept ? `The bundle sells your items at ${formatPercent(b.discountPercent)} off. This is what you give up.` : undefined}
    >
      <Stack gap="sm" data-testid="shop-panel">
        {mine.length > 0 && (
          <Table aria-label="Your items in the bundle" verticalSpacing={4} fz="sm">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Item</Table.Th>
                {!phone && <Table.Th ta="right">Your price</Table.Th>}
                <Table.Th ta="right">Bundle price</Table.Th>
                <Table.Th ta="right">You fund</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {mine.map((i) => (
                <Table.Tr key={i.id}>
                  <Table.Td>
                    {i.title}
                    {i.quantity > 1 ? ` × ${i.quantity}` : ''}
                    {creator && i.commissionRatePercent != null ? ` · creator ${formatPercent(i.commissionRatePercent)}` : ''}
                  </Table.Td>
                  {!phone && <Table.Td ta="right">{formatMoney(i.listUnitPrice)}</Table.Td>}
                  <Table.Td ta="right">{formatMoney(i.bundleUnitPrice)}</Table.Td>
                  <Table.Td ta="right">{formatMoney(i.shopFunds ?? (i.listUnitPrice - i.bundleUnitPrice) * i.quantity)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
        <Alert variant="light" color={perms.canAccept ? 'amber' : 'gray'} data-testid="funding">
          <Text size="sm">{fundingSentence}</Text>
        </Alert>
        <Group justify="flex-end">
          {perms.canDecline && (
            <Button variant="default" color="signal" leftSection={<IconX size={16} />} disabled={write.isPending} onClick={() => setReasonFor('decline')}>
              Decline
            </Button>
          )}
          {perms.canAccept && (
            <Button leftSection={<IconCheck size={16} />} loading={write.isPending} onClick={() => void accept()}>
              Accept terms v{b.termsVersion}
            </Button>
          )}
          {perms.canWithdraw && (
            <Button variant="light" color="signal" leftSection={<IconDoorExit size={16} />} disabled={write.isPending} onClick={() => setReasonFor('withdraw')}>
              Withdraw
            </Button>
          )}
        </Group>
      </Stack>
      <ReasonModal
        opened={reasonFor !== null}
        title={reasonFor === 'decline' ? 'Decline the bundle?' : 'Withdraw from the bundle?'}
        body={
          reasonFor === 'decline'
            ? `${b.ownerName ?? 'The owner'} is told, with your reason. The bundle cannot go live with your items.`
            : 'The bundle is paused for everyone straight away and buyers can no longer buy it. The owner is told, with your reason.'
        }
        confirmLabel={reasonFor === 'decline' ? 'Decline' : 'Withdraw'}
        busy={write.isPending}
        onClose={() => setReasonFor(null)}
        onConfirm={(reason) =>
          write.mutate({
            run: () => (reasonFor === 'decline' ? bundlesApi.decline(b.id, reason) : bundlesApi.withdraw(b.id, reason)),
            success: reasonFor === 'decline' ? 'You declined the bundle.' : 'You withdrew from the bundle.',
            after: () => setReasonFor(null),
          })
        }
      />
    </SectionCard>
  );
}

function ReasonModal({
  opened,
  title,
  body,
  confirmLabel,
  busy,
  onClose,
  onConfirm,
}: {
  opened: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  busy: boolean;
  onClose: () => void;
  onConfirm: (reason: string | null) => void;
}) {
  const [reason, setReason] = useState('');
  const close = () => {
    setReason('');
    onClose();
  };
  return (
    <Modal opened={opened} onClose={close} title={title}>
      <Stack gap="md">
        <Text size="sm">{body}</Text>
        <Textarea
          label="Reason (optional)"
          description={`Shown to the owner. ${reason.length}/${REASON_MAX}`}
          autosize
          minRows={2}
          maxLength={REASON_MAX}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button color="signal" loading={busy} onClick={() => onConfirm(reason.trim() || null)}>
            {confirmLabel}
          </Button>
        </Group>
      </Stack>
    </Modal>
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
    <Modal opened onClose={onClose} title="Add your products" size="lg">
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

/** Find an approved business by name (≥ 2 letters) and invite it with an optional note. */
function InviteModal({ b, opened, onClose }: { b: Bundle; opened: boolean; onClose: () => void }) {
  const write = useBundleWrite(b.id);
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const [picked, setPicked] = useState<BundleVendor | null>(null);
  const [note, setNote] = useState('');
  const inBundle = new Set(activeShops(b).map((s) => s.vendorAccountId));
  const results = useQuery({
    queryKey: [...BUNDLES_KEY, 'vendors', debounced],
    queryFn: () => bundlesApi.searchVendors(debounced),
    enabled: opened && debounced.length >= 2,
  });
  const close = () => {
    setSearch('');
    setPicked(null);
    setNote('');
    onClose();
  };
  return (
    <Modal opened={opened} onClose={close} title="Invite a shop" size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          The shop adds its own products to the bundle and accepts the {formatPercent(b.discountPercent)} discount on them.
        </Text>
        {picked ? (
          <Card withBorder padding="sm">
            <Group justify="space-between" wrap="nowrap">
              <VendorLine v={picked} />
              <Button size="xs" variant="subtle" onClick={() => setPicked(null)}>
                Change
              </Button>
            </Group>
          </Card>
        ) : (
          <>
            <TextInput label="Shop name" placeholder="Peak Gear" value={search} onChange={(e) => setSearch(e.currentTarget.value)} data-autofocus />
            {debounced.length < 2 ? (
              <Text size="sm" c="dimmed">
                Type at least 2 letters of the shop name.
              </Text>
            ) : results.isPending ? (
              <Loader size="sm" color="forest" />
            ) : results.error ? (
              <ErrorBlock error={results.error} title="Could not search shops" onRetry={() => void results.refetch()} />
            ) : (results.data ?? []).length === 0 ? (
              <Text size="sm" c="dimmed">
                No shop matches “{debounced}”.
              </Text>
            ) : (
              <Stack gap={4} role="list" aria-label="Matching shops">
                {(results.data ?? []).map((v) => {
                  const already = inBundle.has(v.vendorAccountId);
                  return (
                    <UnstyledButton
                      key={v.vendorAccountId}
                      role="listitem"
                      disabled={already}
                      onClick={() => setPicked(v)}
                      aria-label={`${v.businessName}${already ? ' (already in this bundle)' : ''}`}
                      style={{ padding: 8, borderRadius: 8, opacity: already ? 0.5 : 1 }}
                    >
                      <VendorLine v={v} />
                    </UnstyledButton>
                  );
                })}
              </Stack>
            )}
          </>
        )}
        <Textarea
          label="Note (optional)"
          description={`Shown to the shop with the invitation. ${note.length}/${INVITE_NOTE_MAX}`}
          autosize
          minRows={2}
          maxLength={INVITE_NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.currentTarget.value)}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button
            disabled={!picked}
            loading={write.isPending}
            onClick={() =>
              write.mutate({
                run: () => bundlesApi.invite(b.id, { vendorAccountId: picked!.vendorAccountId, note: note.trim() || null }),
                success: `Invitation sent to ${picked!.businessName}.`,
                after: close,
              })
            }
          >
            Send invitation
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function VendorLine({ v }: { v: BundleVendor }) {
  return (
    <Group gap="sm" wrap="nowrap" style={{ minWidth: 0 }}>
      <Avatar src={v.logoUrl} size={32} radius="xl">
        {initialsOf(v.businessName)}
      </Avatar>
      <Stack gap={0} style={{ minWidth: 0 }}>
        <Text size="sm" fw={600} truncate>
          {v.businessName}
          {v.isVerified ? ' ✓' : ''}
        </Text>
        {v.city && (
          <Text size="xs" c="dimmed" truncate>
            {v.city}
          </Text>
        )}
      </Stack>
    </Group>
  );
}
