import { useState, type ReactNode } from 'react';
import { Badge, Card, Group, ScrollArea, SegmentedControl, Select, Stack, Table, Text, TextInput } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isMissingEndpoint } from '../../../api/client';
import { useCursorList } from '../../../api/useCursorList';
import { PageHeader } from '../../../components/PageHeader';
import { Pager } from '../../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../../components/StateBlocks';
import { formatDateTime } from '../../../lib/format';
import { useIsPhone } from '../../../lib/useIsPhone';
import { ServiceCategory } from '../category';
import { formatDay, RequireServiceCategory, ServiceSettingUp } from '../components';
import { BANK_KEY, bankApi, bankProductTypeLabel, LeadKind, leadStatusLabel, PRODUCT_TYPES, type Lead } from './api';

export const leadPath = (id: string) => `/bank/leads/${encodeURIComponent(id)}`;

export function LeadStatusBadge({ status }: { status: number }) {
  const s = leadStatusLabel[status] ?? { label: 'Unknown', color: 'gray' };
  return (
    <Badge variant="light" color={s.color} size="sm">
      {s.label}
    </Badge>
  );
}

export function LeadKindBadge({ kind }: { kind: number }) {
  return (
    <Badge variant="outline" color={kind === LeadKind.Appointment ? 'grape' : 'slate'} size="sm">
      {kind === LeadKind.Appointment ? 'Appointment' : 'Enquiry'}
    </Badge>
  );
}

const STATUS_FILTERS = [
  { value: '1', label: 'New' },
  { value: '2', label: 'Contacted' },
  { value: '3', label: 'Qualified' },
  { value: '4', label: 'Converted' },
  { value: '5', label: 'Closed' },
  { value: 'all', label: 'All' },
];

function leadWhat(l: Lead): string {
  const product = l.productName ?? (l.productType ? bankProductTypeLabel[l.productType] : null);
  if (l.kind === LeadKind.Appointment && l.appointment) {
    return `${l.appointment.branchName} · ${formatDay(l.appointment.date)} ${l.appointment.startTime}${product ? ` · ${product}` : ''}`;
  }
  return product ?? 'General enquiry';
}

/** Enquiries and appointment bookings from buyers who consented to be contacted by this bank. */
export default function LeadsPage() {
  return (
    <RequireServiceCategory allow={[ServiceCategory.Bank]}>
      <LeadsBody />
    </RequireServiceCategory>
  );
}

