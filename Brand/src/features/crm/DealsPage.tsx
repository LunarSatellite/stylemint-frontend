import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  Modal,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  Table,
  Tabs,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { messageOf } from '../../api/client';
import { PageHeader } from '../../components/PageHeader';
import { Pager } from '../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate, formatMoney, formatMoneyCompact, fromNow } from '../../lib/format';
import { useIsPhone } from '../../lib/useIsPhone';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import {
  crmApi,
  DealStatus,
  dealStatusColor,
  dealStatusLabel,
  proposalStatusColor,
  proposalStatusLabel,
  QuoteStatus,
  quoteStatusColor,
  quoteStatusLabel,
  type Deal,
  type DealStage,
  type ProposalListItem,
  type Quote,
} from './api';
import { CustomerPicker, DetailSheet, IfCan, RequireCap, Stat } from './components';
import { CRM_KEY, useCan, usePagedQuery } from './hooks';

const money = (amount: number | null | undefined, currency = 'NPR') => (amount === null || amount === undefined ? '—' : formatMoney({ amount, currency }));

// ---------------------------------------------------------------- deals

function NewDealModal({ opened, onClose, stages, pipelineId }: { opened: boolean; onClose: () => void; stages: DealStage[]; pipelineId: string | null }) {
  const qc = useQueryClient();
  const open = stages.filter((s) => !s.isClosed);
  const [name, setName] = useState('');
  const [contactId, setContactId] = useState<string | null>(null);
  const [amount, setAmount] = useState<number | string>('');
  const [close, setClose] = useState('');
  const [stageId, setStageId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    setName('');
    setContactId(null);
    setAmount('');
    setClose('');
    setStageId(null);
    setNotes('');
    setError(null);
    onClose();
  };
  const stage = stageId ?? open[0]?.id ?? null;
  const create = useMutation({
    mutationFn: () =>
      crmApi.createDeal({
        name: name.trim(),
        stageId: stage!,
        pipelineId,
        contactId,
        amount: amount === '' ? null : Number(amount),
        currency: 'NPR',
        closeDate: close ? dayjs(close).toISOString() : null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      toastSuccess('Deal added');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'deals'] });
      done();
    },
    onError: (e) => setError(messageOf(e)),
  });
  return (
    <Modal opened={opened} onClose={done} title="New wholesale deal">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && stage) create.mutate();
        }}
      >
        <Stack gap="md">
          {error && (
            <Alert color="signal" variant="light">
              {error}
            </Alert>
          )}
          <TextInput label="Deal name" required maxLength={300} placeholder="e.g. 200 kurtas for Bhaktapur boutique" value={name} onChange={(e) => setName(e.currentTarget.value)} />
          <CustomerPicker value={contactId} onChange={setContactId} label="Customer (optional)" />
          <Group grow align="flex-start">
            <NumberInput label="Value (Rs)" min={0} thousandSeparator="," value={amount} onChange={setAmount} />
            <TextInput label="Expected close" type="date" value={close} onChange={(e) => setClose(e.currentTarget.value)} />
          </Group>
          <Select
            label="Stage"
            data={open.map((s) => ({ value: s.id, label: s.name }))}
            value={stage}
            onChange={setStageId}
            allowDeselect={false}
            comboboxProps={{ zIndex: 400 }}
          />
          <Textarea label="Notes" autosize minRows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={done}>
              Cancel
            </Button>
            <Button type="submit" loading={create.isPending} disabled={!name.trim() || !stage}>
              Add deal
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

