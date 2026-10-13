import { useState, type ReactNode } from 'react';
import { Alert, Badge, Box, Button, Card, Center, Drawer, Group, ScrollArea, Select, Stack, Text, ThemeIcon, Title } from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { IconBuildingStore, IconLock, IconMailOff, IconRefresh, IconShieldCheck, IconShieldOff, IconTools } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { NavLink, Outlet } from 'react-router-dom';
import { ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { useIsPhone } from '../../lib/useIsPhone';
import { crmApi } from './api';
import { CRM_KEY, useCrmSession, useVisibleAreas } from './hooks';
import { can, type CrmCapability } from './roles';
import { crmSession } from './session';

/** "CRM is being set up" — the session endpoint 404s until the backend is deployed / the workspace exists. */
export function CrmSettingUp() {
  return (
    <Card data-testid="crm-setting-up" padding="xl">
      <Center>
        <Stack align="center" gap="sm" maw={460} ta="center" py="lg">
          <ThemeIcon size={52} radius="xl" variant="light" color="forest">
            <IconTools size={26} />
          </ThemeIcon>
          <Title order={3}>Your customer CRM is being set up</Title>
          <Text size="sm" c="dimmed">
            We are preparing a private CRM workspace for your shop with your buyers, their orders, returns and reviews. This
            usually takes a little while after your shop is approved. Check back soon.
          </Text>
          <Button variant="light" leftSection={<IconRefresh size={15} />} onClick={() => void crmSession.acquire(true)}>
            Check again
          </Button>
        </Stack>
      </Center>
    </Card>
  );
}

function CrmSubNav() {
  const areas = useVisibleAreas();
  return (
    <Box hiddenFrom="sm" mb="md">
      <ScrollArea type="never">
        <Box component="nav" aria-label="CRM sections">
          <Group gap={6} wrap="nowrap">
            {areas.map((a) => (
              <NavLink key={a.key} to={a.to} className="sm-crm-chip">
                {a.short}
              </NavLink>
            ))}
          </Group>
        </Box>
      </ScrollArea>
    </Box>
  );
}

/** Wraps every CRM route: gets the CRM session, then shows the page — or why it cannot. */
export function CrmLayout() {
  const state = useCrmSession({ acquire: true });
  let body: ReactNode;
  if (state.status === 'idle' || state.status === 'loading') body = <ListSkeleton rows={4} height={64} />;
  else if (state.status === 'unavailable') body = <CrmSettingUp />;
  else if (state.status === 'forbidden')
    body = (
      <Alert color="gray" variant="light" icon={<IconLock size={18} />} title="The CRM is not available for your account" data-testid="crm-forbidden">
        Ask the shop owner to give your team account access to customers.
      </Alert>
    );
  else if (state.status === 'error')
    body = <ErrorBlock error={state.error} title="Could not open your CRM" onRetry={() => void crmSession.acquire(true)} />;
  else body = <Outlet />;
  return (
    <>
      <CrmSubNav />
      {body}
    </>
  );
}

/** Renders children only when the CRM role allows the capability. */
export function RequireCap({ cap, children }: { cap: CrmCapability; children: ReactNode }) {
  const { role } = useCrmSession();
  if (!can(role, cap))
    return (
      <Alert color="gray" variant="light" icon={<IconLock size={18} />} title="Not available for your role" data-testid="crm-role-blocked">
        Your team role cannot open this part of the CRM. The shop owner or an admin can.
      </Alert>
    );
  return <>{children}</>;
}

/** Shows children only when allowed — for buttons and menu items. */
export function IfCan({ cap, children }: { cap: CrmCapability; children: ReactNode }) {
  const { role, status } = useCrmSession();
  return status === 'ready' && can(role, cap) ? <>{children}</> : null;
}

/** Detail panel: a bottom sheet on a phone, a side panel on larger screens. */
export function DetailSheet({
  opened,
  onClose,
  title,
  children,
}: {
  opened: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const phone = useIsPhone();
  return (
    <Drawer
      opened={opened}
      onClose={onClose}
      title={<Text fw={650}>{title}</Text>}
      position={phone ? 'bottom' : 'right'}
      size={phone ? '88%' : 'lg'}
      radius={phone ? 'lg' : 0}
      padding="md"
      zIndex={300}
      scrollAreaComponent={ScrollArea.Autosize}
    >
      {children}
    </Drawer>
  );
}

/** Buyer contact details are never shown — say so, once, where a seller would look for them. */
export function PrivacyNote() {
  return (
    <Group gap={8} wrap="nowrap" align="flex-start" data-testid="crm-privacy-note">
      <IconMailOff size={16} style={{ flexShrink: 0, marginTop: 2 }} color="var(--sm-text-muted)" aria-hidden />
      <Text size="xs" c="dimmed">
        Phone and email are hidden to protect buyers. Reach customers through StyleMint — messages, campaigns and surveys go
        only to buyers who agreed to hear from shops.
      </Text>
    </Group>
  );
}

export function ConsentBadge({ consent }: { consent: boolean | null }) {
  if (consent === null) return null;
  return consent ? (
    <Badge color="forest" variant="light" leftSection={<IconShieldCheck size={12} />}>
      Gets offers
    </Badge>
  ) : (
    <Badge color="gray" variant="light" leftSection={<IconShieldOff size={12} />}>
      No marketing
    </Badge>
  );
}

export function SourceBadge() {
  return (
    <Badge color="gray" variant="dot" leftSection={<IconBuildingStore size={11} />}>
      StyleMint
    </Badge>
  );
}

/** Searchable customer select (server search on name). */
export function CustomerPicker({
  value,
  onChange,
  label = 'Customer',
  required,
  initialLabel,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
  required?: boolean;
  initialLabel?: string | null;
}) {
  const [search, setSearch] = useState('');
  const [debounced] = useDebouncedValue(search, 250);
  const [chosenLabel, setChosenLabel] = useState<string | null>(initialLabel ?? null);
  const list = useQuery({
    queryKey: [CRM_KEY, 'customer-picker', debounced],
    queryFn: () => crmApi.customers({ search: debounced || undefined, page: 1, pageSize: 10 }),
    staleTime: 30_000,
  });
  const data = (list.data?.items ?? []).map((c) => ({ value: c.id, label: c.city ? `${c.name} · ${c.city}` : c.name }));
  if (value && chosenLabel && !data.some((d) => d.value === value)) data.unshift({ value, label: chosenLabel });
  return (
    <Select
      label={label}
      required={required}
      searchable
      clearable
      placeholder="Search by name"
      data={data}
      value={value}
      onChange={(id, option) => {
        setChosenLabel(option?.label ?? null);
        onChange(id);
      }}
      searchValue={search}
      onSearchChange={setSearch}
      nothingFoundMessage={list.isFetching ? 'Searching…' : list.error ? 'Could not search customers' : 'No customer with that name'}
      filter={({ options }) => options}
      comboboxProps={{ zIndex: 400 }}
    />
  );
}

/** A small labelled number for detail panels. */
export function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <Box>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700} style={{ letterSpacing: '0.05em' }}>
        {label}
      </Text>
      <Text fw={650} size="lg" component="div">
        {value}
      </Text>
    </Box>
  );
}
