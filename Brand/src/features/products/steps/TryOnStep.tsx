import { useRef, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Image,
  List,
  NumberInput,
  Progress,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  VisuallyHidden,
} from '@mantine/core';
import { Dropzone } from '@mantine/dropzone';
import {
  IconAlertTriangle,
  IconArrowDown,
  IconArrowUp,
  IconCheck,
  IconCircleCheck,
  IconClock,
  IconHanger,
  IconPlus,
  IconTrash,
  IconX,
} from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, isMissingEndpoint, messageOf } from '../../../api/client';
import { SectionCard } from '../../../components/SectionCard';
import { ErrorBlock, ListSkeleton } from '../../../components/StateBlocks';
import { confirmAction, toastError, toastSuccess } from '../../../lib/notify';
import { useIsPhone } from '../../../lib/useIsPhone';
import type { Product } from '../api';
import {
  checkTryOnImage,
  garmentTypeLabel,
  initialChartForm,
  MAX_ROWS,
  maxMeasurement,
  measurementLabel,
  measurementsFor,
  needsSizeChart,
  readImageInfo,
  requiredFor,
  rowKey,
  sizeChartKey,
  sizeValuesOf,
  toSizeChartInput,
  tryOnApi,
  tryOnKey,
  TRYON_MAX_BYTES,
  TRYON_TYPES,
  unitLabel,
  validateSizeChart,
  type ChartIssues,
  type MeasurementKey,
  type SizeChartDto,
  type SizeChartForm,
  type TryOnReadinessDto,
} from '../tryon';

/** Readiness for the publish gate and badges. `missing` = endpoints not deployed yet. */
export function useTryOnReadiness(productId: string | undefined) {
  return useQuery({ queryKey: tryOnKey(productId ?? ''), queryFn: () => tryOnApi.readiness(productId!), enabled: !!productId });
}

export function TryOnBadge({ readiness }: { readiness: TryOnReadinessDto }) {
  return readiness.ready ? (
    <Badge color="forest" variant="light" leftSection={<IconCircleCheck size={12} />}>
      Try-on ready
    </Badge>
  ) : (
    <Badge color="amber" variant="light">
      Try-on not ready
    </Badge>
  );
}

/** What the publish card must say about try-on. */
export function tryOnGate(product: Product, readiness: { data?: TryOnReadinessDto; error: unknown }) {
  if (readiness.error && isMissingEndpoint(readiness.error)) return { block: null, warn: null };
  const r = readiness.data;
  if (!r) return { block: null, warn: null };
  const block = needsSizeChart(product) && !r.hasSizeChart ? 'This product comes in sizes, so it needs a size chart before you can publish it.' : null;
  const warn = !r.hasTryOnImage ? 'No try-on image yet. Customers can’t try this on with their camera — we recommend adding one.' : null;
  return { block, warn };
}

export function TryOnStep({ product, onContinue }: { product: Product; onContinue: () => void }) {
  const readiness = useTryOnReadiness(product.id);

  if (readiness.isPending) return <ListSkeleton rows={4} height={56} />;
  if (readiness.error && isMissingEndpoint(readiness.error)) {
    return (
      <Stack gap="md">
        <Alert color="gray" variant="light" icon={<IconClock size={16} />} title="Try-on setup is coming soon">
          Soon you’ll add a size chart and a try-on image here so customers can try your clothes on with their phone camera.
          You can publish without it for now.
        </Alert>
        <Group justify="flex-end">
          <Button onClick={onContinue}>Continue</Button>
        </Group>
      </Stack>
    );
  }
  if (readiness.error) {
    return <ErrorBlock error={readiness.error} onRetry={() => void readiness.refetch()} title="Could not load try-on setup" />;
  }
  const r = readiness.data!;
  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Text size="sm" c="dimmed" style={{ flex: '1 1 260px' }}>
          Help customers pick the right size and try the product on with their phone camera.
        </Text>
        <TryOnBadge readiness={r} />
      </Group>
      {!r.ready && r.problems.length > 0 && (
        <Alert color="amber" variant="light" icon={<IconAlertTriangle size={16} />} title="Still to do">
          <List size="sm" spacing={2}>
            {r.problems.map((p) => (
              <List.Item key={p}>{p}</List.Item>
            ))}
          </List>
        </Alert>
      )}
      <SizeChartCard product={product} />
      <TryOnImageCard product={product} readiness={r} />
      <Group justify="flex-end">
        <Button onClick={onContinue}>Continue</Button>
      </Group>
    </Stack>
  );
}

