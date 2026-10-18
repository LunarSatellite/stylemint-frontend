import { useState } from 'react';
import {
  ActionIcon,
  Alert,
  Button,
  Card,
  Checkbox,
  Group,
  NumberInput,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  Textarea,
} from '@mantine/core';
import { IconPlus, IconTrash } from '@tabler/icons-react';
import { SectionCard } from '../../../components/SectionCard';
import { MapPinField, PhotoUrlsField } from '../components';
import { listingsApi, ListingKind, PAYMENT_MODES, PaymentMode, paymentModeLabel, type ItineraryDay, type Listing, type ListingWrite } from './api';

export function emptyListing(kind: number): ListingWrite {
  const common: ListingWrite = {
    kind,
    title: '',
    description: '',
    city: '',
    area: '',
    addressLine: '',
    latitude: null,
    longitude: null,
    photoUrls: [],
    amenities: [],
    freeCancellationDays: 3,
    lateCancellationFeePercent: 50,
    paymentModes: [PaymentMode.FullPrepay],
    depositPercent: 30,
  };
  if (kind === ListingKind.Stay)
    return { ...common, starRating: null, checkInTime: '14:00', checkOutTime: '12:00', minNights: 1, maxNights: 30, houseRules: '' };
  return { ...common, destination: '', durationDays: 3, meetingPoint: '', maxGroupSize: null, itinerary: [{ day: 1, title: '', description: '' }], inclusions: [], exclusions: [] };
}

