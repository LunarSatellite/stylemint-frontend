import { useState, type ReactNode } from 'react';
import { Anchor, Card, Group, ScrollArea, SegmentedControl, Select, Stack, Text, Title } from '@mantine/core';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { isMissingEndpoint } from '../../../api/client';
import { useCursorList } from '../../../api/useCursorList';
import { PageHeader } from '../../../components/PageHeader';
import { Pager } from '../../../components/Pager';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../../components/StateBlocks';
import { ServiceCategory } from '../category';
import { addDays, formatDay, kathmanduDate, RequireServiceCategory, ServiceSettingUp } from '../components';
import { BANK_KEY, bankApi, bankProductTypeLabel, type Appointment } from './api';
import { AppointmentActions, AppointmentStatusBadge } from './LeadDetailPage';
import { leadPath } from './LeadsPage';

const RANGES = [
  { value: '7', label: 'Next 7 days' },
  { value: '30', label: 'Next 30 days' },
  { value: 'past', label: 'Last 30 days' },
];

/** Branch appointments by day, with complete / no-show / cancel. */
export default function AppointmentsPage() {
  return (
    <RequireServiceCategory allow={[ServiceCategory.Bank]}>
      <AppointmentsBody />
    </RequireServiceCategory>
  );
}

function AppointmentsBody() {
  const [params] = useSearchParams();
  const focus = params.get('open');
  const [range, setRange] = useState('7');
  const [status, setStatus] = useState<string>('1');
  const [branchId, setBranchId] = useState<string | null>(null);
  const today = kathmanduDate();
  const from = range === 'past' ? addDays(today, -30) : today;
  const to = range === 'past' ? addDays(today, -1) : addDays(today, Number(range));
  const branches = useQuery({ queryKey: [...BANK_KEY, 'branches'], queryFn: () => bankApi.branches(), retry: false });
  const filter = { from, to, branchId: branchId ?? undefined, status: status === 'all' ? undefined : Number(status) };
  const list = useCursorList({
    key: [...BANK_KEY, 'appointments'],
    resetKey: JSON.stringify(filter),
    fetchPage: (cursor) => bankApi.appointments(filter, cursor),
    refetchInterval: 60_000,
  });
  const q = list.query;
  const items = q.data?.items ?? [];
  const byDay = new Map<string, Appointment[]>();
  for (const a of items) byDay.set(a.date, [...(byDay.get(a.date) ?? []), a]);

  let body: ReactNode;
  if (q.isPending) body = <ListSkeleton rows={4} height={80} />;
  else if (q.error && isMissingEndpoint(q.error)) body = <ServiceSettingUp what="Branch appointments" />;
  else if (q.error) body = <ErrorBlock error={q.error} title="Could not load appointments" onRetry={() => void q.refetch()} />;
  else if (items.length === 0)
    body = (
      <Card>
        <EmptyBlock title="No appointments" body="Booked appointments for the chosen days appear here." />
      </Card>
    );
  else
    body = (
      <Stack gap="lg">
        {[...byDay.entries()].map(([date, onDay]) => (
          <Stack key={date} gap="xs">
            <Title order={4}>{formatDay(date)}</Title>
            {onDay.map((a) => (
              <Card key={a.id} withBorder data-testid={`appointment-${a.id}`} style={a.id === focus ? { borderColor: 'var(--sm-accent)' } : undefined}>
                <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
                  <div style={{ minWidth: 0 }}>
                    <Text fw={650}>
                      {a.startTime}–{a.endTime} · {a.contact?.name ?? 'Withdrawn by the buyer'}
                    </Text>
                    <Text size="sm" c="dimmed">
                      {a.branchName}
                      {a.productName || a.productType ? ` · ${a.productName ?? bankProductTypeLabel[a.productType!]}` : ''}
                      {a.purpose ? ` · ${a.purpose}` : ''}
                    </Text>
                    <Anchor component={Link} to={leadPath(a.leadId)} size="xs" className="sm-mono">
                      {a.reference}
                    </Anchor>
                  </div>
                  <Stack gap={6} align="flex-end">
                    <AppointmentStatusBadge status={a.status} />
                    <AppointmentActions appointment={a} />
                  </Stack>
                </Group>
              </Card>
            ))}
          </Stack>
        ))}
      </Stack>
    );

  return (
    <>
      <PageHeader title="Appointments" description="Buyers who booked a time at one of your branches." back={{ to: '/bank/leads', label: 'Leads' }} />
      <Stack gap="md">
        <Group gap="sm" wrap="wrap" align="flex-end">
          <ScrollArea type="never">
            <SegmentedControl value={range} onChange={setRange} data={RANGES} aria-label="Days" />
          </ScrollArea>
          <Select
            aria-label="Status"
            w={160}
            value={status}
            onChange={(v) => setStatus(v ?? 'all')}
            allowDeselect={false}
            data={[
              { value: '1', label: 'Booked' },
              { value: '3', label: 'Completed' },
              { value: '4', label: 'No-show' },
              { value: '2', label: 'Cancelled' },
              { value: 'all', label: 'All' },
            ]}
            comboboxProps={{ withinPortal: true }}
          />
          {(branches.data?.length ?? 0) > 1 && (
            <Select
              aria-label="Branch"
              placeholder="All branches"
              clearable
              w={200}
              value={branchId}
              onChange={setBranchId}
              data={(branches.data ?? []).map((b) => ({ value: b.id, label: b.name }))}
              comboboxProps={{ withinPortal: true }}
            />
          )}
        </Group>
        {body}
        <Pager page={list.page} pageSize={list.pageSize} total={list.total} shown={items.length} hasPrev={list.hasPrev} hasNext={list.hasNext} onPrev={list.prev} onNext={list.next} busy={q.isFetching} />
      </Stack>
    </>
  );
}
