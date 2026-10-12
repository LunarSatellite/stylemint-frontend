import { Code, Group, ScrollArea, Select, Stack, Text, TextInput } from '@mantine/core';
import { DatePickerInput } from '@mantine/dates';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { auditApi, AUDIT_ACTIONS, AUDIT_TARGETS, type AuditEntry } from '@/api/platform';
import { FieldGrid, IdText, When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { DetailDrawer } from '@/components/DetailDrawer';
import { PageHeader } from '@/components/PageHeader';
import { useListState } from '@/hooks/useListState';
import { humanize } from '@/lib/format';

/** The payload is server-redacted JSON. It is pretty-printed as TEXT - never rendered as HTML. */
function payloadText(json: string) {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

function localDay(s: string, end = false) {
  const d = new Date(`${s}T00:00:00`);
  if (end) d.setHours(23, 59, 59, 999);
  return d.toISOString();
}

function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Every admin action, newest first: who did what, to what, why, from where. */
export function AuditPage() {
  const list = useListState(['action', 'target', 'targetId', 'admin', 'from', 'to'] as const, { pageSize: 50 });
  const f = list.filters;
  const q = useQuery({
    queryKey: ['audit', f, list.page, list.pageSize],
    queryFn: ({ signal }) =>
      auditApi.list(
        {
          action: f.action,
          targetKind: f.target,
          targetId: f.targetId,
          adminAccountId: f.admin,
          fromUtc: f.from ? localDay(f.from) : undefined,
          toUtc: f.to ? localDay(f.to, true) : undefined,
          page: list.page,
          pageSize: list.pageSize,
        },
        signal,
      ),
    placeholderData: keepPreviousData,
  });
  const columns: Column<AuditEntry>[] = [
    { key: 'when', header: 'When', render: (e) => <When value={e.occurredUtc} /> },
    { key: 'action', header: 'Action', render: (e) => <Text size="sm" fw={600}>{humanize(e.action.replace(/\./g, ' '))}</Text> },
    { key: 'target', header: 'Target', render: (e) => <Group gap={6} wrap="nowrap"><Text size="sm">{humanize(e.targetKind)}</Text><IdText value={e.targetId} /></Group> },
    { key: 'admin', header: 'By', visibleFrom: 'md', render: (e) => <IdText value={e.adminAccountId} /> },
    { key: 'reason', header: 'Reason', visibleFrom: 'lg', render: (e) => <Text size="sm" lineClamp={1}>{e.reason ?? '—'}</Text> },
  ];
  const selected = q.data?.items.find((e) => e.id === list.selected) ?? null;
  return (
    <>
      <PageHeader title="Audit log" description="Every admin action, newest first. Filter by action, target or person; open an entry for the full record." />
      <DataTable
        label="Audit log"
        columns={columns}
        page={q.data}
        isLoading={q.isLoading}
        isFetching={q.isFetching}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(e) => e.id}
        onRowClick={(e) => list.open(e.id)}
        selectedKey={list.selected}
        onPageChange={list.setPage}
        onPageSizeChange={list.setPageSize}
        filtered={list.filtered}
        emptyTitle="Nothing recorded yet"
        toolbar={
          <Group gap="md" align="flex-end" wrap="wrap">
            <Select label="Action" w={240} searchable clearable placeholder="Any" data={AUDIT_ACTIONS} value={f.action || null} onChange={(v) => list.setFilter('action', v)} />
            <Select label="Target" w={190} searchable clearable placeholder="Any" data={AUDIT_TARGETS} value={f.target || null} onChange={(v) => list.setFilter('target', v)} />
            <TextInput label="Target ID" w={200} value={f.targetId} onChange={(e) => list.setFilter('targetId', e.currentTarget.value.trim() || null)} />
            <TextInput label="Admin ID" w={200} value={f.admin} onChange={(e) => list.setFilter('admin', e.currentTarget.value.trim() || null)} />
            <DatePickerInput
              type="range"
              label="Dates"
              placeholder="Any time"
              clearable
              w={250}
              value={[f.from ? new Date(`${f.from}T00:00:00`) : null, f.to ? new Date(`${f.to}T00:00:00`) : null]}
              onChange={([a, b]) => {
                list.setFilter('from', a ? ymd(a) : null);
                list.setFilter('to', b ? ymd(b) : null);
              }}
            />
          </Group>
        }
      />
      <DetailDrawer opened={!!list.selected} onClose={() => list.open(null)} title={selected ? humanize(selected.action.replace(/\./g, ' ')) : 'Entry'} size="lg">
        {selected ? (
          <Stack gap="md">
            <FieldGrid
              fields={[
                { label: 'When', value: <When value={selected.occurredUtc} /> },
                { label: 'Action', value: <span className="sm-mono">{selected.action}</span> },
                { label: 'Target', value: `${selected.targetKind}` },
                { label: 'Target ID', value: <IdText value={selected.targetId} full /> },
                { label: 'Admin', value: <IdText value={selected.adminAccountId} full /> },
                { label: 'From', value: selected.sourceIp },
                { label: 'Reason', value: selected.reason, wide: true },
                { label: 'Browser', value: selected.userAgent, wide: true },
              ]}
            />
            <Text size="sm" fw={600}>
              Payload
            </Text>
            <ScrollArea.Autosize mah={420}>
              <Code block>{payloadText(selected.payloadJson)}</Code>
            </ScrollArea.Autosize>
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            This entry isn’t on the current page any more.
          </Text>
        )}
      </DetailDrawer>
    </>
  );
}
