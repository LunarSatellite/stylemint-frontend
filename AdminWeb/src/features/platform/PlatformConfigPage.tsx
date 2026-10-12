import { Badge, Button, Code, Group, Stack, Text, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconAlertTriangle, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { toPage } from '@/api/paging';
import { configApi, SENSITIVE_CONFIG, type PlatformConfigEntry } from '@/api/platform';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';

function pretty(json: string) {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

/** Platform settings as JSON values. Security keys are flagged: a wrong IP allowlist locks every admin out. */
export function PlatformConfigPage() {
  const { can } = useAuth();
  const manage = can('manageConfig');
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const [needle, setNeedle] = useState('');
  const q = useQuery({ queryKey: ['config'], queryFn: ({ signal }) => configApi.list(signal) });
  const rows = (q.data ?? []).filter((c) => !needle || c.key.toLowerCase().includes(needle.toLowerCase()));

  const edit = (c?: PlatformConfigEntry) => {
    const sensitive = c && SENSITIVE_CONFIG.includes(c.key);
    open({
      title: c ? `Edit ${c.key}` : 'New setting',
      consequence: sensitive ? (
        <Group gap={6} wrap="nowrap" align="flex-start">
          <IconAlertTriangle size={16} color="var(--mantine-color-signal-6)" style={{ flexShrink: 0, marginTop: 2 }} />
          <span>This controls admin sign-in security. A wrong value can lock every admin out of this console, including you. Double-check it.</span>
        </Group>
      ) : (
        'The value must be valid JSON: a number, true/false, "a string" in quotes, a [list] or an {object}.'
      ),
      confirmLabel: 'Save setting',
      danger: !!sensitive,
      fields: [
        ...(c ? [] : [{ name: 'key', kind: 'text' as const, label: 'Key', required: true }]),
        { name: 'value', kind: 'textarea', label: 'Value (JSON)', required: true, defaultValue: c ? pretty(c.valueJson) : '' },
        { name: 'description', kind: 'text', label: 'Description', defaultValue: c?.description ?? '' },
      ],
      run: (v) => {
        try {
          JSON.parse(v.value!);
        } catch {
          return Promise.reject(new Error('That value is not valid JSON. Strings need "quotes".'));
        }
        return configApi.set(c?.key ?? v.key!.trim(), JSON.stringify(JSON.parse(v.value!)), v.description?.trim() || null);
      },
      success: 'Setting saved.',
      onDone: () => void queryClient.invalidateQueries({ queryKey: ['config'] }),
    });
  };

  const columns: Column<PlatformConfigEntry>[] = [
    {
      key: 'key',
      header: 'Setting',
      render: (c) => (
        <Stack gap={0}>
          <Group gap={6}>
            <Text size="sm" fw={600} className="sm-mono">
              {c.key}
            </Text>
            {SENSITIVE_CONFIG.includes(c.key) && (
              <Badge size="xs" color="signal" variant="light">
                Security
              </Badge>
            )}
          </Group>
          <Text size="xs" c="dimmed" lineClamp={1}>
            {c.description}
          </Text>
        </Stack>
      ),
    },
    { key: 'value', header: 'Value', render: (c) => <Code style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', maxWidth: 420, display: 'block' }}>{c.valueJson.length > 160 ? `${c.valueJson.slice(0, 160)}…` : c.valueJson}</Code> },
    { key: 'updated', header: 'Updated', visibleFrom: 'md', render: (c) => <When value={c.updatedUtc} relative /> },
    { key: 'act', header: '', align: 'right', render: (c) => manage && <Button size="compact-sm" variant="default" onClick={() => edit(c)}>Edit</Button> },
  ];

  return (
    <>
      {dialog}
      <PageHeader title="Platform config" description="Runtime settings read by the API. Every change is in the audit log." actions={manage && <Button onClick={() => edit()}>New setting</Button>} />
      <DataTable
        label="Platform settings"
        columns={columns}
        page={q.data ? toPage(rows, 1, 10000) : undefined}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(c) => c.id}
        filtered={!!needle}
        emptyTitle="No settings"
        toolbar={<TextInput aria-label="Filter settings" placeholder="Filter by key" leftSection={<IconSearch size={14} />} w={300} value={needle} onChange={(e) => setNeedle(e.currentTarget.value)} />}
      />
    </>
  );
}
