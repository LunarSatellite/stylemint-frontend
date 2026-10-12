import { Badge, Button, Group, Menu, Text, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconChevronDown, IconPlus } from '@tabler/icons-react';
import { useState } from 'react';
import { popularSearchesApi, type PopularSearch } from '@/api/catalog';
import { toPage } from '@/api/paging';
import { useAuth } from '@/auth/guards';
import { useActionDialog, type ActionField } from '@/components/ActionDialog';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';

const fields = (p?: PopularSearch): ActionField[] => [
  { name: 'label', kind: 'text', label: 'Chip label', required: true, defaultValue: p?.label, placeholder: 'Wedding lehengas' },
  { name: 'query', kind: 'text', label: 'Search it runs', required: true, defaultValue: p?.query, placeholder: 'lehenga wedding' },
  { name: 'order', kind: 'number', label: 'Display order', min: 0, defaultValue: String(p?.displayOrder ?? 0) },
  { name: 'region', kind: 'text', label: 'Country code (blank = everywhere)', defaultValue: p?.regionCode ?? '', placeholder: 'NP' },
];

function body(v: Record<string, string>) {
  const region = v.region?.trim().toUpperCase() || null;
  if (region && !/^[A-Z]{2}$/.test(region)) throw new Error('The country code is two letters, like NP.');
  return { label: v.label!.trim(), query: v.query!.trim(), displayOrder: Number(v.order) || 0, regionCode: region };
}

/** The popular-search chips shoppers see under the search box. Turn one off rather than deleting it. */
export function DiscoveryPage() {
  const { can } = useAuth();
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const [region, setRegion] = useState('');
  const q = useQuery({ queryKey: ['popular-searches', region], queryFn: ({ signal }) => popularSearchesApi.list(region.trim().toUpperCase() || undefined, signal) });
  const done = () => void queryClient.invalidateQueries({ queryKey: ['popular-searches'] });
  const manage = can('manageCatalogOps');

  const columns: Column<PopularSearch>[] = [
    { key: 'label', header: 'Chip', render: (p) => <Text size="sm" fw={600}>{p.label}</Text> },
    { key: 'query', header: 'Runs search', render: (p) => <span className="sm-mono">{p.query}</span> },
    { key: 'region', header: 'Where', render: (p) => p.regionCode ?? 'Everywhere' },
    { key: 'order', header: 'Order', align: 'right', visibleFrom: 'sm', render: (p) => p.displayOrder },
    { key: 'active', header: 'Shown', render: (p) => <Badge variant="dot" color={p.isActive ? 'forest' : 'gray'}>{p.isActive ? 'On' : 'Off'}</Badge> },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (p) =>
        manage && (
          <Menu position="bottom-end">
            <Menu.Target>
              <Button size="compact-sm" variant="default" rightSection={<IconChevronDown size={12} />}>
                Edit
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => open({ title: `Edit “${p.label}”`, consequence: 'Changes show to shoppers straight away.', confirmLabel: 'Save', fields: fields(p), run: async (v) => popularSearchesApi.update(p.id, body(v)), success: 'Saved.', onDone: done })}>Edit…</Menu.Item>
              <Menu.Item onClick={() => open({ title: p.isActive ? `Turn off “${p.label}”` : `Turn on “${p.label}”`, consequence: p.isActive ? 'The chip stops showing; you can turn it back on.' : 'The chip shows to shoppers.', confirmLabel: p.isActive ? 'Turn off' : 'Turn on', run: () => (p.isActive ? popularSearchesApi.deactivate(p.id) : popularSearchesApi.activate(p.id)), success: 'Updated.', onDone: done })}>
                {p.isActive ? 'Turn off' : 'Turn on'}
              </Menu.Item>
              <Menu.Divider />
              <Menu.Item color="signal" onClick={() => open({ title: `Delete “${p.label}”`, consequence: 'Deleted permanently. Turning it off keeps it for later instead.', confirmLabel: 'Delete for good', danger: true, run: () => popularSearchesApi.remove(p.id), success: 'Deleted.', onDone: done })}>
                Delete…
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ),
    },
  ];

  return (
    <>
      {dialog}
      <PageHeader
        title="Discovery"
        description="Popular searches shown as chips under the search box, everywhere or per country."
        actions={
          manage && (
            <Button leftSection={<IconPlus size={16} />} onClick={() => open({ title: 'New popular search', consequence: 'It shows to shoppers straight away.', confirmLabel: 'Add', fields: fields(), run: async (v) => popularSearchesApi.create(body(v)), success: 'Added.', onDone: done })}>
              Add popular search
            </Button>
          )
        }
      />
      <DataTable
        label="Popular searches"
        columns={columns}
        page={q.data ? toPage(q.data, 1, 1000) : undefined}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(p) => p.id}
        filtered={!!region}
        emptyTitle="No popular searches"
        toolbar={
          <Group>
            <TextInput label="Country" description="Blank shows every row" placeholder="NP" w={140} maxLength={2} value={region} onChange={(e) => setRegion(e.currentTarget.value)} />
          </Group>
        }
      />
    </>
  );
}
