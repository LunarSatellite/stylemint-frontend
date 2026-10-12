import { Badge, Button, Group, Menu, Stack, Switch, Text, TextInput } from '@mantine/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IconChevronDown, IconPlus, IconSearch } from '@tabler/icons-react';
import { useState } from 'react';
import { toPage } from '@/api/paging';
import { flagsApi, ROLE_KIND, type FeatureFlag } from '@/api/platform';
import { useAuth } from '@/auth/guards';
import { useActionDialog } from '@/components/ActionDialog';
import { When } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeader } from '@/components/PageHeader';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Feature flags: a default for everyone, and overrides by role (customer, creator, vendor) or for one account. */
export function FeatureFlagsPage() {
  const { can } = useAuth();
  const manage = can('manageFlags');
  const queryClient = useQueryClient();
  const [dialog, open] = useActionDialog();
  const [needle, setNeedle] = useState('');
  const q = useQuery({ queryKey: ['flags'], queryFn: ({ signal }) => flagsApi.list(signal) });
  const done = () => void queryClient.invalidateQueries({ queryKey: ['flags'] });
  const rows = (q.data ?? []).filter((f) => !needle || f.key.toLowerCase().includes(needle.toLowerCase()) || f.description?.toLowerCase().includes(needle.toLowerCase()));

  const toggle = (f: FeatureFlag) =>
    open({
      title: `${f.defaultEnabled ? 'Turn off' : 'Turn on'} “${f.key}” for everyone`,
      consequence: `The default becomes ${f.defaultEnabled ? 'off' : 'on'}. Overrides still win for their role or account.`,
      confirmLabel: f.defaultEnabled ? 'Turn off' : 'Turn on',
      danger: f.defaultEnabled,
      // The description is sent back unchanged: a null would erase it.
      run: () => flagsApi.upsert(f.key, !f.defaultEnabled, f.description),
      success: 'Flag updated.',
      onDone: done,
    });

  const override = (f: FeatureFlag, clear: boolean) =>
    open({
      title: clear ? `Remove an override on “${f.key}”` : `Override “${f.key}”`,
      consequence: clear ? 'That role or account goes back to the default.' : 'Set it on or off for one role or one account, regardless of the default.',
      confirmLabel: clear ? 'Remove override' : 'Save override',
      fields: [
        { name: 'role', kind: 'select', label: 'For a role', options: [{ value: '', label: '—' }, ...Object.values(ROLE_KIND).map((r) => ({ value: r, label: r }))] },
        { name: 'account', kind: 'text', label: '…or for one account ID' },
        ...(clear ? [] : [{ name: 'enabled', kind: 'checkbox' as const, label: 'Enabled', defaultValue: 'true' }]),
      ],
      run: (v) => {
        const role = v.role || null;
        const account = v.account?.trim() || null;
        if ((role ? 1 : 0) + (account ? 1 : 0) !== 1) return Promise.reject(new Error('Choose a role or enter an account ID - exactly one.'));
        if (account && !GUID.test(account)) return Promise.reject(new Error('That is not an account ID.'));
        const body = { roleKind: role, accountId: account, enabled: v.enabled === 'true' };
        return clear ? flagsApi.clearOverride(f.key, body) : flagsApi.setOverride(f.key, body);
      },
      success: clear ? 'Override removed.' : 'Override saved.',
      onDone: done,
    });

  const columns: Column<FeatureFlag>[] = [
    {
      key: 'key',
      header: 'Flag',
      render: (f) => (
        <Stack gap={0}>
          <Text size="sm" fw={600} className="sm-mono">
            {f.key}
          </Text>
          {f.description && (
            <Text size="xs" c="dimmed" lineClamp={2}>
              {f.description}
            </Text>
          )}
        </Stack>
      ),
    },
    {
      key: 'default',
      header: 'Default',
      render: (f) =>
        manage ? (
          <Switch checked={f.defaultEnabled} onChange={() => toggle(f)} aria-label={`${f.key} default`} onLabel="On" offLabel="Off" />
        ) : (
          <Badge variant="dot" color={f.defaultEnabled ? 'forest' : 'gray'}>
            {f.defaultEnabled ? 'On' : 'Off'}
          </Badge>
        ),
    },
    {
      key: 'overrides',
      header: 'Overrides',
      visibleFrom: 'sm',
      render: (f) =>
        f.overrides.length === 0 ? (
          <Text size="sm" c="dimmed">
            None
          </Text>
        ) : (
          <Group gap={4}>
            {f.overrides.map((o) => (
              <Badge key={o.id} size="sm" variant="light" color={o.enabled ? 'forest' : 'gray'}>
                {o.roleKind ? ROLE_KIND[o.roleKind] : `Account ${o.accountId?.slice(0, 8)}…`}: {o.enabled ? 'on' : 'off'}
              </Badge>
            ))}
          </Group>
        ),
    },
    { key: 'updated', header: 'Updated', visibleFrom: 'md', render: (f) => <When value={f.updatedUtc} relative /> },
    {
      key: 'act',
      header: '',
      align: 'right',
      render: (f) =>
        manage && (
          <Menu position="bottom-end">
            <Menu.Target>
              <Button size="compact-sm" variant="default" rightSection={<IconChevronDown size={12} />}>
                Overrides
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item onClick={() => override(f, false)}>Add or change…</Menu.Item>
              {f.overrides.length > 0 && <Menu.Item onClick={() => override(f, true)}>Remove…</Menu.Item>}
            </Menu.Dropdown>
          </Menu>
        ),
    },
  ];

  return (
    <>
      {dialog}
      <PageHeader
        title="Feature flags"
        description="Switch features on or off for everyone, a role, or one account. Changes apply within a minute."
        actions={
          manage && (
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() =>
                open({
                  title: 'New feature flag',
                  consequence: 'Creates the flag. Code reads it by key, so use the exact key the app expects.',
                  confirmLabel: 'Create flag',
                  fields: [
                    { name: 'key', kind: 'text', label: 'Key', required: true, placeholder: 'checkout.emi' },
                    { name: 'description', kind: 'textarea', label: 'What it controls' },
                    { name: 'on', kind: 'checkbox', label: 'On by default' },
                  ],
                  run: (v) => flagsApi.upsert(v.key!.trim(), v.on === 'true', v.description?.trim() || null),
                  success: 'Flag created.',
                  onDone: done,
                })
              }
            >
              New flag
            </Button>
          )
        }
      />
      <DataTable
        label="Feature flags"
        columns={columns}
        page={q.data ? toPage(rows, 1, 10000) : undefined}
        isLoading={q.isLoading}
        error={q.error}
        onRetry={() => void q.refetch()}
        rowKey={(f) => f.id}
        filtered={!!needle}
        emptyTitle="No flags yet"
        toolbar={<TextInput aria-label="Filter flags" placeholder="Filter by key or description" leftSection={<IconSearch size={14} />} w={320} value={needle} onChange={(e) => setNeedle(e.currentTarget.value)} />}
      />
    </>
  );
}
