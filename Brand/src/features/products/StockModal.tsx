import { useEffect, useState } from 'react';
import { Alert, Button, Checkbox, Group, Modal, NumberInput, Stack, Text } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageOf } from '../../api/client';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { toastSuccess } from '../../lib/notify';
import { productsApi } from './api';

/** Set stock per variant (absolute quantities, as the API expects). */
export function StockModal({ productId, onClose }: { productId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const product = useQuery({ queryKey: ['product', productId], queryFn: () => productsApi.detail(productId!), enabled: !!productId });
  const [qty, setQty] = useState<Record<string, number>>({});
  const [alert, setAlert] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (product.data) setQty(Object.fromEntries(product.data.variants.map((v) => [v.id, v.quantityOnHand])));
    setError(null);
  }, [product.data]);

  const save = useMutation({
    mutationFn: () => {
      const changes = (product.data?.variants ?? [])
        .filter((v) => v.trackInventory && qty[v.id] !== v.quantityOnHand)
        .map((v) => ({ variantId: v.id, quantity: qty[v.id] }));
      if (changes.length === 0) return Promise.resolve(null);
      return productsApi.stock(productId!, changes, alert);
    },
    onSuccess: (saved) => {
      if (saved) {
        qc.setQueryData(['product', productId], saved);
        void qc.invalidateQueries({ queryKey: ['products'] });
        void qc.invalidateQueries({ queryKey: ['home'] });
        toastSuccess('Stock updated');
      }
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });

  const variants = product.data?.variants ?? [];
  return (
    <Modal opened={!!productId} onClose={onClose} title={product.data ? `Stock · ${product.data.name}` : 'Stock'}>
      {product.isPending ? (
        <ListSkeleton rows={3} height={40} />
      ) : product.error ? (
        <ErrorBlock error={product.error} onRetry={() => void product.refetch()} />
      ) : (
        <Stack gap="sm">
          {error && (
            <Alert color="signal" variant="light">
              {error}
            </Alert>
          )}
          {variants.map((v) => (
            <Group key={v.id} justify="space-between" wrap="nowrap">
              <div style={{ minWidth: 0 }}>
                <Text size="sm" fw={600} truncate>
                  {v.optionLabel ?? (variants.length === 1 ? 'In stock' : v.sku)}
                </Text>
                <Text size="xs" c="dimmed">
                  {v.sku}
                  {!v.trackInventory ? ' · stock not tracked' : ''}
                </Text>
              </div>
              <NumberInput
                w={110}
                min={0}
                allowDecimal={false}
                value={qty[v.id] ?? 0}
                onChange={(n) => setQty((q) => ({ ...q, [v.id]: Math.max(0, Number(n) || 0) }))}
                disabled={!v.trackInventory}
                aria-label={`Stock for ${v.optionLabel ?? v.sku}`}
              />
            </Group>
          ))}
          <Checkbox label="Tell waiting customers when it is back in stock" checked={alert} onChange={(e) => setAlert(e.currentTarget.checked)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending}>
              Save stock
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  );
}
