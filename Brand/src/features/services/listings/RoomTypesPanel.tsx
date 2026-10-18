import { useState } from 'react';
import { Alert, Badge, Button, Card, Group, Image, Modal, NumberInput, SimpleGrid, Stack, TagsInput, Text, TextInput, Textarea } from '@mantine/core';
import { IconPlus } from '@tabler/icons-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { messageOf } from '../../../api/client';
import { EmptyBlock } from '../../../components/StateBlocks';
import { formatMoney } from '../../../lib/format';
import { confirmAction, toastError, toastSuccess } from '../../../lib/notify';
import { PhotoUrlsField } from '../components';
import { LISTINGS_KEY, listingsApi, RoomTypeStatus, type Listing, type RoomTypeVendor, type RoomTypeWrite } from './api';

/** RoomTypeWrite limits (service-bookings-contract v1 §3). */
export function validateRoomType(w: RoomTypeWrite): Record<string, string> {
  const e: Record<string, string> = {};
  const name = w.name.trim();
  if (name.length < 2 || name.length > 100) e.name = 'Name needs 2–100 characters.';
  if ((w.description ?? '').length > 2000) e.description = 'At most 2000 characters.';
  if (!Number.isInteger(w.maxAdults) || w.maxAdults < 1 || w.maxAdults > 20) e.maxAdults = 'Adults per room: 1–20.';
  if (!Number.isInteger(w.maxGuests) || w.maxGuests < w.maxAdults || w.maxGuests > 30) e.maxGuests = `Guests per room: ${Math.max(1, w.maxAdults)}–30 (adults + children).`;
  if ((w.beds ?? '').length > 100) e.beds = 'At most 100 characters.';
  if (w.sizeSqm != null && (w.sizeSqm < 1 || w.sizeSqm > 2000)) e.sizeSqm = 'Size is 1–2000 m².';
  if (!Number.isInteger(w.totalUnits) || w.totalUnits < 1 || w.totalUnits > 500) e.totalUnits = 'Rooms of this type: 1–500.';
  if (!(w.baseRate > 0) || w.baseRate > 10_000_000) e.baseRate = 'Enter the nightly rate.';
  if (w.photoUrls.length > 20) e.photoUrls = 'Up to 20 photos.';
  return e;
}

const blank: RoomTypeWrite = { name: '', description: '', maxAdults: 2, maxGuests: 3, beds: '', sizeSqm: null, photoUrls: [], amenities: [], totalUnits: 1, baseRate: 0 };

function toWrite(r: RoomTypeVendor): RoomTypeWrite {
  return {
    name: r.name,
    description: r.description ?? '',
    maxAdults: r.maxAdults,
    maxGuests: r.maxGuests,
    beds: r.beds ?? '',
    sizeSqm: r.sizeSqm,
    photoUrls: r.photoUrls ?? [],
    amenities: r.amenities ?? [],
    totalUnits: r.totalUnits,
    baseRate: r.baseRate,
  };
}