// ---------------------------------------------------------------- size chart

function SizeChartCard({ product }: { product: Product }) {
  const chart = useQuery({ queryKey: sizeChartKey(product.id), queryFn: () => tryOnApi.sizeChart(product.id) });
  const required = needsSizeChart(product);
  return (
    <SectionCard
      id="size-chart"
      title={
        <Group gap="xs">
          Size chart
          {required && (
            <Badge size="sm" color="signal" variant="light">
              Required
            </Badge>
          )}
        </Group>
      }
      description="Measure the garment lying flat (not the body). Customers see this chart and get a size recommendation from it."
    >
      {chart.isPending ? (
        <ListSkeleton rows={3} height={44} />
      ) : chart.error ? (
        <ErrorBlock error={chart.error} onRetry={() => void chart.refetch()} title="Could not load the size chart" />
      ) : (
        <SizeChartEditor key={chart.data?.updatedUtc ?? 'new'} product={product} chart={chart.data ?? null} />
      )}
    </SectionCard>
  );
}

export function SizeChartEditor({ product, chart }: { product: Product; chart: SizeChartDto | null }) {
  const qc = useQueryClient();
  const isPhone = useIsPhone();
  const [form, setForm] = useState<SizeChartForm>(() => initialChartForm(product, chart));
  const [issues, setIssues] = useState<ChartIssues | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const columns = measurementsFor[form.garmentType] ?? [];
  const required = requiredFor[form.garmentType] ?? [];
  const unit = unitLabel[form.unit];
  const sizes = sizeValuesOf(product);

  const save = useMutation({
    mutationFn: () => tryOnApi.putSizeChart(product.id, toSizeChartInput(form)),
    onSuccess: (saved) => {
      qc.setQueryData(sizeChartKey(product.id), saved);
      void qc.invalidateQueries({ queryKey: tryOnKey(product.id) });
      setServerError(null);
      toastSuccess('Size chart saved');
    },
    onError: (e) => setServerError(messageOf(e)),
  });
  const remove = useMutation({
    mutationFn: () => tryOnApi.deleteSizeChart(product.id),
    onSuccess: () => {
      qc.setQueryData(sizeChartKey(product.id), null);
      void qc.invalidateQueries({ queryKey: tryOnKey(product.id) });
      toastSuccess('Size chart removed');
    },
    onError: (e) => toastError(e, 'Could not remove the size chart'),
  });

  const setRow = (i: number, patch: Partial<SizeChartForm['rows'][number]>) =>
    setForm((f) => ({ ...f, rows: f.rows.map((r, k) => (k === i ? { ...r, ...patch } : r)) }));
  const setValue = (i: number, k: MeasurementKey, v: string | number) =>
    setRow(i, { values: { ...form.rows[i].values, [k]: typeof v === 'number' ? v : v.trim() === '' ? null : Number(v) } });
  const move = (i: number, dir: -1 | 1) =>
    setForm((f) => {
      const j = i + dir;
      if (j < 0 || j >= f.rows.length) return f;
      const rows = [...f.rows];
      [rows[i], rows[j]] = [rows[j], rows[i]];
      return { ...f, rows };
    });
  const addRow = () => setForm((f) => ({ ...f, rows: [...f.rows, { key: rowKey(), sizeLabel: '', values: {} }] }));
  const removeRow = (i: number) => setForm((f) => ({ ...f, rows: f.rows.filter((_, k) => k !== i) }));
  const prefill = () =>
    setForm((f) => {
      const have = new Set(f.rows.map((r) => r.sizeLabel.trim().toLowerCase()));
      const extra = sizes.filter((s) => !have.has(s.toLowerCase())).map((s) => ({ key: rowKey(), sizeLabel: s, values: {} }));
      const kept = f.rows.filter((r) => r.sizeLabel.trim() || Object.values(r.values).some((v) => v !== null && v !== undefined));
      return { ...f, rows: [...kept, ...extra].slice(0, MAX_ROWS) };
    });

  const submit = () => {
    const found = validateSizeChart(form);
    setIssues(found);
    if (found) return;
    save.mutate();
  };

  const onDelete = async () => {
    const ok = await confirmAction({
      title: 'Remove the size chart?',
      body: 'Customers will no longer see sizes or get a size recommendation for this product.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) remove.mutate();
  };

  const max = maxMeasurement(form.unit);
  const measure = (i: number, k: MeasurementKey) => (
    <NumberInput
      key={k}
      size="xs"
      label={isPhone ? `${measurementLabel[k]} (${unit})` : undefined}
      aria-label={`${measurementLabel[k]} for size ${form.rows[i].sizeLabel || i + 1}`}
      value={form.rows[i].values[k] ?? ''}
      onChange={(v) => setValue(i, k, v)}
      min={0}
      max={max}
      decimalScale={1}
      hideControls
      withAsterisk={isPhone && required.includes(k)}
      error={issues?.rows[i]?.[k]}
    />
  );
  const rowTools = (i: number) => (
    <Group gap={2} wrap="nowrap">
      <ActionIcon variant="subtle" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move size ${i + 1} up`}>
        <IconArrowUp size={14} />
      </ActionIcon>
      <ActionIcon variant="subtle" size="sm" onClick={() => move(i, 1)} disabled={i === form.rows.length - 1} aria-label={`Move size ${i + 1} down`}>
        <IconArrowDown size={14} />
      </ActionIcon>
      <ActionIcon variant="subtle" size="sm" color="signal" onClick={() => removeRow(i)} aria-label={`Remove size ${i + 1}`}>
        <IconTrash size={14} />
      </ActionIcon>
    </Group>
  );
  const labelInput = (i: number) => (
    <TextInput
      size="xs"
      label={isPhone ? 'Size' : undefined}
      aria-label={`Size label ${i + 1}`}
      placeholder="e.g. M"
      value={form.rows[i].sizeLabel}
      onChange={(e) => setRow(i, { sizeLabel: e.currentTarget.value })}
      maxLength={16}
      error={issues?.rows[i]?.sizeLabel}
    />
  );

  return (
    <Stack gap="md">
      {serverError && (
        <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
          {serverError}
        </Alert>
      )}
      {issues && (
        <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert">
          {issues.form ?? issues.fitNote ?? 'Check the highlighted sizes.'}
        </Alert>
      )}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
        <Select
          label="Garment type"
          data={Object.entries(garmentTypeLabel).map(([value, label]) => ({ value, label }))}
          value={String(form.garmentType)}
          onChange={(v) => v && setForm((f) => ({ ...f, garmentType: Number(v) }))}
          allowDeselect={false}
        />
        <div>
          <Text size="sm" fw={500} mb={4} id="unit-label">
            Unit
          </Text>
          <SegmentedControl
            aria-labelledby="unit-label"
            data={[
              { value: '1', label: 'Centimetres' },
              { value: '2', label: 'Inches' },
            ]}
            value={String(form.unit)}
            onChange={(v) => setForm((f) => ({ ...f, unit: Number(v) }))}
          />
        </div>
      </SimpleGrid>
      <Text size="xs" c="dimmed">
        {required.length
          ? `Required for this garment type: ${required.map((k) => measurementLabel[k].toLowerCase()).join(' and ')}.`
          : 'No measurement is required for accessories, but add what helps customers.'}{' '}
        Values are in {unit}, up to {max}.
      </Text>

      {isPhone ? (
        <Stack gap="sm">
          {form.rows.map((r, i) => (
            <Box key={r.key} p="sm" style={{ border: '1px solid var(--sm-border)', borderRadius: 12 }}>
              <Group justify="space-between" mb={4}>
                <Text size="sm" fw={600}>
                  Size {i + 1}
                </Text>
                {rowTools(i)}
              </Group>
              <SimpleGrid cols={2} spacing="xs">
                {labelInput(i)}
                {columns.map((k) => measure(i, k))}
              </SimpleGrid>
            </Box>
          ))}
        </Stack>
      ) : (
        <Table.ScrollContainer minWidth={520}>
          <Table verticalSpacing={6}>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Size</Table.Th>
                {columns.map((k) => (
                  <Table.Th key={k}>
                    {measurementLabel[k]} ({unit}){required.includes(k) ? ' *' : ''}
                  </Table.Th>
                ))}
                <Table.Th>
                  <VisuallyHidden>Actions</VisuallyHidden>
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {form.rows.map((r, i) => (
                <Table.Tr key={r.key}>
                  <Table.Td>{labelInput(i)}</Table.Td>
                  {columns.map((k) => (
                    <Table.Td key={k}>{measure(i, k)}</Table.Td>
                  ))}
                  <Table.Td>{rowTools(i)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}
      {form.rows.length === 0 && (
        <Text size="sm" c="dimmed">
          No sizes yet. Add one below.
        </Text>
      )}
      <Group gap="xs">
        <Button variant="default" size="xs" leftSection={<IconPlus size={14} />} onClick={addRow} disabled={form.rows.length >= MAX_ROWS}>
          Add size
        </Button>
        {sizes.length > 0 && (
          <Button variant="subtle" size="xs" onClick={prefill}>
            Use my sizes ({sizes.join(', ')})
          </Button>
        )}
      </Group>
      <Textarea
        label="Fit note (optional)"
        placeholder="e.g. Relaxed fit — if you are between sizes, choose the smaller one."
        value={form.fitNote}
        onChange={(e) => setForm((f) => ({ ...f, fitNote: e.currentTarget.value }))}
        maxLength={300}
        autosize
        minRows={2}
        error={issues?.fitNote}
      />
      <Group justify="space-between">
        {chart ? (
          <Button variant="subtle" color="signal" size="sm" onClick={() => void onDelete()} loading={remove.isPending}>
            Remove chart
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={submit} loading={save.isPending}>
          Save size chart
        </Button>
      </Group>
    </Stack>
  );
}

// ---------------------------------------------------------------- try-on image

const checker: React.CSSProperties = {
  backgroundColor: '#fff',
  backgroundImage: 'repeating-conic-gradient(#d9dee3 0% 25%, #ffffff 0% 50%)',
  backgroundSize: '20px 20px',
  borderRadius: 12,
  border: '1px solid var(--sm-border)',
};

function Example({ good, caption, children }: { good: boolean; caption: string; children: React.ReactNode }) {
  return (
    <Stack gap={4} align="center">
      <Box w={92} h={92} style={{ ...(good ? checker : { background: '#c9b8a6', borderRadius: 12 }), display: 'grid', placeItems: 'center' }} aria-hidden>
        {children}
      </Box>
      <Group gap={4} wrap="nowrap">
        {good ? <IconCheck size={14} color="var(--mantine-color-forest-6)" /> : <IconX size={14} color="var(--mantine-color-signal-6)" />}
        <Text size="xs">
          <Text span fw={600} size="xs">
            {good ? 'Do: ' : 'Don’t: '}
          </Text>
          {caption}
        </Text>
      </Group>
    </Stack>
  );
}

/** A plain-markup garment silhouette for the do/don't examples. */
function Shirt({ person = false }: { person?: boolean }) {
  return (
    <Box pos="relative" w={56} h={60}>
      {person && <Box pos="absolute" top={-14} left={18} w={20} h={20} style={{ borderRadius: '50%', background: '#8a6b55' }} />}
      <Box pos="absolute" top={4} left={0} w={56} h={14} style={{ background: '#2f6f5e', borderRadius: '8px 8px 2px 2px' }} />
      <Box pos="absolute" top={10} left={12} w={32} h={50} style={{ background: '#2f6f5e', borderRadius: 4 }} />
    </Box>
  );
}

function TryOnImageCard({ product, readiness }: { product: Product; readiness: TryOnReadinessDto }) {
  const qc = useQueryClient();
  const [problems, setProblems] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [url, setUrl] = useState<string | null>(readiness.imageUrl);
  const openRef = useRef<() => void>(null);

  const upload = useMutation({
    mutationFn: (file: File) => tryOnApi.uploadImage(product.id, file),
    onSuccess: (img) => {
      setUrl(img.imageUrl);
      setProblems([]);
      void qc.invalidateQueries({ queryKey: tryOnKey(product.id) });
      toastSuccess('Try-on image saved');
    },
    onError: (e) => {
      const field = e instanceof ApiError ? e.fieldErrors.file : undefined;
      setProblems([field ?? messageOf(e)]);
    },
  });
  const remove = useMutation({
    mutationFn: () => tryOnApi.deleteImage(product.id),
    onSuccess: () => {
      setUrl(null);
      void qc.invalidateQueries({ queryKey: tryOnKey(product.id) });
      toastSuccess('Try-on image removed');
    },
    onError: (e) => toastError(e, 'Could not remove the image'),
  });

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setProblems([]);
    setChecking(true);
    const info = await readImageInfo(file);
    setChecking(false);
    const found = checkTryOnImage(file, info);
    if (found.length) {
      setProblems(found);
      return;
    }
    upload.mutate(file);
  };

  const onDelete = async () => {
    const ok = await confirmAction({
      title: 'Remove the try-on image?',
      body: 'Customers will not be able to try this product on.',
      confirmLabel: 'Remove',
      danger: true,
    });
    if (ok) remove.mutate();
  };

  return (
    <SectionCard
      id="try-on-image"
      title={
        <Group gap="xs">
          Try-on image
          <Badge size="sm" color="gray" variant="light">
            Recommended
          </Badge>
        </Group>
      }
      description="Customers see this garment over their live camera. It needs a cut-out photo of the garment alone."
    >
      <Stack gap="md">
        <List size="sm" spacing={2}>
          <List.Item>Front view, garment only — laid flat or on an invisible (ghost) mannequin</List.Item>
          <List.Item>Background removed: a transparent PNG or WebP</List.Item>
          <List.Item>At least 600 px on the shortest side, up to 5 MB</List.Item>
        </List>
        <Group gap="lg" wrap="wrap" justify="center">
          <Example good caption="cut-out, front view">
            <Shirt />
          </Example>
          <Example good={false} caption="background left in">
            <Shirt />
          </Example>
          <Example good={false} caption="worn by a model">
            <Shirt person />
          </Example>
        </Group>

        {problems.length > 0 && (
          <Alert color="signal" variant="light" icon={<IconAlertTriangle size={16} />} role="alert" title="This image can’t be used">
            {problems.map((p) => (
              <Text key={p} size="sm">
                {p}
              </Text>
            ))}
          </Alert>
        )}

        {url ? (
          <Group align="flex-start" gap="md" wrap="wrap">
            <Box p="xs" style={checker}>
              <Image src={url} alt={`Try-on image of ${product.name}`} h={220} w={180} fit="contain" />
            </Box>
            <Stack gap="xs">
              <Button variant="default" size="sm" onClick={() => openRef.current?.()} loading={checking || upload.isPending}>
                Replace image
              </Button>
              <Button variant="subtle" color="signal" size="sm" onClick={() => void onDelete()} loading={remove.isPending}>
                Remove image
              </Button>
            </Stack>
          </Group>
        ) : null}
        <Box display={url ? 'none' : undefined}>
          <Dropzone
            openRef={openRef}
            onDrop={(files) => void pick(files[0])}
            onReject={(r) => setProblems([r[0]?.errors[0]?.code === 'file-too-large' ? 'The image is larger than 5 MB.' : 'Use a PNG or WebP image with a transparent background.'])}
            accept={TRYON_TYPES}
            maxSize={TRYON_MAX_BYTES}
            multiple={false}
            radius="lg"
            loading={checking || upload.isPending}
            aria-label="Upload try-on image"
          >
            <Group justify="center" gap="md" mih={100} style={{ pointerEvents: 'none' }}>
              <IconHanger size={34} stroke={1.4} color="var(--sm-accent)" />
              <div>
                <Text fw={600}>Tap to add the try-on image, or drop it here</Text>
                <Text size="sm" c="dimmed">
                  Transparent PNG or WebP · ≥ 600 px · ≤ 5 MB
                </Text>
              </div>
            </Group>
          </Dropzone>
        </Box>
        {upload.isPending && <Progress value={100} animated striped aria-label="Uploading" />}
      </Stack>
    </SectionCard>
  );
}
