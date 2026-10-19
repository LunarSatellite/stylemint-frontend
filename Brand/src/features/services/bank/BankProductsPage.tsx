import { useState } from 'react';
import {
  Alert,
  Badge,
  Button,
  Card,
  Group,
  Menu,
  Modal,
  NumberInput,
  ScrollArea,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  Table,
  TagsInput,
  Text,
  TextInput,
  Textarea,
  ActionIcon,
} from '@mantine/core';
import { IconDots, IconPlus } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageOf } from '../../../api/client';
import { PageHeader } from '../../../components/PageHeader';
import { EmptyBlock } from '../../../components/StateBlocks';
import { formatMoney } from '../../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../../lib/notify';
import { useIsPhone } from '../../../lib/useIsPhone';
import { ServiceCategory } from '../category';
import { PhotoUrlsField, RequireServiceCategory, ServiceQuery } from '../components';
import { REEL_ITEMS_KEY, ReelVisibilityBadge, useReelItems } from '../reelItems';
import {
  BANK_KEY,
  bankApi,
  BankProductStatus,
  bankProductStatusLabel,
  bankProductTypeLabel,
  PRODUCT_TYPES,
  type BankProduct,
  type BankProductWrite,
} from './api';

const PRODUCTS_KEY = [...BANK_KEY, 'products'] as const;

type StatusFilter = 'all' | 'draft' | 'published' | 'archived';
const FILTER_STATUS: Record<Exclude<StatusFilter, 'all'>, number> = { draft: 1, published: 2, archived: 3 };

export function rateText(p: Pick<BankProduct, 'interestRateMinPercent' | 'interestRateMaxPercent'>): string {
  const { interestRateMinPercent: min, interestRateMaxPercent: max } = p;
  if (min == null && max == null) return '—';
  if (min != null && max != null && min !== max) return `${min}% – ${max}% p.a.`;
  return `${min ?? max}% p.a.`;
}

function amountText(p: BankProduct): string | null {
  if (p.minAmount == null && p.maxAmount == null) return null;
  const m = (n: number) => formatMoney({ amount: n, currency: p.currency || 'NPR' });
  if (p.minAmount != null && p.maxAmount != null) return `${m(p.minAmount)} – ${m(p.maxAmount)}`;
  return p.minAmount != null ? `From ${m(p.minAmount)}` : `Up to ${m(p.maxAmount!)}`;
}

function StatusBadge({ status }: { status: number }) {
  const s = bankProductStatusLabel[status] ?? { label: 'Unknown', color: 'gray' };
  return (
    <Badge variant="light" color={s.color} size="sm">
      {s.label}
    </Badge>
  );
}

function useProductActions() {
  const qc = useQueryClient();
  const done = (msg: string) => {
    toastSuccess(msg);
    void qc.invalidateQueries({ queryKey: BANK_KEY });
    void qc.invalidateQueries({ queryKey: REEL_ITEMS_KEY });
  };
  const publish = useMutation({ mutationFn: (id: string) => bankApi.publishProduct(id), onSuccess: () => done('Published — you and creators can now tag it in reels.'), onError: (e) => toastError(e) });
  const unpublish = useMutation({ mutationFn: (id: string) => bankApi.unpublishProduct(id), onSuccess: () => done('Moved back to draft.'), onError: (e) => toastError(e) });
  const archive = useMutation({ mutationFn: (id: string) => bankApi.archiveProduct(id), onSuccess: () => done('Archived.'), onError: (e) => toastError(e) });
  return {
    publish: async (p: BankProduct) => {
      if (await confirmAction({ title: `Publish ${p.name}?`, body: 'Buyers in the StyleMint app can read it and send you enquiries about it.', confirmLabel: 'Publish' }))
        publish.mutate(p.id);
    },
    unpublish: async (p: BankProduct) => {
      if (await confirmAction({ title: `Unpublish ${p.name}?`, body: 'Buyers stop seeing it. Enquiries already sent stay in your inbox.', confirmLabel: 'Unpublish' }))
        unpublish.mutate(p.id);
    },
    archive: async (p: BankProduct) => {
      if (await confirmAction({ title: `Archive ${p.name}?`, body: 'Archived products cannot be edited or published again.', confirmLabel: 'Archive', danger: true }))
        archive.mutate(p.id);
    },
  };
}

