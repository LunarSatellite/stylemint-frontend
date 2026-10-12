import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  SimpleGrid,
  Stack,
  Table,
  TagsInput,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { IconAlertTriangle, IconPlus, IconTrash } from '@tabler/icons-react';
import { formatMoney } from '../../../lib/format';
import { useIsPhone } from '../../../lib/useIsPhone';
import type { Product } from '../api';
import { issuesOf, OPTION_PRESETS, pricingSchema, syncVariants, type OptionForm, type PricingForm, type VariantRow } from '../schemas';

export function initialPricing(product: Product): PricingForm {
  const def = product.variants.find((v) => v.isDefault) ?? product.variants[0];
  const options: OptionForm[] = [...product.options]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((o) => ({ name: o.name, kind: o.kind, values: [...o.values].sort((a, b) => a.sortOrder - b.sortOrder).map((v) => v.value) }));
  const valueById = new Map(product.options.flatMap((o) => o.values.map((v) => [v.id, v.value] as const)));
  const variants: VariantRow[] = options.length
    ? [...product.variants]
        .sort((a, b) => Number(b.isDefault) - Number(a.isDefault))
        .map((v) => {
          const values = v.optionValueIds.map((id) => valueById.get(id) ?? '').filter(Boolean);
          return {
            key: values.join(' / '),
            values,
            sku: v.sku,
            price: v.priceAmount !== def?.priceAmount ? v.priceAmount : null,
            stock: v.quantityOnHand,
          };
        })
        .filter((r) => r.values.length === options.length)
    : [];
  const draftSku = def?.sku?.startsWith('DRAFT-') ? '' : (def?.sku ?? '');
  return {
    sku: draftSku,
    price: def && def.priceAmount > 0 ? def.priceAmount : 0,
    costPrice: def?.costPriceAmount ?? 0,
    stock: def?.quantityOnHand ?? 0,
    trackInventory: def?.trackInventory ?? true,
    allowOverselling: def?.allowOverselling ?? false,
    options,
    variants,
  };
}