export function listingToWrite(l: Listing): ListingWrite {
  const base: ListingWrite = {
    title: l.title,
    description: l.description ?? '',
    city: l.city,
    area: l.area ?? '',
    addressLine: l.addressLine ?? '',
    latitude: l.latitude,
    longitude: l.longitude,
    photoUrls: l.photoUrls ?? [],
    amenities: l.amenities ?? [],
    freeCancellationDays: l.cancellationPolicy?.freeCancellationDays ?? 0,
    lateCancellationFeePercent: l.cancellationPolicy?.lateCancellationFeePercent ?? 0,
    paymentModes: l.paymentModes?.length ? l.paymentModes : [PaymentMode.FullPrepay],
    depositPercent: l.depositPercent || 30,
  };
  if (l.kind === ListingKind.Stay)
    return {
      ...base,
      starRating: l.starRating ?? null,
      checkInTime: l.checkInTime ?? '14:00',
      checkOutTime: l.checkOutTime ?? '12:00',
      minNights: l.minNights ?? 1,
      maxNights: l.maxNights ?? 30,
      houseRules: l.houseRules ?? '',
    };
  return {
    ...base,
    destination: l.destination ?? '',
    durationDays: l.durationDays ?? 1,
    meetingPoint: l.meetingPoint ?? '',
    maxGroupSize: l.maxGroupSize ?? null,
    itinerary: l.itinerary?.length ? l.itinerary : [{ day: 1, title: '', description: '' }],
    inclusions: l.inclusions ?? [],
    exclusions: l.exclusions ?? [],
  };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const len = (s: string | null | undefined) => (s ?? '').trim().length;

/** The contract's ListingWrite limits (service-bookings-contract v1 §3); the server checks again. */
export function validateListing(w: ListingWrite, kind: number): Record<string, string> {
  const e: Record<string, string> = {};
  if (len(w.title) < 3 || len(w.title) > 150) e.title = 'Title needs 3–150 characters.';
  if (len(w.description) > 5000) e.description = 'At most 5000 characters.';
  if (len(w.city) < 2 || len(w.city) > 100) e.city = 'Enter the city (2–100 characters).';
  if (len(w.area) > 100) e.area = 'At most 100 characters.';
  if (len(w.addressLine) > 300) e.addressLine = 'At most 300 characters.';
  if ((w.latitude === null) !== (w.longitude === null)) e.pin = 'Enter both latitude and longitude, or leave both empty.';
  if (w.photoUrls.length > 20) e.photoUrls = 'Up to 20 photos.';
  if (w.amenities.length > 40 || w.amenities.some((a) => a.length > 60)) e.amenities = 'Up to 40 amenities, 60 characters each.';
  if (w.freeCancellationDays < 0 || w.freeCancellationDays > 60) e.freeCancellationDays = 'Between 0 and 60 days.';
  if (w.lateCancellationFeePercent < 0 || w.lateCancellationFeePercent > 100) e.lateCancellationFeePercent = 'Between 0 and 100 %.';
  if (w.paymentModes.length === 0) e.paymentModes = 'Choose at least one way for guests to pay.';
  if (w.paymentModes.includes(PaymentMode.Deposit) && (!Number.isInteger(w.depositPercent) || w.depositPercent < 1 || w.depositPercent > 99))
    e.depositPercent = 'The deposit is 1–99 % of the total.';
  if (kind === ListingKind.Stay) {
    if (w.starRating != null && (w.starRating < 1 || w.starRating > 5)) e.starRating = 'Stars are 1–5.';
    if (!HHMM.test(w.checkInTime ?? '')) e.checkInTime = 'Enter a time like 14:00.';
    if (!HHMM.test(w.checkOutTime ?? '')) e.checkOutTime = 'Enter a time like 12:00.';
    const min = w.minNights ?? 0;
    const max = w.maxNights ?? 0;
    if (min < 1 || min > 30) e.minNights = 'Minimum stay is 1–30 nights.';
    else if (max < min || max > 90) e.maxNights = `Maximum stay is ${min}–90 nights.`;
    if (len(w.houseRules) > 3000) e.houseRules = 'At most 3000 characters.';
  } else {
    if (len(w.destination) < 2 || len(w.destination) > 100) e.destination = 'Enter the destination (2–100 characters).';
    const d = w.durationDays ?? 0;
    if (d < 1 || d > 60) e.durationDays = 'A package lasts 1–60 days.';
    if (len(w.meetingPoint) > 300) e.meetingPoint = 'At most 300 characters.';
    if (w.maxGroupSize != null && (w.maxGroupSize < 1 || w.maxGroupSize > 500)) e.maxGroupSize = 'Group size is 1–500.';
    const it = w.itinerary ?? [];
    if (it.length > 60) e.itinerary = 'Up to 60 days.';
    else if (it.some((x) => len(x.title) === 0 || len(x.title) > 150 || len(x.description) > 2000))
      e.itinerary = 'Every day needs a title (up to 150 characters); descriptions up to 2000.';
    const lists = [...(w.inclusions ?? []), ...(w.exclusions ?? [])];
    if ((w.inclusions ?? []).length > 40 || (w.exclusions ?? []).length > 40 || lists.some((x) => x.length > 200)) e.inclusions = 'Up to 40 items each, 200 characters per item.';
  }
  return e;
}

/** "Free cancellation until 3 days before arrival. After that 50% of the total is charged." */
export function policySentence(days: number, fee: number, kind: number): string {
  const start = kind === ListingKind.Stay ? 'check-in' : 'departure';
  if (fee === 0) return 'Guests can cancel for free until the start date.';
  const free = days === 0 ? 'No free cancellation.' : `Free cancellation until ${days} ${days === 1 ? 'day' : 'days'} before ${start}.`;
  return `${free} After that ${fee}% of the total is charged.`;
}

/** What is sent: trimmed text, empty optional text as null, only the fields of this kind. */
export function cleanListing(w: ListingWrite, kind: number, isNew: boolean): ListingWrite {
  const t = (s: string | null | undefined) => (s ?? '').trim() || null;
  const out: ListingWrite = {
    ...(isNew ? { kind } : {}),
    title: w.title.trim(),
    description: t(w.description),
    city: w.city.trim(),
    area: t(w.area),
    addressLine: t(w.addressLine),
    latitude: w.latitude,
    longitude: w.longitude,
    photoUrls: w.photoUrls,
    amenities: w.amenities.map((a) => a.trim()).filter(Boolean),
    freeCancellationDays: w.freeCancellationDays,
    lateCancellationFeePercent: w.lateCancellationFeePercent,
    paymentModes: [...w.paymentModes].sort(),
    depositPercent: w.paymentModes.includes(PaymentMode.Deposit) ? w.depositPercent : 0,
  };
  if (kind === ListingKind.Stay)
    return { ...out, starRating: w.starRating ?? null, checkInTime: w.checkInTime, checkOutTime: w.checkOutTime, minNights: w.minNights, maxNights: w.maxNights, houseRules: t(w.houseRules) };
  return {
    ...out,
    destination: t(w.destination),
    durationDays: w.durationDays,
    meetingPoint: t(w.meetingPoint),
    maxGroupSize: w.maxGroupSize ?? null,
    itinerary: (w.itinerary ?? []).map((d, i) => ({ day: i + 1, title: d.title.trim(), description: t(d.description) })),
    inclusions: (w.inclusions ?? []).map((x) => x.trim()).filter(Boolean),
    exclusions: (w.exclusions ?? []).map((x) => x.trim()).filter(Boolean),
  };
}

const num = (v: string | number, fallback: number | null = null) => (v === '' ? fallback : Number(v));

export function ListingForm({
  kind,
  initial,
  saving,
  serverError,
  submitLabel,
  onSubmit,
}: {
  kind: number;
  initial: ListingWrite;
  saving: boolean;
  serverError: string | null;
  submitLabel: string;
  onSubmit: (w: ListingWrite) => void;
}) {
  const [w, setW] = useState<ListingWrite>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof ListingWrite>(k: K, v: ListingWrite[K]) => setW((p) => ({ ...p, [k]: v }));
  const stay = kind === ListingKind.Stay;
  const toggleMode = (m: number, on: boolean) => set('paymentModes', on ? [...new Set([...w.paymentModes, m])] : w.paymentModes.filter((x) => x !== m));
  const setDay = (i: number, patch: Partial<ItineraryDay>) => set('itinerary', (w.itinerary ?? []).map((d, k) => (k === i ? { ...d, ...patch } : d)));

  const submit = () => {
    const found = validateListing(w, kind);
    setErrors(found);
    if (Object.keys(found).length === 0) onSubmit(w);
  };

  return (
    <Stack gap="lg">
      {serverError && (
        <Alert color="signal" variant="light" role="alert">
          {serverError}
        </Alert>
      )}
      {Object.keys(errors).length > 0 && (
        <Alert color="signal" variant="light" role="alert" data-testid="form-errors">
          Check the highlighted fields.
        </Alert>
      )}
      <SectionCard title={stay ? 'Property' : 'Package'}>
        <Stack gap="sm">
          <TextInput label={stay ? 'Property name' : 'Package name'} required value={w.title} onChange={(e) => set('title', e.currentTarget.value)} error={errors.title} />
          <Textarea label="Description" autosize minRows={3} maxRows={10} value={w.description ?? ''} onChange={(e) => set('description', e.currentTarget.value)} error={errors.description} />
          {!stay && (
            <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm">
              <TextInput label="Destination" required value={w.destination ?? ''} onChange={(e) => set('destination', e.currentTarget.value)} error={errors.destination} />
              <NumberInput label="Days" min={1} max={60} value={w.durationDays ?? ''} onChange={(v) => set('durationDays', num(v))} error={errors.durationDays} />
              <NumberInput label="Largest group (optional)" min={1} max={500} value={w.maxGroupSize ?? ''} onChange={(v) => set('maxGroupSize', num(v))} error={errors.maxGroupSize} />
            </SimpleGrid>
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <TextInput label="City" required value={w.city} onChange={(e) => set('city', e.currentTarget.value)} error={errors.city} />
            <TextInput label="Area" placeholder={stay ? 'Thamel' : 'Lakeside'} value={w.area ?? ''} onChange={(e) => set('area', e.currentTarget.value)} error={errors.area} />
          </SimpleGrid>
          {stay ? (
            <TextInput label="Address" value={w.addressLine ?? ''} onChange={(e) => set('addressLine', e.currentTarget.value)} error={errors.addressLine} />
          ) : (
            <TextInput label="Meeting point" placeholder="Lakeside Chowk, Pokhara" value={w.meetingPoint ?? ''} onChange={(e) => set('meetingPoint', e.currentTarget.value)} error={errors.meetingPoint} />
          )}
          <Text size="sm" fw={500}>
            {stay ? 'Map pin' : 'Meeting point on the map'}
          </Text>
          <MapPinField value={{ latitude: w.latitude, longitude: w.longitude }} onChange={(v) => setW((p) => ({ ...p, ...v }))} error={errors.pin} />
          <PhotoUrlsField value={w.photoUrls} onChange={(v) => set('photoUrls', v)} max={20} upload={listingsApi.uploadMedia} />
          {errors.photoUrls && (
            <Text size="xs" c="signal">
              {errors.photoUrls}
            </Text>
          )}
          <TagsInput
            label="Amenities"
            description="Press Enter after each, e.g. wifi, parking, breakfast"
            value={w.amenities}
            onChange={(v) => set('amenities', v)}
            maxTags={40}
            error={errors.amenities}
          />
        </Stack>
      </SectionCard>

      {stay ? (
        <SectionCard title="Stay rules">
          <Stack gap="sm">
            <SimpleGrid cols={{ base: 2, sm: 5 }} spacing="sm">
              <Select
                label="Stars"
                placeholder="None"
                clearable
                data={['1', '2', '3', '4', '5']}
                value={w.starRating ? String(w.starRating) : null}
                onChange={(v) => set('starRating', v ? Number(v) : null)}
                error={errors.starRating}
                comboboxProps={{ withinPortal: true }}
              />
              <TextInput type="time" label="Check-in from" value={w.checkInTime ?? ''} onChange={(e) => set('checkInTime', e.currentTarget.value)} error={errors.checkInTime} />
              <TextInput type="time" label="Check-out by" value={w.checkOutTime ?? ''} onChange={(e) => set('checkOutTime', e.currentTarget.value)} error={errors.checkOutTime} />
              <NumberInput label="Min nights" min={1} max={30} value={w.minNights ?? ''} onChange={(v) => set('minNights', num(v))} error={errors.minNights} />
              <NumberInput label="Max nights" min={1} max={90} value={w.maxNights ?? ''} onChange={(v) => set('maxNights', num(v))} error={errors.maxNights} />
            </SimpleGrid>
            <Textarea label="House rules & policies" autosize minRows={2} value={w.houseRules ?? ''} onChange={(e) => set('houseRules', e.currentTarget.value)} error={errors.houseRules} />
          </Stack>
        </SectionCard>
      ) : (
        <SectionCard title="Itinerary" description="One entry per day.">
          <Stack gap="sm">
            {(w.itinerary ?? []).map((d, i) => (
              <Card key={i} withBorder padding="sm" data-testid={`itinerary-day-${i + 1}`}>
                <Group justify="space-between" mb={6}>
                  <Text size="sm" fw={650}>
                    Day {i + 1}
                  </Text>
                  {(w.itinerary ?? []).length > 1 && (
                    <ActionIcon size="sm" variant="subtle" color="signal" aria-label={`Remove day ${i + 1}`} onClick={() => set('itinerary', (w.itinerary ?? []).filter((_, k) => k !== i))}>
                      <IconTrash size={14} />
                    </ActionIcon>
                  )}
                </Group>
                <Stack gap={6}>
                  <TextInput aria-label={`Day ${i + 1} title`} placeholder="Pokhara → Nayapul" value={d.title} onChange={(e) => setDay(i, { title: e.currentTarget.value })} />
                  <Textarea aria-label={`Day ${i + 1} description`} placeholder="What happens this day" autosize minRows={1} value={d.description ?? ''} onChange={(e) => setDay(i, { description: e.currentTarget.value })} />
                </Stack>
              </Card>
            ))}
            {errors.itinerary && (
              <Text size="xs" c="signal">
                {errors.itinerary}
              </Text>
            )}
            <Button
              variant="default"
              leftSection={<IconPlus size={15} />}
              disabled={(w.itinerary ?? []).length >= 60}
              onClick={() => set('itinerary', [...(w.itinerary ?? []), { day: (w.itinerary ?? []).length + 1, title: '', description: '' }])}
              style={{ alignSelf: 'flex-start' }}
            >
              Add a day
            </Button>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <TagsInput label="Included" description="e.g. Guide, Permits, Meals" value={w.inclusions ?? []} onChange={(v) => set('inclusions', v)} maxTags={40} error={errors.inclusions} />
              <TagsInput label="Not included" description="e.g. Flights, Insurance" value={w.exclusions ?? []} onChange={(v) => set('exclusions', v)} maxTags={40} />
            </SimpleGrid>
          </Stack>
        </SectionCard>
      )}

      <SectionCard title="Payment & cancellation" description="Choose how guests may pay. Online payments go through StyleMint; commission is taken only on completed bookings.">
        <Stack gap="sm">
          <Stack gap={6} role="group" aria-label="Payment options">
            {PAYMENT_MODES.map((m) => (
              <Checkbox key={m} label={paymentModeLabel[m]} checked={w.paymentModes.includes(m)} onChange={(e) => toggleMode(m, e.currentTarget.checked)} />
            ))}
            {errors.paymentModes && (
              <Text size="xs" c="signal">
                {errors.paymentModes}
              </Text>
            )}
          </Stack>
          {w.paymentModes.includes(PaymentMode.Deposit) && (
            <NumberInput
              label="Deposit paid online"
              description="The rest is paid at the venue."
              suffix=" %"
              min={1}
              max={99}
              w={220}
              value={w.depositPercent}
              onChange={(v) => set('depositPercent', Number(num(v, 0)))}
              error={errors.depositPercent}
            />
          )}
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
            <NumberInput
              label={`Free cancellation until … days before ${stay ? 'check-in' : 'departure'}`}
              min={0}
              max={60}
              value={w.freeCancellationDays}
              onChange={(v) => set('freeCancellationDays', Number(num(v, 0)))}
              error={errors.freeCancellationDays}
            />
            <NumberInput
              label="Late cancellation fee"
              suffix=" %"
              min={0}
              max={100}
              value={w.lateCancellationFeePercent}
              onChange={(v) => set('lateCancellationFeePercent', Number(num(v, 0)))}
              error={errors.lateCancellationFeePercent}
            />
          </SimpleGrid>
          <Text size="sm" c="dimmed" data-testid="policy-preview">
            Guests see: {policySentence(w.freeCancellationDays, w.lateCancellationFeePercent, kind)}
          </Text>
        </Stack>
      </SectionCard>

      <Group justify="flex-end">
        <Button onClick={submit} loading={saving}>
          {submitLabel}
        </Button>
      </Group>
    </Stack>
  );
}
