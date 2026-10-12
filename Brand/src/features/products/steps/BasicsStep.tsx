import { useMemo, useState } from 'react';
import { Alert, Button, Collapse, Group, Select, Stack, Text, Textarea, TextInput } from '@mantine/core';
import { IconAlertTriangle, IconSparkles } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { messageOf } from '../../../api/client';
import { productsApi, type Category, type Product } from '../api';
import { basicsSchema, issuesOf, type BasicsForm } from '../schemas';

/** "Women › Dresses › Party" labels from the flat category list. */
export function categoryOptions(categories: Category[]) {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const pathOf = (c: Category): string => {
    const parts = [c.nameEn];
    let parent = c.parentCategoryId ? byId.get(c.parentCategoryId) : undefined;
    let guard = 0;
    while (parent && guard++ < 6) {
      parts.unshift(parent.nameEn);
      parent = parent.parentCategoryId ? byId.get(parent.parentCategoryId) : undefined;
    }
    return parts.join(' › ');
  };
  const hasChildren = new Set(categories.map((c) => c.parentCategoryId).filter(Boolean));
  return categories
    .filter((c) => c.isActive)
    .map((c) => ({ value: c.id, label: pathOf(c), leaf: !hasChildren.has(c.id), gated: c.isGated }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function firstSentence(text: string): string {
  const i = text.indexOf('. ');
  return i > 0 ? text.slice(0, i + 1) : text;
}

export function BasicsStep({
  product,
  onSave,
  saving,
  serverError,
}: {
  product: Product | null;
  onSave: (form: BasicsForm) => void;
  saving: boolean;
  serverError: string | null;
}) {
  const categories = useQuery({ queryKey: ['categories'], queryFn: productsApi.categories, staleTime: 10 * 60_000 });
  const [form, setForm] = useState<BasicsForm>({
    categoryId: product?.categoryId ?? '',
    name: product?.name ?? '',
    shortDescription: product?.shortDescription ?? '',
    longDescriptionMarkdown: product?.longDescriptionMarkdown ?? '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [aiOpen, setAiOpen] = useState(false);
  const [aiNotes, setAiNotes] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const options = useMemo(() => categoryOptions(categories.data ?? []), [categories.data]);
  const set = <K extends keyof BasicsForm>(k: K, v: BasicsForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  const submit = () => {
    const parsed = basicsSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(issuesOf(parsed.error));
      return;
    }
    setErrors({});
    onSave(parsed.data);
  };

  const describe = async () => {
    if (!product) return;
    if (!aiNotes.trim() && product.images.length === 0) {
      setAiError('Write a few words about the product (material, fit, what it is for).');
      return;
    }
    setAiBusy(true);
    setAiError(null);
    try {
      const res = await productsApi.aiDescribe(product.id, {
        shorthandNotes: [form.name, aiNotes].filter((s) => s.trim()).join('. ').slice(0, 2000) || null,
        imageUrls: product.images.slice(0, 10).map((i) => i.cdnUrl),
      });
      const features = res.keyFeatures.length ? `\n\n${res.keyFeatures.map((f) => `- ${f}`).join('\n')}` : '';
      setForm((f) => ({
        ...f,
        name: f.name || res.title,
        shortDescription: firstSentence(res.description).slice(0, 280),
        longDescriptionMarkdown: `${res.description}${features}`.slice(0, 20000),
      }));
      setAiOpen(false);
    } catch (e) {
      setAiError(messageOf(e));
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Stack gap="md">
      {serverError && (
        <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
          {serverError}
        </Alert>
      )}
      <Select
        label="Category"
        placeholder={categories.isPending ? 'Loading categories…' : 'Search a category'}
        data={options.map((o) => ({ value: o.value, label: o.label }))}
        searchable
        nothingFoundMessage={categories.error ? 'Could not load categories' : 'No category matches'}
        value={form.categoryId || null}
        onChange={(v) => set('categoryId', v ?? '')}
        error={errors.categoryId ?? (categories.error ? 'Could not load categories — try again later' : undefined)}
        required
        maxDropdownHeight={320}
      />
      <TextInput
        label="Product name"
        placeholder="e.g. Hand-knitted woollen sweater"
        value={form.name}
        onChange={(e) => set('name', e.currentTarget.value)}
        error={errors.name}
        maxLength={200}
        required
      />
      <TextInput
        label="Short summary"
        description="One line shown under the name in search and on cards."
        value={form.shortDescription}
        onChange={(e) => set('shortDescription', e.currentTarget.value)}
        error={errors.shortDescription}
        maxLength={280}
        required
        rightSection={
          <Text size="xs" c="dimmed" pr={6}>
            {form.shortDescription.length}/280
          </Text>
        }
        rightSectionWidth={64}
      />
      <Textarea
        label="Description"
        description="Material, size and fit, care, what is in the box. You can use - for bullet points."
        value={form.longDescriptionMarkdown}
        onChange={(e) => set('longDescriptionMarkdown', e.currentTarget.value)}
        error={errors.longDescriptionMarkdown}
        autosize
        minRows={5}
        maxRows={16}
        required
      />

      {product ? (
        <div>
          <Button variant="light" leftSection={<IconSparkles size={16} />} onClick={() => setAiOpen((o) => !o)} size="sm">
            Write it with AI
          </Button>
          <Collapse in={aiOpen}>
            <Stack gap="xs" mt="sm" p="sm" style={{ border: '1px solid var(--sm-border)', borderRadius: 12 }}>
              <Textarea
                label="A few words about the product"
                placeholder="e.g. pure pashmina shawl, handmade in Kathmandu, 200 x 70 cm, soft, dry clean"
                autosize
                minRows={2}
                maxLength={2000}
                value={aiNotes}
                onChange={(e) => setAiNotes(e.currentTarget.value)}
              />
              {aiError && (
                <Text size="sm" c="signal">
                  {aiError}
                </Text>
              )}
              <Group justify="space-between">
                <Text size="xs" c="dimmed">
                  We also look at your photos. Check the text before saving.
                </Text>
                <Button size="xs" loading={aiBusy} onClick={() => void describe()}>
                  Write description
                </Button>
              </Group>
            </Stack>
          </Collapse>
        </div>
      ) : (
        <Text size="xs" c="dimmed">
          Tip: after this step you can let AI write the description from a few notes and your photos.
        </Text>
      )}

      <Group justify="flex-end">
        <Button onClick={submit} loading={saving}>
          {product ? 'Save and continue' : 'Create draft and continue'}
        </Button>
      </Group>
    </Stack>
  );
}