function DealDetail({ deal, stages, onClose, onNewQuote }: { deal: Deal; stages: DealStage[]; onClose: () => void; onNewQuote: (d: Deal) => void }) {
  const qc = useQueryClient();
  const canManage = useCan('deals.manage');
  const canDelete = useCan('records.delete');
  const [reason, setReason] = useState('');
  const [closing, setClosing] = useState<'won' | 'lost' | null>(null);
  const quotes = useQuery({ queryKey: [CRM_KEY, 'quotes', 'deal', deal.id], queryFn: () => crmApi.quotes({ dealId: deal.id, page: 1, pageSize: 20 }) });
  const act = useMutation({
    mutationFn: (a: { run: () => Promise<unknown>; done: string; close?: boolean }) => a.run().then(() => a),
    onSuccess: (a) => {
      toastSuccess(a.done);
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'deals'] });
      if (a.close) onClose();
    },
    onError: (e) => toastError(e),
  });
  const isOpen = deal.status === DealStatus.Open;
  return (
    <Stack gap="md">
      <SimpleGrid cols={2} spacing="sm">
        <Stat label="Value" value={money(deal.amount, deal.currency)} />
        <Stat label="Expected close" value={deal.closeDate ? formatDate(deal.closeDate) : '—'} />
        <Stat
          label="Status"
          value={
            <Badge color={dealStatusColor[deal.status] ?? 'gray'} variant="light">
              {dealStatusLabel[deal.status] ?? '—'}
            </Badge>
          }
        />
        <Stat label="Customer" value={deal.accountName ?? '—'} />
      </SimpleGrid>
      {deal.notes && (
        <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
          {deal.notes}
        </Text>
      )}
      {isOpen && canManage && (
        <>
          <Select
            label="Stage"
            data={stages.filter((s) => !s.isClosed).map((s) => ({ value: s.id, label: s.name }))}
            value={deal.stageId}
            onChange={(v) => v && v !== deal.stageId && act.mutate({ run: () => crmApi.moveDeal(deal.id, v), done: 'Deal moved', close: true })}
            allowDeselect={false}
            comboboxProps={{ zIndex: 400 }}
          />
          {closing ? (
            <Stack gap="xs">
              <TextInput
                label={closing === 'won' ? 'Why did you win it? (optional)' : 'Why was it lost?'}
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
                maxLength={500}
              />
              <Group gap="xs">
                <Button
                  color={closing === 'won' ? 'forest' : 'signal'}
                  loading={act.isPending}
                  onClick={() =>
                    act.mutate({ run: () => crmApi.closeDeal(deal.id, closing === 'won', reason.trim() || null), done: closing === 'won' ? 'Marked as won' : 'Marked as lost', close: true })
                  }
                >
                  {closing === 'won' ? 'Mark won' : 'Mark lost'}
                </Button>
                <Button variant="default" onClick={() => setClosing(null)}>
                  Back
                </Button>
              </Group>
            </Stack>
          ) : (
            <Group gap="xs">
              <Button variant="light" color="forest" onClick={() => setClosing('won')}>
                Won
              </Button>
              <Button variant="light" color="gray" onClick={() => setClosing('lost')}>
                Lost
              </Button>
            </Group>
          )}
        </>
      )}
      <Divider label="Quotes" labelPosition="left" />
      {quotes.isPending ? (
        <ListSkeleton rows={2} height={40} />
      ) : quotes.error ? (
        <ErrorBlock error={quotes.error} title="Could not load quotes" onRetry={() => void quotes.refetch()} />
      ) : (quotes.data?.items ?? []).length === 0 ? (
        <Text size="sm" c="dimmed">
          No quotes for this deal yet.
        </Text>
      ) : (
        <Stack gap={6}>
          {(quotes.data?.items ?? []).map((q) => (
            <Group key={q.id} justify="space-between" wrap="nowrap">
              <Text size="sm">
                {q.quoteNumber}
                {q.revisionNumber && q.revisionNumber > 1 ? ` (rev ${q.revisionNumber})` : ''}
              </Text>
              <Group gap="xs" wrap="nowrap">
                <Text size="sm" fw={600}>
                  {money(q.totalAmount, q.currency)}
                </Text>
                <Badge size="xs" variant="light" color={quoteStatusColor[q.status] ?? 'gray'}>
                  {quoteStatusLabel[q.status] ?? '—'}
                </Badge>
              </Group>
            </Group>
          ))}
        </Stack>
      )}
      <Group gap="xs">
        <IfCan cap="quotes.manage">
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => onNewQuote(deal)}>
            New quote
          </Button>
        </IfCan>
        {canDelete && (
          <Button
            size="xs"
            variant="subtle"
            color="signal"
            onClick={() =>
              void confirmAction({ title: 'Delete this deal?', body: deal.name, confirmLabel: 'Delete', danger: true }).then(
                (ok) => ok && act.mutate({ run: () => crmApi.deleteDeal(deal.id), done: 'Deal deleted', close: true }),
              )
            }
          >
            Delete deal
          </Button>
        )}
      </Group>
    </Stack>
  );
}

