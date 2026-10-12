import { useState } from 'react';
import { Alert, Button, Card, Checkbox, Group, NumberInput, SimpleGrid, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { shippingKindLabel, ShippingOptionKind, type Product } from '../api';
import { issuesOf, shippingSchema, type ShippingForm } from '../schemas';

const DEFAULTS: Record<number, { fee: number; daysMin: number; daysMax: number }> = {
  [ShippingOptionKind.Standard]: { fee: 100, daysMin: 2, daysMax: 5 },
  [ShippingOptionKind.Express]: { fee: 250, daysMin: 1, daysMax: 2 },
  [ShippingOptionKind.Pickup]: { fee: 0, daysMin: 0, daysMax: 1 },
};

export function initialShipping(product: Product): ShippingForm {
  const def = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  return {
    processingTimeDays: product.processingTimeDays ?? 1,
    weightGrams: def?.weightGrams ?? 0,
    lengthCm: def?.lengthCm ?? 0,
    widthCm: def?.widthCm ?? 0,
    heightCm: def?.heightCm ?? 0,
    options: [ShippingOptionKind.Standard, ShippingOptionKind.Express, ShippingOptionKind.Pickup].map((kind) => {
      const existing = product.shippingOptions.find((o) => o.kind === kind);
      const d = DEFAULTS[kind];
      return {
        kind,
        enabled: existing ? existing.isEnabled : kind === ShippingOptionKind.Standard,
        fee: existing?.feeAmount ?? d.fee,
        daysMin: existing?.estimatedDaysMin ?? d.daysMin,
        daysMax: existing?.estimatedDaysMax ?? d.daysMax,
      };
    }),
  };
}

export function ShippingStep({
  product,
  onSave,
  saving,
  serverError,
}: {
  product: Product;
  onSave: (form: ShippingForm) => void;
  saving: boolean;
  serverError: string | null;
}) {
  const [form, setForm] = useState<ShippingForm>(() => initialShipping(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ShippingForm>(k: K, v: ShippingForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setOption = (i: number, patch: Partial<ShippingForm['options'][number]>) =>
    set(
      'options',
      form.options.map((o, k) => (k === i ? { ...o, ...patch } : o)),
    );

  const submit = () => {
    const parsed = shippingSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesOf(parsed.error));
      return;
    }
    setErrors({});
    onSave(parsed.data);
  };

  const num = (v: string | number) => (v === '' ? 0 : Number(v));

  return (
    <Stack gap="md">
      {serverError && (
        <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
          {serverError}
        </Alert>
      )}
      <NumberInput
        label="Days to prepare an order"
        description="How long you need to pack an order after accepting it."
        value={form.processingTimeDays}
        onChange={(v) => set('processingTimeDays', num(v))}
        min={0}
        max={60}
        allowDecimal={false}
        error={errors.processingTimeDays}
        maw={260}
      />
      <div>
        <Text size="sm" fw={600}>
          Packed size and weight
        </Text>
        <Text size="xs" c="dimmed" mb={6}>
          Riders use this to see whether the parcel fits their vehicle.
        </Text>
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
          <NumberInput label="Weight (g)" value={form.weightGrams} onChange={(v) => set('weightGrams', num(v))} min={0} allowDecimal={false} error={errors.weightGrams} thousandSeparator="," />
          <NumberInput label="Length (cm)" value={form.lengthCm} onChange={(v) => set('lengthCm', num(v))} min={0} max={500} error={errors.lengthCm} />
          <NumberInput label="Width (cm)" value={form.widthCm} onChange={(v) => set('widthCm', num(v))} min={0} max={500} error={errors.widthCm} />
          <NumberInput label="Height (cm)" value={form.heightCm} onChange={(v) => set('heightCm', num(v))} min={0} max={500} error={errors.heightCm} />
        </SimpleGrid>
      </div>
      <div>
        <Text size="sm" fw={600}>
          How customers get it
        </Text>
        {errors.options && (
          <Text size="sm" c="signal" mt={4}>
            {errors.options}
          </Text>
        )}
        <Stack gap="xs" mt={6}>
          {form.options.map((o, i) => (
            <Card key={o.kind} padding="sm" withBorder>
              <Checkbox
                label={shippingKindLabel[o.kind]}
                checked={o.enabled}
                onChange={(e) => setOption(i, { enabled: e.currentTarget.checked })}
                mb={o.enabled ? 'xs' : 0}
              />
              {o.enabled && (
                <SimpleGrid cols={3} spacing="xs">
                  <NumberInput size="xs" label="Fee (Rs)" value={o.fee} onChange={(v) => setOption(i, { fee: num(v) })} min={0} thousandSeparator="," />
                  <NumberInput size="xs" label="Days, from" value={o.daysMin} onChange={(v) => setOption(i, { daysMin: num(v) })} min={0} max={90} allowDecimal={false} />
                  <NumberInput size="xs" label="to" value={o.daysMax} onChange={(v) => setOption(i, { daysMax: num(v) })} min={0} max={90} allowDecimal={false} />
                </SimpleGrid>
              )}
            </Card>
          ))}
        </Stack>
      </div>
      <Group justify="flex-end">
        <Button onClick={submit} loading={saving}>
          Save and continue
        </Button>
      </Group>
    </Stack>
  );
}
