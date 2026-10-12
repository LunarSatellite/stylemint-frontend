import { useEffect, useState } from 'react';
import { Anchor, Button, Group, NumberInput, Stack, Switch, Text } from '@mantine/core';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { isMissingEndpoint } from '../../api/client';
import { SectionCard } from '../../components/SectionCard';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatMoney } from '../../lib/format';
import { toastError, toastSuccess } from '../../lib/notify';
import { emiErrorMessage, productsApi } from '../products/api';

/** Vendor EMI settings: the total buyers may owe you, and which products offer EMI. Hidden if not deployed. */
export function EmiSettingsSection() {
  const qc = useQueryClient();
  const settings = useQuery({ queryKey: ['emi', 'settings'], queryFn: productsApi.emiSettings, retry: false });
  const products = useQuery({ queryKey: ['emi', 'products'], queryFn: productsApi.emiProducts, retry: false });
  const [limited, setLimited] = useState(false);
  const [limit, setLimit] = useState<number>(0);

  useEffect(() => {
    if (settings.data) {
      setLimited(!!settings.data.exposureLimit);
      setLimit(settings.data.exposureLimit?.amount ?? settings.data.maxExposureLimit.amount);
    }
  }, [settings.data]);

  const save = useMutation({
    mutationFn: () => productsApi.putEmiSettings(limited ? { amount: limit, currency: 'NPR' } : null),
    onSuccess: (data) => {
      qc.setQueryData(['emi', 'settings'], data);
      toastSuccess('EMI settings saved');
    },
    onError: (e) => toastError(new Error(emiErrorMessage(e))),
  });

  if (settings.error && isMissingEndpoint(settings.error)) return null;

  return (
    <SectionCard title="EMI" description="Instalments you fund for customers. Turn EMI on per product in the product editor.">
      {settings.isPending ? (
        <ListSkeleton rows={2} height={40} />
      ) : settings.error ? (
        <ErrorBlock error={settings.error} onRetry={() => void settings.refetch()} title="Could not load EMI settings" />
      ) : (
        <Stack gap="md">
          <Switch
            label="Limit how much customers can owe me in total"
            checked={limited}
            onChange={(e) => setLimited(e.currentTarget.checked)}
          />
          {limited && (
            <NumberInput
              label="Limit (Rs)"
              description={`StyleMint allows up to ${formatMoney(settings.data.maxExposureLimit)}.`}
              value={limit}
              onChange={(v) => setLimit(Number(v) || 0)}
              min={0}
              max={settings.data.maxExposureLimit.amount}
              thousandSeparator=","
              maw={260}
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={() => save.mutate()} loading={save.isPending}>
              Save
            </Button>
          </Group>
          <div>
            <Text size="sm" fw={600} mb={4}>
              Products with EMI
            </Text>
            {products.isPending ? (
              <ListSkeleton rows={1} height={30} />
            ) : products.error ? (
              <Text size="sm" c="dimmed">
                Could not load.
              </Text>
            ) : products.data.length === 0 ? (
              <Text size="sm" c="dimmed">
                None yet. Open a product priced Rs 20,000 or more and turn on “Offer EMI”.
              </Text>
            ) : (
              <Stack gap={4}>
                {products.data.map((t) => (
                  <Group key={t.productId} justify="space-between" wrap="nowrap">
                    <Anchor component={Link} to={`/products/${t.productId}`} size="sm" truncate>
                      {t.productName}
                    </Anchor>
                    <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
                      {t.effectiveMinDownPaymentPercent}% down · {t.tenures.join('/')} months
                    </Text>
                  </Group>
                ))}
              </Stack>
            )}
          </div>
        </Stack>
      )}
    </SectionCard>
  );
}