export function RoomTypesPanel({ listing, readOnly }: { listing: Listing; readOnly: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<RoomTypeVendor | 'new' | null>(null);
  const rooms = (listing.roomTypes ?? []).filter((r) => r.status === RoomTypeStatus.Active);
  const archive = useMutation({
    mutationFn: (id: string) => listingsApi.archiveRoomType(id),
    onSuccess: () => {
      toastSuccess('Room type archived. Existing bookings stay.');
      void qc.invalidateQueries({ queryKey: LISTINGS_KEY });
    },
    onError: (e) => toastError(e),
  });
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Text size="sm" c="dimmed">
          Each room type has a capacity, beds, how many such rooms you have and a base nightly rate. Change prices for single dates under Rates & availability.
        </Text>
        {!readOnly && (
          <Button leftSection={<IconPlus size={16} />} onClick={() => setEditing('new')}>
            Add room type
          </Button>
        )}
      </Group>
      {rooms.length === 0 ? (
        <Card>
          <EmptyBlock title="No room types yet" body="Add at least one room type — the property can be published after that." />
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
          {rooms.map((r) => (
            <Card key={r.roomTypeId} withBorder data-testid={`room-${r.roomTypeId}`}>
              <Group wrap="nowrap" align="flex-start" gap="sm">
                {r.photoUrls?.[0] && <Image src={r.photoUrls[0]} alt="" w={80} h={60} radius="md" fit="cover" />}
                <Stack gap={2} style={{ flex: 1, minWidth: 0 }}>
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={650} truncate>
                      {r.name}
                    </Text>
                    <Badge variant="light" size="sm">
                      {r.totalUnits} {r.totalUnits === 1 ? 'room' : 'rooms'}
                    </Badge>
                  </Group>
                  <Text size="sm" c="dimmed">
                    {[r.beds, `up to ${r.maxAdults} adults / ${r.maxGuests} guests`, r.sizeSqm ? `${r.sizeSqm} m²` : null].filter(Boolean).join(' · ')}
                  </Text>
                  <Text size="sm" fw={600}>
                    {formatMoney({ amount: r.baseRate, currency: listing.currency || 'NPR' })} / night
                  </Text>
                  {!readOnly && (
                    <Group gap="xs" mt={4}>
                      <Button size="xs" variant="default" onClick={() => setEditing(r)}>
                        Edit
                      </Button>
                      <Button
                        size="xs"
                        variant="subtle"
                        color="signal"
                        onClick={async () => {
                          if (await confirmAction({ title: `Archive ${r.name}?`, body: 'Guests can no longer book it. Bookings already made stay.', confirmLabel: 'Archive', danger: true }))
                            archive.mutate(r.roomTypeId);
                        }}
                      >
                        Archive
                      </Button>
                    </Group>
                  )}
                </Stack>
              </Group>
            </Card>
          ))}
        </SimpleGrid>
      )}
      {editing && <RoomTypeEditor listing={listing} room={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Stack>
  );
}

const n = (v: string | number, fallback = 0) => (v === '' ? fallback : Number(v));

function RoomTypeEditor({ listing, room, onClose }: { listing: Listing; room: RoomTypeVendor | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [w, setW] = useState<RoomTypeWrite>(() => (room ? toWrite(room) : { ...blank }));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const set = <K extends keyof RoomTypeWrite>(k: K, v: RoomTypeWrite[K]) => setW((p) => ({ ...p, [k]: v }));
  const save = useMutation({
    mutationFn: () => {
      const body: RoomTypeWrite = { ...w, name: w.name.trim(), description: w.description?.trim() || null, beds: w.beds?.trim() || null };
      return room ? listingsApi.updateRoomType(room.roomTypeId, body) : listingsApi.addRoomType(listing.listingId, body);
    },
    onSuccess: () => {
      toastSuccess(room ? 'Room type saved.' : 'Room type added.');
      void qc.invalidateQueries({ queryKey: LISTINGS_KEY });
      onClose();
    },
    onError: (e) => setServerError(messageOf(e)),
  });
  const submit = () => {
    const found = validateRoomType(w);
    setErrors(found);
    setServerError(null);
    if (Object.keys(found).length === 0) save.mutate();
  };
  return (
    <Modal opened onClose={onClose} title={room ? `Edit ${room.name}` : 'Add a room type'} size="lg">
      <Stack gap="sm">
        {serverError && (
          <Alert color="signal" variant="light" role="alert">
            {serverError}
          </Alert>
        )}
        <TextInput label="Name" placeholder="Deluxe Double" required value={w.name} onChange={(e) => set('name', e.currentTarget.value)} error={errors.name} />
        <Textarea label="Description" autosize minRows={2} value={w.description ?? ''} onChange={(e) => set('description', e.currentTarget.value)} error={errors.description} />
        <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="sm">
          <NumberInput label="Adults per room" min={1} max={20} value={w.maxAdults} onChange={(v) => set('maxAdults', n(v))} error={errors.maxAdults} />
          <NumberInput label="Guests per room" description="Adults + children" min={1} max={30} value={w.maxGuests} onChange={(v) => set('maxGuests', n(v))} error={errors.maxGuests} />
          <TextInput label="Beds" placeholder="1 King" value={w.beds ?? ''} onChange={(e) => set('beds', e.currentTarget.value)} error={errors.beds} />
          <NumberInput label="Size (m²)" min={1} max={2000} value={w.sizeSqm ?? ''} onChange={(v) => set('sizeSqm', v === '' ? null : Number(v))} error={errors.sizeSqm} />
          <NumberInput label="Rooms of this type" min={1} max={500} value={w.totalUnits} onChange={(v) => set('totalUnits', n(v))} error={errors.totalUnits} />
          <NumberInput label="Base rate per night (NPR)" min={1} thousandSeparator="," value={w.baseRate || ''} onChange={(v) => set('baseRate', n(v))} error={errors.baseRate} />
        </SimpleGrid>
        {room && w.totalUnits < room.totalUnits && (
          <Text size="xs" c="dimmed">
            Fewer rooms never cancels bookings already made; it only limits new ones.
          </Text>
        )}
        <TagsInput label="Room amenities" value={w.amenities} onChange={(v) => set('amenities', v)} maxTags={40} />
        <PhotoUrlsField value={w.photoUrls} onChange={(v) => set('photoUrls', v)} max={20} upload={listingsApi.uploadMedia} label="Room photos" />
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} loading={save.isPending}>
            {room ? 'Save room type' : 'Add room type'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
