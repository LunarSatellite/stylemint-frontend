import { useEffect, useState } from 'react';
import { Alert, Button, Group, NumberInput, Select, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { messageOf } from '../../../api/client';
import { SectionCard } from '../../../components/SectionCard';
import { ErrorBlock, ListSkeleton } from '../../../components/StateBlocks';
import { toastSuccess } from '../../../lib/notify';
import { AttributeDataType, attributeUnitLabel, productsApi, type AttributeDefinition, type AttributeValue, type Product } from '../api';

type Draft = Record<string, string>;

function valueToString(v: AttributeValue | undefined): string {
  if (!v) return '';
  if (v.textValue !== null && v.textValue !== undefined) return v.textValue;
  if (v.numberValue !== null && v.numberValue !== undefined) return String(v.numberValue);
  if (v.booleanValue !== null && v.booleanValue !== undefined) return v.booleanValue ? 'true' : 'false';
  return '';
}

function payloadFor(def: AttributeDefinition, raw: string) {
  switch (def.dataType) {
    case AttributeDataType.Number:
      return { numberValue: Number(raw) };
    case AttributeDataType.Boolean:
      return { booleanValue: raw === 'true' };
    default:
      return { textValue: raw.slice(0, 400) };
  }
}

/** Category attributes (material, fit, warranty months…): optional, but they help search and filters. */
export function AttributesCard({ product }: { product: Product }) {
  const qc = useQueryClient();
  const sheet = useQuery({ queryKey: ['product', product.id, 'attributes'], queryFn: () => productsApi.attributes(product.id) });
  const [draft, setDraft] = useState<Draft>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sheet.data) {
      const byKey = new Map(sheet.data.values.map((v) => [v.key, v]));
      setDraft(Object.fromEntries(sheet.data.applicableDefinitions.map((d) => [d.key, valueToString(byKey.get(d.key))])));
    }
  }, [sheet.data]);

  const defs = (sheet.data?.applicableDefinitions ?? []).filter((d) => d.isActive).sort((a, b) => a.sortOrder - b.sortOrder);

  const save = async () => {
    if (!sheet.data) return;
    setSaving(true);
    setError(null);
    const byKey = new Map(sheet.data.values.map((v) => [v.key, v]));
    try {
      for (const def of defs) {
        const now = (draft[def.key] ?? '').trim();
        const before = valueToString(byKey.get(def.key));
        if (now === before) continue;
        if (!now) await productsApi.clearAttribute(product.id, def.key);
        else {
          if (def.dataType === AttributeDataType.Number) {
            const n = Number(now);
            if (!Number.isFinite(n)) throw new Error(`${def.label}: enter a number`);
            if (def.minNumber !== null && n < def.minNumber) throw new Error(`${def.label}: at least ${def.minNumber}`);
            if (def.maxNumber !== null && n > def.maxNumber) throw new Error(`${def.label}: at most ${def.maxNumber}`);
          }
          await productsApi.setAttribute(product.id, def.key, payloadFor(def, now));
        }
      }
      toastSuccess('Details saved');
      void qc.invalidateQueries({ queryKey: ['product', product.id, 'attributes'] });
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard title="Product details" description="Optional facts for this category. They help customers filter and compare.">
      {sheet.isPending ? (
        <ListSkeleton rows={3} height={40} />
      ) : sheet.error ? (
        <ErrorBlock error={sheet.error} onRetry={() => void sheet.refetch()} title="Could not load product details" />
      ) : defs.length === 0 ? (
        <Text size="sm" c="dimmed">
          This category has no extra details to fill in.
        </Text>
      ) : (
        <Stack gap="md">
          {error && (
            <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />}>
              {error}
            </Alert>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            {defs.map((d) => {
              const unit = attributeUnitLabel[d.unit] ?? '';
              const label = unit ? `${d.label} (${unit})` : d.label;
              const value = draft[d.key] ?? '';
              const onChange = (v: string) => setDraft((x) => ({ ...x, [d.key]: v }));
              if (d.dataType === AttributeDataType.Enumeration)
                return (
                  <Select key={d.key} label={label} description={d.description ?? undefined} data={d.allowedValues} value={value || null} onChange={(v) => onChange(v ?? '')} clearable />
                );
              if (d.dataType === AttributeDataType.Boolean)
                return (
                  <Select
                    key={d.key}
                    label={label}
                    description={d.description ?? undefined}
                    data={[
                      { value: 'true', label: 'Yes' },
                      { value: 'false', label: 'No' },
                    ]}
                    value={value || null}
                    onChange={(v) => onChange(v ?? '')}
                    clearable
                  />
                );
              if (d.dataType === AttributeDataType.Number)
                return (
                  <NumberInput
                    key={d.key}
                    label={label}
                    description={d.description ?? undefined}
                    value={value === '' ? '' : Number(value)}
                    onChange={(v) => onChange(v === '' ? '' : String(v))}
                    min={d.minNumber ?? undefined}
                    max={d.maxNumber ?? undefined}
                  />
                );
              return <TextInput key={d.key} label={label} description={d.description ?? undefined} value={value} maxLength={400} onChange={(e) => onChange(e.currentTarget.value)} />;
            })}
          </SimpleGrid>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => void save()} loading={saving}>
              Save details
            </Button>
          </Group>
        </Stack>
      )}
    </SectionCard>
  );
}