function LeadsBody() {
  const isPhone = useIsPhone();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const kindParam = params.get('kind') ?? 'all';
  const statusParam = params.get('status') ?? '1';
  const [productType, setProductType] = useState<string | null>(null);
  const [branchId, setBranchId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search.trim(), 300);
  const branches = useQuery({ queryKey: [...BANK_KEY, 'branches'], queryFn: () => bankApi.branches(), retry: false });

  const filter = {
    kind: kindParam === 'all' ? undefined : Number(kindParam),
    status: statusParam === 'all' ? undefined : Number(statusParam),
    productType: productType ? Number(productType) : undefined,
    branchId: branchId ?? undefined,
    search: debounced || undefined,
  };
  const list = useCursorList({
    key: [...BANK_KEY, 'leads'],
    resetKey: JSON.stringify(filter),
    fetchPage: (cursor) => bankApi.leads(filter, cursor),
    refetchInterval: 60_000,
  });
  const q = list.query;
  const setParam = (k: string, v: string, dflt: string) => {
    const next = new URLSearchParams(params);
    if (v === dflt) next.delete(k);
    else next.set(k, v);
    setParams(next, { replace: true });
  };
  const items = q.data?.items ?? [];

  let body: ReactNode;
  if (q.isPending) body = <ListSkeleton rows={5} height={isPhone ? 96 : 52} />;
  else if (q.error && isMissingEndpoint(q.error)) body = <ServiceSettingUp what="Your leads inbox" />;
  else if (q.error) body = <ErrorBlock error={q.error} title="Could not load your leads" onRetry={() => void q.refetch()} />;
  else if (items.length === 0)
    body = (
      <Card>
        <EmptyBlock
          title={statusParam === '1' && !debounced ? 'No new leads' : 'No leads match'}
          body="When a buyer sends an enquiry or books a branch appointment, it arrives here and in your CRM."
        />
      </Card>
    );
  else if (isPhone)
    body = (
      <Stack gap="sm">
        {items.map((l) => (
          <Card key={l.id} withBorder component={Link} to={leadPath(l.id)} data-testid={`lead-${l.id}`}>
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <div style={{ minWidth: 0 }}>
                <Text fw={650} truncate>
                  {l.contact?.name ?? 'Withdrawn by the buyer'}
                </Text>
                <Text size="sm" c="dimmed" lineClamp={2}>
                  {leadWhat(l)}
                </Text>
                <Text size="xs" c="dimmed">
                  {l.reference} · {formatDateTime(l.createdUtc)}
                </Text>
              </div>
              <Stack gap={4} align="flex-end">
                <LeadStatusBadge status={l.status} />
                <LeadKindBadge kind={l.kind} />
              </Stack>
            </Group>
          </Card>
        ))}
      </Stack>
    );
  else
    body = (
      <Card padding={0}>
        <Table.ScrollContainer minWidth={820}>
          <Table verticalSpacing="sm" highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Reference</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th>About</Table.Th>
                <Table.Th>Type</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Received</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((l) => (
                <Table.Tr key={l.id} data-testid={`lead-${l.id}`} style={{ cursor: 'pointer' }} onClick={() => navigate(leadPath(l.id))}>
                  <Table.Td>
                    <Text component={Link} to={leadPath(l.id)} fw={600} className="sm-mono" size="sm">
                      {l.reference}
                    </Text>
                  </Table.Td>
                  <Table.Td>{l.contact?.name ?? <Text span c="dimmed" size="sm">Withdrawn</Text>}</Table.Td>
                  <Table.Td>
                    <Text size="sm" lineClamp={1}>
                      {leadWhat(l)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <LeadKindBadge kind={l.kind} />
                  </Table.Td>
                  <Table.Td>
                    <LeadStatusBadge status={l.status} />
                  </Table.Td>
                  <Table.Td>{formatDateTime(l.createdUtc)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </Card>
    );

  return (
    <>
      <PageHeader
        title="Leads"
        description="Enquiries and branch appointments from buyers. You see a buyer's name, phone and email only because they agreed to be contacted by you about that enquiry."
        actions={
          <Text component={Link} to="/bank/appointments" size="sm" c="forest">
            Appointment calendar
          </Text>
        }
      />
      <Stack gap="md">
        <ScrollArea type="never">
          <SegmentedControl
            value={kindParam}
            onChange={(v) => setParam('kind', v, 'all')}
            aria-label="Lead type"
            data={[
              { value: 'all', label: 'Everything' },
              { value: '1', label: 'Enquiries' },
              { value: '2', label: 'Appointments' },
            ]}
          />
        </ScrollArea>
        <ScrollArea type="never">
          <SegmentedControl value={statusParam} onChange={(v) => setParam('status', v, '1')} aria-label="Lead status" data={STATUS_FILTERS} />
        </ScrollArea>
        <Group gap="sm" wrap="wrap" align="flex-end">
          <TextInput
            placeholder="Reference or name"
            aria-label="Search leads"
            leftSection={<IconSearch size={15} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            w={240}
          />
          <Select
            placeholder="Any product type"
            aria-label="Product type"
            clearable
            data={PRODUCT_TYPES.map((t) => ({ value: String(t), label: bankProductTypeLabel[t] }))}
            value={productType}
            onChange={setProductType}
            w={200}
            comboboxProps={{ withinPortal: true }}
          />
          {(branches.data?.length ?? 0) > 1 && (
            <Select
              placeholder="Any branch"
              aria-label="Branch"
              clearable
              data={(branches.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
              value={branchId}
              onChange={setBranchId}
              w={200}
              comboboxProps={{ withinPortal: true }}
            />
          )}
        </Group>
        {body}
        <Pager
          page={list.page}
          pageSize={list.pageSize}
          total={list.total}
          shown={items.length}
          hasPrev={list.hasPrev}
          hasNext={list.hasNext}
          onPrev={list.prev}
          onNext={list.next}
          busy={q.isFetching}
        />
      </Stack>
    </>
  );
}
