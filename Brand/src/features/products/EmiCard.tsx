import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Chip, Group, Slider, Stack, Switch, Text } from '@mantine/core';
import { IconInfoCircle } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { isMissingEndpoint } from '../../api/client';
import { SectionCard } from '../../components/SectionCard';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatMoney } from '../../lib/format';
import { toastSuccess } from '../../lib/notify';
import { emiErrorMessage, emiInstallment, productsApi, type Product } from './api';

const TENURES = [3, 6, 9, 12];
const MIN_PRICE = 20_000;

/**
 * "Offer EMI" (emi-phase1-contract.md): vendor-funded instalments, 0 % interest, manual approval.
 * Hidden entirely when the backend does not have the endpoint yet.
 */
export function EmiCard({ product }: { product: Product }) {
  const qc = useQueryClient();
  const terms = useQuery({ queryKey: ['product', product.id, 'emi'], queryFn: () => productsApi.emiTerms(product.id), retry: false });
  const [enabled, setEnabled] = useState(false);
  const [minDown, setMinDown] = useState(30);
  const [tenures, setTenures] = useState<string[]>(['3', '6']);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (terms.data) {
      setEnabled(terms.data.enabled);
      setMinDown(terms.data.minDownPaymentPercent || 30);
      setTenures((terms.data.tenures.length ? terms.data.tenures : [3, 6]).map(String));
    }
  }, [terms.data]);

  const save = useMutation({
    // The backend validates tenures even when turning EMI off, so never send an empty list.
    mutationFn: () =>
      productsApi.putEmiTerms(product.id, {
        enabled,
        minDownPaymentPercent: minDown,
        tenures: (tenures.length ? tenures : ['3']).map(Number).sort((a, b) => a - b),
      }),
    onSuccess: (data) => {
      qc.setQueryData(['product', product.id, 'emi'], data);
      setError(null);
      toastSuccess(data.enabled ? 'EMI offered on this product' : 'EMI turned off');
    },
    onError: (e) => setError(emiErrorMessage(e)),
  });

  const eligiblePrices = product.variants.map((v) => v.priceAmount).filter((p) => p >= MIN_PRICE);
  const lowest = eligiblePrices.length ? Math.min(...eligiblePrices) : null;
  const effectiveMin = Math.max(minDown, terms.data?.effectiveMinDownPaymentPercent ?? 20, 20);
  const longest = Math.max(0, ...tenures.map(Number));
  const sample = useMemo(() => (lowest && longest ? emiInstallment(lowest, effectiveMin, longest) : null), [lowest, longest, effectiveMin]);

  if (terms.error && isMissingEndpoint(terms.error)) return null;

  return (
    <SectionCard title="Offer EMI" description="Let customers pay in monthly instalments. You fund it; StyleMint checks and collects.">
      {terms.isPending ? (
        <ListSkeleton rows={2} height={40} />
      ) : terms.error ? (
        <ErrorBlock error={terms.error} onRetry={() => void terms.refetch()} title="Could not load EMI terms" />
      ) : (
        <Stack gap="md">
          {lowest === null && (
            <Alert color="gray" variant="light" icon={<IconInfoCircle size={16} />}>
              EMI is available for products priced Rs 20,000 or more. Raise the price of at least one variant to offer it.
            </Alert>
          )}
          <Switch
            label="Offer EMI on this product"
            checked={enabled}
            onChange={(e) => setEnabled(e.currentTarget.checked)}
            disabled={lowest === null && !enabled}
          />
          {enabled && (
            <>
              <div>
                <Text size="sm" fw={600}>
                  Minimum down payment: {minDown}%
                </Text>
                <Slider
                  value={minDown}
                  onChange={setMinDown}
                  min={20}
                  max={90}
                  step={5}
                  marks={[
                    { value: 20, label: '20%' },
                    { value: 50, label: '50%' },
                    { value: 90, label: '90%' },
                  ]}
                  mb="lg"
                  aria-label="Minimum down payment"
                />
                {terms.data && terms.data.effectiveMinDownPaymentPercent > minDown && (
                  <Text size="xs" c="dimmed">
                    Customers pay at least {terms.data.effectiveMinDownPaymentPercent}% so the down payment covers StyleMint’s commission.
                  </Text>
                )}
              </div>
              <div>
                <Text size="sm" fw={600} mb={6}>
                  Months to pay
                </Text>
                <Chip.Group multiple value={tenures} onChange={setTenures}>
                  <Group gap="xs">
                    {TENURES.map((t) => (
                      <Chip key={t} value={String(t)}>
                        {t} months
                      </Chip>
                    ))}
                  </Group>
                </Chip.Group>
              </div>
              {sample && lowest && (
                <Alert color="forest" variant="light" title="Example">
                  On {formatMoney(lowest)}: {formatMoney(sample.downPayment)} down, then {longest - 1 > 0 ? `${longest - 1} × ` : ''}
                  {formatMoney(sample.installment)}
                  {longest > 1 ? ` and a last payment of ${formatMoney(sample.last)}` : ''}. 0% interest — the customer pays
                  the normal price.
                </Alert>
              )}
              <Text size="xs" c="dimmed">
                Each EMI order is approved by you and StyleMint before it ships (manual approval). EMI checkout is opening in
                stages.
              </Text>
            </>
          )}
          {error && (
            <Text size="sm" c="signal" role="alert">
              {error}
            </Text>
          )}
          <Group justify="flex-end">
            <Button
              variant={enabled ? 'filled' : 'default'}
              onClick={() => {
                if (enabled && tenures.length === 0) return setError('Choose at least one number of months.');
                save.mutate();
              }}
              loading={save.isPending}
            >
              Save EMI terms
            </Button>
          </Group>
        </Stack>
      )}
    </SectionCard>
  );
}