function DealCard({ d, onOpen }: { d: Deal; onOpen: () => void }) {
  return (
    <Card withBorder padding="sm" data-interactive="true" style={{ cursor: 'pointer' }} onClick={onOpen} aria-label={`Deal ${d.name}`}>
      <Stack gap={4}>
        <Text size="sm" fw={600} lineClamp={2}>
          {d.name}
        </Text>
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={650}>
            {d.amount !== null ? formatMoneyCompact({ amount: d.amount, currency: d.currency || 'NPR' }) : '—'}
          </Text>
          <Text size="xs" c={d.closeDate && dayjs(d.closeDate).isBefore(dayjs(), 'day') ? 'signal' : 'dimmed'}>
            {d.closeDate ? formatDate(d.closeDate) : ''}
          </Text>
        </Group>
        {d.accountName && (
          <Text size="xs" c="dimmed" truncate>
            {d.accountName}
          </Text>
        )}
      </Stack>
    </Card>
  );
}

function PipelineTab({ onNewQuote }: { onNewQuote: (d: Deal) => void }) {
  const phone = useIsPhone();
  const pipelines = useQuery({ queryKey: [CRM_KEY, 'pipelines'], queryFn: crmApi.pipelines, staleTime: 5 * 60_000 });
  const [pipelineId, setPipelineId] = useState<string | null>(null);
  const activePipeline = pipelineId ?? pipelines.data?.find((p) => p.isDefault)?.id ?? pipelines.data?.[0]?.id ?? null;
  const stages = useQuery({
    queryKey: [CRM_KEY, 'stages', activePipeline],
    queryFn: () => crmApi.stages(activePipeline),
    enabled: !pipelines.isPending,
    staleTime: 5 * 60_000,
  });
  const [status, setStatus] = useState<string>(String(DealStatus.Open));
  const list = usePagedQuery({
    key: ['deals', 'board'],
    resetKey: `${activePipeline}|${status}`,
    pageSize: 100,
    enabled: !pipelines.isPending,
    fetchPage: (page, pageSize) => crmApi.deals({ pipelineId: activePipeline, status: status === 'all' ? null : Number(status), page, pageSize }),
  });
  const [open, setOpen] = useState<Deal | null>(null);
  const [creating, setCreating] = useState(false);
  const [phoneStage, setPhoneStage] = useState<string | null>(null);
  const ordered = useMemo(() => [...(stages.data ?? [])].sort((a, b) => a.order - b.order), [stages.data]);
  const columns = status === String(DealStatus.Open) ? ordered.filter((s) => !s.isClosed) : ordered;
  const byStage = useMemo(() => {
    const m = new Map<string, Deal[]>();
    for (const d of list.items) m.set(d.stageId, [...(m.get(d.stageId) ?? []), d]);
    return m;
  }, [list.items]);
  const shownStage = phoneStage ?? columns[0]?.id ?? null;

  return (
    <Stack gap="md">
      <Group justify="space-between" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="wrap">
          {(pipelines.data?.length ?? 0) > 1 && (
            <Select
              w={200}
              aria-label="Pipeline"
              data={(pipelines.data ?? []).map((p) => ({ value: p.id, label: p.name }))}
              value={activePipeline}
              onChange={setPipelineId}
              allowDeselect={false}
            />
          )}
          <Select
            w={160}
            aria-label="Deal status"
            data={[
              { value: String(DealStatus.Open), label: 'Open deals' },
              { value: String(DealStatus.Won), label: 'Won' },
              { value: String(DealStatus.Lost), label: 'Lost' },
              { value: 'all', label: 'All deals' },
            ]}
            value={status}
            onChange={(v) => setStatus(v ?? String(DealStatus.Open))}
            allowDeselect={false}
          />
        </Group>
        <IfCan cap="deals.manage">
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCreating(true)} disabled={!ordered.some((s) => !s.isClosed)}>
            New deal
          </Button>
        </IfCan>
      </Group>
      {pipelines.error ? (
        <ErrorBlock error={pipelines.error} title="Could not load your pipeline" onRetry={() => void pipelines.refetch()} />
      ) : stages.error ? (
        <ErrorBlock error={stages.error} title="Could not load deal stages" onRetry={() => void stages.refetch()} />
      ) : pipelines.isPending || stages.isPending || list.query.isPending ? (
        <ListSkeleton rows={3} height={90} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} title="Could not load deals" onRetry={() => void list.query.refetch()} />
      ) : list.items.length === 0 ? (
        <EmptyBlock title="No deals here" body="Track wholesale and bulk orders from first contact to a signed quote." />
      ) : phone || status !== String(DealStatus.Open) ? (
        <Stack gap="sm">
          {phone && status === String(DealStatus.Open) && (
            <Select
              aria-label="Stage"
              data={columns.map((s) => ({ value: s.id, label: `${s.name} (${byStage.get(s.id)?.length ?? 0})` }))}
              value={shownStage}
              onChange={setPhoneStage}
              allowDeselect={false}
            />
          )}
          {(status === String(DealStatus.Open) && phone ? byStage.get(shownStage ?? '') ?? [] : list.items).map((d) => (
            <DealCard key={d.id} d={d} onOpen={() => setOpen(d)} />
          ))}
          {status === String(DealStatus.Open) && phone && (byStage.get(shownStage ?? '') ?? []).length === 0 && (
            <Text size="sm" c="dimmed" ta="center" py="md">
              No deals in this stage.
            </Text>
          )}
        </Stack>
      ) : (
        <div className="sm-crm-board" role="list" aria-label="Deal board">
          {columns.map((s) => {
            const deals = byStage.get(s.id) ?? [];
            const total = deals.reduce((sum, d) => sum + (d.amount ?? 0), 0);
            return (
              <Card key={s.id} padding="sm" role="listitem" style={{ background: 'var(--sm-inset)' }}>
                <Group justify="space-between" mb="xs" wrap="nowrap">
                  <Text size="sm" fw={650} truncate>
                    {s.name}
                  </Text>
                  <Badge size="sm" variant="light" color="gray">
                    {deals.length}
                  </Badge>
                </Group>
                <Text size="xs" c="dimmed" mb="xs">
                  {formatMoneyCompact(total)}
                </Text>
                <Stack gap="xs">
                  {deals.map((d) => (
                    <DealCard key={d.id} d={d} onOpen={() => setOpen(d)} />
                  ))}
                </Stack>
              </Card>
            );
          })}
        </div>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={list.items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
      <NewDealModal opened={creating} onClose={() => setCreating(false)} stages={ordered} pipelineId={activePipeline} />
      <DetailSheet opened={!!open} onClose={() => setOpen(null)} title={open?.name ?? ''}>
        {open && (
          <DealDetail
            deal={open}
            stages={ordered}
            onClose={() => setOpen(null)}
            onNewQuote={(d) => {
              setOpen(null);
              onNewQuote(d);
            }}
          />
        )}
      </DetailSheet>
    </Stack>
  );
}

// ---------------------------------------------------------------- quotes

interface LineDraft {
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  discountPercent: number | string;
}

const emptyLine = (): LineDraft => ({ description: '', quantity: 1, unitPrice: '', discountPercent: 0 });

function NewQuoteModal({ deal, onClose }: { deal: Deal | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [tax, setTax] = useState<number | string>(13);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const done = () => {
    setLines([emptyLine()]);
    setTax(13);
    setNotes('');
    setError(null);
    onClose();
  };
  const valid = lines.length > 0 && lines.every((l) => l.description.trim() && Number(l.quantity) > 0 && Number(l.unitPrice) >= 0 && l.unitPrice !== '');
  const subtotal = lines.reduce((s, l) => s + Number(l.quantity || 0) * Number(l.unitPrice || 0) * (1 - Number(l.discountPercent || 0) / 100), 0);
  const create = useMutation({
    mutationFn: () =>
      crmApi.draftQuote({
        dealId: deal?.id ?? null,
        currency: 'NPR',
        taxPercent: Number(tax) || 0,
        notes: notes.trim() || null,
        lineItems: lines.map((l) => ({
          description: l.description.trim(),
          quantity: Number(l.quantity),
          unitPrice: Number(l.unitPrice),
          discountPercent: Number(l.discountPercent) || 0,
        })),
      }),
    onSuccess: () => {
      toastSuccess('Quote drafted');
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'quotes'] });
      done();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const set = (i: number, patch: Partial<LineDraft>) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <Modal opened={!!deal} onClose={done} title={deal ? `New quote · ${deal.name}` : ''} size="lg">
      <Stack gap="md">
        {error && (
          <Alert color="signal" variant="light">
            {error}
          </Alert>
        )}
        {lines.map((l, i) => (
          <Card key={i} withBorder padding="sm">
            <Stack gap="xs">
              <Group justify="space-between" wrap="nowrap" align="flex-end">
                <TextInput style={{ flex: 1 }} label={`Item ${i + 1}`} required value={l.description} onChange={(e) => set(i, { description: e.currentTarget.value })} maxLength={500} />
                {lines.length > 1 && (
                  <ActionIcon variant="subtle" color="gray" aria-label={`Remove item ${i + 1}`} onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
                    <IconTrash size={15} />
                  </ActionIcon>
                )}
              </Group>
              <SimpleGrid cols={3} spacing="xs">
                <NumberInput label="Qty" min={1} value={l.quantity} onChange={(v) => set(i, { quantity: v })} />
                <NumberInput label="Unit price" min={0} thousandSeparator="," value={l.unitPrice} onChange={(v) => set(i, { unitPrice: v })} />
                <NumberInput label="Discount %" min={0} max={100} value={l.discountPercent} onChange={(v) => set(i, { discountPercent: v })} />
              </SimpleGrid>
            </Stack>
          </Card>
        ))}
        <Group>
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => setLines((ls) => [...ls, emptyLine()])}>
            Add item
          </Button>
        </Group>
        <Group grow align="flex-start">
          <NumberInput label="VAT %" min={0} max={100} value={tax} onChange={setTax} />
          <Stat label="Subtotal" value={money(subtotal)} />
        </Group>
        <Textarea label="Terms / notes" autosize minRows={2} maxLength={2000} value={notes} onChange={(e) => setNotes(e.currentTarget.value)} />
        <Text size="xs" c="dimmed">
          The quote is saved in your CRM. Share it with the buyer yourself; StyleMint does not email it.
        </Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={done}>
            Cancel
          </Button>
          <Button loading={create.isPending} disabled={!valid} onClick={() => create.mutate()}>
            Save quote
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

function QuoteDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const qc = useQueryClient();
  const canManage = useCan('quotes.manage');
  const quote = useQuery({ queryKey: [CRM_KEY, 'quotes', id], queryFn: () => crmApi.quote(id) });
  const act = useMutation({
    mutationFn: (a: { run: () => Promise<unknown>; done: string }) => a.run().then(() => a.done),
    onSuccess: (done) => {
      toastSuccess(done);
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'quotes'] });
      onClose();
    },
    onError: (e) => toastError(e),
  });
  if (quote.isPending) return <ListSkeleton rows={3} height={40} />;
  if (quote.error || !quote.data) return <ErrorBlock error={quote.error ?? new Error('No data')} title="Could not load this quote" onRetry={() => void quote.refetch()} />;
  const q: Quote = quote.data;
  return (
    <Stack gap="md">
      <Group gap="xs">
        <Badge color={quoteStatusColor[q.status] ?? 'gray'} variant="light">
          {quoteStatusLabel[q.status] ?? '—'}
        </Badge>
        <Text size="xs" c="dimmed">
          {q.dealName ?? ''} {q.validUntil ? `· valid until ${formatDate(q.validUntil)}` : ''}
        </Text>
      </Group>
      <Table.ScrollContainer minWidth={420}>
        <Table verticalSpacing="xs">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Item</Table.Th>
              <Table.Th ta="right">Qty</Table.Th>
              <Table.Th ta="right">Price</Table.Th>
              <Table.Th ta="right">Total</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {q.lineItems.map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>
                  {l.description}
                  {l.discountPercent ? <Text size="xs" c="dimmed">{`${l.discountPercent}% off`}</Text> : null}
                </Table.Td>
                <Table.Td ta="right">{l.quantity}</Table.Td>
                <Table.Td ta="right">{money(l.unitPrice, q.currency)}</Table.Td>
                <Table.Td ta="right">{money(l.lineTotal, q.currency)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <SimpleGrid cols={2} spacing="xs">
        <Stat label="Subtotal" value={money(q.subTotal, q.currency)} />
        <Stat label="Discount" value={money(q.discountAmount, q.currency)} />
        <Stat label="VAT" value={money(q.taxAmount, q.currency)} />
        <Stat label="Total" value={money(q.totalAmount, q.currency)} />
      </SimpleGrid>
      {canManage && (
        <Group gap="xs">
          {q.status === QuoteStatus.Draft && (
            <Button variant="light" onClick={() => act.mutate({ run: () => crmApi.setQuoteStatus(q.id, QuoteStatus.Sent), done: 'Marked as shared' })}>
              Mark as shared
            </Button>
          )}
          {(q.status === QuoteStatus.Sent || q.status === QuoteStatus.Draft) && (
            <>
              <Button color="forest" variant="light" onClick={() => act.mutate({ run: () => crmApi.acceptQuote(q.id), done: 'Quote accepted' })}>
                Accepted
              </Button>
              <Button color="gray" variant="light" onClick={() => act.mutate({ run: () => crmApi.rejectQuote(q.id), done: 'Quote rejected' })}>
                Rejected
              </Button>
            </>
          )}
          {q.status !== QuoteStatus.Accepted && (
            <Button variant="subtle" onClick={() => act.mutate({ run: () => crmApi.reviseQuote(q.id), done: 'New revision drafted' })}>
              Revise
            </Button>
          )}
        </Group>
      )}
    </Stack>
  );
}

function QuotesTab() {
  const [status, setStatus] = useState('all');
  const [open, setOpen] = useState<string | null>(null);
  const list = usePagedQuery({
    key: ['quotes', 'list'],
    resetKey: status,
    fetchPage: (page, pageSize) => crmApi.quotes({ status: status === 'all' ? null : Number(status), page, pageSize }),
  });
  return (
    <Stack gap="md">
      <Select
        w={200}
        aria-label="Filter quotes"
        data={[{ value: 'all', label: 'All quotes' }, ...Object.entries(quoteStatusLabel).map(([value, label]) => ({ value, label }))]}
        value={status}
        onChange={(v) => setStatus(v ?? 'all')}
        allowDeselect={false}
      />
      {list.query.isPending ? (
        <ListSkeleton rows={3} height={56} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} title="Could not load quotes" onRetry={() => void list.query.refetch()} />
      ) : list.items.length === 0 ? (
        <EmptyBlock title="No quotes" body="Open a deal and choose “New quote”." />
      ) : (
        <Stack gap="xs">
          {list.items.map((q) => (
            <Card key={q.id} withBorder padding="sm" data-interactive="true" style={{ cursor: 'pointer' }} onClick={() => setOpen(q.id)} aria-label={`Quote ${q.quoteNumber}`}>
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600}>
                    {q.quoteNumber}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {[q.dealName, q.contactName, fromNow(q.createdAt)].filter(Boolean).join(' · ')}
                  </Text>
                </Stack>
                <Stack gap={2} align="flex-end">
                  <Text size="sm" fw={650}>
                    {money(q.totalAmount, q.currency)}
                  </Text>
                  <Badge size="xs" variant="light" color={quoteStatusColor[q.status] ?? 'gray'}>
                    {quoteStatusLabel[q.status] ?? '—'}
                  </Badge>
                </Stack>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={list.items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
      <DetailSheet opened={!!open} onClose={() => setOpen(null)} title="Quote">
        {open && <QuoteDetail id={open} onClose={() => setOpen(null)} />}
      </DetailSheet>
    </Stack>
  );
}

// ---------------------------------------------------------------- proposals

function ProposalDetail({ item, onClose }: { item: ProposalListItem; onClose: () => void }) {
  const qc = useQueryClient();
  const canManage = useCan('quotes.manage');
  const proposal = useQuery({ queryKey: [CRM_KEY, 'proposals', item.id], queryFn: () => crmApi.proposal(item.id) });
  const act = useMutation({
    mutationFn: (a: { run: () => Promise<unknown>; done: string }) => a.run().then(() => a.done),
    onSuccess: (done) => {
      toastSuccess(done);
      void qc.invalidateQueries({ queryKey: [CRM_KEY, 'proposals'] });
      onClose();
    },
    onError: (e) => toastError(e),
  });
  if (proposal.isPending) return <ListSkeleton rows={3} height={60} />;
  if (proposal.error || !proposal.data) return <ErrorBlock error={proposal.error ?? new Error('No data')} title="Could not load this proposal" onRetry={() => void proposal.refetch()} />;
  const p = proposal.data;
  const decided = p.status === 5 || p.status === 6 || p.status === 7;
  return (
    <Stack gap="md">
      <Badge color={proposalStatusColor[p.status] ?? 'gray'} variant="light" w="fit-content">
        {proposalStatusLabel[p.status] ?? '—'}
      </Badge>
      {[...p.sections]
        .sort((a, b) => a.ordinal - b.ordinal)
        .map((s) => (
          <Stack key={s.id} gap={4}>
            <Text fw={650}>{s.title}</Text>
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {s.content}
            </Text>
          </Stack>
        ))}
      {canManage && !decided && (
        <Group gap="xs">
          <Button variant="light" color="forest" onClick={() => act.mutate({ run: () => crmApi.acceptProposal(p.id), done: 'Proposal accepted' })}>
            Accepted
          </Button>
          <Button variant="light" color="gray" onClick={() => act.mutate({ run: () => crmApi.rejectProposal(p.id), done: 'Proposal rejected' })}>
            Rejected
          </Button>
        </Group>
      )}
    </Stack>
  );
}

function ProposalsTab() {
  const [open, setOpen] = useState<ProposalListItem | null>(null);
  const list = usePagedQuery({ key: ['proposals', 'list'], fetchPage: (page, pageSize) => crmApi.proposals({ page, pageSize }) });
  return (
    <Stack gap="md">
      {list.query.isPending ? (
        <ListSkeleton rows={3} height={56} />
      ) : list.query.error ? (
        <ErrorBlock error={list.query.error} title="Could not load proposals" onRetry={() => void list.query.refetch()} />
      ) : list.items.length === 0 ? (
        <EmptyBlock title="No proposals" body="Proposals for wholesale deals appear here." />
      ) : (
        <Stack gap="xs">
          {list.items.map((p) => (
            <Card key={p.id} withBorder padding="sm" data-interactive="true" style={{ cursor: 'pointer' }} onClick={() => setOpen(p)} aria-label={`Proposal ${p.title}`}>
              <Group justify="space-between" wrap="nowrap">
                <Stack gap={2} style={{ minWidth: 0 }}>
                  <Text size="sm" fw={600} truncate>
                    {p.title}
                  </Text>
                  <Text size="xs" c="dimmed" truncate>
                    {[p.dealName, `${p.sectionCount} sections`, fromNow(p.createdAt)].filter(Boolean).join(' · ')}
                  </Text>
                </Stack>
                <Badge size="xs" variant="light" color={proposalStatusColor[p.status] ?? 'gray'}>
                  {proposalStatusLabel[p.status] ?? '—'}
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={list.items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={list.query.isFetching} />
      <DetailSheet opened={!!open} onClose={() => setOpen(null)} title={open?.title ?? ''}>
        {open && <ProposalDetail item={open} onClose={() => setOpen(null)} />}
      </DetailSheet>
    </Stack>
  );
}

export default function DealsPage() {
  const [quoteFor, setQuoteFor] = useState<Deal | null>(null);
  return (
    <RequireCap cap="deals.view">
      <PageHeader title="Deals & quotes" description="Wholesale and bulk orders you negotiate with shops and businesses — from first talk to an accepted quote." />
      <Tabs defaultValue="pipeline" keepMounted={false}>
        <Tabs.List mb="md">
          <Tabs.Tab value="pipeline">Pipeline</Tabs.Tab>
          <Tabs.Tab value="quotes">Quotes</Tabs.Tab>
          <Tabs.Tab value="proposals">Proposals</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="pipeline">
          <PipelineTab onNewQuote={setQuoteFor} />
        </Tabs.Panel>
        <Tabs.Panel value="quotes">
          <QuotesTab />
        </Tabs.Panel>
        <Tabs.Panel value="proposals">
          <ProposalsTab />
        </Tabs.Panel>
      </Tabs>
      <NewQuoteModal deal={quoteFor} onClose={() => setQuoteFor(null)} />
    </RequireCap>
  );
}
