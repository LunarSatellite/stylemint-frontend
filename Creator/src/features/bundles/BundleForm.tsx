import { useState } from 'react';
import { Alert, Button, Group, Modal, NumberInput, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { formatMoney } from '../../lib/format';
import { confirmAction, toastSuccess } from '../../lib/notify';
import {
  BUNDLES_KEY,
  bundleErrorMessage,
  bundlesApi,
  DESCRIPTION_MAX,
  detailKey,
  MAX_DISCOUNT,
  MAX_ITEMS,
  previewTotals,
  termsChangeWarning,
  TITLE_MAX,
  validateBundleText,
  validateQuantity,
  type Bundle,
  type BundleTextInput,
} from './api';
import { ProductPicker, type PickedItem } from './ProductPicker';

export const bundlePath = (id: string) => `/bundles/${encodeURIComponent(id)}`;

/** Title, description, cover link and discount. */
function TextFields({ v, onChange }: { v: BundleTextInput; onChange: (next: BundleTextInput) => void }) {
  return (
    <>
      <TextInput label="Title" required placeholder="Trekking kit" value={v.title} maxLength={TITLE_MAX} onChange={(e) => onChange({ ...v, title: e.currentTarget.value })} />
      <Textarea
        label="Description (optional)"
        autosize
        minRows={2}
        maxLength={DESCRIPTION_MAX}
        value={v.description}
        onChange={(e) => onChange({ ...v, description: e.currentTarget.value })}
      />
      <TextInput
        label="Cover image link (optional)"
        placeholder="https://…"
        value={v.coverImageUrl}
        onChange={(e) => onChange({ ...v, coverImageUrl: e.currentTarget.value })}
      />
      <NumberInput
        label="Bundle discount (%)"
        description={`0–${MAX_DISCOUNT} %. Each shop funds the discount on its own items. 0 % = a kit sold together at full price.`}
        min={0}
        max={MAX_DISCOUNT}
        decimalScale={2}
        value={v.discountPercent ?? ''}
        onChange={(n) => onChange({ ...v, discountPercent: n === '' ? null : Number(n) })}
      />
    </>
  );
}

const EMPTY: BundleTextInput = { title: '', description: '', coverImageUrl: '', discountPercent: 10 };

export function CreateBundleModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [v, setV] = useState<BundleTextInput>(EMPTY);
  const [items, setItems] = useState<PickedItem[]>([]);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const problem = validateBundleText(v) ?? (items.length === 0 ? 'Pick at least one product from a partner brand.' : items.map((i) => validateQuantity(i.quantity)).find(Boolean) ?? null);
  const preview = previewTotals(
    items.map((i) => ({ price: i.price, quantity: i.quantity })),
    Number(v.discountPercent) || 0,
  );
  const reset = () => {
    setV(EMPTY);
    setItems([]);
  };
  const create = useMutation({
    mutationFn: () =>
      bundlesApi.create({
        title: v.title.trim(),
        description: v.description.trim() || null,
        coverImageUrl: v.coverImageUrl.trim() || null,
        discountPercent: Number(v.discountPercent),
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      }),
    onSuccess: (b) => {
      queryClient.setQueryData(detailKey(b.id), b);
      void queryClient.invalidateQueries({ queryKey: [...BUNDLES_KEY, 'list'] });
      toastSuccess('Bundle saved as a draft. Send it to the shops when it is ready.');
      reset();
      onClose();
      navigate(bundlePath(b.id));
    },
  });
  const close = () => {
    reset();
    create.reset();
    onClose();
  };
  return (
    <Modal opened={opened} onClose={close} title="New bundle" size="lg">
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Pick products from brands you have an active partnership with. Each shop then accepts the discount on its own
          items; the bundle goes live when every shop has accepted. You earn your partnership commission on every item.
        </Text>
        <TextFields v={v} onChange={setV} />
        <Stack gap={6}>
          <Text size="sm" fw={500}>
            Products from your partner brands
          </Text>
          {opened && <ProductPicker value={items} onChange={setItems} max={MAX_ITEMS} />}
        </Stack>
        {items.length > 0 && (
          <Text size="sm" data-testid="create-preview">
            {formatMoney(preview.listTotal)} separately → {formatMoney(preview.bundleTotal)} as a bundle (buyer saves {formatMoney(preview.saving)})
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
          <Button variant="default" onClick={close}>
            Cancel
          </Button>
          <Button disabled={!!problem} loading={create.isPending} onClick={() => create.mutate()}>
            Save draft
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function EditBundleModal({ b, me, opened, onClose }: { b: Bundle; me: string | null; opened: boolean; onClose: () => void }) {
  const [v, setV] = useState<BundleTextInput>({
    title: b.title,
    description: b.description ?? '',
    coverImageUrl: b.coverImageUrl ?? '',
    discountPercent: b.discountPercent,
  });
  const queryClient = useQueryClient();
  const problem = validateBundleText(v);
  const save = useMutation({
    mutationFn: async () => {
      const discountChanged = Number(v.discountPercent) !== b.discountPercent;
      const warning = discountChanged ? termsChangeWarning(b, me) : null;
      if (warning && !(await confirmAction({ title: 'Change the discount?', body: warning, confirmLabel: 'Change discount' }))) return 'cancelled' as const;
      return bundlesApi.update(b.id, {
        title: v.title.trim(),
        description: v.description.trim() || null,
        coverImageUrl: v.coverImageUrl.trim() || null,
        ...(discountChanged ? { discountPercent: Number(v.discountPercent) } : {}),
      });
    },
    onSuccess: (r) => {
      if (r === 'cancelled') return;
      if (r) queryClient.setQueryData(detailKey(b.id), r);
      else void queryClient.invalidateQueries({ queryKey: detailKey(b.id) });
      void queryClient.invalidateQueries({ queryKey: [...BUNDLES_KEY, 'list'] });
      toastSuccess('Bundle saved.');
      onClose();
    },
  });
  return (
    <Modal opened={opened} onClose={onClose} title="Edit bundle" size="lg">
      <Stack gap="md">
        <TextFields v={v} onChange={setV} />
        {problem && (
          <Text size="sm" c="signal">
            {problem}
          </Text>
        )}
        {save.error && (
          <Alert variant="light" color="signal" role="alert">
            {bundleErrorMessage(save.error)}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!!problem} loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