function ProductMenu({ p, onEdit }: { p: BankProduct; onEdit: () => void }) {
  const actions = useProductActions();
  if (p.status === BankProductStatus.Archived) return null;
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon variant="subtle" color="slate" aria-label={`Actions for ${p.name}`}>
          <IconDots size={18} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={onEdit}>Edit</Menu.Item>
        {p.status === BankProductStatus.Draft && <Menu.Item onClick={() => void actions.publish(p)}>Publish</Menu.Item>}
        {p.status === BankProductStatus.Published && <Menu.Item onClick={() => void actions.unpublish(p)}>Unpublish</Menu.Item>}
        <Menu.Item color="signal" onClick={() => void actions.archive(p)}>
          Archive
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** Bank products (savings, loans, cards…) as information pages buyers can enquire about. */
export default function BankProductsPage() {
  return (
    <RequireServiceCategory allow={[ServiceCategory.Bank]}>
      <ProductsBody />
    </RequireServiceCategory>
  );
}

function ProductsBody() {
  const isPhone = useIsPhone();
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<BankProduct | 'new' | null>(null);
  const query = useQuery({ queryKey: PRODUCTS_KEY, queryFn: () => bankApi.products() });
  const shown = (query.data ?? []).filter((p) => filter === 'all' || p.status === FILTER_STATUS[filter]);
  const reel = useReelItems();
  const reelOf = (p: BankProduct) => (p.status === BankProductStatus.Archived ? 'unknown' : reel.visibility(p.id, p.status === BankProductStatus.Published));

  return (
    <>
      <PageHeader
        title="Bank products"
        description="Accounts, deposits, loans and cards. A published product is an item you and creators can tag in reels; buyers open it to enquire or book an appointment, and enquiries arrive in your leads inbox."
        actions={
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
            New product
          </Button>
        }
      />
      <Stack gap="md">
        <ScrollArea type="never">
          <SegmentedControl
            value={filter}
            onChange={(v) => setFilter(v as StatusFilter)}
            aria-label="Filter products"
            data={[
              { value: 'all', label: 'All' },
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Drafts' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </ScrollArea>
        <ServiceQuery
          query={query}
          what="Bank products"
          errorTitle="Could not load your products"
          isEmpty={() => shown.length === 0}
          empty={
            <Card>
              <EmptyBlock
                title={filter === 'all' ? 'No products yet' : 'Nothing here'}
                body={filter === 'all' ? 'Add your first product — a savings account, a loan or a card — and publish it.' : 'No products with this status.'}
              />
            </Card>
          }
        >
          {() =>
            isPhone ? (
              <Stack gap="sm">
                {shown.map((p) => (
                  <Card key={p.id} withBorder data-testid={`bank-product-${p.id}`}>
                    <Group justify="space-between" align="flex-start" wrap="nowrap">
                      <div style={{ minWidth: 0 }}>
                        <Text fw={650} truncate>
                          {p.name}
                        </Text>
                        <Text size="sm" c="dimmed">
                          {bankProductTypeLabel[p.type] ?? 'Other'} · {rateText(p)}
                        </Text>
                        <ReelVisibilityBadge visibility={reelOf(p)} />
                      </div>
                      <Group gap={4} wrap="nowrap">
                        <StatusBadge status={p.status} />
                        <ProductMenu p={p} onEdit={() => setEditing(p)} />
                      </Group>
                    </Group>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Card padding={0}>
                <Table.ScrollContainer minWidth={720}>
                  <Table verticalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>Product</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Interest</Table.Th>
                        <Table.Th>Amount</Table.Th>
                        <Table.Th>Status</Table.Th>
                        <Table.Th aria-label="Actions" />
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {shown.map((p) => (
                        <Table.Tr key={p.id} data-testid={`bank-product-${p.id}`}>
                          <Table.Td>
                            <Text fw={600}>{p.name}</Text>
                            {p.summary && (
                              <Text size="xs" c="dimmed" lineClamp={1}>
                                {p.summary}
                              </Text>
                            )}
                          </Table.Td>
                          <Table.Td>{bankProductTypeLabel[p.type] ?? 'Other'}</Table.Td>
                          <Table.Td>{rateText(p)}</Table.Td>
                          <Table.Td>{amountText(p) ?? '—'}</Table.Td>
                          <Table.Td>
                            <Stack gap={4} align="flex-start">
                              <StatusBadge status={p.status} />
                              <ReelVisibilityBadge visibility={reelOf(p)} />
                            </Stack>
                          </Table.Td>
                          <Table.Td>
                            <ProductMenu p={p} onEdit={() => setEditing(p)} />
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </Table.ScrollContainer>
              </Card>
            )
          }
        </ServiceQuery>
      </Stack>
      {editing && <ProductEditor product={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function emptyWrite(): BankProductWrite {
  return {
    type: 1,
    name: '',
    summary: '',
    description: '',
    interestRateMinPercent: null,
    interestRateMaxPercent: null,
    rateNote: '',
    feesText: '',
    eligibilityText: '',
    documentsRequired: [],
    photoUrls: [],
    minAmount: null,
    maxAmount: null,
    minTenureMonths: null,
    maxTenureMonths: null,
    currency: 'NPR',
  };
}

function toWrite(p: BankProduct): BankProductWrite {
  const { id: _id, bankId: _b, bankName: _n, status: _s, publishedUtc: _p, createdUtc: _c, updatedUtc: _u, ...rest } = p;
  return { ...emptyWrite(), ...rest, documentsRequired: rest.documentsRequired ?? [], photoUrls: rest.photoUrls ?? [] };
}

/** Client-side copy of the contract's limits (§3 BankProduct); the server checks again. */
export function validateProduct(w: BankProductWrite): Record<string, string> {
  const e: Record<string, string> = {};
  const name = w.name.trim();
  if (name.length < 2 || name.length > 150) e.name = 'Name needs 2–150 characters.';
  if ((w.summary ?? '').length > 500) e.summary = 'At most 500 characters.';
  if ((w.description ?? '').length > 4000) e.description = 'At most 4000 characters.';
  if ((w.rateNote ?? '').length > 300) e.rateNote = 'At most 300 characters.';
  if ((w.feesText ?? '').length > 2000) e.feesText = 'At most 2000 characters.';
  if ((w.eligibilityText ?? '').length > 2000) e.eligibilityText = 'At most 2000 characters.';
  const rate = (n: number | null) => n != null && (n < 0 || n > 100);
  if (rate(w.interestRateMinPercent) || rate(w.interestRateMaxPercent)) e.interestRateMinPercent = 'Rates are between 0 and 100 %.';
  else if (w.interestRateMinPercent != null && w.interestRateMaxPercent != null && w.interestRateMinPercent > w.interestRateMaxPercent)
    e.interestRateMinPercent = 'The lowest rate cannot be above the highest.';
  if ((w.minAmount ?? 0) < 0 || (w.maxAmount ?? 0) < 0) e.minAmount = 'Amounts cannot be negative.';
  else if (w.minAmount != null && w.maxAmount != null && w.minAmount > w.maxAmount) e.minAmount = 'The minimum cannot be above the maximum.';
  const ten = (n: number | null) => n != null && (n < 1 || n > 600);
  if (ten(w.minTenureMonths) || ten(w.maxTenureMonths)) e.minTenureMonths = 'Tenure is 1–600 months.';
  else if (w.minTenureMonths != null && w.maxTenureMonths != null && w.minTenureMonths > w.maxTenureMonths)
    e.minTenureMonths = 'The shortest tenure cannot be above the longest.';
  if (w.documentsRequired.length > 20 || w.documentsRequired.some((d) => d.length > 150)) e.documentsRequired = 'Up to 20 documents, 150 characters each.';
  if (w.photoUrls.length > 10) e.photoUrls = 'Up to 10 photos.';
  return e;
}

function numOrNull(v: string | number): number | null {
  return v === '' ? null : Number(v);
}

function ProductEditor({ product, onClose }: { product: BankProduct | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [w, setW] = useState<BankProductWrite>(() => (product ? toWrite(product) : emptyWrite()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const set = <K extends keyof BankProductWrite>(k: K, v: BankProductWrite[K]) => setW((prev) => ({ ...prev, [k]: v }));

  const save = useMutation({
    mutationFn: () => {
      const body: BankProductWrite = { ...w, name: w.name.trim() };
      return product ? bankApi.updateProduct(product.id, body) : bankApi.createProduct(body);
    },
    onSuccess: () => {
      toastSuccess(product ? 'Product saved.' : 'Product added as a draft. Publish it when it is ready.');
      void qc.invalidateQueries({ queryKey: BANK_KEY });
      onClose();
    },
    onError: (e) => setServerError(messageOf(e)),
  });

  const submit = () => {
    const found = validateProduct(w);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length === 0) save.mutate();
  };

  return (
    <Modal opened onClose={onClose} title={product ? `Edit ${product.name}` : 'New bank product'} size="lg">
      <Stack gap="sm">
        {serverError && (
          <Alert color="signal" variant="light" role="alert">
            {serverError}
          </Alert>
        )}
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
          <Select
            label="Type"
            data={PRODUCT_TYPES.map((t) => ({ value: String(t), label: bankProductTypeLabel[t] }))}
            value={String(w.type)}
            onChange={(v) => v && set('type', Number(v))}
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
          />
          <TextInput label="Name" required value={w.name} onChange={(e) => set('name', e.currentTarget.value)} error={errors.name} />
        </SimpleGrid>
        <TextInput label="Summary" description="One line shown in lists" value={w.summary ?? ''} onChange={(e) => set('summary', e.currentTarget.value)} error={errors.summary} />
        <Textarea label="Description" autosize minRows={3} maxRows={8} value={w.description ?? ''} onChange={(e) => set('description', e.currentTarget.value)} error={errors.description} />
        <SimpleGrid cols={{ base: 2 }} spacing="sm">
          <NumberInput label="Lowest interest rate (% p.a.)" min={0} max={100} decimalScale={2} value={w.interestRateMinPercent ?? ''} onChange={(v) => set('interestRateMinPercent', numOrNull(v))} error={errors.interestRateMinPercent} />
          <NumberInput label="Highest interest rate (% p.a.)" min={0} max={100} decimalScale={2} value={w.interestRateMaxPercent ?? ''} onChange={(v) => set('interestRateMaxPercent', numOrNull(v))} />
          <NumberInput label="Minimum amount (NPR)" min={0} thousandSeparator="," value={w.minAmount ?? ''} onChange={(v) => set('minAmount', numOrNull(v))} error={errors.minAmount} />
          <NumberInput label="Maximum amount (NPR)" min={0} thousandSeparator="," value={w.maxAmount ?? ''} onChange={(v) => set('maxAmount', numOrNull(v))} />
          <NumberInput label="Shortest tenure (months)" min={1} max={600} value={w.minTenureMonths ?? ''} onChange={(v) => set('minTenureMonths', numOrNull(v))} error={errors.minTenureMonths} />
          <NumberInput label="Longest tenure (months)" min={1} max={600} value={w.maxTenureMonths ?? ''} onChange={(v) => set('maxTenureMonths', numOrNull(v))} />
        </SimpleGrid>
        <TextInput label="Rate note" placeholder="Base rate + 2.5% p.a." value={w.rateNote ?? ''} onChange={(e) => set('rateNote', e.currentTarget.value)} error={errors.rateNote} />
        <Textarea label="Fees" autosize minRows={2} value={w.feesText ?? ''} onChange={(e) => set('feesText', e.currentTarget.value)} error={errors.feesText} />
        <Textarea label="Who can apply" autosize minRows={2} value={w.eligibilityText ?? ''} onChange={(e) => set('eligibilityText', e.currentTarget.value)} error={errors.eligibilityText} />
        <TagsInput
          label="Documents required"
          description="Press Enter after each one"
          value={w.documentsRequired}
          onChange={(v) => set('documentsRequired', v)}
          error={errors.documentsRequired}
          maxTags={20}
        />
        <PhotoUrlsField value={w.photoUrls} onChange={(v) => set('photoUrls', v)} max={10} />
        <Group justify="flex-end" gap="sm" mt="xs">
          <Button variant="default" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {product ? 'Save product' : 'Add product'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
