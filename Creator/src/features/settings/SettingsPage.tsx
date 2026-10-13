import { useState } from 'react';
import { Alert, Card, Group, SegmentedControl, Stack, Switch, Table, Tabs, Text, useMantineColorScheme } from '@mantine/core';
import { TimeInput } from '@mantine/dates';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, messageOf } from '../../api/client';
import { useSession } from '../../auth/useSession';
import { PageHeader } from '../../components/PageHeader';
import { SectionCard } from '../../components/SectionCard';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { toastSuccess } from '../../lib/notify';
import { useTab } from '../../lib/useTab';
import { SecuritySection } from './SecuritySection';

/** Identity notification preferences (the store the StyleMint app uses). */
interface Prefs {
  emailEnabledMaster: boolean;
  pushEnabledMaster: boolean;
  smsEnabledMaster: boolean;
  [key: string]: boolean | string;
  quietHoursEnabled: boolean;
  quietHoursStartLocal: string;
  quietHoursEndLocal: string;
  quietHoursTimezone: string;
}

const TOPICS: { key: string; label: string; hint: string }[] = [
  { key: 'ReelActivity', label: 'Reels', hint: 'Likes, comments and reports on your reels' },
  { key: 'Messages', label: 'Messages', hint: 'Brands and fans writing to you' },
  { key: 'FriendActivity', label: 'Followers', hint: 'New followers and people you follow' },
  { key: 'OrderUpdates', label: 'Orders', hint: 'Your own purchases' },
  { key: 'DeliveryUpdates', label: 'Deliveries', hint: 'Your own deliveries' },
  { key: 'SystemAnnouncements', label: 'StyleMint news', hint: 'Product and policy updates' },
  { key: 'Marketing', label: 'Offers', hint: 'Promotions from StyleMint' },
];

function Notifications() {
  const { accountId } = useSession();
  const qc = useQueryClient();
  const key = ['settings', 'notifications', accountId];
  const prefs = useQuery({ queryKey: key, queryFn: () => api.get<Prefs>(`/v1/accounts/${accountId}/notification-preferences`), enabled: !!accountId });
  const [error, setError] = useState<string | null>(null);
  const toggle = useMutation({
    mutationFn: (patch: Record<string, boolean>) => api.patch<Prefs>(`/v1/accounts/${accountId}/notification-preferences/toggles`, patch),
    onSuccess: (next) => qc.setQueryData(key, next),
    onError: (e) => setError(messageOf(e)),
  });
  const quiet = useMutation({
    mutationFn: (patch: { enabled?: boolean; startLocal?: string; endLocal?: string }) =>
      api.patch<Prefs>(`/v1/accounts/${accountId}/notification-preferences/quiet-hours`, patch),
    onSuccess: (next) => {
      qc.setQueryData(key, next);
      toastSuccess('Quiet hours saved');
    },
    onError: (e) => setError(messageOf(e)),
  });
  if (prefs.isPending) return <ListSkeleton rows={4} height={36} />;
  if (prefs.error) return <ErrorBlock error={prefs.error} onRetry={() => void prefs.refetch()} title="Could not load your notification settings" />;
  const p = prefs.data;
  const hhmm = (t: string) => t.slice(0, 5);
  return (
    <Stack gap="md">
      {error && <Alert color="signal" variant="light" withCloseButton onClose={() => setError(null)}>{error}</Alert>}
      <SectionCard title="Channels" description="Security alerts are always sent.">
        <Group gap="xl">
          <Switch label="App notifications" checked={p.pushEnabledMaster} onChange={(e) => toggle.mutate({ pushEnabledMaster: e.currentTarget.checked })} />
          <Switch label="Email" checked={p.emailEnabledMaster} onChange={(e) => toggle.mutate({ emailEnabledMaster: e.currentTarget.checked })} />
          <Switch label="SMS" checked={p.smsEnabledMaster} onChange={(e) => toggle.mutate({ smsEnabledMaster: e.currentTarget.checked })} />
        </Group>
      </SectionCard>
      <SectionCard title="Topics">
        <Table.ScrollContainer minWidth={360}>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Topic</Table.Th>
                <Table.Th ta="center">App</Table.Th>
                <Table.Th ta="center">Email</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {TOPICS.map((t) => (
                <Table.Tr key={t.key}>
                  <Table.Td>
                    <Text size="sm" fw={600}>{t.label}</Text>
                    <Text size="xs" c="dimmed">{t.hint}</Text>
                  </Table.Td>
                  {(['push', 'email'] as const).map((ch) => (
                    <Table.Td key={ch} ta="center">
                      <Switch
                        aria-label={`${t.label} by ${ch === 'push' ? 'app' : 'email'}`}
                        checked={Boolean(p[`${ch}${t.key}`])}
                        disabled={!(ch === 'push' ? p.pushEnabledMaster : p.emailEnabledMaster)}
                        onChange={(e) => toggle.mutate({ [`${ch}${t.key}`]: e.currentTarget.checked })}
                        style={{ display: 'inline-block' }}
                      />
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      </SectionCard>
      <SectionCard title="Quiet hours" description={`No app notifications during these hours (${p.quietHoursTimezone}).`}>
        <Stack gap="sm">
          <Switch label="Quiet hours on" checked={p.quietHoursEnabled} onChange={(e) => quiet.mutate({ enabled: e.currentTarget.checked })} />
          <Group>
            <TimeInput
              label="From"
              defaultValue={hhmm(p.quietHoursStartLocal)}
              onBlur={(e) => e.currentTarget.value && e.currentTarget.value !== hhmm(p.quietHoursStartLocal) && quiet.mutate({ startLocal: `${e.currentTarget.value}:00` })}
            />
            <TimeInput
              label="To"
              defaultValue={hhmm(p.quietHoursEndLocal)}
              onBlur={(e) => e.currentTarget.value && e.currentTarget.value !== hhmm(p.quietHoursEndLocal) && quiet.mutate({ endLocal: `${e.currentTarget.value}:00` })}
            />
          </Group>
        </Stack>
      </SectionCard>
    </Stack>
  );
}

function Appearance() {
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  return (
    <SectionCard title="Appearance">
      <SegmentedControl
        value={colorScheme}
        onChange={(v) => setColorScheme(v as 'light' | 'dark' | 'auto')}
        data={[
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark' },
          { value: 'auto', label: 'Match device' },
        ]}
      />
    </SectionCard>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useTab(['security', 'notifications', 'appearance'] as const, 'security');
  return (
    <>
      <PageHeader title="Settings" />
      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="security">Password & sessions</Tabs.Tab>
          <Tabs.Tab value="notifications">Notifications</Tabs.Tab>
          <Tabs.Tab value="appearance">Appearance</Tabs.Tab>
        </Tabs.List>
        {tab === 'security' ? <SecuritySection /> : tab === 'notifications' ? <Notifications /> : <Card p={0} bg="transparent" withBorder={false}><Appearance /></Card>}
      </Tabs>
    </>
  );
}
