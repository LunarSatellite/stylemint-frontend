import { useState } from 'react';
import { ActionIcon, Alert, Badge, Button, Card, Group, Menu, Modal, NumberInput, SimpleGrid, Stack, Text, TextInput } from '@mantine/core';
import { IconCheck, IconDots, IconEdit, IconMapPin, IconPlus, IconTrash } from '@tabler/icons-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { messageOf } from '../../api/client';
import { SectionCard } from '../../components/SectionCard';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { formatDate } from '../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../lib/notify';
import { settingsApi, type StoreInput, type VendorStore } from './api';

function StoreModal({ store, opened, onClose }: { store: VendorStore | null; opened: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<StoreInput>({
    name: store?.name ?? '',
    addressLine: store?.addressLine ?? '',
    city: store?.city ?? '',
    phone: store?.phone ?? '',
    openingHours: store?.openingHours ?? '',
    latitude: store?.latitude ?? null,
    longitude: store?.longitude ?? null,
  });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: () => {
      const body: StoreInput = {
        ...form,
        name: form.name.trim(),
        addressLine: form.addressLine.trim(),
        city: form.city.trim(),
        phone: form.phone?.trim() || null,
        openingHours: form.openingHours?.trim() || null,
      };
      return store ? settingsApi.updateStore(store.id, body) : settingsApi.addStore(body);
    },
    onSuccess: () => {
      toastSuccess(store ? 'Store updated' : 'Store added');
      void qc.invalidateQueries({ queryKey: ['stores'] });
      onClose();
    },
    onError: (e) => setError(messageOf(e)),
  });
  const submit = () => {
    setError(null);
    if (form.name.trim().length < 2) return setError('Store name needs at least 2 characters.');
    if (!form.addressLine.trim() || !form.city.trim()) return setError('Enter the address and city.');
    save.mutate();
  };
  const useMyLocation = () => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setForm((f) => ({ ...f, latitude: +pos.coords.latitude.toFixed(6), longitude: +pos.coords.longitude.toFixed(6) })),
      () => setError('Could not read your location. Allow location access, or type the coordinates.'),
    );
  };
  return (
    <Modal opened={opened} onClose={onClose} title={store ? 'Edit store' : 'Add a store'}>
      <Stack gap="sm">
        {error && (
          <Alert color="signal" variant="light">
            {error}
          </Alert>
        )}
        <TextInput label="Store name" maxLength={80} value={form.name} onChange={(e) => setForm({ ...form, name: e.currentTarget.value })} required />
        <TextInput label="Address" maxLength={160} value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.currentTarget.value })} required />
        <TextInput label="City" maxLength={80} value={form.city} onChange={(e) => setForm({ ...form, city: e.currentTarget.value })} required />
        <TextInput label="Phone" maxLength={20} value={form.phone ?? ''} onChange={(e) => setForm({ ...form, phone: e.currentTarget.value })} />
        <TextInput
          label="Opening hours"
          placeholder="e.g. Sun–Fri 10:00–19:00"
          maxLength={240}
          value={form.openingHours ?? ''}
          onChange={(e) => setForm({ ...form, openingHours: e.currentTarget.value })}
        />
        <SimpleGrid cols={2} spacing="sm">
          <NumberInput label="Latitude" value={form.latitude ?? ''} min={-90} max={90} decimalScale={6} onChange={(v) => setForm({ ...form, latitude: v === '' ? null : Number(v) })} />
          <NumberInput label="Longitude" value={form.longitude ?? ''} min={-180} max={180} decimalScale={6} onChange={(v) => setForm({ ...form, longitude: v === '' ? null : Number(v) })} />
        </SimpleGrid>
        <Button variant="subtle" size="xs" leftSection={<IconMapPin size={14} />} onClick={useMyLocation} style={{ alignSelf: 'flex-start' }}>
          Use my current location
        </Button>
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            Save store
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function StoresSection() {
  const qc = useQueryClient();
  const stores = useQuery({ queryKey: ['stores'], queryFn: () => settingsApi.stores(null) });
  const [editing, setEditing] = useState<VendorStore | null | 'new'>(null);
  const act = useMutation({
    mutationFn: (s: { run: () => Promise<unknown>; done: string }) => s.run().then(() => s.done),
    onSuccess: (done) => {
      toastSuccess(done);
      void qc.invalidateQueries({ queryKey: ['stores'] });
    },
    onError: (e) => toastError(e),
  });
  const items = (stores.data?.items ?? []).filter((s) => s.isActive);
  return (
    <SectionCard
      title="Stores & pickup points"
      description="Your physical shops. Customers can find you and collect orders here."
      action={
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setEditing('new')}>
          Add store
        </Button>
      }
    >
      {stores.isPending ? (
        <ListSkeleton rows={2} />
      ) : stores.error ? (
        <ErrorBlock error={stores.error} onRetry={() => void stores.refetch()} title="Could not load your stores" />
      ) : items.length === 0 ? (
        <EmptyBlock title="No stores yet" body="Add your shop’s address so customers can visit or collect orders." />
      ) : (
        <Stack gap="xs">
          {items.map((s) => (
            <Card key={s.id} padding="sm" withBorder>
              <Group justify="space-between" wrap="nowrap" align="flex-start">
                <div style={{ minWidth: 0 }}>
                  <Group gap={6}>
                    <Text fw={600} size="sm">
                      {s.name}
                    </Text>
                    {s.lastConfirmedUtc ? (
                      <Badge size="xs" color="forest" variant="light">
                        Checked {formatDate(s.lastConfirmedUtc)}
                      </Badge>
                    ) : (
                      <Badge size="xs" color="amber" variant="light">
                        Not confirmed
                      </Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">
                    {s.addressLine}, {s.city}
                    {s.phone ? ` · ${s.phone}` : ''}
                  </Text>
                  {s.openingHours && (
                    <Text size="xs" c="dimmed">
                      {s.openingHours}
                    </Text>
                  )}
                </div>
                <Menu position="bottom-end">
                  <Menu.Target>
                    <ActionIcon variant="subtle" color="gray" aria-label={`Actions for ${s.name}`}>
                      <IconDots size={16} />
                    </ActionIcon>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item leftSection={<IconEdit size={14} />} onClick={() => setEditing(s)}>
                      Edit
                    </Menu.Item>
                    <Menu.Item leftSection={<IconCheck size={14} />} onClick={() => act.mutate({ run: () => settingsApi.confirmStore(s.id), done: 'Details confirmed' })}>
                      Address and hours are correct
                    </Menu.Item>
                    <Menu.Item
                      color="signal"
                      leftSection={<IconTrash size={14} />}
                      onClick={() =>
                        void confirmAction({
                          title: `Close ${s.name}?`,
                          body: 'The store is archived and its QR codes stop working. This cannot be undone.',
                          confirmLabel: 'Archive store',
                          danger: true,
                        }).then((ok) => ok && act.mutate({ run: () => settingsApi.archiveStore(s.id), done: 'Store archived' }))
                      }
                    >
                      Archive
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
      {editing && <StoreModal key={editing === 'new' ? 'new' : editing.id} store={editing === 'new' ? null : editing} opened onClose={() => setEditing(null)} />}
    </SectionCard>
  );
}
