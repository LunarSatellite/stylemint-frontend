import { useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Alert,
  Anchor,
  Box,
  Button,
  Card,
  Group,
  Image,
  NumberInput,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { IconCurrentLocation, IconLock, IconMapPin, IconPhotoPlus, IconTools, IconTrash } from '@tabler/icons-react';
import { isMissingEndpoint, messageOf } from '../../api/client';
import { EmptyBlock, ErrorBlock, ListSkeleton } from '../../components/StateBlocks';
import { productsApi } from '../products/api';
import { serviceCategoryLabel, useServiceCategory, type ServiceCategoryValue } from './category';

/** The service endpoints 404 with no error code until the combined deploy: say so instead of "empty". */
export function ServiceSettingUp({ what, body }: { what: string; body?: ReactNode }) {
  return (
    <Card withBorder data-testid="state-setting-up">
      <Stack align="center" gap={6} py="lg" ta="center">
        <IconTools size={28} opacity={0.6} aria-hidden />
        <Text fw={600}>{what} is being set up</Text>
        <Text size="sm" c="dimmed" maw={480}>
          {body ?? 'StyleMint is switching this on for service vendors. It will appear here as soon as it is ready — nothing has been lost.'}
        </Text>
      </Stack>
    </Card>
  );
}

/**
 * Only the vendor category an area is for may use it. A product seller opening a service link (or a bank opening
 * a hotel link) sees a plain explanation, never someone else's tools.
 */
export function RequireServiceCategory({ allow, children }: { allow: readonly ServiceCategoryValue[]; children: ReactNode }) {
  const { category, isPending } = useServiceCategory();
  if (isPending) return <ListSkeleton rows={3} />;
  if (!allow.includes(category)) {
    const forWhom = allow.map((c) => serviceCategoryLabel[c].toLowerCase()).join(' and ');
    return (
      <Alert variant="light" color="gray" icon={<IconLock size={18} />} title="Not part of your seller account" data-testid="state-wrong-category">
        <Text size="sm">
          This area is for {forWhom} vendors on StyleMint. Your account is set up as a{' '}
          {serviceCategoryLabel[category].toLowerCase()}. To change what you offer, contact StyleMint support.
        </Text>
      </Alert>
    );
  }
  return <>{children}</>;
}

interface QueryLike<T> {
  isPending: boolean;
  error: unknown;
  data: T | undefined;
  refetch: () => unknown;
}

/** pending → "being set up" (bare 404) → error → empty → content. */
export function ServiceQuery<T>({
  query,
  what,
  errorTitle,
  isEmpty,
  empty,
  skeleton,
  children,
}: {
  query: QueryLike<T>;
  what: string;
  errorTitle?: string;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  skeleton?: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{skeleton ?? <ListSkeleton rows={4} />}</>;
  if (query.error && isMissingEndpoint(query.error)) return <ServiceSettingUp what={what} />;
  if (query.error || query.data === undefined)
    return <ErrorBlock error={query.error ?? new Error('No data')} title={errorTitle} onRetry={() => void query.refetch()} />;
  if (isEmpty?.(query.data)) return <>{empty ?? <EmptyBlock />}</>;
  return <>{children(query.data)}</>;
}

const ACCEPT = IMAGE_MIME_TYPE.filter((t) => t === 'image/jpeg' || t === 'image/png' || t === 'image/webp');
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Photos as absolute https URLs (the service DTOs take `photoUrls`): upload through the existing vendor media
 * upload, or paste a link.
 */
export function PhotoUrlsField({
  value,
  onChange,
  max = 10,
  label = 'Photos',
  upload = productsApi.uploadImage,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
  max?: number;
  label?: string;
  /** Where a picked file goes; returns its public URL. Defaults to the vendor product-image upload. */
  upload?: (file: File) => Promise<{ url: string }>;
}) {
  const [busy, setBusy] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [paste, setPaste] = useState('');
  const room = max - value.length;

  const uploadFiles = async (files: File[]) => {
    setErrors([]);
    const accepted = files.slice(0, Math.max(0, room));
    const problems: string[] = files.length > room ? [`Only ${max} photos are allowed.`] : [];
    const added: string[] = [];
    setBusy(accepted.length);
    for (const file of accepted) {
      try {
        if (file.size > MAX_BYTES) throw new Error('larger than 5 MB');
        const { url } = await upload(file);
        added.push(url);
      } catch (e) {
        problems.push(`${file.name}: ${messageOf(e)}`);
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (added.length) onChange([...value, ...added].slice(0, max));
    setErrors(problems);
  };

  const addPasted = () => {
    const url = paste.trim();
    if (!/^https:\/\/\S+$/i.test(url)) {
      setErrors(['Paste a full link that starts with https://']);
      return;
    }
    if (value.includes(url)) return setPaste('');
    onChange([...value, url].slice(0, max));
    setPaste('');
    setErrors([]);
  };

  return (
    <Stack gap="xs">
      <Text size="sm" fw={500}>
        {label}{' '}
        <Text span size="xs" c="dimmed">
          ({value.length} of {max})
        </Text>
      </Text>
      {value.length > 0 && (
        <SimpleGrid cols={{ base: 3, sm: 5 }} spacing="xs">
          {value.map((url, i) => (
            <Box key={url} pos="relative" style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--sm-border)' }}>
              <Image src={url} alt={`${label} ${i + 1}`} h={84} fit="cover" />
              <ActionIcon
                pos="absolute"
                top={4}
                right={4}
                size="sm"
                color="signal"
                variant="filled"
                aria-label={`Remove photo ${i + 1}`}
                onClick={() => onChange(value.filter((u) => u !== url))}
              >
                <IconTrash size={13} />
              </ActionIcon>
            </Box>
          ))}
        </SimpleGrid>
      )}
      {room > 0 && (
        <Dropzone onDrop={(f) => void uploadFiles(f)} accept={ACCEPT} maxSize={MAX_BYTES} multiple radius="md" p="sm"
          onReject={(r) => setErrors(r.map((x) => `${x.file.name}: only JPG, PNG or WebP up to 5 MB`))}>
          <Group justify="center" gap="sm" style={{ pointerEvents: 'none' }}>
            <IconPhotoPlus size={22} stroke={1.5} />
            <Text size="sm">{busy > 0 ? `Uploading ${busy}…` : 'Add photos (JPG, PNG or WebP, up to 5 MB)'}</Text>
          </Group>
        </Dropzone>
      )}
      {room > 0 && (
        <Group gap="xs" align="flex-end" wrap="nowrap">
          <TextInput
            style={{ flex: 1 }}
            size="xs"
            label="…or paste a photo link"
            placeholder="https://"
            value={paste}
            onChange={(e) => setPaste(e.currentTarget.value)}
          />
          <Button size="xs" variant="default" onClick={addPasted} disabled={!paste.trim()}>
            Add link
          </Button>
        </Group>
      )}
      {errors.map((e) => (
        <Text key={e} size="xs" c="signal">
          {e}
        </Text>
      ))}
    </Stack>
  );
}

export interface LatLng {
  latitude: number | null;
  longitude: number | null;
}

/** A map pin as coordinates: type them, take this device's location, or check them on OpenStreetMap. */
export function MapPinField({ value, onChange, error }: { value: LatLng; onChange: (v: LatLng) => void; error?: string | null }) {
  const [geoError, setGeoError] = useState<string | null>(null);
  const here = () => {
    setGeoError(null);
    if (!navigator.geolocation) return setGeoError('This browser cannot share its location. Type the coordinates instead.');
    navigator.geolocation.getCurrentPosition(
      (pos) => onChange({ latitude: +pos.coords.latitude.toFixed(6), longitude: +pos.coords.longitude.toFixed(6) }),
      () => setGeoError('Could not read your location. Allow location access, or type the coordinates.'),
    );
  };
  const pinned = value.latitude !== null && value.longitude !== null;
  return (
    <Stack gap={6}>
      <Group gap="xs" align="flex-end" wrap="wrap">
        <NumberInput
          label="Latitude"
          w={150}
          min={-90}
          max={90}
          decimalScale={6}
          value={value.latitude ?? ''}
          onChange={(v) => onChange({ ...value, latitude: v === '' ? null : Number(v) })}
        />
        <NumberInput
          label="Longitude"
          w={150}
          min={-180}
          max={180}
          decimalScale={6}
          value={value.longitude ?? ''}
          onChange={(v) => onChange({ ...value, longitude: v === '' ? null : Number(v) })}
        />
        <Button variant="default" leftSection={<IconCurrentLocation size={16} />} onClick={here}>
          Use my location
        </Button>
      </Group>
      {pinned && (
        <Anchor
          size="sm"
          href={`https://www.openstreetmap.org/?mlat=${value.latitude}&mlon=${value.longitude}#map=17/${value.latitude}/${value.longitude}`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
        >
          <IconMapPin size={14} aria-hidden /> Check the pin on the map
        </Anchor>
      )}
      {(error || geoError) && (
        <Text size="xs" c="signal">
          {error ?? geoError}
        </Text>
      )}
    </Stack>
  );
}

/** Both coordinates or neither (the server rejects half a pin). */
export function pinError(v: LatLng): string | null {
  if ((v.latitude === null) !== (v.longitude === null)) return 'Enter both latitude and longitude, or leave both empty.';
  return null;
}

/** The field a 400 names (`field` in the problem body), for highlighting the input. */
export function fieldOf(error: unknown): string | null {
  const field = (error as { problem?: { field?: unknown } } | null)?.problem?.field;
  return typeof field === 'string' ? field : null;
}

/** Kathmandu calendar day ("yyyy-MM-dd") — UTC+5:45, no DST. */
export function kathmanduDate(offsetDays = 0, now = Date.now()): string {
  const d = new Date(now + 345 * 60_000 + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** "Tue 21 Oct 2026" from "2026-10-21", independent of the viewer's zone. */
export function formatDay(date: string | null | undefined, withWeekday = true): string {
  if (!date || !/^\d{4}-\d{2}-\d{2}/.test(date)) return '—';
  const d = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', {
    timeZone: 'UTC',
    weekday: withWeekday ? 'short' : undefined,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