export function PricingStep({
  product,
  onSave,
  saving,
  serverError,
}: {
  product: Product;
  onSave: (form: PricingForm) => void;
  saving: boolean;
  serverError: string | null;
}) {
  const [form, setForm] = useState<PricingForm>(() => initialPricing(product));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isPhone = useIsPhone();

  const set = <K extends keyof PricingForm>(k: K, v: PricingForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const setOptions = (options: OptionForm[]) =>
    setForm((f) => ({ ...f, options, variants: syncVariants(options, f.variants, f.sku, f.stock) }));
  const updateOption = (i: number, patch: Partial<OptionForm>) =>
    setOptions(form.options.map((o, k) => (k === i ? { ...o, ...patch } : o)));
  const addOption = (preset: { label: string; kind: number }) =>
    setOptions([...form.options, { name: preset.label, kind: preset.kind, values: [] }]);
  const updateVariant = (key: string, patch: Partial<VariantRow>) =>
    set(
      'variants',
      form.variants.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  const removeVariant = (key: string) => set('variants', form.variants.filter((r) => r.key !== key));

  const submit = () => {
    const parsed = pricingSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesOf(parsed.error));
      return;
    }
    setErrors({});
    onSave(parsed.data);
  };

  const unused = OPTION_PRESETS.filter((p) => !form.options.some((o) => o.kind === p.kind || o.name.toLowerCase() === p.label.toLowerCase()));
  const margin = form.price > 0 && form.costPrice > 0 ? Math.round(((form.price - form.costPrice) / form.price) * 100) : null;

  return (
    <Stack gap="md">
      {serverError && (
        <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
          {serverError}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <NumberInput
          label="Selling price (Rs)"
          description="What the customer pays, before delivery."
          value={form.price}
          onChange={(v) => set('price', Number(v) || 0)}
          min={0}
          thousandSeparator=","
          decimalScale={2}
          error={errors.price}
          required
        />
        <NumberInput
          label="Your cost (Rs)"
          description={margin !== null ? `Margin about ${margin}%. Only you see this.` : 'Optional. Only you see this.'}
          value={form.costPrice}
          onChange={(v) => set('costPrice', Number(v) || 0)}
          min={0}
          thousandSeparator=","
          decimalScale={2}
          error={errors.costPrice}
        />
        <TextInput
          label="SKU"
          description="Your own product code, unique in your shop."
          value={form.sku}
          onChange={(e) => set('sku', e.currentTarget.value)}
          maxLength={64}
          error={errors.sku}
          required
        />
        {form.options.length === 0 && (
          <NumberInput
            label="Quantity in stock"
            value={form.stock}
            onChange={(v) => set('stock', Number(v) || 0)}
            min={0}
            allowDecimal={false}
            error={errors.stock}
            disabled={!form.trackInventory}
          />
        )}
      </SimpleGrid>
      <Group gap="lg">
        <Checkbox
          label="Track stock"
          description="Stop selling when stock runs out."
          checked={form.trackInventory}
          onChange={(e) => set('trackInventory', e.currentTarget.checked)}
        />
        <Checkbox
          label="Allow orders when out of stock"
          checked={form.allowOverselling}
          onChange={(e) => set('allowOverselling', e.currentTarget.checked)}
          disabled={!form.trackInventory}
        />
      </Group>

      <Card withBorder padding="md">
        <Stack gap="sm">
          <div>
            <Title order={4}>Sizes, colours and other options</Title>
            <Text size="sm" c="dimmed">
              Add options if customers choose between versions. Each combination becomes a variant with its own stock.
            </Text>
          </div>
          {errors.options && (
            <Text size="sm" c="signal">
              {errors.options}
            </Text>
          )}
          {form.options.map((o, i) => (
            <Group key={i} align="flex-end" wrap="nowrap" gap="sm">
              <TextInput
                label="Option"
                value={o.name}
                onChange={(e) => updateOption(i, { name: e.currentTarget.value })}
                maxLength={40}
                w={130}
              />
              <TagsInput
                label="Values"
                placeholder={o.values.length ? '' : o.kind === 2 ? 'Red, Black… (Enter after each)' : 'S, M, L… (Enter after each)'}
                value={o.values}
                onChange={(values) => updateOption(i, { values: values.map((v) => v.trim()).filter(Boolean).slice(0, 30) })}
                style={{ flex: 1 }}
                splitChars={[',', 'Enter']}
                clearable
              />
              <ActionIcon variant="subtle" color="signal" size="lg" onClick={() => setOptions(form.options.filter((_, k) => k !== i))} aria-label={`Remove option ${o.name}`}>
                <IconTrash size={16} />
              </ActionIcon>
            </Group>
          ))}
          {form.options.length < 3 && (
            <Group gap="xs">
              {unused.map((p) => (
                <Button key={p.kind} size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => addOption(p)}>
                  {p.label}
                </Button>
              ))}
              <Button size="xs" variant="subtle" leftSection={<IconPlus size={14} />} onClick={() => addOption({ label: '', kind: 99 })}>
                Other option
              </Button>
            </Group>
          )}

          {form.variants.length > 0 && (
            <>
              {errors.variants && (
                <Text size="sm" c="signal">
                  {errors.variants}
                </Text>
              )}
              <Text size="sm" fw={600}>
                {form.variants.length} {form.variants.length === 1 ? 'variant' : 'variants'} — the first is shown by default
              </Text>
              {isPhone ? (
                <Stack gap="xs">
                  {form.variants.map((r) => (
                    <Card key={r.key} padding="sm" withBorder>
                      <Group justify="space-between" mb={6}>
                        <Text fw={600} size="sm">
                          {r.key}
                        </Text>
                        <ActionIcon variant="subtle" color="signal" onClick={() => removeVariant(r.key)} aria-label={`Remove ${r.key}`}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Group>
                      <SimpleGrid cols={2} spacing="xs">
                        <TextInput size="xs" label="SKU" value={r.sku} onChange={(e) => updateVariant(r.key, { sku: e.currentTarget.value })} />
                        <NumberInput size="xs" label="Stock" value={r.stock} min={0} allowDecimal={false} onChange={(v) => updateVariant(r.key, { stock: Number(v) || 0 })} />
                        <NumberInput
                          size="xs"
                          label="Price (blank = main price)"
                          value={r.price ?? ''}
                          min={0}
                          thousandSeparator=","
                          onChange={(v) => updateVariant(r.key, { price: v === '' ? null : Number(v) })}
                        />
                      </SimpleGrid>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Table.ScrollContainer minWidth={560}>
                  <Table verticalSpacing="xs" highlightOnHover={false}>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Variant</Table.Th>
                        <Table.Th>SKU</Table.Th>
                        <Table.Th>Price (Rs)</Table.Th>
                        <Table.Th>Stock</Table.Th>
                        <Table.Th />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {form.variants.map((r) => (
                        <Table.Tr key={r.key}>
                          <Table.Td>
                            <Text size="sm" fw={600}>
                              {r.key}
                            </Text>
                          </Table.Td>
                          <Table.Td>
                            <TextInput size="xs" value={r.sku} onChange={(e) => updateVariant(r.key, { sku: e.currentTarget.value })} aria-label={`SKU for ${r.key}`} maxLength={64} />
                          </Table.Td>
                          <Table.Td>
                            <NumberInput
                              size="xs"
                              value={r.price ?? ''}
                              placeholder={formatMoney(form.price)}
                              min={0}
                              thousandSeparator=","
                              onChange={(v) => updateVariant(r.key, { price: v === '' ? null : Number(v) })}
                              aria-label={`Price for ${r.key}`}
                            />
                          </Table.Td>
                          <Table.Td>
                            <NumberInput
                              size="xs"
                              value={r.stock}
                              min={0}
                              allowDecimal={false}
                              onChange={(v) => updateVariant(r.key, { stock: Number(v) || 0 })}
                              aria-label={`Stock for ${r.key}`}
                              w={90}
                            />
                          </Table.Td>
                          <Table.Td>
                            <ActionIcon variant="subtle" color="signal" onClick={() => removeVariant(r.key)} aria-label={`Remove ${r.key}`}>
                              <IconTrash size={14} />
                            </ActionIcon>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              )}
            </>
          )}
        </Stack>
      </Card>

      <Group justify="flex-end">
        <Button onClick={submit} loading={saving}>
          Save and continue
        </Button>
      </Group>
    </Stack>
  );
}
